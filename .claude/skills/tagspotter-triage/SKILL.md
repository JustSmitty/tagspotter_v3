---
name: tagspotter-triage
description: Owns anything reported as broken in Tag Spotter — bugs, crashes, regressions, freezes, wrong behaviour, "it used to work". Use when the request describes a symptom rather than a change. Enforces search-memory-first, reproduce-before-fixing, a failing test before the fix, and a mandatory postmortem for anything that reached a build.
review_by: 2027-02-28
---

# Tag Spotter — Triage

A symptom is not a task. The job is to find the invariant that had no owner, not the line that looks
wrong.

## 1. Search memory before you read code

```bash
npm run brain -- search "<symptom in the reporter's words>"
npm run brain -- search "<the subsystem you suspect>"
```

This project has already paid for bugs whose cause was not where anyone looked.
`pm-0001-stale-quiz-session` is the canonical one: the reset logic was correct, the quiz logic was
correct, and the bug lived in the invariant *between* two persistence surfaces that nobody owned.

If the Brain has a matching `postmortem`, read it fully before touching anything. If it has a
`decision` explaining the behaviour, the report may be a **misunderstanding, not a defect** — say so
plainly and cite the record rather than changing code.

## 2. Reproduce before you theorize

Write down, before making any change:

- Exact steps, including **mode** (classic/trivia), **difficulty**, and whether location was granted.
- Expected vs observed.
- Does it survive an app restart? A trip reset? A fresh install?

That last line matters more here than in most apps, because state lives across four persistence
surfaces with **deliberately different lifetimes**:

| Key | Survives trip reset? | Survives save corruption? |
|---|---|---|
| `tagspotter_v1_save_data` | rebuilt from seed | no — triggers reset |
| `temp_quiz_session` | **cleared** (`pm-0001`) | independent |
| `tagspotter_v1_onboarding_seen` | **yes** (`dec-0006`) | **yes** — by design |
| `tagspotter_v1_location_precision` | **yes** | **yes** — privacy preference |

A large share of state bugs in this app are a mismatch between one of those rows and someone's
assumption. Check the table before blaming logic.

## 3. Suspect these first

Ranked by how often they have actually been the cause:

1. **State read after an `await`** — `gameMode()` re-read post-dialog (F-15). Anything read after an
   await may have changed during it.
2. **A sidecar key with an undeclared lifetime** — the table above.
3. **`isBusy` held across a slow external call** — the app looks frozen, not broken (F-06). "It hangs
   for ten seconds" is almost certainly this, not a crash.
4. **Silent data joins** — the atlas matches GeoJSON to states by lowercased name and `reduce`s
   non-matches away; a rename drops a state from the map with no error (`ctx-0001-states-dataset`).
5. **A view model dividing by a hardcoded constant** — accuracy divides by `QUIZ_QUESTION_COUNT`
   regardless of how many questions were actually asked (F-18).

## 4. Failing test first

Write the test that fails **before** the fix. If you cannot express the bug as a failing test, you do
not yet understand it — go back to step 2.

`npm.cmd run test -- --watch=false --browsers=ChromeHeadless`

Put it at the layer where the bug lives: `game-command.service.spec.ts` for scoring,
`game-state.store.spec.ts` for state/persistence, `home-workflow.service.spec.ts` for interaction
sequencing. Note that the last file does not exist yet (F-37) — creating it is part of the fix, not a
reason to test at the wrong layer.

## 5. Fix at the cause, not the symptom

Suppressing a symptom in a component when the cause is in the store is how the next three bugs get
created. Route the actual change through `tagspotter-feature` and respect the layering.

## 6. Postmortem is mandatory

If it reached a build, file a `postmortem` before the fix merges (filing rule 7). It must answer:

- **What happened** — observable behaviour, in the reporter's terms.
- **Root cause** — the invariant that had no owner. "A null check was missing" is a symptom
  description, not a root cause.
- **The lesson that generalizes** — what class of future change should be treated differently.
- **Can a guardrail catch this class?** If yes, add it to `.agents/evals/guardrails.json` in the same
  commit. This is the step that makes the system get better instead of just longer.

Use `pm-0001-stale-quiz-session` as the shape.

## Definition of done

- [ ] Reproduced, with written steps
- [ ] Brain searched; existing records cited or a new one filed
- [ ] Failing test written first, now passing
- [ ] Fixed at the cause, at the right layer
- [ ] Full suite green
- [ ] Postmortem filed if it reached a build
- [ ] Guardrail added if the class is machine-checkable
