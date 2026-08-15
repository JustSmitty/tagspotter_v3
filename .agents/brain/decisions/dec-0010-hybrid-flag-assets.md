---
id: dec-0010-hybrid-flag-assets
type: decision
title: Flags are SVG when cheap, WebP when they are seals
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-23
author: justin
confidence: high
tags: [assets, performance, flags, build]
claims: {flag-format: hybrid-svg-webp, flag-raster-width: 384}
supersedes: []
related: [con-0001-offline-first, dec-0002-slim-save-payload, ctx-0001-states-dataset]
review_by: 2027-06-30
---

The flags shipped as raw Inkscape exports: 8.39 MB across 51 files, up to 775 KB each, to draw a
56x56 thumbnail. `scripts/optimize-flags.mjs` now produces them, and the result is **0.44 MB —
95% smaller**, with nothing over the 40 KB per-file budget.

## Why hybrid rather than all-vector or all-raster

SVGO alone got 8.39 MB to 4.99 MB, but **33 of 51 files were still over budget**. Those are the
state seals: their weight is thousands of path points, not markup, so no amount of minification
reaches a sane size. Meanwhile the simple flags (stripes, tricolours, Texas, Colorado) compress to
under 1 KB and stay perfectly scalable.

So the rule is per-file, not per-project: **run SVGO on everything, and rasterize only what is still
over budget.** 20 stayed SVG, 31 became WebP. Each keeps the format that suits it.

`RASTER_WIDTH` is 384px because the largest box a flag is ever drawn in is the quiz answer option at
150x100 CSS px; 384 covers that at ~2.5x DPR. If a future screen displays a flag larger than that,
raise the constant and re-run the script — do not add a second size.

## Things that will bite the next person

- **`sharp` needs a computed density, not a fixed DPI.** These SVGs declare intrinsic sizes ranging
  from millimetres to thousands of pixels; a flat `density: 300` blew past sharp's pixel limit on the
  larger ones. `densityFor()` scales the DPI from the intrinsic width instead.
- **SVGO 4 moved `removeViewBox` and `collapseGroups` out of `preset-default`**, so overriding them
  there throws. viewBox is preserved by default in v4, which is what we wanted anyway.
- **`flagURL` in `states.json` now mixes extensions.** The script rewrites it to match what is on
  disk; never hand-edit it. This is safe for existing players because only `{ID, fnd}` is persisted
  (dec-0002-slim-save-payload) — `flagURL` is re-merged from seed on every load.

Verified by rendering all 51 into a contact sheet and looking at it: seals legible, colours correct,
no dropped paths. `guardrail:flag-budget` holds the line at 0.
