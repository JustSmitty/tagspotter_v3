import { TestBed } from '@angular/core/testing';

import { createEmptyPoints, QuizSession, StoredStateRecord } from '../models/game-state.model';
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
      'loadStates',
      'loadPoints',
      'saveStates',
      'savePoints',
      'resetProgress',
    ]);
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getCurrentLocationAccess',
      'calculateDistanceMiles',
    ]);
    quizService = jasmine.createSpyObj<QuizService>('QuizService', ['createQuizSession']);

    stateService.saveStates.and.resolveTo();
    stateService.savePoints.and.resolveTo();
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
  });

  it('hydrates once and exposes derived view models', async () => {
    stateService.loadStates.and.resolveTo([
      buildState(1, 'AL', { fnd: { distance: 120, stateFound: true, questionsCorrect: 2 } }),
    ]);
    stateService.loadPoints.and.resolveTo({ state: 1, question: 2, distance: 1 });

    await store.hydrate();
    await store.hydrate();

    expect(stateService.loadStates).toHaveBeenCalledTimes(1);
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

    stateService.loadStates.and.resolveTo(states);
    stateService.loadPoints.and.resolveTo(createEmptyPoints());
    quizService.createQuizSession.and.returnValue(session);

    await store.hydrate();

    const result = await store.recordFoundState(1);

    expect(result).toEqual(session);
    expect(store.homeViewModel().states[0].isFound).toBeTrue();
    expect(store.homeViewModel().states[0].distanceFound).toBe(1500);
    expect(store.homeViewModel().points.total).toBe(4);
    expect(stateService.saveStates).toHaveBeenCalledTimes(1);
    expect(stateService.savePoints).toHaveBeenCalledTimes(1);

    await store.recordFoundState(1);

    expect(store.homeViewModel().points.total).toBe(4);
    expect(stateService.saveStates).toHaveBeenCalledTimes(1);
    expect(stateService.savePoints).toHaveBeenCalledTimes(1);
  });

  it('completes quiz scoring without double counting the same result', async () => {
    stateService.loadStates.and.resolveTo([
      buildState(1, 'AL', {
        fnd: {
          distance: 250,
          stateFound: true,
          questionsCorrect: 0,
        },
      }),
    ]);
    stateService.loadPoints.and.resolveTo({ state: 1, question: 0, distance: 1 });

    await store.hydrate();
    await store.completeQuiz(1, 2);
    await store.completeQuiz(1, 2);

    expect(store.homeViewModel().points.quiz).toBe(2);
    expect(store.homeViewModel().points.total).toBe(4);
  });

  it('resets progress back to a clean snapshot', async () => {
    stateService.loadStates.and.resolveTo([
      buildState(1, 'AL', {
        fnd: {
          distance: 250,
          stateFound: true,
          questionsCorrect: 2,
        },
      }),
    ]);
    stateService.loadPoints.and.resolveTo({ state: 1, question: 2, distance: 1 });
    stateService.resetProgress.and.resolveTo({
      states: [buildState(1, 'AL')],
      points: createEmptyPoints(),
    });

    await store.hydrate();
    await store.resetProgress();

    expect(store.dashboardViewModel().foundCount).toBe(0);
    expect(store.homeViewModel().points.total).toBe(0);
  });

  it('records a state without a distance bonus when location permission is denied', async () => {
    stateService.loadStates.and.resolveTo([
      buildState(1, 'AL'),
      buildState(2, 'AK'),
      buildState(3, 'AZ'),
      buildState(4, 'AR'),
    ]);
    stateService.loadPoints.and.resolveTo(createEmptyPoints());
    locationService.getCurrentLocationAccess.and.resolveTo({
      status: 'denied',
      message: 'Location permission was denied.',
    });

    await store.hydrate();
    await store.recordFoundState(1);

    expect(locationService.calculateDistanceMiles).not.toHaveBeenCalled();
    expect(store.homeViewModel().states[0].distanceFound).toBe(0);
    expect(store.homeViewModel().points.total).toBe(1);
  });

  it('stores a sanitized error message when distance calculation fails unexpectedly', async () => {
    stateService.loadStates.and.resolveTo([
      buildState(1, 'AL'),
      buildState(2, 'AK'),
      buildState(3, 'AZ'),
      buildState(4, 'AR'),
    ]);
    stateService.loadPoints.and.resolveTo(createEmptyPoints());
    locationService.getCurrentLocationAccess.and.resolveTo({
      status: 'error',
      message: 'Distance bonus is unavailable right now.',
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

    stateService.loadStates.and.resolveTo(states);
    stateService.loadPoints.and.resolveTo(createEmptyPoints());
    stateService.saveStates.and.callFake(async () => firstSave);

    await store.hydrate();

    const firstRecord = store.recordFoundState(1);
    const secondRecord = store.recordFoundState(1);

    releaseFirstSave();
    await firstRecord;
    await secondRecord;

    expect(stateService.saveStates).toHaveBeenCalledTimes(1);
    expect(stateService.savePoints).toHaveBeenCalledTimes(1);
    expect(store.homeViewModel().points.total).toBe(4);
  });
});

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
