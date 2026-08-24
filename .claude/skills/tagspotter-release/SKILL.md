---
name: tagspotter-release
description: Owns Tag Spotter's build configuration, CI, versioning, native Android/iOS config, and store submission. Use when the request involves release, publishing, versioning, CI pipelines, Gradle, APK/AAB, the Capacitor config, the Android manifest, tsconfig, ESLint or Karma configuration, or the Angular builder. Enforces version parity, release-build hardening, and the escalation rule for anything that ships outward.
---

# Tag Spotter — Release Engineering

## Hard rule before anything else

**Publishing is an escalation.** Uploading a build, pushing to `main`, submitting to a store, or
anything else outward-facing requires explicit confirmation from the maintainer in chat, every time.
Approval for one release is not approval for the next. Preparing and verifying a build is normal
work; sending it anywhere is not.

## Environment

Windows-first development (`con-0003-windows-dev-commands`) — use `npm.cmd run <script>`. CI is
Linux. Anything committed must work on both: no Windows-only paths, no line-ending assumptions.

`spawn EPERM` from Karma or the Angular compiler in a sandboxed desktop agent is an environment
permission problem, **not** a code defect. Never "fix" code in response to it.

## Version parity — `guardrail:version-parity`

Three files, five fields, one source of truth:

| Where | Field | Must equal |
|---|---|---|
| `package.json` | `version` | — this is the source of truth |
| `android/app/build.gradle` | `versionName` | `package.json` `version` |
| `android/app/build.gradle` | `versionCode` | a monotonic integer, never reused |
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` | `package.json` `version` |
| `ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` | Android `versionCode` |

`versionCode` increments on every store build and never goes backwards — Play rejects a reused code,
and there is no way to undo a published one.

They are no longer hand-synced (F-40). `scripts/bump-version.mjs` moves all of them together — use
it rather than editing three files and hoping:

```
npm.cmd run version:check          # report only, changes nothing
npm.cmd run version:bump -- patch  # or minor / major / build (build = versionCode only)
npm.cmd run version:sync           # align iOS to the current version, no bump
```

`guardrail:version-parity` checks all five. It did not always: it stopped at Android, and iOS sat
at `1.0.0` / `1` while Android reached `1.1.0` / `3` — green the whole time (F-44). Repair drift with
`version:sync`, not a bump; bumping burns a version number to fix a bookkeeping error.

## Release build hardening

Every item below is **done and guarded**; all of these guardrails read 0 in `npm run evals`. The job
here is holding the line, not doing the work again.

- **R8 is on.** `minifyEnabled true` + `shrinkResources true` on the release buildType (F-34).
  `guardrail:r8-disabled` scans `android/app/build.gradle` for `minifyEnabled false`.

  What makes R8 survivable is `android/app/proguard-rules.pro`. Capacitor resolves plugin methods
  **by name** through the bridge, so R8 sees no caller and strips them. Without those keep rules the
  "Open settings" button in the location-permission alert silently does nothing — *in release only*.
  So: do not trim the keep rules, and when a plugin or any other reflective entry point is added,
  smoke-test the **release** APK. A green debug build proves nothing about R8.

  R8 also means the shipped stack traces are obfuscated. Upload `mapping.txt` alongside the AAB or
  every Play crash report comes back unreadable.

- **CLI analytics is off.** `angular.json` has `"analytics": false` (F-41). Note the limit of the
  guardrail: `guardrail:cli-analytics` matches a committed *UUID*, so it will not catch the flag
  being flipped back to `true`. The setting is the invariant; the guardrail is only the backstop.

- **The CSP names no remote hosts and no `unsafe-eval`.** `script-src 'self'` (F-21, `con-0002`).
  `guardrail:csp-unsafe-eval` is a plain regex scan of `src/index.html`, which means the explanatory
  comment in that file cannot name the banned string either — it is worded around it on purpose.
  Keep it that way rather than adding a scanner exclusion. A guardrail that a comment can talk its
  way past is not a guardrail.

- **Backup behaviour is declared, not defaulted.** The manifest sets both
  `android:fullBackupContent` and `android:dataExtractionRules` (F-22), and the two XML files under
  `android/app/src/main/res/xml/` include sharedprefs while **excluding the in-flight quiz sidecar**
  (`CapacitorStorage.temp_quiz_session.xml`). Restoring a half-finished quiz alongside a save from a
  different moment is `pm-0001-stale-quiz-session` again, arriving by backup instead. A new
  persisted key is an explicit include/exclude decision in **both** files.

- **Release signing never references the debug keystore** (`guardrail:debug-keystore-in-release`).
  A debug-signed APK installs perfectly and can then never be updated on Play.

## Toolchain — settled, do not migrate again

All five migrations landed (phases 2 and 4). Each is now a shape to preserve, and each has a trap
that is cheap to reintroduce:

1. **Karma is headless single-run by default** (F-36). `karma.conf.js` sets
   `browsers: ['ChromeHeadless']`, `singleRun: true`, `autoWatch: false`, so `npm test` needs no
   flags; `npm run test:ci` is the same run with them spelled out for CI. Do not put
   `--browsers=ChromeHeadless` back into scripts or docs — forgetting the flags used to hang the
   run, and the fix was to make it the default rather than something to remember.
2. **ESLint is flat config** (F-38). `eslint.config.js` only; `.eslintrc.json` is gone. It is built
   from the individual plugin packages rather than the `angular-eslint` / `typescript-eslint`
   umbrellas, so the migration needed no new dependencies. It deliberately does **not** extend
   `typescript-eslint/recommended` — that surfaces ~34 further errors, which is worth doing as its
   own change and not smuggled inside a config edit.
3. **tsconfig `target` and `lib` are in step** (F-39): `target: es2022`, `lib: ["es2022","dom"]`,
   `useDefineForClassFields: true`. The old skew emitted modern syntax while refusing modern library
   methods — `Array.prototype.flatMap` failed to typecheck on an es2022 target. Move `target` and
   `lib` together or not at all.
4. **The `application` (esbuild) builder** (F-25, `dec-0011`). `outputPath` is the object form
   `{ "base": "www", "browser": "" }` on purpose: the builder otherwise emits into `www/browser/`,
   which `capacitor.config.ts` (`webDir: "www"`) never looks at. The symptom is a blank white screen
   on device after `cap sync`, behind a perfectly green web build. `outputPath` and `webDir` move
   together.
5. **Zoneless** (F-26, `dec-0013`). `provideZonelessChangeDetection()` in both `src/main.ts` and
   `src/test.ts`; no `polyfills.ts`, no zone.js. Every component stays OnPush + signals with no
   manual `markForCheck`. The trap `dec-0013` records: never hand a raw Capacitor plugin proxy to
   DI — it answers *any* property including `ngOnDestroy`, so Angular calls it during injector
   teardown and hits the native bridge. Inject behind a token.

After **any** build-config change: `npm.cmd run verify` (lint + headless suite + evals) then
`npm.cmd run build`, then `npx cap sync` and launch on a device. A green web build does not prove
the native shell works.

## Android specifics

- JDK 21 is auto-provisioned via `foojay-resolver` (`android/settings.gradle`). Do not add manual
  JDK instructions to docs — that was deliberately removed.
- Orientation is locked to portrait (`con-0005-portrait-only`). Do not remove it as a side effect.
- Keystore config is read from `keystore.properties`, which is gitignored and must stay that way.
  Never commit, print, or echo signing credentials.

## Store submission

`docs/store-submission.md`, `docs/app-store-release.md`, and `docs/store-metadata.*.json` are the
checklists. Store copy is copy — route wording through `tagspotter-copy`.

Play takes the **AAB**, not the APK: `npm.cmd run release:aab` (`release:apk` is for on-device smoke
tests). iOS builds on the macOS runner in `.github/workflows/ios.yml`, which is manual-dispatch or
`v*`-tag only because GitHub bills macOS at 10x; its App Store Connect upload sits behind an explicit
`upload` input, so a tag push alone never sends a build to Apple. See `f-044-store-readiness`.

Every URL in store metadata and the privacy policy is real and live —
`guardrail:store-placeholder-urls` bans `example.com`/`example.org` in those files, because a
placeholder that reaches them is publicly visible immediately.

Privacy declarations must match reality: location is read, used for one arithmetic operation, and
discarded (`con-0004-no-backend-no-accounts`, `dec-0007-coarse-location-default`). If a change makes
the published privacy copy false, that is a store-listing change too.

## Definition of done

- [ ] `npm.cmd run verify` clean — lint, full headless suite, evals, no baseline increased
- [ ] Production web build succeeds; bundle sizes reported
- [ ] `npx cap sync` and a real device launch for native changes
- [ ] Anything touching R8, plugins, or reflection smoke-tested on a **release** APK
- [ ] `npm.cmd run version:check` passes; `versionCode` incremented for a store build
- [ ] Outward-facing step? **Confirmed with the maintainer in chat first.**
