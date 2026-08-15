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

Three numbers must agree, and today they are synced by hand (audit F-40):

| Where | Field |
|---|---|
| `package.json` | `version` |
| `android/app/build.gradle` | `versionName` |
| `android/app/build.gradle` | `versionCode` (monotonic integer, never reused) |

`versionName` must equal `package.json` `version`. `versionCode` increments on every store build and
never goes backwards — Play rejects a reused code, and there is no way to undo a published one.

## Release build hardening

Open items from the audit; each has a guardrail:

- **`guardrail:r8-disabled`** — `minifyEnabled false` on the release buildType (F-34). Turn on R8,
  then **smoke-test the release APK**, not just the debug one. `AppSettingsPlugin` is reached
  reflectively through Capacitor's plugin registry, so it needs a keep rule in
  `proguard-rules.pro` or the "Calibrate GPS" button silently dies in release.
- **`guardrail:cli-analytics`** — `angular.json` has a committed CLI analytics UUID (F-41). Set it
  to `false`; every contributor's builds currently report under the maintainer's ID.
- **`guardrail:csp-unsafe-eval`** — `script-src 'unsafe-eval'` for a MapLibre dependency that no
  longer exists (F-21, `con-0002`). Remove the directive *and* its stale comment together.
- **Data extraction rules** (F-22) — `allowBackup="true"` with nothing declared for API 31+.

## Toolchain migrations, in this order

Each is independently shippable. Do not batch them — when a build breaks you want one suspect.

1. **Karma → headless by default** (F-36). `npm test` must be single-run headless with no extra
   flags. Today the config defaults to `browsers: ['Chrome'], singleRun: false`.
2. **ESLint flat config** (F-38). `.eslintrc.json` is legacy under ESLint 9; it works via compat and
   will stop.
3. **tsconfig alignment** (F-39). `target: es2022` with `lib: ["es2018","dom"]`, plus
   `useDefineForClassFields: false`.
4. **`browser` → `application` builder** (F-25). Deprecated webpack builder → esbuild. Changes output
   layout; run it *after* the asset cleanup so you are validating against a small `www/`.
5. **Zoneless** (F-26). Every component is OnPush with signals and no manual `markForCheck`, so
   `provideZonelessChangeDetection()` should be a config change. Full suite must stay green.

After **any** of these: `npm.cmd run lint && npm.cmd run test -- --watch=false --browsers=ChromeHeadless && npm.cmd run build`,
then `npx cap sync` and launch on a device. A green web build does not prove the native shell works.

## Android specifics

- JDK 21 is auto-provisioned via `foojay-resolver` (`android/settings.gradle`). Do not add manual
  JDK instructions to docs — that was deliberately removed.
- Orientation is locked to portrait (`con-0005-portrait-only`). Do not remove it as a side effect.
- Keystore config is read from `keystore.properties`, which is gitignored and must stay that way.
  Never commit, print, or echo signing credentials.

## Store submission

`docs/store-submission.md`, `docs/app-store-release.md`, and `docs/store-metadata.*.json` are the
checklists. Store copy is copy — route wording through `tagspotter-copy`.

Privacy declarations must match reality: location is read, used for one arithmetic operation, and
discarded (`con-0004-no-backend-no-accounts`, `dec-0007-coarse-location-default`). If a change makes
the published privacy copy false, that is a store-listing change too.

## Definition of done

- [ ] `npm.cmd run lint` clean
- [ ] Full suite green, headless
- [ ] Production web build succeeds; bundle sizes reported
- [ ] `npx cap sync` and a real device launch for native changes
- [ ] Version parity guardrail passes; `versionCode` incremented for a store build
- [ ] `npm run evals` green, no baseline increased
- [ ] Outward-facing step? **Confirmed with the maintainer in chat first.**
