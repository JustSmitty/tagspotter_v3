---
id: dec-0012-dark-mode-instrument-cluster
type: decision
title: Dark mode inverts the chrome; ephemera keeps its daylight colours
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-10
author: justin
confidence: high
tags: [design-system, dark-mode, accessibility, theming]
claims: {dark-mode: prefers-color-scheme, ephemera-inverts: false}
supersedes: []
related: [con-0006-design-system-authority, dec-0008-americana-brand-voice]
review_by: 2027-02-28
---

Dark mode is modelled on a **1950s instrument cluster at night** — warm near-black panels, amber-lit
type, brass and gold taken from the existing Americana palette. Not a desaturated inversion of the
daytime paper, which would have read as grey cardboard.

## The rule that made it tractable

**The chrome inverts. The ephemera does not.**

License plates, flags, stamps and the postcard keep their daylight colours in both themes, because in
the fiction they are physical objects — a Colorado plate is the same plate under a streetlight. Only
the surfaces holding them change. This is why the `region-*` tokens have no dark override: their
absence is the decision, not an oversight.

Besides being coherent with the "physicality" pillar in `docs/design_principles.md`, this cut the
work from "re-theme ~150 hardcoded colours" to "theme the surfaces, leave the collectibles".

## The trap it creates, and the token that fixes it

An ephemera surface that keeps light card stock but inherits themed ink renders **cream on cream**.
That is what happened to the score on the postcard: `.points-value` used `--app-ink-deep`, which is
light in dark mode, on paper that stayed cream — 1.01:1, completely invisible.

So `--app-ink-on-ephemera` exists and is **deliberately never redefined in the dark block**. Any text
printed on the postcard or a plate uses it. `.postcard-front` and `.plate-body` set it as an
inherited default, so new markup inside them is right by default.

## How it was verified

Not by eye — the browser pane could not composite screenshots. `scripts/contrast-audit.js` walks
every rendered text node, composites the real background through translucent ancestors, and computes
WCAG ratios. Run in both schemes with a reload between.

Result: light 45 failures, dark 45 failures. **Dark mode adds zero contrast regressions.** The 45 are
pre-existing debt in both themes, now tracked as F-42.

Two measurement traps worth knowing before trusting a contrast number:

- A naive checker that only reads `backgroundColor` climbs straight past a gradient. The postcard's
  paper is a gradient, so the first run reported its entire contents as failures against the page
  behind it — 55 phantom failures out of 100.
- `matchMedia` and the emulated colour scheme can disagree until the page is reloaded, which produced
  a run with light tokens and dark surfaces mixed together. Always reload after switching.
