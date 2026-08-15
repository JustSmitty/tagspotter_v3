---
id: dec-0014-scoring-rebalance-and-streak
type: decision
title: Scoring changes are additive only; challenges pay a streak, not points
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-13
author: justin
confidence: high
tags: [scoring, game-design, streak, persistence]
claims: {scoring-changes: additive-only, challenge-reward: streak}
supersedes: []
related: [dec-0008-americana-brand-voice, con-0006-design-system-authority]
review_by: 2027-02-28
---

Two Phase 5 decisions that share one rule.

## The rule

**Scoring only ever moves up.** Trip history archives a `finalScore` per trip, and the road log now
compares the trip in progress against those numbers (F-14). Any change that *lowered* a reward would
silently inflate every archived trip relative to new ones — players would appear to be getting worse
at a game whose rules changed under them, with no way to tell.

So both changes below are strictly additive. Nothing a player has already earned is worth less than
it was.

## F-13 — raise the spotting side, leave trivia alone

A perfect hard trivia round was 9 points; the best possible *spot* in the game — a Hawaii plate seen
in Maine — was 6. The road-trip half of a road-trip game was about a tenth of a typical score.

Rejected: cutting trivia multipliers. It balances by subtraction and devalues the archive.

Done instead:

- Range tiers now accelerate: `1 / 2 / 3 / 5 / 8` (were `1 / 2 / 3 / 4 / 5`).
- The **discovery point itself** scales with distance: 1 normally, 2 past 1,000 miles, 3 past 2,000.

A coast-to-coast find is now 11 points against 9 for a perfect hard quiz. Every tier is greater than
or equal to what it used to be, and `reward.service.spec.ts` pins that with a test that asserts the
new curve never pays less than the old one.

**The gotcha:** distance arrives *after* the spot is committed (F-06), so `applyDistance` tops up the
discovery point as well as the range bonus, and `unspotState` reverses using the recorded distance.
Miss either and points leak.

## F-11 — challenges pay a streak

The three rotating challenges awarded nothing whatsoever. Points were the obvious fix and the wrong
one, for the reason above. A streak adds a reason to come back and touches no score.

`ChallengeStreakService` is pure functions over a date and a streak — no clock, no storage — so every
calendar rule is directly testable. Two details worth keeping:

- Day keys are **local** calendar days (`YYYY-MM-DD`), not timestamps or UTC. The player's midnight
  is the one that matters.
- The stored streak is never rewritten at start-up. `asOf()` derives how it *reads* today, so a
  lapsed run shows 0 while `best` survives untouched.

The streak deliberately survives a trip reset — it measures days the traveller showed up, not
progress within any one trip — which is why `resetSnapshot` now takes it as an argument.
