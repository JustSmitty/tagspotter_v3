import { TestBed } from '@angular/core/testing';

import { RewardService } from './reward.service';

/**
 * The scoring tiers. Trivially simple and completely uncovered (audit F-37) —
 * which matters because the boundaries are exactly where an off-by-one silently
 * changes every player's score.
 */
describe('RewardService', () => {
  let service: RewardService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [RewardService] });
    service = TestBed.inject(RewardService);
  });

  it('awards one point for a nearby find and more for a distant one', () => {
    expect(service.getStateDiscoveryReward()).toBe(1);
    expect(service.getStateDiscoveryReward(0)).toBe(1);
    expect(service.getStateDiscoveryReward(1000)).toBe(1);
    expect(service.getStateDiscoveryReward(1001)).toBe(2);
    expect(service.getStateDiscoveryReward(2000)).toBe(2);
    expect(service.getStateDiscoveryReward(2001)).toBe(3);
  });

  it('never pays less than the pre-rebalance curve', () => {
    // Audit F-13 was rebalanced additively so no archived trip score in the road
    // log is devalued. This pins that promise.
    const previousCurve: Array<[number, number]> = [
      [1, 1], [500, 1], [501, 2], [1000, 2], [1001, 3], [2000, 3], [2001, 4], [3000, 4], [3001, 5],
    ];

    for (const [miles, oldReward] of previousCurve) {
      expect(service.getDistanceReward(miles)).withContext(`${miles} miles`).toBeGreaterThanOrEqual(oldReward);
    }
  });

  it('awards nothing for zero or unknown distance', () => {
    expect(service.getDistanceReward(0)).toBe(0);
    expect(service.getDistanceReward(-10)).toBe(0);
  });

  it('scores each distance tier at its boundaries', () => {
    const boundaries: Array<[number, number]> = [
      [1, 1], [500, 1],
      [501, 2], [1000, 2],
      [1001, 3], [2000, 3],
      [2001, 5], [3000, 5],
      [3001, 8], [12000, 8],
    ];

    for (const [miles, expected] of boundaries) {
      expect(service.getDistanceReward(miles)).withContext(`${miles} miles`).toBe(expected);
    }
  });

  it('never awards more than the top tier', () => {
    expect(service.getDistanceReward(Number.MAX_SAFE_INTEGER)).toBe(8);
  });
});
