---
id: ctx-0001-states-dataset
type: context
title: The states dataset — shape, gaps, and why DC is special
status: accepted
date: 2026-08-15
source: file:src/data/states.json:1
author: claude
confidence: high
tags: [data, trivia, quiz, seed]
claims: {state-count: 51, dc-state-id: 9}
supersedes: []
related: [dec-0002-slim-save-payload]
review_by: 2027-06-30
---

`src/data/states.json` holds 51 records (50 states + DC), each with `ID`, `Abbrv`, `Name`, `Lat`,
`Lng`, `Capital`, `Bird`, `Flower`, `Nickname`, `flagURL`, plus optional `Region`, `LargestCity`,
`AdmissionYear`, `Tree`, `FamousLandmark`, `MovieSetting`, `SportsTeam`.

Verified 2026-08-15: **every field is populated for all 51 records except DC**, which is missing
`Capital`, `Bird`, `Flower` and `Nickname`.

## Why that gap is safe today

`DISTRICT_OF_COLUMBIA_ID = 9` is excluded twice in `QuizService`: DC never gets a quiz session, and
DC is filtered out of the distractor pool for every other state's questions. So the empty strings
can never surface as a blank answer option.

This is load-bearing. An agent that "simplifies" either exclusion will produce a quiz with a blank
multiple-choice option — a visible bug with no test covering it. If you touch quiz generation, add
the test first.

## Second gap, currently latent

`QuizService.createQuizSession` slices to 3 topics from the tier's available list. The `medium` tier
(`Nickname`, `Bird`, `AdmissionYear`) has *exactly* three. Any future data gap in a medium topic
silently yields a 2-question quiz, while `GameViewModelService` still divides accuracy by the
hardcoded `QUIZ_QUESTION_COUNT` of 3. That is audit F-18.

`assets/us-states.json` is a separate 76 KB GeoJSON used only by the atlas, matched to states by
lowercased `properties.name`. A rename in either file breaks the join silently — the feature is
simply dropped by the `reduce` in `loadAtlas`.
