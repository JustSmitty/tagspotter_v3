---
id: f-043-nav-icons-were-black
type: finding
title: F-43 — the bottom-nav glyphs ignored their ink and painted black in both themes
status: resolved
date: 2026-08-15
source: device:pixel-10-pro-xl-screenshot-2026-08-15
author: claude
confidence: high
tags: [accessibility, dark-mode, design-system, icons, navigation]
claims:
  nav-icons.paint-method: mask-image
  nav-icons.currentcolor-works: true
supersedes: []
related: [dec-0015-ink-follows-its-ground, dec-0012-dark-mode-instrument-cluster, f-042-contrast-debt]
review_by: 2027-02-28
---

The four bottom-nav glyphs are inline SVG data URIs carrying `stroke="currentColor"`, applied with
`background-image`. **An SVG used as an image is its own document**, so `currentColor` there does not
inherit from the element — it resolves to the initial value, black.

`color: var(--app-nav-ink)` was set on `.nav-icon` the entire time and never reached the artwork.

Consequences, both shipped:

- **Dark mode:** four black glyphs on the near-black tags (`#262019`). Effectively invisible, which is
  what the user reported.
- **Light mode:** less obvious but equally wrong — the *active* tab drew a rust label beside a **black**
  pin. That mismatch was visible in every screenshot of the app ever taken and read as a design choice.

A `filter: grayscale(1)` on the inactive glyphs had been hiding the problem in light mode by making
everything look deliberately monochrome.

## Fix

Paint the glyph as a **mask** rather than an image:

```scss
background-color: currentColor;
mask-image: url('data:image/svg+xml,…');   /* + -webkit- prefix */
mask-size: contain;
```

The element's own background is what shows through, so `currentColor` genuinely applies. Masks use the
alpha channel, and these glyphs are opaque strokes on transparent, so they mask cleanly with no change
to the artwork.

Measured after: pine on tag card **8.49:1** in dark, **6.18:1** in light; active rust **4.70:1** on the
raised tag.

## Why the contrast audit never caught it

It measures **text**. These are non-text graphics, so a page of black-on-black icons reported 0
failures perfectly correctly. `scripts/contrast-audit.js` is not a substitute for looking at the
screen — and this was found by looking at a device screenshot, not by any check in the repo.

That is the second time in one day that a green suite coexisted with a visible defect; see also the
cream `.search-filter-bar` slab, which passed contrast because its *text* was dark on cream while the
surface itself had never been themed.

## Enforcement

`guardrail:currentcolor-in-background-image` (baseline 0) flags any `background-image` data URI that
mentions `currentColor`. Verified by introducing a violation and watching it go red.

It cannot catch the general case — an icon can be the wrong colour without mentioning `currentColor`
at all — so the rule to carry forward is the one in `dec-0015`: **an ink only applies if the thing
you set it on is what actually paints.**
