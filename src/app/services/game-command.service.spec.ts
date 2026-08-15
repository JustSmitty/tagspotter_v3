import { TestBed } from '@angular/core/testing';

import { createEmptyPoints, DISTRICT_OF_COLUMBIA_ID, StoredStateRecord } from '../models/game-state.model';
import { GameCommandService } from './game-command.service';
import { LocationService } from './location.service';
import { QuizService } from './quiz.service';

/**
 * Every scoring rule in the game lives here and none of it was covered
 * (audit F-37). These are pure functions over a snapshot, so they are cheap to
 * test and expensive to get wrong — a mistake here silently changes a player's
 * score with nothing to catch it.
 */
describe('GameCommandService', () => {
  let service: GameCommandService;
  let locationService: jasmine.SpyObj<LocationService>;
  let quizService: jasmine.SpyObj<QuizService>;

  function buildState(id: number, code: string, found = false): StoredStateRecord {
    return {
      ID: id,
      Name: `State ${code}`,
      Abbrv: code,
      Lat: 33,
      Lng: -86,
      Capital: 'Capital',
      Bird: 'Bird',
      Flower: 'Flower',
      Nickname: 'Nickname',
      flagURL: `/assets/stateflags/${code}.svg`,
      fnd: { distance: 0, stateFound: found, questionsCorrect: 0 },
    };
  }

  beforeEach(() => {
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getCurrentLocationAccess',
      'calculateDistanceMiles',
    ]);
    quizService = jasmine.createSpyObj<QuizService>('QuizService', ['createQuizSession']);
    quizService.createQuizSession.and.returnValue({
      stateId: 1, stateCode: 'AL', stateName: 'State AL', imageSrc: '', questions: [],
    });
    locationService.calculateDistanceMiles.and.returnValue(1500);

    TestBed.configureTestingModule({
      providers: [
        GameCommandService,
        { provide: LocationService, useValue: locationService },
        { provide: QuizService, useValue: quizService },
      ],
    });
    service = TestBed.inject(GameCommandService);
  });

  describe('recordFoundState', () => {
    it('awards the discovery point without touching location', () => {
      const result = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'classic', 'easy');

      expect(result?.points.state).toBe(1);
      expect(result?.states[0].fnd.stateFound).toBeTrue();
      expect(result?.states[0].fnd.distance).toBe(0);
      // Audit F-06: this call must stay synchronous and location-free.
      expect(locationService.getCurrentLocationAccess).not.toHaveBeenCalled();
    });

    it('does not mutate the arrays it was given', () => {
      const states = [buildState(1, 'AL')];
      const points = createEmptyPoints();

      service.recordFoundState(states, points, 1, 'classic', 'easy');

      expect(states[0].fnd.stateFound).toBeFalse();
      expect(points.state).toBe(0);
    });

    it('returns null for an unknown state or one already spotted', () => {
      expect(service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 99, 'classic', 'easy')).toBeNull();
      expect(service.recordFoundState([buildState(1, 'AL', true)], createEmptyPoints(), 1, 'classic', 'easy')).toBeNull();
    });

    it('creates a quiz in trivia mode but never for DC', () => {
      const trivia = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'trivia', 'hard');
      expect(trivia?.quizSession).not.toBeNull();

      const classic = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'classic', 'hard');
      expect(classic?.quizSession).toBeNull();

      // DC has no Capital/Bird/Flower/Nickname in the dataset (ctx-0001), so a
      // quiz for it would render blank options.
      const dc = service.recordFoundState(
        [buildState(DISTRICT_OF_COLUMBIA_ID, 'DC')], createEmptyPoints(), DISTRICT_OF_COLUMBIA_ID, 'trivia', 'easy',
      );
      expect(dc?.quizSession).toBeNull();
    });
  });

  describe('applyDistance', () => {
    it('records the distance and its reward tier', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'classic', 'easy')!;

      const result = service.applyDistance(spotted.states, spotted.points, 1, { lat: 40, lng: -100 });

      expect(result?.states[0].fnd.distance).toBe(1500);
      expect(result?.points.distance).toBe(3); // 1001-2000 miles
      expect(result?.points.state).toBe(2); // discovery scales with distance too (F-13)
    });

    it('replaces rather than stacks when applied twice', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'classic', 'easy')!;
      const once = service.applyDistance(spotted.states, spotted.points, 1, { lat: 40, lng: -100 })!;

      locationService.calculateDistanceMiles.and.returnValue(200);
      const twice = service.applyDistance(once.states, once.points, 1, { lat: 34, lng: -87 })!;

      expect(twice.states[0].fnd.distance).toBe(200);
      expect(twice.points.distance).toBe(1); // not 3 + 1
    });

    it('ignores a state that is not spotted', () => {
      expect(service.applyDistance([buildState(1, 'AL')], createEmptyPoints(), 1, { lat: 40, lng: -100 })).toBeNull();
    });
  });

  describe('unspotState', () => {
    it('reverses the discovery point, the range bonus and banked trivia points', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'trivia', 'hard')!;
      const withDistance = service.applyDistance(spotted.states, spotted.points, 1, { lat: 40, lng: -100 })!;
      const withQuiz = service.completeQuiz(withDistance.states, withDistance.points, 1, 6)!;

      // 2 discovery (1500 mi) + 3 range + 6 trivia = 11 after the F-13 rebalance.
      expect(withQuiz.points.state + withQuiz.points.distance + withQuiz.points.question).toBe(11);

      const result = service.unspotState(withQuiz.states, withQuiz.points, 1)!;

      expect(result.points).toEqual(createEmptyPoints());
      expect(result.states[0].fnd.stateFound).toBeFalse();
      expect(result.states[0].fnd.distance).toBe(0);
      expect(result.states[0].fnd.questionsCorrect).toBe(0);
      expect(result.states[0].fnd.mode).toBeUndefined();
      expect(result.states[0].fnd.difficulty).toBeUndefined();
    });

    it('leaves other states untouched', () => {
      const states = [buildState(1, 'AL'), buildState(2, 'AK')];
      const first = service.recordFoundState(states, createEmptyPoints(), 1, 'classic', 'easy')!;
      const second = service.recordFoundState(first.states, first.points, 2, 'classic', 'easy')!;

      const result = service.unspotState(second.states, second.points, 1)!;

      expect(result.states[1].fnd.stateFound).toBeTrue();
      expect(result.points.state).toBe(1);
    });

    it('never drives a total negative', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'classic', 'easy')!;
      // A save that has been hand-edited or corrupted could hold fewer points
      // than this state is worth; a deficit must not be shown to the player.
      const result = service.unspotState(spotted.states, createEmptyPoints(), 1)!;

      expect(result.points.state).toBe(0);
      expect(result.points.distance).toBe(0);
      expect(result.points.question).toBe(0);
    });

    it('ignores a state that was never spotted', () => {
      expect(service.unspotState([buildState(1, 'AL')], createEmptyPoints(), 1)).toBeNull();
    });
  });

  describe('completeQuiz', () => {
    it('replaces previously banked points rather than adding to them', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'trivia', 'easy')!;

      const first = service.completeQuiz(spotted.states, spotted.points, 1, 2)!;
      expect(first.points.question).toBe(2);

      const second = service.completeQuiz(first.states, first.points, 1, 3)!;
      expect(second.points.question).toBe(3);
    });

    it('clamps a negative score to zero', () => {
      const spotted = service.recordFoundState([buildState(1, 'AL')], createEmptyPoints(), 1, 'trivia', 'easy')!;

      const result = service.completeQuiz(spotted.states, spotted.points, 1, -5)!;

      expect(result.points.question).toBe(0);
    });
  });
});
