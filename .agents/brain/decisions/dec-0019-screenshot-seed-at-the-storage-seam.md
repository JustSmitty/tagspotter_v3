---
id: dec-0019-screenshot-seed-at-the-storage-seam
type: decision
title: Store screenshots are seeded at the app's storage seam, not in the simulator's Preferences
status: accepted
date: 2026-09-01
source: file:src/app/services/platform/preference-storage.service.ts:36
author: claude
confidence: high
tags: [ios, release, store, screenshots, storage, ci]
claims: {screenshot-seed-mechanism: window-global-at-storage-seam}
supersedes: []
related: [f-044-store-readiness, dec-0016-iphone-only-ios, con-0001-offline-first, con-0002-csp-no-remote-hosts, dec-0009-plain-json-saves]
review_by: 2027-09-01
---

App Store screenshots need a played-looking collection, not a fresh install's empty board. The seed
is supplied by a `window` global that `PreferenceStorageService.get` reads before it calls the
Capacitor plugin — **not** by writing a save into the iOS simulator's Preferences.

## Why not the simulator's Preferences, which is the obvious way

Three attempts, six 10x-billed macOS runs, and it never worked once:

1. `simctl spawn <udid> defaults write <bundle-id>` — spawn runs *outside* the app sandbox, so it
   wrote the simulator's system-wide domain, not the app's container.
2. Writing the container plist from the host, then rebooting to flush `cfprefsd`.
3. Writing before the app's first launch with the device shut down, so no daemon held a cached
   domain. `defaults write` reported success and `plutil` then found no file at that path at all;
   the app rendered a black screen after the shutdown/boot cycle.

A diagnostic dump settled it: after a normal launch the app's data container held **no preferences
file whatsoever** — not our seed, not the app's own. Where this app's UserDefaults actually live on
an iOS 26 simulator was never established, and every further step would have been another guess
priced at ten minutes of billed macOS time.

## What the two failed verifications teach, which is the durable part

Both attempts shipped a check that passed while every screenshot came out empty.

- The first read the value back **through the same path it had written to**. That proves a write
  happened. It cannot prove the consumer can see it, and the consumer was the only thing that
  mattered.
- The second inferred "the app read our save" from "nothing overwrote our save" — equally true when
  nothing reads it at all.

A check whose subject is your own write, rather than the behaviour you care about, will confirm
whatever you just did. **Verify at the consumer.** The seam chosen here is a consequence of that:
seeding *at the app's storage boundary* means the thing being verified and the thing being used are
the same thing.

## Why this seam specifically

`PreferenceStorageService` is the single boundary between the app and device storage. A value
returned from there is indistinguishable from a stored one, so migration, normalization and
hydration all run exactly as they do for a real player — the screenshots show the real app, not a
mocked-up one. Seeding higher (in `StateService`, or by pre-populating the store) would have meant
bypassing the very code paths that make the screens truthful.

It also made the whole mechanism testable on Windows. The seam is platform-independent, so the
built web assets — with both helpers injected exactly as CI injects them — were served locally and
confirmed rendering a 28-state collection and booting straight onto `/goals`, before any macOS
minutes were spent. That is the reversal that mattered: the previous approach could only be tested
on the machine that costs money to rent.

## The safety property

The seed ships in no production build. It is a `window` global defined by a script the screenshot
workflow injects into the *built* assets, so a real build defines nothing and the branch is dead.
`guardrail:screenshot-hooks-in-src` fails the build if either helper is ever referenced from
`src/index.html`, because a committed tag would ship a fake 28-state save and a forced start route
to every player — and would look like a perfectly working app in review.

Both helpers are same-origin classic scripts, so `script-src 'self'` is unchanged (`con-0002`) and
nothing is fetched at runtime (`con-0001`).
