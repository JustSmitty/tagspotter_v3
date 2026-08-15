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

**Known debt:** the CSP still carries `unsafe-eval` with a comment blaming MapLibre, which is no
longer a dependency (audit F-21). The README still claims MapLibre in one section (audit F-03) —
exactly the contradiction this corpus's claims-checking exists to catch.
