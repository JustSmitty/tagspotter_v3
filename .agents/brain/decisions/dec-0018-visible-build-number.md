---
id: dec-0018-visible-build-number
type: decision
title: The build number is user-visible in the handbook footer; the web fallback imports package.json
status: accepted
date: 2026-08-31
source: file:src/app/services/platform/app-info.service.ts:36
author: claude
confidence: high
tags: [release, versioning, capacitor, ux]
claims: {build-line-surface: handbook-footer, build-line-web-source: package-json-import}
supersedes: []
related: [dec-0013-zoneless-and-plugin-tokens, dec-0015-ink-follows-its-ground, dec-0011-esbuild-application-builder]
review_by: 2027-02-28
---

versionCode 4 and 5 both shipped as versionName 1.2.0, and during a live debugging session the
tester could not say which build their phone was running — Android app info and the Play listing
show only the versionName. So the app now prints "Edition {versionName} ({versionCode})" — e.g.
`Edition 1.2.0 (5)` — in the Traveler's Handbook footer, which is reachable at any time from the
help pin on Home. `AppInfoService` (`services/platform/`, behind `APP_INFO_PLUGIN` per dec-0013)
reads it from Capacitor `App.getInfo()`.

## The web fallback is an import of package.json, on purpose

`App.getInfo()` **rejects on the web** ("Not implemented on web.") — the plugin has no web
implementation, whatever the plugin's docs imply. The fallback shown there is
`"{package.json version} (web)"`, and the version comes from a **default import of package.json
itself** — the exact field `guardrail:version-parity` treats as the source of truth.

Two options were rejected:

- **A hardcoded fallback string** — an eighth copy of the version that `scripts/bump-version.mjs`
  does not move, guaranteed to drift by the next release.
- **Widening version-parity / bump-version.mjs to manage a new constant** — more release surface to
  hold the line on, for a value the build can simply derive.

The import derives from the source of truth, so parity holds by construction and the bump script
needs no knowledge of it.

The measured cost: esbuild cannot tree-shake property access off a default JSON import, so the
whole package.json (~2.6 kB raw, under 1 kB transfer) rides along in the lazy home-page chunk.
That is the dependency list of a public repo, not a secret, and it is noise against the 2 MB
initial budget — accepted. If it ever needs to go, the fix is a prebuild-generated version
constant, not a hand-written one.

## Two traps, if this is ever touched

1. `import { version } from 'package.json'` (the named form) builds fine under esbuild but the
   **Karma test target still runs webpack** (dec-0011, "not done, deliberately"), and webpack
   refuses named imports from JSON modules. Use the default import.
2. The handbook footer looks like fixed cream paper, and its stylesheet even sets
   `--background: #f7efdb` — but that var is **inert**: `ion-footer` has no toolbar to consume it,
   and the ground actually showing through is the modal's `::part(content)` background,
   `--app-surface-card` (global.scss `.handbook-modal`), which goes dark in dark mode. So the
   edition line takes **themed** ink (`--app-ink-muted`), per dec-0015 — ink follows its ground.
   The first cut used the sheet's fixed `#4f5d5a` and was near-invisible in dark mode; only the
   in-browser dark-mode check caught it, because the contrast audit walks routes, not overlays
   (pm-0003).
