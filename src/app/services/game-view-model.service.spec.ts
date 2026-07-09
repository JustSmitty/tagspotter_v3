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
    const home = service.buildHomeViewModel(snapshot, cards, true, false);

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
