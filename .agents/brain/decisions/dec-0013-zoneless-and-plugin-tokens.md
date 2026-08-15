---
id: dec-0013-zoneless-and-plugin-tokens
type: decision
title: Zoneless change detection, and never hand a Capacitor proxy to DI
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-26
author: justin
confidence: high
tags: [angular, performance, testing, capacitor, architecture]
claims: {change-detection: zoneless, capacitor-plugins-injected: true}
supersedes: []
related: [dec-0011-esbuild-application-builder, con-0003-windows-dev-commands]
review_by: 2027-06-30
---

`provideZonelessChangeDetection()` in `main.ts`, `zone.js` uninstalled, `polyfills.ts` and
`zone-flags.ts` deleted. Initial bundle **780 kB → 741 kB**; release APK 2.75 MB.

The migration was almost free because the codebase had already earned it: every component is OnPush,
all state is signals, and there is no `markForCheck` or `detectChanges` in application code anywhere.
zone.js was monkey-patching the entire browser API surface to discover changes the framework was
already being told about.

## Tests are zoneless too, deliberately

`src/test.ts` uses `platformBrowserTesting()` with a global `beforeEach` that provides
`provideZonelessChangeDetection()` — `configureTestingModule` merges, so every spec keeps working
without edits.

Keeping zone.js for the runner would have been easier and much worse: a component relying on
zone-driven change detection would pass every spec and fail on a device. Test and production must
agree about how change detection happens.

## The bug zoneless found

Injecting Capacitor plugins behind tokens (`PREFERENCES_PLUGIN`, `GEOLOCATION_PLUGIN`) made them
testable — Capacitor exposes plugins as proxy objects whose methods cannot be spied, so specs were
silently falling through to the real web implementation and asserting nothing.

But the first version provided the **proxy itself** as the injectable value. A Capacitor proxy
answers *any* property access with a callable, including `ngOnDestroy` — so Angular called it while
destroying an injector, hit the native bridge, and got `UNIMPLEMENTED`. Under zone.js that surfaced
as a swallowed unhandled rejection. Zoneless it disconnected the Karma browser and killed the run.

**Rule: never provide a Capacitor plugin object directly.** The token's factory returns a plain
object delegating to it, typed to the narrow surface this app actually uses. Two benefits beyond the
bug: DI never touches the proxy, and the interface documents exactly which plugin methods the app
depends on.

This is also a small argument for zoneless on its own merits — it turned a silent swallowed rejection
into a loud failure.
