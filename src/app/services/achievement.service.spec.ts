import { TestBed } from '@angular/core/testing';

import { GameSnapshot, StoredStateRecord, createEmptyPoints } from '../models/game-state.model';
import { AchievementService } from './achievement.service';

describe('AchievementService', () => {
  let service: AchievementService;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AchievementService],
    });

    service = testBed.inject(AchievementService);
  });

  it('unlocks coast-to-coast for California and Maine', () => {
    const achievements = service.getAchievements(buildSnapshot([
      buildState(5, 'CA', true),
      buildState(19, 'ME', true),
    ]));

    expect(achievements.find((achievement) => achievement.id === 'coast-to-coast')?.unlocked).toBeTrue();
  });

  it('does not unlock coast-to-coast for only one coast or inland states', () => {
    const californiaOnly = service.getAchievements(buildSnapshot([
      buildState(5, 'CA', true),
    ]));
    const inlandOnly = service.getAchievements(buildSnapshot([
      buildState(15, 'KS', true),
      buildState(25, 'MO', true),
    ]));

    expect(californiaOnly.find((achievement) => achievement.id === 'coast-to-coast')?.unlocked).toBeFalse();
    expect(inlandOnly.find((achievement) => achievement.id === 'coast-to-coast')?.unlocked).toBeFalse();
  });
});

function buildSnapshot(states: StoredStateRecord[]): GameSnapshot {
  const foundStates = states.filter((state) => state.fnd.stateFound);

  return {
    states,
    points: createEmptyPoints(),
    foundCount: foundStates.length,
    totalCorrect: foundStates.reduce((total, state) => total + state.fnd.questionsCorrect, 0),
    totalDistanceMiles: foundStates.reduce((total, state) => total + state.fnd.distance, 0),
  };
}

function buildState(id: number, abbrv: string, found: boolean): StoredStateRecord {
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
    fnd: {
      distance: 0,
      stateFound: found,
      questionsCorrect: 0,
    },
  };
}
