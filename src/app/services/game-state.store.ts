import { computed, inject, Injectable, signal, effect } from '@angular/core';

import {
  AchievementViewModel,
  ChallengeStreak,
  createEmptyPoints,
  createEmptyStreak,
  GameSnapshot,
  getCorrectAnswersCount,
  PersistedGameSnapshot,
  QuizSession,
  QuizDifficulty,
  StateCardViewModel,
  StoredPoints,
  StoredStateRecord,
  TripHistoryEntry,
} from '../models/game-state.model';
import { AchievementService } from './achievement.service';
import { QuizService } from './quiz.service';
import { StateService } from './state.service';
import { GameViewModelService } from './game-view-model.service';
import { ImpactStyle } from '@capacitor/haptics';
import { DEFAULT_LOCATION_PRECISION, LocationPrecision } from '../models/location.model';
import { GameCommandService } from './game-command.service';
import { LocationErrorCode } from './location.service';
import { NativeUiService } from './platform/native-ui.service';
import { ClockService } from './clock.service';
import { ChallengeStreakService } from './challenge-streak.service';

export interface RecordFoundStateResult {
  quizSession: QuizSession | null;
  /** Resolves when the range bonus lands: null on success, else why it did not. */
  distanceBonus: Promise<LocationErrorCode | null>;
}

@Injectable({
  providedIn: 'root'
})
export class GameStateStore {
  private readonly stateService = inject(StateService);
  private readonly achievementService = inject(AchievementService);
  private readonly quizService = inject(QuizService);
  private readonly viewModelService = inject(GameViewModelService);
  private readonly commands = inject(GameCommandService);
  private readonly nativeUi = inject(NativeUiService);
  private readonly clock = inject(ClockService);
  private readonly streaks = inject(ChallengeStreakService);

  private readonly states = signal<StoredStateRecord[]>([]);
  private readonly points = signal<StoredPoints>(createEmptyPoints());
  readonly isLoaded = signal(false);
  readonly isBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly locationError = signal<'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN' | null>(null);
  readonly difficulty = signal<QuizDifficulty>('easy');
  readonly gameMode = signal<'classic' | 'trivia'>('classic');
  readonly hasSeenOnboarding = signal(false);
  readonly tripHistory = signal<TripHistoryEntry[]>([]);
  readonly locationPrecision = signal<LocationPrecision>(DEFAULT_LOCATION_PRECISION);
  private readonly storedStreak = signal<ChallengeStreak>(createEmptyStreak());

  /**
   * The streak as it reads today (audit F-11). Derived rather than stored so a
   * streak that lapsed while the app was closed shows as 0 without anyone
   * having to rewrite history at start-up.
   */
  readonly challengeStreak = computed(() => this.streaks.asOf(this.storedStreak(), this.clock.today()));
  readonly challengesCompletedToday = computed(
    () => this.streaks.isCompletedToday(this.storedStreak(), this.clock.today()),
  );


  /**
   * Refactor: Achievements evaluation is heavy. Extracting this to its own computed
   * signal ensures it only recalculates when specific achievement-triggering 
   * criteria (like total miles or total states) hit specific thresholds, 
   * rather than on every minor point addition in the dashboard view model.
   */
  readonly achievements = computed(() => {
    return this.achievementService.getAchievements(this.snapshot());
  });

  /**
   * Narrow signal side-effects: By using a specific computed signal for foundCount,
   * the hapticTrigger effect only re-runs when the count of discovered states 
   * actually changes, rather than on every state snapshot update (like miles or points).
   */
  readonly foundCount = computed(() => this.snapshot().foundCount);

  private hapticsInitialized = false;
  private lastFoundCount = 0;
  private readonly hapticTrigger = effect(() => {
    const foundCount = this.foundCount();
    const isLoaded = this.isLoaded();

    if (isLoaded) {
      if (this.hapticsInitialized && foundCount > this.lastFoundCount) {
        void this.triggerFoundHaptic();
      }
      this.lastFoundCount = foundCount;
      this.hapticsInitialized = true;
    }
  });

  /**
   * The most recently unlocked achievement, or null once acknowledged.
   * Achievements used to unlock in total silence (audit F-12) — nothing marked
   * the moment, so the only way to discover one was to visit the Goals tab
   * later and notice a badge had changed.
   */
  readonly justUnlocked = signal<AchievementViewModel | null>(null);

  private unlockBaselineTaken = false;
  private previouslyUnlocked = new Set<string>();
  /**
   * A genuine side effect rather than a computed: it announces a transition,
   * and the first evaluation after load must establish a baseline instead of
   * firing for every achievement the player already had.
   */
  private readonly unlockTrigger = effect(() => {
    if (!this.isLoaded()) return;
    const unlocked = this.achievements().filter((achievement) => achievement.unlocked);

    if (!this.unlockBaselineTaken) {
      this.previouslyUnlocked = new Set(unlocked.map((achievement) => achievement.id));
      this.unlockBaselineTaken = true;
      return;
    }

    const fresh = unlocked.find((achievement) => !this.previouslyUnlocked.has(achievement.id));
    this.previouslyUnlocked = new Set(unlocked.map((achievement) => achievement.id));
    if (fresh) this.justUnlocked.set(fresh);
  });

  /** Called once the unlock has been shown, so the same one is not re-announced. */
  acknowledgeUnlock(): void {
    this.justUnlocked.set(null);
  }

  /**
   * Banks the day's streak the moment all three challenges are done (audit
   * F-11). An effect rather than a computed because it persists — and it is
   * cheap: `advance` returns the same object unless something actually changed,
   * so the guard below stops it writing on every snapshot update.
   */
  private readonly streakTrigger = effect(() => {
    if (!this.isLoaded()) return;

    const next = this.streaks.advance(this.storedStreak(), this.rotatingChallenges(), this.clock.today());
    if (next !== this.storedStreak()) void this.commitStreak(next);
  });

  private async commitStreak(streak: ChallengeStreak): Promise<void> {
    try {
      await this.enqueueMutation(async () => {
        this.storedStreak.set(streak);
        await this.persistCurrentSnapshot('your challenge streak');
      });
    } catch {
      // A streak is a nicety; failing to store it must not surface as an error
      // over the trip itself, which is already saved.
    }
  }

  private hydratePromise: Promise<void> | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private busyDepth = 0;

  readonly snapshot = computed<GameSnapshot>(() => {
    const states = this.states();
    const points = this.points();
    const foundStates = states.filter((state) => state.fnd.stateFound);
    const totalCorrect = foundStates.reduce((total, state) => {
      const isTrivia = state.fnd.mode === 'trivia' || (state.fnd.mode !== 'classic' && state.fnd.questionsCorrect > 0);
      const count = isTrivia ? getCorrectAnswersCount(state.fnd.questionsCorrect, state.fnd.difficulty) : 0;
      return total + count;
    }, 0);
    const totalDistanceMiles = foundStates.reduce((total, state) => total + state.fnd.distance, 0);

    return {
      states,
      points,
      foundCount: foundStates.length,
      totalCorrect,
      totalDistanceMiles,
    };
  });

  readonly homeViewModel = computed(() => this.viewModelService.buildHomeViewModel(
    this.snapshot(),
    this.stateCards(),
    this.isLoaded(),
    this.isBusy(),
    this.error(),
  ));

  readonly dashboardViewModel = computed(() => {
    const snapshot = this.snapshot();

    return this.viewModelService.buildDashboardViewModel(
      snapshot,
      this.stateCards(),
      this.achievements(),
      this.tripHistory(),
    );
  });

  readonly rankedFoundStates = computed<StateCardViewModel[]>(() => {
    return this.viewModelService.rankFoundStates(this.stateCards());
  });

  readonly dashboardSouvenirFlags = computed(() => this.rankedFoundStates().slice(0, 3));
  readonly goalsSouvenirFlags = computed(() => this.viewModelService.toSouvenirFlags(this.rankedFoundStates(), 5));
  readonly goalProgress = computed(() => this.achievementService.getGoalProgress(this.snapshot()));
  readonly rotatingChallenges = computed(() => this.achievementService.getRotatingChallenges(this.snapshot(), this.clock.today()));
  readonly goalsSummary = computed(() => this.viewModelService.buildGoalsSummary(this.goalProgress()));
  readonly tripComparison = computed(() => this.viewModelService.buildTripComparison(this.snapshot(), this.tripHistory()));
  readonly summaryViewModel = computed(() => {
    const snapshot = this.snapshot();
    const distribution = this.summaryDistribution();

    return this.viewModelService.buildSummaryViewModel(snapshot, distribution);
  });
  readonly triviaViewModel = computed(() => this.viewModelService.buildTriviaViewModel(
    this.snapshot(),
    this.rankedFoundStates(),
    this.quizService.getTriviaTopics(),
  ));
  readonly summaryDistribution = computed(() => this.viewModelService.buildSummaryDistribution(this.snapshot()));

  async hydrate(): Promise<void> {
    if (this.isLoaded()) {
      return;
    }

    if (this.hydratePromise) {
      return this.hydratePromise;
    }

    this.hydratePromise = this.runBusy(async () => {
      const [snapshot, locationPrecision] = await Promise.all([
        this.stateService.loadSnapshot(),
        this.stateService.getLocationPrecision(),
      ]);

      this.setSnapshot(snapshot.states, snapshot.points);
      this.hasSeenOnboarding.set(snapshot.hasSeenOnboarding);
      this.gameMode.set(snapshot.gameMode);
      this.difficulty.set(snapshot.difficulty);
      this.tripHistory.set(snapshot.tripHistory);
      this.storedStreak.set(snapshot.challengeStreak ?? createEmptyStreak());
      this.locationPrecision.set(locationPrecision);

      this.isLoaded.set(true);
      this.error.set(null);
    });

    try {
      await this.hydratePromise;
    } finally {
      this.hydratePromise = null;
    }
  }

  async markOnboardingComplete(): Promise<void> {
    await this.enqueueMutation(async () => {
      await this.persistCurrentSnapshot('the handbook', { hasSeenOnboarding: true });
      this.hasSeenOnboarding.set(true);
    });
  }

  async setDifficulty(level: QuizDifficulty): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      await this.persistCurrentSnapshot('your difficulty setting', { difficulty: level });
      this.difficulty.set(level);
    });
  }

  async setGameMode(mode: 'classic' | 'trivia'): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      await this.persistCurrentSnapshot('your mode setting', { gameMode: mode });
      this.gameMode.set(mode);
    });
  }

  async setLocationPrecision(precision: LocationPrecision): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      await this.stateService.setLocationPrecision(precision);
      this.locationPrecision.set(precision);
    });
  }


  async resetProgress(): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const tripHistory = this.withArchivedCurrentTrip(this.tripHistory());
      // A quiz saved mid-flight belongs to the old trip; resuming it against
      // the fresh save would award trivia points to an unspotted state.
      //
      // Cleared BEFORE the save is rebuilt, and the order is the whole point.
      // These are two separate Preferences writes and cannot be made one: the
      // plugin exposes no transaction, and each call is its own
      // `edit()`/`apply()` on the native side. So a window between them is
      // unavoidable and the only choice is which pairing it leaves on disk.
      //
      // Clearing first leaves `old save + no session` — a consistent trip that
      // has merely lost an in-flight quiz. The other order leaves
      // `fresh save + old session`, which is pm-0001's exact hazard sitting on
      // disk for an Android backup to snapshot (pm-0002). The same asymmetry
      // covers a partial failure: if the second write throws, this order has
      // dropped an ephemeral quiz, and the other has stranded a stale one
      // against a reset trip.
      //
      // checkAndResumeQuiz refuses a mismatched pair regardless. This keeps the
      // mismatch from being written down in the first place.
      await this.stateService.clearTempQuizSession();
      const resetSnapshot = await this.stateService.resetSnapshot(tripHistory, this.hasSeenOnboarding(), this.storedStreak());
      this.setSnapshot(resetSnapshot.states, resetSnapshot.points);
      this.hasSeenOnboarding.set(resetSnapshot.hasSeenOnboarding);
      this.gameMode.set(resetSnapshot.gameMode);
      this.difficulty.set(resetSnapshot.difficulty);
      this.tripHistory.set(resetSnapshot.tripHistory);
      this.storedStreak.set(resetSnapshot.challengeStreak ?? createEmptyStreak());
      this.error.set(null);
    });
  }

  /**
   * Logs the plate immediately and returns straight away (audit F-06). The
   * range bonus needs a GPS fix that can take up to ten seconds, and waiting
   * for it inside the mutation meant `isBusy` disabled the whole UI for that
   * long after a single tap. `distanceBonus` resolves later with whatever went
   * wrong, or null when the bonus was applied.
   */
  async recordFoundState(stateId: number): Promise<RecordFoundStateResult | null> {
    await this.hydrate();

    const outcome = await this.enqueueMutation(async () => {
      const result = this.commands.recordFoundState(
        this.states(),
        this.points(),
        stateId,
        this.gameMode(),
        this.difficulty(),
      );
      if (!result) return null;

      await this.persistSnapshot(result.states, result.points, 'that plate');
      this.setSnapshot(result.states, result.points);
      this.error.set(null);
      this.locationError.set(null);
      return { quizSession: result.quizSession };
    });

    if (!outcome) return null;

    return {
      quizSession: outcome.quizSession,
      distanceBonus: this.resolveDistanceBonus(stateId),
    };
  }

  /** Removes a spot and every point earned from it (audit F-04). */
  async unspotState(stateId: number): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const result = this.commands.unspotState(this.states(), this.points(), stateId);
      if (!result) return;
      await this.persistSnapshot(result.states, result.points, 'that removal');
      this.setSnapshot(result.states, result.points);
      this.error.set(null);
    });
  }

  /**
   * Runs entirely outside the mutation queue until it has an answer, so the
   * slow part never blocks the player. Only the tiny apply step is queued.
   */
  private async resolveDistanceBonus(stateId: number): Promise<LocationErrorCode | null> {
    try {
      const location = await this.commands.readLocation(this.locationPrecision());

      if (location.status !== 'granted') {
        this.locationError.set(location.errorCode);
        return location.errorCode;
      }

      await this.enqueueMutation(async () => {
        const result = this.commands.applyDistance(this.states(), this.points(), stateId, location.coordinates);
        if (!result) return;
        await this.persistSnapshot(result.states, result.points, 'the range bonus');
        this.setSnapshot(result.states, result.points);
      });

      this.locationError.set(null);
      return null;
    } catch {
      // A failed bonus must never surface as a failed spot — the plate is
      // already logged and saved by the time this runs.
      this.locationError.set('UNKNOWN');
      return 'UNKNOWN';
    }
  }


  async completeQuiz(stateId: number, earnedPoints: number): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const result = this.commands.completeQuiz(this.states(), this.points(), stateId, earnedPoints);
      if (!result) return;
      await this.persistSnapshot(result.states, result.points, 'your quiz answers');
      this.setSnapshot(result.states, result.points);
      this.error.set(null);
    });
  }

  private async persistSnapshot(
    states: StoredStateRecord[],
    points: StoredPoints,
    action: string,
    overrides: Partial<Pick<PersistedGameSnapshot, 'hasSeenOnboarding' | 'gameMode' | 'difficulty' | 'tripHistory'>> = {},
  ): Promise<void> {
    const snapshot: PersistedGameSnapshot = {
      states,
      points,
      hasSeenOnboarding: this.hasSeenOnboarding(),
      gameMode: this.gameMode(),
      difficulty: this.difficulty(),
      tripHistory: this.tripHistory(),
      challengeStreak: this.storedStreak(),
      ...overrides,
    };

    await this.persistGameSnapshot(snapshot, action);
  }

  /**
   * The message names the action that failed (audit F-19). Persisting happens
   * before the in-memory update, so a storage failure means the change the
   * player just made did not happen — "Failed to save progress" left them
   * guessing which one.
   */
  private async persistGameSnapshot(snapshot: PersistedGameSnapshot, action: string): Promise<void> {
    try {
      await this.stateService.saveSnapshot(snapshot);
    } catch (err) {
      console.error(`Failed to persist game state while saving ${action}:`, err);
      const message = `Couldn't save ${action}. Your device storage may be full — free some space and try again.`;
      this.error.set(message);
      throw new Error(message);
    }
  }

  private async persistCurrentSnapshot(
    action: string,
    overrides: Partial<Pick<PersistedGameSnapshot, 'hasSeenOnboarding' | 'gameMode' | 'difficulty' | 'tripHistory'>> = {},
  ): Promise<void> {
    await this.persistSnapshot(this.states(), this.points(), action, overrides);
  }

  private setSnapshot(states: StoredStateRecord[], points: StoredPoints): void {
    // Redundant clones removed: Callers (recordFoundState/completeQuiz) are responsible 
    // for providing fresh objects, and signals handle the reference change detection.
    this.states.set(states);
    this.points.set(points);
  }

  private async triggerFoundHaptic(): Promise<void> {
    await this.nativeUi.impact(ImpactStyle.Heavy);
  }

  clearError(): void {
    this.error.set(null);
  }

  async retryHydrate(): Promise<void> {
    this.isLoaded.set(false);
    await this.hydrate();
  }

  private withArchivedCurrentTrip(history: TripHistoryEntry[]): TripHistoryEntry[] {
    const snapshot = this.snapshot();

    if (snapshot.foundCount === 0) {
      return history;
    }

    const entry: TripHistoryEntry = {
      id: `${Date.now()}`,
      completedAt: new Date().toISOString(),
      foundCount: snapshot.foundCount,
      totalStates: snapshot.states.length,
      finalScore: snapshot.points.state + snapshot.points.question + snapshot.points.distance,
      miles: snapshot.totalDistanceMiles,
      triviaCorrect: snapshot.totalCorrect,
    };

    return [entry, ...history].slice(0, 10);
  }

  private readonly stateCards = computed<StateCardViewModel[]>(() => this.viewModelService.toStateCards(this.snapshot().states));


  private async runBusy<T>(operation: () => Promise<T>): Promise<T> {
    this.beginBusy();

    try {
      return await operation();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unknown game state error.');
      throw error;
    } finally {
      this.endBusy();
    }
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.mutationQueue.catch(() => undefined).then(async () => {
      this.beginBusy();

      try {
        return await operation();
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'Unknown game state error.');
        throw error;
      } finally {
        this.endBusy();
      }
    });

    this.mutationQueue = nextOperation.then(() => undefined, () => undefined);

    return nextOperation;
  }

  private beginBusy(): void {
    this.busyDepth += 1;
    this.isBusy.set(true);
  }

  private endBusy(): void {
    this.busyDepth = Math.max(this.busyDepth - 1, 0);

    if (this.busyDepth === 0) {
      this.isBusy.set(false);
    }
  }
}
