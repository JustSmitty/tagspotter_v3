import { TestBed } from '@angular/core/testing';

import {
  GameSnapshot,
  StoredStateRecord,
  createEmptyPoints,
} from '../models/game-state.model';
import { GameViewModelService } from './game-view-model.service';

describe('GameViewModelService', () => {
  let service: GameViewModelService;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameViewModelService],
    });

    service = testBed.inject(GameViewModelService);
  });

  it('builds state cards, ranking, and point summaries from a snapshot', () => {
    const snapshot = buildSnapshot([
      buildState(1, 'AL', { stateFound: true, questionsCorrect: 1, distance: 400 }),
      buildState(5, 'CA', { stateFound: true, questionsCorrect: 3, distance: 20 }),
      buildState(2, 'AK', { stateFound: false, questionsCorrect: 0, distance: 0 }),
    ], { state: 2, question: 4, distance: 2 });
    const cards = service.toStateCards(snapshot.states);
    const ranked = service.rankFoundStates(cards);
    const home = service.buildHomeViewModel(snapshot, cards, true, false, null);

    expect(cards[0]).toEqual(jasmine.objectContaining({
      code: 'AL',
      isFound: true,
      region: 'south',
    }));
    expect(ranked.map((state) => state.code)).toEqual(['CA', 'AL']);
    expect(home.points.total).toBe(8);
    expect(home.points.miles).toBe(420);
  });

  it('builds summary distribution and trivia models', () => {
    const snapshot = buildSnapshot([
      buildState(1, 'AL', { stateFound: true, questionsCorrect: 9, distance: 400, mode: 'trivia', difficulty: 'hard' }),
      buildState(5, 'CA', { stateFound: true, questionsCorrect: 1, distance: 20, mode: 'classic' }),
    ], { state: 2, question: 4, distance: 2 });
    const ranked = service.rankFoundStates(service.toStateCards(snapshot.states));
    const distribution = service.buildSummaryDistribution(snapshot);
    const trivia = service.buildTriviaViewModel(snapshot, ranked, [
      { title: 'Capital', subtitle: 'Match the plate to its capital city.' },
    ]);

    expect(distribution).toEqual({
      classicStates: 1,
      easyStates: 0,
      medStates: 0,
      hardStates: 1,
      total: 2,
    });
    expect(trivia.accuracy).toBe(100);
    expect(trivia.perfectPasses).toBe(1);
    expect(trivia.topStates.map((state) => state.code)).toEqual(['AL']);
  });

  describe('buildTripComparison (audit F-14)', () => {
    const trip = (id: string, finalScore: number) => ({
      id, completedAt: `2026-08-0${id}T00:00:00.000Z`, foundCount: 10,
      totalStates: 51, finalScore, miles: 500, triviaCorrect: 3,
    });

    const snapshotWorth = (points: number) => ({
      states: [],
      points: { state: points, question: 0, distance: 0 },
      foundCount: 0,
      totalCorrect: 0,
      totalDistanceMiles: 0,
    });

    it('reports no history on a first trip', () => {
      const result = service.buildTripComparison(snapshotWorth(12), []);

      expect(result.hasHistory).toBeFalse();
      expect(result.bestScore).toBeNull();
      expect(result.scoreDelta).toBeNull();
      expect(result.isPersonalBest).toBeFalse();
    });

    it('compares against the most recent trip, which is stored first', () => {
      const result = service.buildTripComparison(snapshotWorth(30), [trip('3', 25), trip('2', 40), trip('1', 10)]);

      expect(result.previousScore).toBe(25);
      expect(result.scoreDelta).toBe(5);
      expect(result.tripsCompleted).toBe(3);
    });

    it('finds the best across all trips, not just the last', () => {
      const result = service.buildTripComparison(snapshotWorth(30), [trip('3', 25), trip('2', 40), trip('1', 10)]);

      expect(result.bestScore).toBe(40);
      expect(result.isPersonalBest).toBeFalse();
      // 40 - 30 + 1: one point past the record, not merely level with it.
      expect(result.pointsToBeat).toBe(11);
    });

    it('flags a personal best only once the record is passed', () => {
      const level = service.buildTripComparison(snapshotWorth(40), [trip('1', 40)]);
      expect(level.isPersonalBest).toBeFalse();
      expect(level.pointsToBeat).toBe(1);

      const ahead = service.buildTripComparison(snapshotWorth(41), [trip('1', 40)]);
      expect(ahead.isPersonalBest).toBeTrue();
      expect(ahead.pointsToBeat).toBeNull();
    });

    it('reports a negative delta when behind the last trip', () => {
      expect(service.buildTripComparison(snapshotWorth(10), [trip('1', 25)]).scoreDelta).toBe(-15);
    });
  });
});

function buildSnapshot(states: StoredStateRecord[], points = createEmptyPoints()): GameSnapshot {
  const foundStates = states.filter((state) => state.fnd.stateFound);

  return {
    states,
    points,
    foundCount: foundStates.length,
    totalCorrect: foundStates.reduce((total, state) => total + state.fnd.questionsCorrect, 0),
    totalDistanceMiles: foundStates.reduce((total, state) => total + state.fnd.distance, 0),
  };
}

function buildState(
  id: number,
  abbrv: string,
  fnd: StoredStateRecord['fnd'],
): StoredStateRecord {
  return {
    ID: id,
    Name: `State ${abbrv}`,
    Abbrv: abbrv,
    Lat: 0,
    Lng: 0,
    Capital: `${abbrv} Capital`,
    Bird: `${abbrv} Bird`,
    Flower: `${abbrv} Flower`,
    Nickname: `${abbrv} Nickname`,
    flagURL: `/assets/stateflags/${abbrv}.svg`,
    fnd,
  };
}
