---
id: dec-0006-standalone-onboarding-flag
type: decision
title: Keep the onboarding-seen flag outside the encrypted save blob
status: accepted
date: 2026-07-11
source: file:src/app/services/state.service.ts:37
author: justin
confidence: high
tags: [storage, onboarding, ux]
claims: {onboarding-flag-location: standalone-key}
supersedes: []
related: [dec-0001-encrypted-save-envelope]
review_by: 2027-02-28
---

`tagspotter_v1_onboarding_seen` is written as its own preference key, mirrored from the save blob on
every write and restored from on load when the blob is missing.

The reason is a specific bad experience: a corrupted or failed-integrity save triggers a fresh
reset, and if the onboarding flag lived only inside that blob, a returning player would be shown the
five-page handbook again as if they were brand new. The blob stays authoritative when present; the
standalone key only fills the gap.

The same reasoning applies to `tagspotter_v1_location_precision` — a privacy preference must survive
a trip reset.
