---
id: dec-0004-inline-svg-atlas
type: decision
title: Render the road atlas as inline SVG over bundled GeoJSON, not MapLibre
status: accepted
date: 2026-07-09
source: commit:d2a2eff
author: justin
confidence: high
tags: [map, rendering, offline, csp, bundle-size]
claims: {map-renderer: inline-svg}
supersedes: []
related: [con-0001-offline-first, con-0002-csp-no-remote-hosts]
review_by: 2027-06-30
---

`RoadAtlasComponent` projects `assets/us-states.json` into SVG paths itself (equirectangular, with
hand-tuned insets for Alaska and Hawaii). MapLibre GL and all tile hosts were removed.

Why: the map is a static, flat, full-country progress view. It never pans, zooms or fetches tiles,
so a full GL renderer bought nothing and cost a large dependency, remote tile hosts in the CSP, and
`script-src 'unsafe-eval'` for MapLibre's expression engine.

**Both known debts are closed** (`1a0b5b2`). The CSP no longer carries `unsafe-eval` or the comment
blaming MapLibre (F-21, held by `guardrail:csp-unsafe-eval`), and the README no longer claims
MapLibre alongside inline SVG (F-03, held by `guardrail:stale-tech-claims`). Both read 0.

F-03 is still worth remembering as the reference case for `claims:` — two sections of one README were
each true at a different time, and nothing short of a claims collision would have caught it.
