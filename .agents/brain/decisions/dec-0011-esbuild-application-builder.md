---
id: dec-0011-esbuild-application-builder
type: decision
title: Build with the esbuild application builder, output flat into www/
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-25
author: justin
confidence: high
tags: [build, performance, capacitor, angular]
claims: {angular-builder: application-esbuild, web-output-dir: www}
supersedes: []
related: [con-0003-windows-dev-commands, dec-0010-hybrid-flag-assets]
review_by: 2027-06-30
---

Migrated `@angular-devkit/build-angular:browser` (webpack, deprecated) to
`@angular-devkit/build-angular:application` (esbuild).

Initial bundle **1.29 MB raw / 259 kB transfer → 722 kB raw / 182 kB transfer**. Build time roughly
halved. Full suite stayed green with no source changes.

## The one thing that would have broken the native app

The application builder defaults to emitting into `<outputPath>/browser`. `capacitor.config.ts`
points `webDir` at `www`, so the default would have produced a `www/browser/index.html` that
Capacitor never looks at — and the failure appears only after `cap sync`, as a blank white screen on
device, with a perfectly green web build.

`outputPath` is therefore the object form:

```json
"outputPath": { "base": "www", "browser": "" }
```

If anyone ever changes `webDir`, these two must move together.

## Option changes required

`buildOptimizer`, `vendorChunk` and `namedChunks` are not valid for the application builder and were
removed from the `development` configuration. `main` became `browser`; `polyfills` became an array.

Note `angular.json` rejects `//` comment keys via schema validation — put explanation in a Brain
record like this one, not in the file.

## Not done, deliberately

The `test` target still uses the Karma/webpack builder. It is a separate target and works unchanged;
migrating the test runner is its own piece of work (audit F-36 / F-26), not a side effect of this
one.
