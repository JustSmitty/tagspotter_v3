---
id: dec-0007-coarse-location-default
type: decision
title: Default to coarse location, make precise opt-in
status: accepted
date: 2026-08-13
source: commit:dff551d
author: justin
confidence: high
tags: [privacy, location, permissions]
claims: {location-default: coarse}
supersedes: []
related: [con-0004-no-backend-no-accounts]
review_by: 2027-02-28
---

The app requests `coarseLocation` unless the player explicitly picks "Precise" in the Distance
Accuracy control on Home. `LocationService` treats a cached fine fix as satisfying a coarse request,
but never the reverse.

Rationale: the only use of location is a distance bonus whose reward tiers are 500-mile buckets, so
coarse accuracy is more than sufficient for the actual gameplay. Requesting fine location by default
would be asking for more than the feature needs. The manifest declares both permissions; only the
selected one is ever requested at runtime.

Location is never persisted or transmitted. Any change here must keep that true, and must keep the
footer note on Home accurate.
