import { TestBed } from '@angular/core/testing';

import { StoredStateRecord } from '../models/game-state.model';
import { QuizService } from './quiz.service';

describe('QuizService', () => {
  let service: QuizService;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuizService],
    });

    service = testBed.inject(QuizService);
  });

  it('creates three questions with unique distractors and excludes DC candidates', () => {
    const foundState = buildState(1, 'AL', {
      Bird: 'Yellowhammer',
      Capital: 'Montgomery',
      Flower: 'Camellia',
      Nickname: 'Yellowhammer State',
    });
    const districtOfColumbia = buildState(9, 'DC', {
      Bird: 'Wood Thrush',
      Capital: 'Washington',
      Flower: 'American Beauty Rose',
      Nickname: 'Capital City',
    });
    const alaska = buildState(2, 'AK', {
      Bird: 'Willow Ptarmigan',
      Capital: 'Juneau',
      Flower: 'Forget Me Not',
      Nickname: 'Last Frontier',
    });
    const arizona = buildState(3, 'AZ', {
      Bird: 'Cactus Wren',
      Capital: 'Phoenix',
      Flower: 'Saguaro Blossom',
      Nickname: 'Grand Canyon State',
    });
    const arkansas = buildState(4, 'AR', {
      Bird: 'Mockingbird',
      Capital: 'Little Rock',
      Flower: 'Apple Blossom',
      Nickname: 'Natural State',
    });
    const randomSpy = spyOn(Math, 'random').and.returnValue(0.999);

    const session = service.createQuizSession(foundState, [
      foundState,
      districtOfColumbia,
      alaska,
      arizona,
      arkansas,
    ], 'easy');

    expect(session.questions.length).toBe(3);

    for (const question of session.questions) {
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.correctAnswer);
    }

    expect(session.questions[0].options).not.toContain(districtOfColumbia.Capital);
    expect(session.questions[1].options).not.toContain(districtOfColumbia.Abbrv);
    expect(session.questions[2].options).not.toContain(districtOfColumbia.Region!);

    randomSpy.and.callThrough();
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
    Lng: 0,
    Capital: `${abbrv} Capital`,
    Bird: `${abbrv} Bird`,
    Flower: `${abbrv} Flower`,
    Nickname: `${abbrv} Nickname`,
    Region: `${abbrv} Region`,
    LargestCity: `${abbrv} Largest City`,
    Tree: `${abbrv} Tree`,
    AdmissionYear: 1800 + id,
    FamousLandmark: `${abbrv} Landmark`,
    MovieSetting: `${abbrv} Movie`,
    SportsTeam: `${abbrv} Sports Team`,
    flagURL: `/assets/stateflags/${abbrv}.svg`,
    fnd: {
      distance: 0,
      stateFound: false,
      questionsCorrect: 0,
    },
    ...overrides,
  };
}
