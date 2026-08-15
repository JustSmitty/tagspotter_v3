import { TestBed } from '@angular/core/testing';

import { createEmptyStreak } from '../models/game-persistence.model';
import { RotatingChallengeViewModel } from '../models/game-view.model';
import { ChallengeStreakService } from './challenge-streak.service';

/**
 * Streak rules are all calendar arithmetic, which is where this kind of feature
 * usually goes wrong — off-by-one around midnight, UTC drift, or a streak that
 * quietly resets because the app was opened at 00:01.
 */
describe('ChallengeStreakService', () => {
  let service: ChallengeStreakService;

  const day = (iso: string) => {
    const [year, month, date] = iso.split('-').map(Number);
    return new Date(year, month - 1, date, 13, 0, 0);
  };

  const challenges = (unlocked: boolean[]): RotatingChallengeViewModel[] =>
    unlocked.map((isUnlocked, index) => ({
      id: `c${index}`, title: '', description: '',
      currentValue: 0, targetValue: 1, progressPercent: 0, progressLabel: '',
      unlocked: isUnlocked,
    }));

  const allDone = challenges([true, true, true]);
  const partlyDone = challenges([true, true, false]);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChallengeStreakService] });
    service = TestBed.inject(ChallengeStreakService);
  });

  it('uses the local calendar day, not UTC', () => {
    // 23:30 local on the 5th is still the 5th, whatever UTC thinks.
    expect(service.toDayKey(new Date(2026, 7, 5, 23, 30))).toBe('2026-08-05');
    expect(service.toDayKey(new Date(2026, 7, 5, 0, 30))).toBe('2026-08-05');
  });

  it('does not advance until every challenge is done', () => {
    const streak = createEmptyStreak();

    expect(service.advance(streak, partlyDone, day('2026-08-05'))).toBe(streak);
  });

  it('does not advance on an empty challenge list', () => {
    const streak = createEmptyStreak();

    expect(service.advance(streak, [], day('2026-08-05'))).toBe(streak);
  });

  it('starts a streak at one', () => {
    const result = service.advance(createEmptyStreak(), allDone, day('2026-08-05'));

    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
    expect(result.lastCompletedDay).toBe('2026-08-05');
  });

  it('continues a streak completed yesterday', () => {
    const yesterday = { current: 3, best: 4, lastCompletedDay: '2026-08-04' };

    const result = service.advance(yesterday, allDone, day('2026-08-05'));

    expect(result.current).toBe(4);
    expect(result.best).toBe(4);
  });

  it('restarts at one after a gap', () => {
    const stale = { current: 9, best: 9, lastCompletedDay: '2026-08-01' };

    const result = service.advance(stale, allDone, day('2026-08-05'));

    expect(result.current).toBe(1);
    expect(result.best).toBe(9);
  });

  it('is idempotent within a day', () => {
    const banked = { current: 2, best: 2, lastCompletedDay: '2026-08-05' };

    // Returns the identical object so the caller can skip a write — this runs
    // on every snapshot change.
    expect(service.advance(banked, allDone, day('2026-08-05'))).toBe(banked);
  });

  it('raises the best when the current run passes it', () => {
    const streak = { current: 5, best: 5, lastCompletedDay: '2026-08-04' };

    expect(service.advance(streak, allDone, day('2026-08-05')).best).toBe(6);
  });

  it('crosses a month boundary', () => {
    const streak = { current: 2, best: 2, lastCompletedDay: '2026-07-31' };

    expect(service.advance(streak, allDone, day('2026-08-01')).current).toBe(3);
  });

  describe('as displayed today', () => {
    it('keeps a streak completed today', () => {
      const streak = { current: 4, best: 4, lastCompletedDay: '2026-08-05' };

      expect(service.asOf(streak, day('2026-08-05')).current).toBe(4);
    });

    it('keeps a streak completed yesterday alive — the day is not over', () => {
      const streak = { current: 4, best: 4, lastCompletedDay: '2026-08-04' };

      expect(service.asOf(streak, day('2026-08-05')).current).toBe(4);
    });

    it('shows zero once the run has lapsed, without losing the best', () => {
      const streak = { current: 4, best: 7, lastCompletedDay: '2026-08-01' };
      const shown = service.asOf(streak, day('2026-08-05'));

      expect(shown.current).toBe(0);
      expect(shown.best).toBe(7);
      // Stored history is not rewritten, only how it reads today.
      expect(streak.current).toBe(4);
    });

    it('reports whether today is already banked', () => {
      const streak = { current: 1, best: 1, lastCompletedDay: '2026-08-05' };

      expect(service.isCompletedToday(streak, day('2026-08-05'))).toBeTrue();
      expect(service.isCompletedToday(streak, day('2026-08-06'))).toBeFalse();
    });
  });
});
