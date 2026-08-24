---
id: pm-0001-stale-quiz-session
type: postmortem
title: A quiz saved mid-flight could score points against a reset trip
status: resolved
date: 2026-08-14
source: commit:98a2113
author: justin
confidence: high
tags: [quiz, state, reset, bug]
claims: {}
supersedes: []
related: [dec-0006-standalone-onboarding-flag, pm-0002-inert-backup-exclude]
review_by: 2027-02-28
---

## What happened

`temp_quiz_session` is written to Preferences before each question so an app kill mid-quiz can be
resumed. Trip reset rebuilt the save from seed states but left that key untouched. On the next
launch the resume prompt appeared for a state that was no longer spotted, and finishing it called
`completeQuiz` against the fresh save — awarding trivia points to an unspotted state.

## Root cause

Two persistence surfaces with different lifetimes and no owner for the invariant between them. The
save blob was reset transactionally; the sidecar key was not part of anyone's mental model of
"reset". The bug was not in the reset logic or the quiz logic in isolation — each was correct.

## Fix

`GameStateStore.resetProgress` now calls `stateService.clearTempQuizSession()` inside the same
queued mutation as the reset.

## The lesson that generalizes

**Every sidecar key needs a declared lifetime.** There are now three keys outside the save blob —
`temp_quiz_session`, `tagspotter_v1_onboarding_seen`, `tagspotter_v1_location_precision` — and they
deliberately have *different* reset behaviour: the quiz session is cleared, the other two survive
(dec-0006). That is correct, but it is only correct because it was decided rather than defaulted.

Any agent adding a fourth standalone preference key must state, in the same commit, what happens to
it on trip reset and on save corruption, and add a store spec that asserts it.

## Amended by pm-0002

Declaring the lifetime was necessary and not sufficient. This fix cleared the sidecar at the one
*producer* of a mismatch known at the time — trip reset — and left the resume path trusting whatever
it loaded, so the next unanticipated producer reopened the same hazard. Read
[[pm-0002-inert-backup-exclude]] with this: where two persistence surfaces must agree, check the
agreement at the point of use, because the producers are an open set and the consumer is one place.
