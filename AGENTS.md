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

## Open work

`docs/remediation-plan.md` holds all 41 audit findings, phased, each with an owning skill and an
acceptance criterion. Progress is measured by `.agents/evals/guardrails.json`, not by that document —
a guardrail baseline that has not dropped means the work has not landed.

## The one rule that keeps this working

If you have written the same instructions to an agent twice, the system has failed. Write a skill
file instead (filing rule 6). `npm run evals` fails if a skill exists without a route, so
skillification is structurally enforced rather than remembered.
