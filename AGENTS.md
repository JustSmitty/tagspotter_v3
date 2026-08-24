# AGENTS.md

## Start here

This repository runs an agent workforce. **Do not start work by reading code.** Start by finding out
who owns the request and what the project already knows:

```bash
npm run resolve -- "<the request, in the reporter's own words>"
npm run brain -- search "<the query the resolver hands you>"
```

`.agents/README.md` explains the whole system. `.agents/filing-rules.md` is binding — in particular
retrieve-before-act (rule 1), provenance (rule 3), and escalate-don't-widen (rule 8).

## Verification Commands

- `npm.cmd run lint` — lint checks on Windows.
- `npm.cmd run test:ci` — full Karma suite, headless, single run.
- `npm.cmd run build` — production Angular build.
- `npm.cmd run evals` — structural, brain, routing and guardrail suites.
- `npm.cmd run verify` — lint + tests + evals in one shot.

`npm run brain -- lint` and `npm run brain -- index` maintain the memory layer; CI fails if the
index is stale.

## Mobile Workflows

- `npm.cmd run assets:mobile` — regenerate Android and iOS launcher icons and splash images from
  `scripts/generate-mobile-assets.ps1`.
- `npm.cmd run build:mobile` — web build, then `assets:mobile`, then `npx cap sync`.
- `npm.cmd run cap:sync` — resync Capacitor on its own, after a web build or a native config change.
- `npm.cmd run android:open` / `npm.cmd run ios:open` — open the native projects in Android Studio
  or Xcode.

A green web build does not prove the native shell works. Anything touching native config needs
`cap sync` and a launch on a device; `tagspotter-release` owns that.

## Notes

- In the Codex desktop sandbox on Windows, `npm.cmd run test:ci` may fail with `spawn EPERM` unless
  Chrome is allowed to launch outside the sandbox. `npm.cmd run build` may need elevated execution
  for the same reason. **This is an environment permission issue, not a code defect** — do not change
  code in response to it.
- Recent correctness coverage is concentrated in `src/app/home/home.page.spec.ts`,
  `src/app/services/game-state.store.spec.ts`,
  `src/app/shared/quiz-modal/quiz-modal.component.spec.ts`, and
  `src/app/services/achievement.service.spec.ts`.
- `home-workflow.service.ts` and `game-command.service.ts` both have specs, and
  `guardrail:untested-services` (F-37) holds every `@Injectable` in `src/app/services` to that.
  Adding a service without a sibling spec fails the build.

## Where the work stands

All 41 findings from the 2026-08-15 audit are closed (`audit-2026-08-15`), across the five phases in
`docs/remediation-plan.md`. Phase 6 — store readiness — is the live one, and what remains in it is
maintainer-only: iPhone screenshots and the App Store Connect signing secrets
(`f-044-store-readiness`, `docs/store-assets-checklist.md`).

**`docs/remediation-plan.md` is not the source of truth for progress — `.agents/evals/guardrails.json`
is.** Each guardrail carries a baseline equal to the violation count on the day it was written, and CI
fails if a count rises above it, so debt can only shrink. Run `npm run evals` to see the standing.

Findings raised since the audit are their own records under `.agents/brain/findings/`. A guardrail at
baseline 0 means that finding is closed and the skill that owns it should describe the **invariant**,
not the work — filing rule 6, step 4. Skills going stale that way is `f-049`, and it is why every
skill now carries a `review_by` that CI enforces.

## The one rule that keeps this working

If you have written the same instructions to an agent twice, the system has failed. Write a skill
file instead (filing rule 6). `npm run evals` fails if a skill exists without a route, so
skillification is structurally enforced rather than remembered.
