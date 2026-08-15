import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RewardService {
  /**
   * Range bonus by spotting distance (audit F-13).
   *
   * The tiers used to be flat (1/2/3/4/5), which made the best possible spot in
   * the game — a Hawaii plate seen in Maine — worth 6 points, against 9 for
   * answering three trivia questions. The road-trip half of a road-trip game was
   * about a tenth of a typical score.
   *
   * The curve now accelerates, so distance is worth chasing rather than merely
   * noted. Deliberately additive: no tier went down, so no archived trip score
   * in the road log is devalued and old and new trips stay comparable.
   */
  getDistanceReward(distance: number): number {
    if (distance <= 0) return 0;
    if (distance <= 500) return 1;
    if (distance <= 1000) return 2;
    if (distance <= 2000) return 3;
    if (distance <= 3000) return 5;
    return 8; // Coast-to-coast and beyond.
  }

  /**
   * Points for the find itself.
   *
   * A plate spotted a long way from home is a better story than one spotted at
   * the end of your own street, and the find should say so on its own rather
   * than leaving all of it to the range bonus. Every plate is still worth at
   * least the original 1 point.
   */
  getStateDiscoveryReward(distance = 0): number {
    if (distance > 2000) return 3;
    if (distance > 1000) return 2;
    return 1;
  }
}
