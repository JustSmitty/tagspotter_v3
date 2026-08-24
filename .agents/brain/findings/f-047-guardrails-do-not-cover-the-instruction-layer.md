---
id: f-047-guardrails-do-not-cover-the-instruction-layer
type: finding
title: F-47 — guardrails ratchet the code, nothing ratchets the text that instructs agents
status: open
date: 2026-08-24
source: file:.claude/skills/tagspotter-release/SKILL.md
author: claude
confidence: high
tags: [agents, skills, brain, guardrails, process]
claims: {guardrails.cover-instruction-layer: false}
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

**Candidate guardrail, not yet built.** Cross-check the two layers instead of scanning prose: for
every `F-\d+` referenced in `.claude/skills/**/SKILL.md` or `.agents/brain/**/*.md`, if that finding
has a guardrail in `.agents/evals/guardrails.json` at `baseline: 0`, the surrounding text must not
also carry pending-work language ("open item", "turn on", "today it", "currently", "still", "must be
migrated"). Deliberately keyed off the guardrail baseline rather than a word list, because the
baseline is the fact and the prose is the thing that drifts from it.

Worth building carefully or not at all. `f-044-store-readiness` collects the fullest statement of
why: four separate checks in this repo have gone green while the thing they were named for was still
broken, every time because the rule was scoped to the instances someone had already found. F-45 and
F-46 are two more. A prose scanner is the easiest place yet to repeat that mistake.

**Cheap interim rule:** closing a phase is not done when the guardrail ratchets to 0. It is done when
every skill and record that names the finding has been reread and rewritten to describe the invariant
instead of the work.
