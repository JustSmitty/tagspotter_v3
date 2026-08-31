---
id: pm-0005-atlas-drawn-before-the-save-arrived
type: postmortem
title: The atlas joined two async arrivals in the order only the browser guarantees
status: resolved
date: 2026-08-31
source: file:src/app/shared/road-atlas/road-atlas.component.ts:117
author: claude
confidence: high
tags: [angular, signals, race, capacitor, native, atlas, state, bug]
claims: {atlas.join: reactive-computed}
supersedes: []
related: [pm-0004-env-safe-area-is-zero-on-android, pm-0001-stale-quiz-session, con-0001-offline-first]
review_by: 2027-02-28
---

## What happened

On the freshly installed internal build the Interactive Road Atlas card rendered its header, its
"Tap a state to inspect its plate" line and its spotted count — and then nothing. No map, no state
outlines, no labels, no error, no retry button, no loading text. A correctly sized, entirely empty
card. It stayed empty for the whole session; only relaunching could change it.

The map draws from two independent arrivals: the geometry, fetched over HTTP from
`assets/us-states.json`, and the state records, hydrated from storage. `loadAtlas()` joined them
eagerly, inside the fetch's own `await`:

```ts
const data = await firstValueFrom(this.http.get(...));
const statesByName = new Map(this.store.snapshot().states.map(...));   // read once, right here
this.features.set(data.features.reduce(... if (!state) return result ...));
```

`GameStateStore.states` starts as `signal([])` and only fills when `hydrate()` resolves. If the
fetch won that race, `statesByName` was empty, every one of the 51 shapes was discarded as
"unmatched", and `features` — a plain signal, written once — was set to `[]` and never recomputed.

## Root cause

**An ordering assumption that only holds on the platform it was written on.** On the web, hydration
reads `localStorage` through Capacitor Preferences and settles almost immediately, while a 75 KB
GeoJSON fetch takes a network turn; hydration wins, and the join is correct every time. On a device
the costs invert: the GeoJSON comes off the local asset bundle while hydration crosses the native
bridge — and on a *first* launch after install there is no save yet, so the store has to build and
persist the initial 51-state ledger before it can answer. The geometry wins comfortably.

The filtering is what made it silent. `reduce` with `if (!state) return result` treats "no matching
state record" as a per-feature fact about the data, indistinguishable from a genuinely unknown
region. Fifty-one of them in a row is a different fact entirely — the store was not ready — but
nothing was in a position to notice, so the failure had no error to report and the component's own
`loadError` stayed null.

The one-shot `signal` sealed it. Hydration completing a moment later changed the store, and the map
had already stopped listening.

## The lesson

**When two async sources have to meet, join them in a `computed`, not inside whichever one you
happened to `await`.** A derivation cannot be early: whichever half lands second, the result
recomputes. The eager version is a correct-looking snapshot of a moment that had no right to be
authoritative — and it encodes a race into a place where the race is invisible.

More generally: relative timing is a platform property, not a fact about the code. A browser and a
WebView-plus-native-bridge disagree about which of two promises is fast, and neither ordering is
wrong. Code that only works under one of them is broken under both — it just has not been observed
yet. This is the same shape as [[pm-0004-env-safe-area-is-zero-on-android]], found in the same
session: the browser answering a question the device answers differently.

## Guardrail

No regex can see this class, so the check is behavioural: `road-atlas.component.spec.ts › draws the
map when the save arrives after the geometry` mounts the component with an empty, un-hydrated store,
asserts the card says it is still drawing rather than sitting blank, then fills the store and
asserts all shapes appear. Against the previous component it fails with `Expected 0 to be 2` —
precisely the empty card from the device.

The fix also closes the reporting gap that hid it: `isLoading` now covers *both* halves
(`isFetching() || !store.isLoaded()`), so the window before the store is ready renders as "Drawing
the road atlas…" instead of an unexplained void. A surface that cannot yet draw should say so; a
blank card is the one outcome that tells the user nothing and the developer less.
