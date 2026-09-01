---
id: f-051-atlas-insets-projected-off-canvas
type: finding
title: Alaska and Hawaii drew every frame, just outside the map's window
status: resolved
date: 2026-09-01
source: file:src/app/shared/road-atlas/road-atlas.component.ts:214
author: claude
confidence: high
tags: [atlas, geojson, projection, svg, data-assumption, bug]
claims: {atlas.projection: single-uniform}
supersedes: []
related: [pm-0005-atlas-drawn-before-the-save-arrived, con-0001-offline-first, dec-0004-inline-svg-over-maplibre]
review_by: 2027-03-01
---

Two of the fifty states were missing from the Interactive Road Atlas for the entire life of the
feature. Not failing — *drawing*, correctly, outside the frame.

`project()` carried special cases for Alaska and Hawaii, written for their **real-world**
coordinates (Alaska around lat 51–71, lng -180..-130; Hawaii lng -160..-154). The shipped
`assets/us-states.json` does not use those: like most US atlas datasets it is **already an inset
map**, with Alaska and Hawaii pre-translated into the lower left of the continental frame — Alaska
at lng -130.6..-110, lat 22..29, Hawaii just east of it. Feeding pre-translated coordinates through
a real-world transform put Alaska at y 426..447 and Hawaii at x 586..628, against a 600×400
viewBox. Both paths were in the DOM, with correct geometry and correct labels, entirely off-canvas.

## Why nothing caught it

Every check the atlas had counted shapes, not positions. `road-atlas.component.spec.ts` asserted
that 2 of 2 features render, that found-state classes toggle, that a late-arriving save still draws
(pm-0005) — all true with the shapes off-screen. The component's own error path never fired,
because nothing failed. The rendered SVG reported 51 paths, which is the number that looks right.

The dataset is also the kind of input nobody re-reads: it was correct, complete, and had a plausible
shape, so the projection's *assumption about it* was never tested against the file. The mismatch is
invisible in the code — both halves look reasonable on their own.

## The lesson

**When code transforms data, assert the output lands where it belongs, not merely that output
exists.** A count is not a position. For anything projected, clipped, or laid out, the cheap check
is a bounding box against the visible region — it would have caught this on day one, and it costs
one assertion.

Corollary for third-party geodata: check whether it is *already* projected or arranged before
writing a transform for it. An inset map and a raw one are indistinguishable until you look at the
numbers, and the special-case branch is exactly where the wrong guess hides.

## Fix

One uniform projection for all 51 rendered features (Puerto Rico is in the file but has no state
record, so it never draws), fitted to the shipped extremes and preserving the old 9.6:15.2 lng:lat
ratio so shapes keep their proportions. The special cases are gone; the mainland is ~11% smaller to
make room for the insets the data always contained.

Two specs pin it, both failing against the old projection (`Hawaii x: Expected 627.6 to be less
than 300`): every state's path data must fall inside the viewBox, and Alaska and Hawaii must land
in the lower-left quadrant where an inset map puts them. Path strings are parsed rather than
measured, so the check needs no SVG layout and runs anywhere.
