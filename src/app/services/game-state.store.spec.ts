import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';

import { PersistedGameSnapshot, createEmptyPoints, QuizSession, StoredStateRecord } from '../models/game-state.model';
import { AchievementService } from './achievement.service';
import { GameStateStore } from './game-state.store';
import { LocationService } from './location.service';
import { QuizService } from './quiz.service';
import { StateService } from './state.service';

describe('GameStateStore', () => {
  let store: GameStateStore;
  let stateService: jasmine.SpyObj<StateService>;
  let locationService: jasmine.SpyObj<LocationService>;
  let quizService: jasmine.SpyObj<QuizService>;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    stateService = jasmine.createSpyObj<StateService>('StateService', [
      'loadSnapshot',
      'saveSnapshot',
      'resetSnapshot',
      'getLocationPrecision',
      'setLocationPrecision',
      'clearTempQuizSession',
    ]);
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getCurrentLocationAccess',
      'calculateDistanceMiles',
    ]);
    quizService = jasmine.createSpyObj<QuizService>('QuizService', ['createQuizSession']);

    stateService.saveSnapshot.and.resolveTo();
    stateService.getLocationPrecision.and.resolveTo('coarse');
    stateService.setLocationPrecision.and.resolveTo();
    stateService.clearTempQuizSession.and.resolveTo();
    locationService.getCurrentLocationAccess.and.resolveTo({
      status: 'granted',
      coordinates: { lat: 33, lng: -86 },
    });
    locationService.calculateDistanceMiles.and.returnValue(1500);

    TestBed.configureTestingModule({
      providers: [
        GameStateStore,
        AchievementService,
        { provide: StateService, useValue: stateService },
        { provide: LocationService, useValue: locationService },
        { provide: QuizService, useValue: quizService },
      ],
    });

    store = testBed.inject(GameStateStore);
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({ gameMode: 'trivia' }));
  });

  it('hydrates once and exposes derived view models', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL', { fnd: { distance: 120, stateFound: true, questionsCorrect: 2 } }),
      ],
      points: { state: 1, question: 2, distance: 1 }
    }));

    await store.hydrate();
    await store.hydrate();

    expect(stateService.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(store.homeViewModel().points.total).toBe(4);
    expect(store.dashboardViewModel().foundCount).toBe(1);
    expect(store.dashboardViewModel().totalDistanceMiles).toBe(120);
  });

  it('records a found state once and applies the distance reward', async () => {
    const states = [
      buildState(1, 'AL'),
      buildState(2, 'AK'),
      buildState(3, 'AZ'),
      buildState(4, 'AR'),
      buildState(5, 'CA'),
    ];
    const session: QuizSession = {
      stateId: 1,
      stateCode: 'AL',
      stateName: 'State AL',
      imageSrc: '/assets/stateflags/AL.svg',
      questions: [],
    };

    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states,
      points: createEmptyPoints(),
      gameMode: 'trivia',
    }));
    quizService.createQuizSession.and.returnValue(session);

    await store.hydrate();

    const result = await store.recordFoundState(1);

    expect(result).toEqual(session);
    expect(store.homeViewModel().states[0].isFound).toBeTrue();
    expect(store.homeViewModel().states[0].distanceFound).toBe(1500);
    expect(store.homeViewModel().points.total).toBe(4);
    expect(stateService.saveSnapshot).toHaveBeenCalledTimes(1);

    await store.recordFoundState(1);

    expect(store.homeViewModel().points.total).toBe(4);
    expect(stateService.saveSnapshot).toHaveBeenCalledTimes(1);
  });

  it('persists and exposes the selected location precision', async () => {
    await store.hydrate();

    expect(store.locationPrecision()).toBe('coarse');

    await store.setLocationPrecision('fine');

    expect(store.locationPrecision()).toBe('fine');
    expect(stateService.setLocationPrecision).toHaveBeenCalledWith('fine');
  });

  it('requests location at the selected precision when recording a find', async () => {
    stateService.getLocationPrecision.and.resolveTo('fine');
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [buildState(1, 'AL')],
      points: createEmptyPoints(),
      gameMode: 'classic',
    }));

    await store.hydrate();
    await store.recordFoundState(1);

    expect(locationService.getCurrentLocationAccess).toHaveBeenCalledWith('fine');
  });

  it('does not save or update a trivia find when quiz creation fails', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL'),
        buildState(2, 'AK'),
        buildState(3, 'AZ'),
        buildState(4, 'AR'),
      ],
      points: createEmptyPoints(),
      gameMode: 'trivia',
    }));
    quizService.createQuizSession.and.throwError('Unable to build quiz question for topic Bird.');

    await store.hydrate();

    await expectAsync(store.recordFoundState(1)).toBeRejectedWithError('Unable to build quiz question for topic Bird.');

    expect(stateService.saveSnapshot).not.toHaveBeenCalled();
    expect(store.homeViewModel().states[0].isFound).toBeFalse();
    expect(store.homeViewModel().points.total).toBe(0);
  });

  it('does not update in-memory progress when saving a found state fails', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL'),
        buildState(2, 'AK'),
        buildState(3, 'AZ'),
        buildState(4, 'AR'),
      ],
      points: createEmptyPoints(),
      gameMode: 'classic',
    }));
    stateService.saveSnapshot.and.rejectWith(new Error('Quota exceeded'));
    spyOn(console, 'error');

    await store.hydrate();

    await expectAsync(store.recordFoundState(1)).toBeRejectedWithError('Failed to save progress. Storage may be full.');

    expect(store.homeViewModel().states[0].isFound).toBeFalse();
    expect(store.homeViewModel().points.total).toBe(0);
    expect(store.error()).toBe('Failed to save progress. Storage may be full.');
  });

  it('ignores quiz completion for a state that is not spotted (stale session guard)', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [buildState(1, 'AL')],
      points: createEmptyPoints(),
    }));

    await store.hydrate();
    await store.completeQuiz(1, 3);

    expect(store.homeViewModel().states[0].questionsCorrect).toBe(0);
    expect(store.homeViewModel().points.total).toBe(0);
    expect(stateService.saveSnapshot).not.toHaveBeenCalled();
  });

  it('completes quiz scoring without double counting the same result', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL', {
          fnd: {
            distance: 250,
            stateFound: true,
            questionsCorrect: 0,
          },
        }),
      ],
      points: { state: 1, question: 0, distance: 1 }
    }));

    await store.hydrate();
    await store.completeQuiz(1, 2);
    await store.completeQuiz(1, 2);

    expect(store.homeViewModel().points.quiz).toBe(2);
    expect(store.homeViewModel().points.total).toBe(4);
  });

  it('resets progress back to a clean snapshot', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL', {
          fnd: {
            distance: 250,
            stateFound: true,
            questionsCorrect: 2,
          },
        }),
      ],
      points: { state: 1, question: 2, distance: 1 }
    }));
    stateService.resetSnapshot.and.resolveTo(buildSnapshot({
      states: [buildState(1, 'AL')],
      points: createEmptyPoints(),
    }));

    await store.hydrate();
    await store.resetProgress();

    expect(store.dashboardViewModel().foundCount).toBe(0);
    expect(store.homeViewModel().points.total).toBe(0);
    expect(stateService.clearTempQuizSession).toHaveBeenCalled();
  });

  it('archives the current trip when resetting progress', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL', {
          fnd: {
            distance: 250,
            stateFound: true,
            questionsCorrect: 2,
          },
        }),
      ],
      points: { state: 1, question: 2, distance: 1 },
    }));
    stateService.resetSnapshot.and.callFake(async (tripHistory) => buildSnapshot({
      states: [buildState(1, 'AL')],
      points: createEmptyPoints(),
      tripHistory,
    }));

    await store.hydrate();
    await store.resetProgress();

    expect(stateService.resetSnapshot).toHaveBeenCalledWith([
      jasmine.objectContaining({
        foundCount: 1,
        totalStates: 1,
        finalScore: 4,
        miles: 250,
        triviaCorrect: 2,
      }),
    ], false);
    expect(store.dashboardViewModel().tripHistory.length).toBe(1);
  });

  it('records a state without a distance bonus when location permission is denied', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL'),
        buildState(2, 'AK'),
        buildState(3, 'AZ'),
        buildState(4, 'AR'),
      ],
      points: createEmptyPoints(),
    }));
    locationService.getCurrentLocationAccess.and.resolveTo({
      status: 'denied',
      message: 'Location permission was denied.',
      errorCode: 'PERMISSION_DENIED'
    });

    await store.hydrate();
    await store.recordFoundState(1);

    expect(locationService.calculateDistanceMiles).not.toHaveBeenCalled();
    expect(store.homeViewModel().states[0].distanceFound).toBe(0);
    expect(store.homeViewModel().points.total).toBe(1);
    expect(store.locationError()).toBe('PERMISSION_DENIED');
  });

  it('stores a sanitized error message when distance calculation fails unexpectedly', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL'),
        buildState(2, 'AK'),
        buildState(3, 'AZ'),
        buildState(4, 'AR'),
      ],
      points: createEmptyPoints(),
    }));
    locationService.getCurrentLocationAccess.and.resolveTo({
      status: 'error',
      message: 'Distance bonus is unavailable right now.',
      errorCode: 'UNKNOWN'
    });

    await store.hydrate();
    await store.recordFoundState(1);

    expect(store.error()).toBe('Distance bonus is unavailable right now.');
    expect(store.homeViewModel().points.total).toBe(1);
  });

  it('serializes overlapping record requests so the second mutation sees the updated state', async () => {
    let releaseFirstSave!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const states = [
      buildState(1, 'AL'),
      buildState(2, 'AK'),
      buildState(3, 'AZ'),
      buildState(4, 'AR'),
    ];

    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states,
      points: createEmptyPoints()
    }));
    stateService.saveSnapshot.and.callFake(async () => firstSave);

    await store.hydrate();

    const firstRecord = store.recordFoundState(1);
    const secondRecord = store.recordFoundState(1);

    releaseFirstSave();
    await firstRecord;
    expect(stateService.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(store.homeViewModel().points.total).toBe(4);
  });

  it('persists settings changes through the canonical snapshot path', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot());

    await store.hydrate();
    await store.setGameMode('trivia');
    await store.setDifficulty('hard');

    expect(stateService.saveSnapshot).toHaveBeenCalledWith(jasmine.objectContaining({
      gameMode: 'trivia',
      difficulty: 'easy',
    }));
    expect(stateService.saveSnapshot).toHaveBeenCalledWith(jasmine.objectContaining({
      gameMode: 'trivia',
      difficulty: 'hard',
    }));
  });

  it('does not update in-memory settings when saving a setting fails', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      gameMode: 'classic',
      difficulty: 'easy',
    }));
    stateService.saveSnapshot.and.rejectWith(new Error('Quota exceeded'));
    spyOn(console, 'error');

    await store.hydrate();

    await expectAsync(store.setDifficulty('hard')).toBeRejectedWithError('Failed to save progress. Storage may be full.');

    expect(store.difficulty()).toBe('easy');
    expect(store.error()).toBe('Failed to save progress. Storage may be full.');
  });

  it('keeps summary distribution after hydrating stored per-state mode and difficulty', async () => {
    stateService.loadSnapshot.and.resolveTo(buildSnapshot({
      states: [
        buildState(1, 'AL', { fnd: { distance: 100, stateFound: true, questionsCorrect: 0, mode: 'classic' } }),
        buildState(2, 'AK', { fnd: { distance: 200, stateFound: true, questionsCorrect: 1, mode: 'trivia', difficulty: 'easy' } }),
        buildState(3, 'AZ', { fnd: { distance: 300, stateFound: true, questionsCorrect: 2, mode: 'trivia', difficulty: 'medium' } }),
        buildState(4, 'AR', { fnd: { distance: 400, stateFound: true, questionsCorrect: 3, mode: 'trivia', difficulty: 'hard' } }),
      ],
      points: { state: 4, question: 6, distance: 4 },
    }));

    await store.hydrate();

    expect(store.summaryDistribution()).toEqual({
      classicStates: 1,
      easyStates: 1,
      medStates: 1,
      hardStates: 1,
      total: 4,
    });
  });

  it('skips haptics on web platforms', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    const impactSpy = spyOn(Haptics, 'impact').and.resolveTo();

    await (store as any).triggerFoundHaptic();

    expect(impactSpy).not.toHaveBeenCalled();
  });

  it('treats haptics as best effort on native platforms', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    spyOn(Haptics, 'impact').and.rejectWith(new Error('No haptic engine'));

    await expectAsync((store as any).triggerFoundHaptic()).toBeResolved();
  });
});

function buildSnapshot(overrides: Partial<PersistedGameSnapshot> = {}): PersistedGameSnapshot {
  return {
    states: [],
    points: createEmptyPoints(),
    hasSeenOnboarding: false,
    gameMode: 'classic',
    difficulty: 'easy',
    tripHistory: [],
    ...overrides,
  };
}

function buildState(
  id: number,
  abbrv: string,
  overrides: Partial<StoredStateRecord> = {},
): StoredStateRecord {
  return {
    ID: id,
    Name: `State ${abbrv}`,
    Abbrv: abbrv,
    Lat: 0,
    Lng: -90,
    Capital: `${abbrv} Capital`,
    Bird: `${abbrv} Bird`,
    Flower: `${abbrv} Flower`,
    Nickname: `${abbrv} Nickname`,
    flagURL: `/assets/stateflags/${abbrv}.svg`,
    fnd: {
      distance: 0,
      stateFound: false,
      questionsCorrect: 0,
    },
    ...overrides,
  };
}
