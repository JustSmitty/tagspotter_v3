---
id: con-0001-offline-first
type: constraint
title: The app must fully function with no network, forever
status: accepted
date: 2026-07-09
source: file:src/index.html:9
author: justin
confidence: high
tags: [offline, architecture, assets]
claims: {network-required-at-runtime: false}
supersedes: []
related: [dec-0003-self-host-fonts, dec-0004-inline-svg-atlas, con-0002-csp-no-remote-hosts]
review_by: 2027-06-30
---

Tag Spotter is played in a moving car, frequently with no signal. Every asset the app needs at
runtime — fonts, flags, GeoJSON, the states dataset — is bundled. There is no runtime fetch to any
host the app does not ship.

**Rules for agents:**

- Never add a CDN, remote font, tile server, analytics beacon or telemetry endpoint.
- Never make a feature depend on a network call succeeding. A feature that cannot work offline does
  not belong in this app.
- `HttpClient` is used only for same-origin bundled assets (`assets/us-states.json`). That is the
  only acceptable use.

This constraint is the reason for several decisions that look inefficient in isolation (bundled
fonts, hand-rolled SVG projection, a 51-state JSON in the build).
