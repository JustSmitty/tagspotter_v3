---
id: dec-0002-slim-save-payload
type: decision
title: Persist only per-state progress, re-merge seed data on load
status: accepted
date: 2026-08-14
source: commit:106dac1
author: justin
confidence: high
tags: [storage, performance, save-format]
claims: {save-payload: progress-only}
supersedes: []
related: [dec-0001-encrypted-save-envelope, ctx-0001-states-dataset]
review_by: 2027-02-28
---

`saveSnapshot` writes only `{ID, fnd}` per state. Names, coordinates, flags and trivia fields all
ship in `states.json` and are re-merged onto seed records by `mergeStoredProgressOntoSeedStates` at
load time. This keeps the encrypted payload roughly 10x smaller per save.

Two consequences an agent must not break:

1. Loading stays backward compatible — legacy full blobs also carry `ID` and `fnd`, so the merge is
   a no-op for them rather than an error path.
2. Editing `states.json` now silently changes *existing* players' data on the next load. That is the
   intent (trivia fixes reach everyone), but it means a seed edit is a migration, not a content
   change. Anything keyed on `ID` must stay stable forever.
