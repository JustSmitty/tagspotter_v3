---
id: f-047-guardrails-do-not-cover-the-instruction-layer
type: finding
title: F-47 — nothing ratcheted the text that instructs agents; skills now carry review_by
status: resolved
date: 2026-08-24
source: commit:32e4b87
author: claude
confidence: high
tags: [agents, skills, brain, guardrails, process]
claims: {guardrails.cover-instruction-layer: structural-only}
supersedes: []
related: [audit-2026-08-15, f-044-store-readiness, f-045-resolver-substring-keyword-collisions, f-046-block-form-claims-parse-as-a-list]
review_by: 2027-02-28
---

On 2026-08-24 every one of the 22 guardrails read 0 and `npm run evals` was 89/89 green, while four
documents still told an agent that finished work was outstanding:

- `.claude/skills/tagspotter-release/SKILL.md` — "Open items from the audit", listing R8, CLI
  analytics, the CSP and the backup rules as work to do, and five toolchain migrations "in this
  order" that had all landed. It also said the three version numbers were "synced by hand" months
  after `scripts/bump-version.mjs` was written.
- `con-0002-csp-no-remote-hosts` — "That second rule is currently broken".
- `dec-0004-inline-svg-atlas` — a **Known debt** paragraph on the same closed `unsafe-eval`.
- `audit-2026-08-15` — `status: open` with all five phases complete.

**Root cause.** `docs/remediation-plan.md` says it plainly: "This file is **not** the source of truth
for progress — `.agents/evals/guardrails.json` is." That is the right design and it worked. What it
leaves uncovered is that a skill file is not documentation *about* the project, it is the **prompt**
an agent executes. When `.agents/resolver.json` routes a request to `tagspotter-release`, the stale
text became that agent's instructions. So the failure mode is not "the docs are out of date", it is
**a green build shipping wrong instructions** — and an agent following them redoes finished work or
"fixes" something already correct, against a suite that stays green the whole time.

The ratchet has no reading of itself. `guardrail:r8-disabled` proves `minifyEnabled false` is absent
from `build.gradle`; nothing proves the skill that owns R8 has stopped asking for it.

## The sketched guardrail was measured and rejected

The candidate above was: for every `F-\d+` in a skill or record whose guardrail sits at `baseline: 0`,
fail if the surrounding text also carries pending-work language. A narrower variant is more tempting
still — a skill must not state a guardrail's own **violating pattern** as fact, since the rot was
exactly that (`minifyEnabled false`, `unsafe-eval`, a committed analytics UUID) written in the
present tense.

Both were run against the corpus before being written. Eight guardrail patterns appear **in prose
that is currently correct**:

| Skill | Guardrail | What the correct prose says |
|---|---|---|
| `tagspotter-copy` | `copy-lexicon` | names caddie, hole, the green — in order to ban them |
| `tagspotter-copy` | `distance-mislabelled` | names "odometer", "distance driven" — to ban them |
| `tagspotter-release` | `r8-disabled` | "scans `build.gradle` for `minifyEnabled false`" |
| `tagspotter-release` | `csp-unsafe-eval` | "the CSP names no remote hosts and no `unsafe-eval`" |
| `tagspotter-release` | `store-placeholder-urls` | "bans `example.com`/`example.org` in those files" |
| `tagspotter-a11y-gate` | `viewport-zoom` | "may **not** contain `user-scalable=no` or `maximum-scale`" |
| `tagspotter-a11y-gate` | `reduced-motion` | "every stylesheet that declares an `animation:`" |
| `tagspotter-a11y-gate` | `svg-tabindex` | quotes `tabindex="0"` describing what was removed |

Eight for eight, false positives. A skill that owns an invariant has to be able to **name the thing
it forbids** — that is what makes it teachable. The pending-word variant fails the same way from the
other side: `con-0002` legitimately says "that second rule was broken once", and no word list
separates that from "that second rule is currently broken".

This is `f-044-store-readiness`'s lesson arriving one layer up. Four checks in this repo have gone
green while the thing they were named for was still broken, every time because the rule was scoped to
the instances someone had already found. A prose scanner would have been the fifth, and the most
confident-looking.

## What was built instead

Three checks in `structuralSuite()`, all decidable, no word lists. Each was verified by sabotaging
`tagspotter-feature` and watching the right one go red:

- **`skill:<name>:owns-its-guardrails`** — a guardrail's `owner` skill must name it. This found
  **seven** live gaps: `tagspotter-copy` never mentioned `ai-capability-claims` or
  `distance-mislabelled`, `tagspotter-feature` never mentioned `crypto-theater`,
  `preload-strategy` or `dead-handlers`, `tagspotter-asset-pipeline` never mentioned
  `ionicons-glob`, `tagspotter-a11y-gate` never mentioned `currentcolor-in-background-image`. Seven
  invariants that CI enforced and no agent was ever told about. All seven are now written up in the
  skill that owns them.
- **`skill:<name>:guardrail-refs-resolve`** — a `guardrail:<id>` cited in a skill must exist. Clean
  today; this keeps a renamed guardrail from leaving a dangling instruction behind.
- **`skill:<name>:review-fresh`** — `review_by` in the frontmatter, failing once passed. Records have
  carried this since the corpus was built and `brain lint --strict` fails CI on a stale date
  (filing rule 3). Skills had no equivalent, which is exactly how this layer rotted quietly for
  months. Same mechanism, same commitment.

All six project skills are dated `2027-02-28` — deliberately the same day rather than staggered.
They are one layer and they rot together, and rereading them in one pass is what catches the
cross-skill drift: `tagspotter-feature` was still prescribing
`npm test -- --watch=false --browsers=ChromeHeadless` long after F-36 made headless the default, and
`tagspotter-copy` still said the onboarding modal "currently" claims an AI Caddie. Neither is
release-owned; neither would have surfaced from reading `tagspotter-release` alone. Both are fixed.

## What is still not covered, honestly

Nothing checks whether a sentence is true. `review_by` guarantees the file gets reread, not that the
reader is thorough. Filing rule 6 gained a step 4 — a guardrail ratcheting to 0 is not done until the
skill that owns it is rewritten to describe the invariant — and that step is a habit, not a gate.

The claim on this record is `true` in the sense that the instruction layer now has *a* ratchet, where
it had none. It is not the sense of "prose can no longer go stale."
