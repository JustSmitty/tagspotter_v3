---
id: f-042-contrast-debt
type: finding
title: F-42 — WCAG AA contrast debt; plate names fixed, 16 remain
status: open
date: 2026-08-15
source: audit:contrast-audit-2026-08-15
author: claude
confidence: high
tags: [accessibility, contrast, design-system, backlog]
claims: {}
supersedes: []
related: [dec-0012-dark-mode-instrument-cluster, con-0006-design-system-authority]
review_by: 2026-12-31
---

Measured with `scripts/contrast-audit.js` on Home. Not caused by dark mode — dark adds zero — this is
pre-existing debt both themes share.

**45 → 16 in both themes (2026-08-15).** The 29 `.plate-state-name` failures are fixed; the rest are
header micro-type and chrome labels.

## Why the Phase 1 fix did not catch this

F-30 was scoped to one pattern — `color: rgba(0, 0, 0, α)` with low α — and `guardrail:low-alpha-text`
enforces exactly that pattern, which is at 0. But most of these failures are **saturated brand colours
on pale surfaces**, not black at low alpha. The guardrail was built from the instances the original
audit happened to find, so it never had a chance of seeing this class.

Same lesson as the copy lexicon (see `dec-0008-americana-brand-voice`): a guardrail derived from known
instances will miss the unexamined ones. A green regex is evidence about the regex, not about the app.

## Resolved: the plate names

The regional accents were chosen for the **large die-cast plate code** — 43px, which needs only 3:1
and passes comfortably. The same colour was also driving the **9px state name**, where it needs 4.5:1
and did not come close:

| Region | Was | Now | Plates |
|---|---|---|---|
| South | `#66B2B2` — 2.26:1 | `#407070` — **5.14:1** | 17 |
| Midwest | `#DAA520` — 2.18:1 | `#876614` — **5.19:1** | 12 |
| Northeast | `#8b0000` — 9.06:1 | unchanged | 9 |
| West | `#2f6f7c` — 4.97:1 | unchanged | 13 |

Each new ink is a darkened member of the same colour family, so a Midwest plate still reads harvest
gold and a Southern one dusty turquoise — the collection keeps its regional character rather than
being repainted. Northeast and West already passed and were left alone, but **every** region now has
an explicit `--region-*-name` token, so the next person editing an accent can see that two different
jobs depend on it.

**The lesson that generalizes:** one colour serving two type sizes is one colour doing two jobs. The
accent was never wrong — it had only ever been validated at the size where it passes.

## What remains: 16 failures, both themes

`.filter-chip` (4), `.l-key` (3), and one each of `.postmark`, `.brand-kicker`, `.points-label`,
`.neon-tube`, `.ledger-footer`, `.section-label`, `.switch-label`, `.precision-btn`, `.nav-label`.

These are header micro-type and chrome labels rather than collection art, so they carry none of the
design tension the plates did — mostly small uppercase text at low alpha or in a mid-tone accent.
Straightforward whenever someone picks it up.

## Enforcement

Contrast cannot be checked by the regex-based eval suite — it is a property of what actually rendered.
`scripts/contrast-audit.js` is the tool; **16/16 is now the number that must not rise.** Automating it
in CI would need a headless browser in the pipeline.
