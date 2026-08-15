---
id: f-042-contrast-debt
type: finding
title: F-42 — WCAG AA contrast debt, cleared to zero in both themes
status: resolved
date: 2026-08-15
source: audit:contrast-audit-2026-08-15
author: claude
confidence: high
tags: [accessibility, contrast, design-system, dark-mode]
claims:
  contrast.baseline.light: 0
  contrast.baseline.dark: 0
  contrast.scope: all-five-routes-populated
supersedes: []
related: [dec-0012-dark-mode-instrument-cluster, con-0006-design-system-authority, dec-0015-ink-follows-its-ground]
review_by: 2026-12-31
---

Measured with `scripts/contrast-audit.js`. Started as 45 failures on Home in both themes; **now 0 and
0**, measured across all five routes in both themes against a save with 26 of 51 states spotted.

**45 → 16 → 0.** The 29 `.plate-state-name` failures went first, then the remaining chrome labels,
then a final four that only appeared once the app had data in it.

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

## Resolved: the last four, and why they were invisible

The final pass found four failures that no earlier run could have caught, because **the earlier runs
measured an empty app**. Stamps, badges and the summary only render once states are spotted. After
seeding 26 states:

| Element | Was | Fix |
|---|---|---|
| `.stamp-code` ×26 | white on a region overlay at 0.7 over cream → **2.67:1** | own translucent slug + `--app-ink-on-fill` |
| `.trip-compare__delta--up` | `--ion-color-success` on card → **2.70:1** | new themed `--app-success-ink` |
| `.postmark`, `.brand-logotype` | `--app-rust-ink` brightened onto fixed cream → **2.79:1** | `--app-rust-on-ephemera` |
| `.brand-kicker`, `.points-label` | themed inks on the postcard → **1.72:1** | fixed ephemera inks |

The region overlays could not simply be darkened: regions are fixed ephemera under
`dec-0012-dark-mode-instrument-cluster`. Giving the ink its own ground — the same slug the travel
stamp's abbreviation already used — fixes all four regions at once instead of the one that happened
to be measured.

## The quiz modal: eight more, found without rendering it

The modal is presented through `ModalController` and needs a live geolocation + alert flow, which the
harness could not drive. Every colour in it is a **static constant**, though, so the palette was
settled arithmetically instead — see `scripts/` scratch work reproduced in the commit message:

| Element | Was | Now |
|---|---|---|
| `.pass-banner` ink, 4 of 5 regions | 3.66 – 4.35:1 | 4.62 – 8.76:1 |
| `.option-marker`, South and West | 3.83 / 4.07:1 | 5.99 / 8.26:1 |
| `.route-name` on the topline accent | 3.37:1 (incl. its `opacity: 0.9`) | ≥ 5.99:1 |

Three moves, all of them precedents from earlier in this finding: small text moved from
`--quiz-accent` to `--quiz-accent-strong` (one colour, two jobs — the accent was chosen for the 48px
route code); the decorative cream stripe dropped from `0.16` to `0.07` alpha, which was eating up to
1.5 points of contrast from the banner ink; and `.route-name`'s `opacity: 0.9` deleted outright,
since "adjust lightness, never reach for alpha" is this project's own rule.

The topline gradient now runs from `--quiz-accent-strong` to a darkened form of itself, so **every
point on the ramp** is at least as dark as the strong accent. That removes the need to reason about
which end a given label sits on — the earlier version was only safe if `.route-name` happened to land
on the left.

> **Caveat, recorded deliberately:** these eight are verified by computation over static colour
> values, not by rendering. The other 45 were verified both ways and agreed. This surface still wants
> a rendered pass on device.

## The measurement was wrong four separate times

Every one of these cost more time than the bug behind it, so they are now documented in the script
header:

1. **Discarding the accumulated stack.** The postcard's paper is alpha 0.98, never 1.0, so a checker
   that only accepts a fully-opaque layer fell through to the page and read dark-on-cream as
   dark-on-dark — `1.27:1` for text that was perfectly legible.
2. **Resolving surfaces via the `--background` custom property.** Custom properties *inherit*, so
   every descendant of `ion-content` reported the page's background as its own.
3. **Ignoring shadow DOM.** Ionic paints `ion-button`'s fill on `.button-native` inside the shadow
   root; the host measures transparent, so the rust buttons read as cream-on-cream.
4. **Measuring an empty app** — see above.

**The tell, in every case: a result that flips between themes for an element whose ground does not.**
A fixed fill cannot pass in dark and fail in light. When that happens the checker is wrong, not the
app. That heuristic caught 3 and 4 directly.

## Enforcement

Contrast is a property of what actually rendered, so the regex suite cannot check it;
`scripts/contrast-audit.js` is the tool and **0/0 is now the number that must not rise**. Automating
it would need a headless browser in CI.

`guardrail:background-token-as-ink` (baseline 0) covers the one mechanical slice of this that a regex
*can* see: `--app-bg-*` used as a `color`. That was four real failures. It was verified to fire by
introducing a violation, not just by observing it green — see `dec-0008` on why a green check proves
nothing until you have watched it go red.
