---
id: f-042-contrast-debt
type: finding
title: F-42 — 45 text elements fail WCAG AA contrast, in both themes
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

Measured with `scripts/contrast-audit.js` on Home: **45 failures in light, 45 in dark**. Not caused by
dark mode — dark adds zero — this is pre-existing debt that both themes share.

| Selector | Count | Example |
|---|---|---|
| `.plate-state-name` | 29 | Harvest Gold `#DAA520` on `#fffde7` — **2.18:1** |
| `.filter-chip` | 4 | muted green at 0.64 alpha |
| `.l-key` | 3 | ledger keys at 0.5 alpha |
| `.postmark`, `.brand-kicker`, `.points-label`, `.neon-tube`, `.ledger-footer` | 1 each | header micro-type |

## Why the Phase 1 fix did not catch this

F-30 was scoped to one pattern — `color: rgba(0, 0, 0, α)` with low α — and `guardrail:low-alpha-text`
enforces exactly that pattern, which is now at 0. But most of these failures are **saturated brand
colours on pale surfaces**, not black at low alpha. The guardrail was built from the instances the
original audit happened to find, so it never had a chance of seeing this class.

Same lesson as the copy lexicon (see `dec-0008-americana-brand-voice`): a guardrail derived from known
instances will miss the unexamined ones. A green regex is evidence about the regex, not about the app.

## The hard part

The 29 `.plate-state-name` failures are the regional palette doing its job — Harvest Gold on Harvest
Sun *is* the Midwest plate. Fixing contrast by darkening those accents changes the look of the
collection, which is the thing the design system most wants to protect (`con-0006`). Options, none
free:

1. Darken each region's accent until it clears 4.5:1 on its own background. Safest for users, changes
   the art.
2. Keep the accent for the large plate code and give the small state name a fixed dark ink. Preserves
   the palette where it reads at size, fixes it where it does not.
3. Increase the small type's size/weight so 3:1 applies instead of 4.5:1. Least disruption, least
   benefit.

Option 2 looks best but it is a design call for the maintainer, not something to slip in silently.

## Enforcement

Contrast cannot be checked by the regex-based eval suite — it is a property of what actually rendered.
`scripts/contrast-audit.js` is the tool; the baseline of 45/45 is the number that must not rise.
Automating it in CI would need a headless browser in the pipeline.
