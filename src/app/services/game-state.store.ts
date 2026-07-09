import { computed, inject, Injectable, signal, effect } from '@angular/core';

import {
  cloneStoredPoints,
  cloneStoredStates,
  createEmptyPoints,
  DISTRICT_OF_COLUMBIA_ID,
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
import { LocationService } from './location.service';
import { QuizService } from './quiz.service';
import { StateService } from './state.service';
import { RewardService } from './reward.service';
import { GameViewModelService } from './game-view-model.service';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { DEFAULT_LOCATION_PRECISION, LocationPrecision } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class GameStateStore {
  private readonly stateService = inject(StateService);
  private readonly achievementService = inject(AchievementService);
  private readonly locationService = inject(LocationService);
  private readonly quizService = inject(QuizService);
  private readonly rewardService = inject(RewardService);
  private readonly viewModelService = inject(GameViewModelService);

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
  readonly rotatingChallenges = computed(() => this.achievementService.getRotatingChallenges(this.snapshot()));
  readonly goalsSummary = computed(() => this.viewModelService.buildGoalsSummary(this.goalProgress()));
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

  async hydrate(force = false): Promise<void> {
    if (!force && this.isLoaded()) {
      return;
    }

    if (!force && this.hydratePromise) {
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
      await this.persistCurrentSnapshot({ hasSeenOnboarding: true });
      this.hasSeenOnboarding.set(true);
    });
  }

  async setDifficulty(level: QuizDifficulty): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      await this.persistCurrentSnapshot({ difficulty: level });
      this.difficulty.set(level);
    });
  }

  async setGameMode(mode: 'classic' | 'trivia'): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      await this.persistCurrentSnapshot({ gameMode: mode });
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
      const resetSnapshot = await this.stateService.resetSnapshot(tripHistory, this.hasSeenOnboarding());
      this.setSnapshot(resetSnapshot.states, resetSnapshot.points);
      this.hasSeenOnboarding.set(resetSnapshot.hasSeenOnboarding);
      this.gameMode.set(resetSnapshot.gameMode);
      this.difficulty.set(resetSnapshot.difficulty);
      this.tripHistory.set(resetSnapshot.tripHistory);
      this.error.set(null);
    });
  }

  async recordFoundState(stateId: number): Promise<QuizSession | null> {
    await this.hydrate();

    return this.enqueueMutation(async () => {
      const states = cloneStoredStates(this.states());
      const points = cloneStoredPoints(this.points());
      const stateIndex = states.findIndex((state) => state.ID === stateId);

      if (stateIndex === -1) {
        return null;
      }

      const foundState = states[stateIndex];

      if (foundState.fnd.stateFound) {
        return null;
      }

      foundState.fnd.stateFound = true;
      foundState.fnd.mode = this.gameMode();
      foundState.fnd.difficulty = this.difficulty();
      foundState.fnd.questionsCorrect = 0;
      foundState.fnd.distance = 0;

      const locationResult = await this.locationService.getCurrentLocationAccess(this.locationPrecision());

      if (locationResult.status === 'granted') {
        const distance = Math.round(
          this.locationService.calculateDistanceMiles(
            { lat: foundState.Lat, lng: foundState.Lng },
            locationResult.coordinates,
          ),
        );

        foundState.fnd.distance = distance;
        points.distance += this.rewardService.getDistanceReward(distance);
      } else {
        this.error.set(locationResult.message);
        this.locationError.set(locationResult.errorCode);
      }

      points.state += this.rewardService.getStateDiscoveryReward();

      const quizSession = foundState.ID === DISTRICT_OF_COLUMBIA_ID || this.gameMode() === 'classic'
        ? null
        : this.quizService.createQuizSession(foundState, states, this.difficulty());
      
      await this.persistSnapshot(states, points);
      this.setSnapshot(states, points);

      if (locationResult.status === 'granted') {
        this.error.set(null);
        this.locationError.set(null);
      }

      return quizSession;
    });
  }


  async completeQuiz(stateId: number, earnedPoints: number): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const states = cloneStoredStates(this.states());
      const points = cloneStoredPoints(this.points());
      const stateIndex = states.findIndex((state) => state.ID === stateId);

      if (stateIndex === -1) {
        return;
      }

      const foundState = states[stateIndex];
      const normalizedPoints = Math.max(earnedPoints, 0);
      const delta = normalizedPoints - foundState.fnd.questionsCorrect;

      foundState.fnd.questionsCorrect = normalizedPoints;
      points.question += delta;

      await this.persistSnapshot(states, points);
      this.setSnapshot(states, points);
      this.error.set(null);
    });
  }

  private async persistSnapshot(
    states: StoredStateRecord[],
    points: StoredPoints,
    overrides: Partial<Pick<PersistedGameSnapshot, 'hasSeenOnboarding' | 'gameMode' | 'difficulty' | 'tripHistory'>> = {},
  ): Promise<void> {
    const snapshot: PersistedGameSnapshot = {
      states,
      points,
      hasSeenOnboarding: this.hasSeenOnboarding(),
      gameMode: this.gameMode(),
      difficulty: this.difficulty(),
      tripHistory: this.tripHistory(),
      ...overrides,
    };

    await this.persistGameSnapshot(snapshot);
  }

  private async persistGameSnapshot(snapshot: PersistedGameSnapshot): Promise<void> {
    try {
      await this.stateService.saveSnapshot(snapshot);
    } catch (err) {
      console.error('Failed to persist game state:', err);
      const message = 'Failed to save progress. Storage may be full.';
      this.error.set(message);
      throw new Error(message);
    }
  }

  private async persistCurrentSnapshot(
    overrides: Partial<Pick<PersistedGameSnapshot, 'hasSeenOnboarding' | 'gameMode' | 'difficulty' | 'tripHistory'>> = {},
  ): Promise<void> {
    await this.persistSnapshot(this.states(), this.points(), overrides);
  }

  private setSnapshot(states: StoredStateRecord[], points: StoredPoints): void {
    // Redundant clones removed: Callers (recordFoundState/completeQuiz) are responsible 
    // for providing fresh objects, and signals handle the reference change detection.
    this.states.set(states);
    this.points.set(points);
  }

  private async triggerFoundHaptic(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Haptics are a best-effort flourish; unsupported devices should keep playing.
    }
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
