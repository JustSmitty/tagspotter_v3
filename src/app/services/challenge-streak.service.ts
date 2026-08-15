import { Injectable } from '@angular/core';

import { ChallengeStreak, createEmptyStreak } from '../models/game-persistence.model';
import { RotatingChallengeViewModel } from '../models/game-view.model';

/**
 * The daily challenge streak (audit F-11).
 *
 * The three rotating challenges used to award nothing at all — they rotated,
 * showed progress, and completing one changed nothing anywhere. A streak was
 * chosen over bonus points deliberately: points would inflate new trips relative
 * to every trip already archived in the road log, making the history
 * incomparable, while a streak adds a reason to come back without touching the
 * score at all.
 *
 * Pure functions over a date and a streak — no clock, no storage. That keeps
 * "what day is it" a caller's problem and makes every rule below directly
 * testable.
 */
@Injectable({ providedIn: 'root' })
export class ChallengeStreakService {
  /** Local calendar day, not UTC: the player's midnight is the one that counts. */
  toDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  allComplete(challenges: RotatingChallengeViewModel[]): boolean {
    return challenges.length > 0 && challenges.every((challenge) => challenge.unlocked);
  }

  /**
   * Advances the streak for `today` if every challenge is done.
   *
   * Returns the same object when nothing changed, so callers can skip a write
   * — this runs on every snapshot change.
   */
  advance(streak: ChallengeStreak, challenges: RotatingChallengeViewModel[], today: Date): ChallengeStreak {
    if (!this.allComplete(challenges)) return streak;

    const day = this.toDayKey(today);
    if (streak.lastCompletedDay === day) return streak;

    // Consecutive only if the last completion was literally yesterday; any
    // longer gap starts again at 1 rather than continuing.
    const current = streak.lastCompletedDay === this.previousDayKey(today) ? streak.current + 1 : 1;

    return {
      current,
      best: Math.max(streak.best, current),
      lastCompletedDay: day,
    };
  }

  /**
   * The streak as it should be *displayed* today. A streak completed yesterday
   * is still alive — the player has the rest of today to keep it — but one that
   * ended before yesterday reads as 0 without rewriting stored history.
   */
  asOf(streak: ChallengeStreak, today: Date): ChallengeStreak {
    if (streak.lastCompletedDay === null) return createEmptyStreak();

    const alive = streak.lastCompletedDay === this.toDayKey(today)
      || streak.lastCompletedDay === this.previousDayKey(today);

    return alive ? streak : { ...streak, current: 0 };
  }

  /** True when today's challenges have already been banked. */
  isCompletedToday(streak: ChallengeStreak, today: Date): boolean {
    return streak.lastCompletedDay === this.toDayKey(today);
  }

  private previousDayKey(today: Date): string {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return this.toDayKey(yesterday);
  }
}
