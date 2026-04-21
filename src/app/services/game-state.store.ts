import { computed, inject, Injectable, signal, effect } from '@angular/core';

import {
  cloneStoredPoints,
  cloneStoredStates,
  createEmptyPoints,
  DashboardViewModel,
  DISTRICT_OF_COLUMBIA_ID,
  GameSnapshot,
  GoalsSummaryViewModel,
  GoalProgressViewModel,
  HomeViewModel,
  PointsSummary,
  QuizSession,
  QuizDifficulty,
  SouvenirFlagViewModel,
  StateCardViewModel,
  StoredPoints,
  StoredStateRecord,
  SummaryDistribution,
  SummaryViewModel,
  TriviaTopicCard,
  TriviaViewModel,
  QUIZ_QUESTION_COUNT,
} from '../models/game-state.model';
import { AchievementService } from './achievement.service';
import { LocationService } from './location.service';
import { QuizService } from './quiz.service';
import { StateService } from './state.service';
import { RewardService } from './reward.service';
import { getStateRegion } from '../constants/us-states';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({
  providedIn: 'root'
})
export class GameStateStore {
  private readonly quizTopics: TriviaTopicCard[] = [
    { title: 'Bird', subtitle: 'Identify each state bird from the road atlas.' },
    { title: 'Capital', subtitle: 'Match the plate to its capital city.' },
    { title: 'Flower', subtitle: 'Remember the bloom on each state seal.' },
    { title: 'Nickname', subtitle: 'Decode the nickname painted on the roadside sign.' },
    { title: 'Abbreviation', subtitle: 'Recognize the two-letter postal code.' },
    { title: 'Region', subtitle: 'Pinpoint the geographical region of the state.' },
    { title: 'AdmissionYear', subtitle: 'Know when the state joined the union.' },
    { title: 'LargestCity', subtitle: 'Find the most populous city in the state.' },
    { title: 'Tree', subtitle: 'Identify the official state tree.' },
    { title: 'Flag', subtitle: 'Pick the correct state flag.' },
  ];
  private readonly stateService = inject(StateService);
  private readonly achievementService = inject(AchievementService);
  private readonly locationService = inject(LocationService);
  private readonly quizService = inject(QuizService);
  private readonly rewardService = inject(RewardService);

  private readonly states = signal<StoredStateRecord[]>([]);
  private readonly points = signal<StoredPoints>(createEmptyPoints());
  readonly isLoaded = signal(false);
  readonly isBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly locationError = signal<'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN' | null>(null);
  readonly difficulty = signal<QuizDifficulty>('easy');
  readonly gameMode = signal<'classic' | 'trivia'>('classic');
  readonly hasSeenOnboarding = signal(false);


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

  private lastFoundCount = 0;
  private readonly hapticTrigger = effect(() => {
    const foundCount = this.foundCount();
    // Only buzz if the count actually increased after initial load
    if (this.isLoaded() && foundCount > this.lastFoundCount) {
      void Haptics.impact({ style: ImpactStyle.Heavy });
    }
    this.lastFoundCount = foundCount;
  });

  private hydratePromise: Promise<void> | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private busyDepth = 0;

  readonly snapshot = computed<GameSnapshot>(() => {
    const states = this.states();
    const points = this.points();
    const foundStates = states.filter((state) => state.fnd.stateFound);
    const totalCorrect = foundStates.reduce((total, state) => total + state.fnd.questionsCorrect, 0);
    const totalDistanceMiles = foundStates.reduce((total, state) => total + state.fnd.distance, 0);

    return {
      states,
      points,
      foundCount: foundStates.length,
      totalCorrect,
      totalDistanceMiles,
    };
  });

  readonly homeViewModel = computed<HomeViewModel>(() => ({
    points: this.toPointsSummary(this.snapshot()),
    states: this.stateCards(),
    isLoaded: this.isLoaded(),
    isBusy: this.isBusy(),
  }));

  readonly dashboardViewModel = computed<DashboardViewModel>(() => {
    const snapshot = this.snapshot();

    return {
      points: this.toPointsSummary(snapshot),
      foundCount: snapshot.foundCount,
      totalStates: snapshot.states.length,
      totalCorrect: snapshot.totalCorrect,
      totalDistanceMiles: snapshot.totalDistanceMiles,
      states: this.stateCards(),
      achievements: this.achievements(),
    };
  });

  readonly rankedFoundStates = computed<StateCardViewModel[]>(() => {
    return this.stateCards()
      .filter((state) => state.isFound)
      .sort((left, right) => right.questionsCorrect - left.questionsCorrect
        || right.distanceFound - left.distanceFound
        || left.name.localeCompare(right.name));
  });

  readonly dashboardSouvenirFlags = computed(() => this.rankedFoundStates().slice(0, 3));
  readonly goalsSouvenirFlags = computed<SouvenirFlagViewModel[]>(() => this.rankedFoundStates()
    .slice(0, 5)
    .map((state) => ({
      code: state.code,
      name: state.name,
      flagUrl: state.flagUrl,
    })));
  readonly goalProgress = computed<GoalProgressViewModel[]>(() => this.achievementService.getGoalProgress(this.snapshot()));
  readonly goalsSummary = computed<GoalsSummaryViewModel>(() => {
    const goals = this.goalProgress();

    return {
      total: goals.length,
      unlocked: goals.filter((goal) => goal.unlocked).length,
      inProgress: goals.filter((goal) => !goal.unlocked && goal.currentValue > 0).length,
      nextGoal: goals.find((goal) => !goal.unlocked) ?? null,
    };
  });
  readonly summaryViewModel = computed<SummaryViewModel>(() => {
    const snapshot = this.snapshot();
    const distribution = this.summaryDistribution();

    return {
      foundCount: snapshot.foundCount,
      totalStates: snapshot.states.length,
      finalScore: this.toPointsSummary(snapshot).total,
      miles: snapshot.totalDistanceMiles,
      distribution,
    };
  });
  readonly triviaViewModel = computed<TriviaViewModel>(() => {
    const rankedFoundStates = this.rankedFoundStates();
    const snapshot = this.snapshot();
    const totalPossibleAnswers = rankedFoundStates.length * QUIZ_QUESTION_COUNT;
    const accuracy = totalPossibleAnswers === 0
      ? 0
      : Math.round((snapshot.totalCorrect / totalPossibleAnswers) * 100);

    return {
      accuracy,
      correctAnswers: snapshot.totalCorrect,
      foundStates: snapshot.foundCount,
      perfectPasses: rankedFoundStates.filter((state) => state.questionsCorrect >= QUIZ_QUESTION_COUNT).length,
      totalPossibleAnswers,
      topStates: rankedFoundStates.slice(0, 6),
      featuredStates: rankedFoundStates.slice(0, 3),
      topics: this.quizTopics,
    };
  });
  readonly summaryDistribution = computed<SummaryDistribution>(() => {
    const foundStates = this.snapshot().states.filter((state) => state.fnd.stateFound);

    return {
      classicStates: foundStates.filter((state) => state.fnd.mode === 'classic').length,
      easyStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'easy').length,
      medStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'medium').length,
      hardStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'hard').length,
      total: foundStates.length,
    };
  });

  async hydrate(force = false): Promise<void> {
    if (!force && this.isLoaded()) {
      return;
    }

    if (!force && this.hydratePromise) {
      return this.hydratePromise;
    }

    this.hydratePromise = this.runBusy(async () => {
      const snapshot = await this.stateService.loadSnapshot();

      this.setSnapshot(snapshot.states, snapshot.points);
      this.hasSeenOnboarding.set(snapshot.hasSeenOnboarding);
      this.gameMode.set(snapshot.gameMode);
      this.difficulty.set(snapshot.difficulty);

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
      this.hasSeenOnboarding.set(true);
      await this.persistCurrentSnapshot();
    });
  }

  async setDifficulty(level: QuizDifficulty): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      this.difficulty.set(level);
      await this.persistCurrentSnapshot();
    });
  }

  async setGameMode(mode: 'classic' | 'trivia'): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      this.gameMode.set(mode);
      await this.persistCurrentSnapshot();
    });
  }


  async resetProgress(): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const resetSnapshot = await this.stateService.resetSnapshot();
      this.setSnapshot(resetSnapshot.states, resetSnapshot.points);
      this.hasSeenOnboarding.set(resetSnapshot.hasSeenOnboarding);
      this.gameMode.set(resetSnapshot.gameMode);
      this.difficulty.set(resetSnapshot.difficulty);
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

      const locationResult = await this.locationService.getCurrentLocationAccess();

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
      
      await this.persistSnapshot(states, points);
      this.setSnapshot(states, points);

      if (locationResult.status !== 'error') {
        this.error.set(null);
        this.locationError.set(null);
      }

      if (foundState.ID === DISTRICT_OF_COLUMBIA_ID || this.gameMode() === 'classic') {
        return null; // Bypass quiz modal for DC or Classic Mode
      }

      return this.quizService.createQuizSession(foundState, states, this.difficulty());
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

  private async persistSnapshot(states: StoredStateRecord[], points: StoredPoints): Promise<void> {
    try {
      await this.stateService.saveSnapshot({
        states,
        points,
        hasSeenOnboarding: this.hasSeenOnboarding(),
        gameMode: this.gameMode(),
        difficulty: this.difficulty(),
      });
    } catch (err) {
      console.error('Failed to persist game state:', err);
      this.error.set('Failed to save progress. Storage may be full.');
    }
  }

  private async persistCurrentSnapshot(): Promise<void> {
    await this.persistSnapshot(this.states(), this.points());
  }

  private setSnapshot(states: StoredStateRecord[], points: StoredPoints): void {
    // Redundant clones removed: Callers (recordFoundState/completeQuiz) are responsible 
    // for providing fresh objects, and signals handle the reference change detection.
    this.states.set(states);
    this.points.set(points);
  }

  private toPointsSummary(snapshot: GameSnapshot): PointsSummary {
    return {
      ...snapshot.points,
      states: snapshot.points.state,
      quiz: snapshot.points.question,
      total: snapshot.points.state + snapshot.points.question + snapshot.points.distance,
      miles: snapshot.totalDistanceMiles,
    };
  }

  private toStateCard(state: StoredStateRecord): StateCardViewModel {
    return {
      id: state.ID,
      code: state.Abbrv,
      name: state.Name,
      isFound: state.fnd.stateFound,
      distanceFound: state.fnd.distance,
      questionsCorrect: state.fnd.questionsCorrect,
      flagUrl: state.flagURL,
      region: getStateRegion(state.Abbrv),
    };
  }

  private readonly stateCards = computed<StateCardViewModel[]>(() => this.snapshot().states.map((state) => this.toStateCard(state)));


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
