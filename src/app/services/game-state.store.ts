import { computed, inject, Injectable, signal } from '@angular/core';

import {
  cloneStoredPoints,
  cloneStoredStates,
  createEmptyPoints,
  DashboardViewModel,
  DISTRICT_OF_COLUMBIA_ID,
  GameSnapshot,
  HomeViewModel,
  PointsSummary,
  QuizSession,
  StateCardViewModel,
  StoredPoints,
  StoredStateRecord,
} from '../models/game-state.model';
import { AchievementService } from './achievement.service';
import { LocationService } from './location.service';
import { QuizService } from './quiz.service';
import { StateService } from './state.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({
  providedIn: 'root'
})
export class GameStateStore {
  private readonly stateService = inject(StateService);
  private readonly achievementService = inject(AchievementService);
  private readonly locationService = inject(LocationService);
  private readonly quizService = inject(QuizService);

  private readonly states = signal<StoredStateRecord[]>([]);
  private readonly points = signal<StoredPoints>(createEmptyPoints());
  readonly isLoaded = signal(false);
  readonly isBusy = signal(false);
  readonly error = signal<string | null>(null);

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
    states: this.snapshot().states.map((state) => this.toStateCard(state)),
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
      states: snapshot.states.map((state) => this.toStateCard(state)),
      achievements: this.achievementService.getAchievements(snapshot),
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
      const [states, points] = await Promise.all([
        this.stateService.loadStates(),
        this.stateService.loadPoints(),
      ]);

      this.setSnapshot(states, points);
      this.isLoaded.set(true);
      this.error.set(null);
    });

    try {
      await this.hydratePromise;
    } finally {
      this.hydratePromise = null;
    }
  }

  async resetProgress(): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const resetSnapshot = await this.stateService.resetProgress();
      this.setSnapshot(resetSnapshot.states, resetSnapshot.points);
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
        points.distance += this.getDistanceReward(distance);
      } else if (locationResult.status === 'error') {
        this.error.set(locationResult.message);
      }

      points.state += 1;

      // Trigger premium mechanical haptic feedback
      await Haptics.impact({ style: ImpactStyle.Heavy });

      await this.persistSnapshot(states, points);
      this.setSnapshot(states, points);

      if (locationResult.status !== 'error') {
        this.error.set(null);
      }

      if (foundState.ID === DISTRICT_OF_COLUMBIA_ID) {
        return null;
      }

      return this.quizService.createQuizSession(foundState, states);
    });
  }

  async completeQuiz(stateId: number, correctAnswers: number): Promise<void> {
    await this.hydrate();

    await this.enqueueMutation(async () => {
      const states = cloneStoredStates(this.states());
      const points = cloneStoredPoints(this.points());
      const stateIndex = states.findIndex((state) => state.ID === stateId);

      if (stateIndex === -1) {
        return;
      }

      const foundState = states[stateIndex];
      const normalizedCorrectAnswers = Math.max(correctAnswers, 0);
      const delta = normalizedCorrectAnswers - foundState.fnd.questionsCorrect;

      foundState.fnd.questionsCorrect = normalizedCorrectAnswers;
      points.question += delta;

      await this.persistSnapshot(states, points);
      this.setSnapshot(states, points);
      this.error.set(null);
    });
  }

  private async persistSnapshot(states: StoredStateRecord[], points: StoredPoints): Promise<void> {
    await Promise.all([
      this.stateService.saveStates(states),
      this.stateService.savePoints(points),
    ]);
  }

  private setSnapshot(states: StoredStateRecord[], points: StoredPoints): void {
    this.states.set(cloneStoredStates(states));
    this.points.set(cloneStoredPoints(points));
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
      region: this.getRegion(state.Abbrv),
    };
  }

  private getRegion(code: string): any {
    const northeast = ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'];
    const south = ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV', 'DC'];
    const midwest = ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'];
    
    if (northeast.includes(code)) return 'northeast';
    if (south.includes(code)) return 'south';
    if (midwest.includes(code)) return 'midwest';
    return 'west'; // Default to West for AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY
  }

  private getDistanceReward(distance: number): number {
    if (distance > 0 && distance <= 500) {
      return 1;
    }

    if (distance <= 1000) {
      return 2;
    }

    if (distance <= 2000) {
      return 3;
    }

    if (distance <= 3000) {
      return 4;
    }

    if (distance > 3000) {
      return 5;
    }

    return 0;
  }

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
