---
name: tagspotter-feature
description: The default workflow for any behaviour change to the Tag Spotter app — new features, refactors, bug fixes in app code. Use when the request is to implement, add, change, wire, extract or refactor something in src/app. Enforces retrieve-before-act against the Brain, the store/command/view-model layering, and file-back-after. Do not use for copy-only changes (tagspotter-copy), assets (tagspotter-asset-pipeline), accessibility (tagspotter-a11y-gate), or build/release config (tagspotter-release).
review_by: 2027-02-28
---

# Tag Spotter — Feature Work

You are changing an app that is already architecturally sound. The value you add is *not* in
restructuring it; it is in making the change fit what is already there.

## 0. Retrieve first — non-negotiable

```bash
npm run resolve -- "<the request>"
npm run brain -- search "<query the resolver gave you>"
```

Read every `constraint` that comes back. Constraints are binding. If your change requires violating
one, **stop and escalate to the maintainer** — do not widen the constraint (filing rule 8).

If a returned `decision` is one you are about to reverse, supersede it explicitly (filing rule 4).

## 1. Respect the layering

Data flows in exactly one direction. Put your change at the right altitude:

```
Component  (OnPush, signals only, zero business logic)
    ↓
HomeWorkflowService     modals, alerts, toasts, navigation — all user interaction sequencing
    ↓
GameStateStore          signal state, the mutation queue, persistence orchestration, busy/error
    ↓
GameCommandService      pure-ish game rules: what a spot costs, what a quiz awards
    ↓
StateService            storage envelope, migration, normalization
```

- **Never** put an `AlertController` or `ModalController` in a component or the store. It belongs in
  `HomeWorkflowService`.
- **Never** put scoring arithmetic in the store. It belongs in `GameCommandService` / `RewardService`.
- **Never** mutate `states`/`points` in place. Both command methods clone first (`cloneStoredStates`,
  `cloneStoredPoints`) and return new objects; the store just `.set()`s them.
- View models are built in `GameViewModelService` and exposed as `computed` on the store. A component
  that computes anything beyond trivial filtering is at the wrong altitude.

## 2. Every mutation goes through the queue

`GameStateStore.enqueueMutation` serializes writes so two rapid taps cannot interleave a
read-modify-write. Any new public mutator must:

1. `await this.hydrate()` first.
2. Wrap its body in `enqueueMutation`.
3. Read `this.states()` / `this.points()` **inside** the queued closure, never outside it.

Do not add a mutator that writes signals directly. That is the bug class the queue exists to prevent.

## 3. Signals — the house style

Match `angular-signals` (vendored skill) for API detail; these are the project rules on top:

- `computed` for anything derivable. If you are writing an `effect` that sets a signal, you almost
  certainly want a `computed` instead — see audit F-17 for the live example in `RoadAtlasComponent`.
- Hold **IDs** in signals, derive records via `computed`. Holding a snapshot object means keeping it
  in sync by hand.
- `effect` is for genuine side effects only (haptics, native calls). It gets a comment explaining why
  it cannot be a `computed`.

## 4. Async correctness

The single most common defect class in this codebase:

> **Read state once, before you await. Never re-read it after.**

`recordState` reads `gameMode()` after awaiting a dialog, so toggling the mode mid-dialog desyncs the
stored mode from the quiz that runs (audit F-15). Capture what you need at entry.

Likewise: do not hold the busy flag across a long external await. `isBusy` disables the entire UI, so
awaiting a 10-second geolocation call inside the mutation queue freezes the app (audit F-06). Commit
the user-visible change first, resolve slow external facts after.

## 5. Test what you changed

Run: `npm.cmd run test` — headless and single-run by default, no flags needed (F-36).

- A new store mutator needs a `game-state.store.spec.ts` case covering **both** the success path and
  the persistence-failure path.
- A new scoring rule needs a `game-command.service.spec.ts` case.
- A new user-interaction sequence needs a `home-workflow.service.spec.ts` case.

`guardrail:untested-services` tracks services that have no spec file at all. Do not increase it.

Three more guardrails are owned by this skill and are easiest to break by accident:

- **`guardrail:dead-handlers`** — a component method that no template binds. `/summary` was
  unreachable for exactly this reason: `openSummary()` existed and nothing called it (F-08). Wiring
  a handler is not done until something binds it.
- **`guardrail:preload-strategy`** — `PreloadAllModules` in `src/main.ts`. It fetches every lazy
  route right after boot, which cancels out the code splitting (F-27). Every route here is lazy on
  purpose.
- **`guardrail:crypto-theater`** — hardcoded key material presented as encryption (F-20, `dec-0009`).
  `legacy-save-reader.service.ts` is excluded on purpose: it reproduces the ≤ 1.1.0 key constants for
  **decrypt only**, so upgrading players do not lose their trip. It has no encrypt path. Do not add
  one, and do not copy those constants anywhere else.

## 6. File back

Per `.agents/filing-rules.md`:

- Made a call a future agent could reasonably make differently? → `decision` record.
- Fixed something that reached a build? → `postmortem` record, mandatory (filing rule 7).
- Discovered a load-bearing invariant that isn't visible in the code? → `constraint` record.

Then: `npm run brain -- index && npm run evals`.

## Definition of done

- [ ] Brain retrieved before acting; constraints honoured
- [ ] Change sits at the correct layer
- [ ] Mutations queued; state read once before awaits
- [ ] `npm run lint` clean
- [ ] Tests pass, with new coverage for the new behaviour
- [ ] Brain updated and re-indexed
- [ ] `npm run evals` green and no guardrail baseline increased
