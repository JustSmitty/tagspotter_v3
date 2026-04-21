import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RewardService {
  /**
   * Calculates the point reward for a given distance in miles.
   * Rewards are based on milestone distances to encourage long-distance "spotting".
   */
  getDistanceReward(distance: number): number {
    if (distance <= 0) return 0;
    if (distance <= 500) return 1;
    if (distance <= 1000) return 2;
    if (distance <= 2000) return 3;
    if (distance <= 3000) return 4;
    return 5; // Distance > 3000 miles
  }

  /**
   * Calculates total state discovery reward.
   * Standard reward is 1 point per state.
   */
  getStateDiscoveryReward(): number {
    return 1;
  }
}
