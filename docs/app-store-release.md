# Mobile Release Guide

## Prerequisites

- Node.js and npm
- Android Studio with the Android SDK
- A macOS machine with Xcode for iOS archives and App Store uploads — or none, and the iOS workflow
  below does it (development here is Windows-only)
- A Google Play Console app and Apple Developer app record created with the bundle ID `com.tagspotter.app`
- Release signing material kept outside the repo:
  - Android upload keystore and passwords
  - Apple distribution certificate and an App Store provisioning profile for `com.tagspotter.app`
    (CI signs manually — `dec-0017` — so automatic signing access is not a substitute)
- Store metadata source files in this repo:
  - `docs/store-metadata.google-play.json`
  - `docs/store-metadata.app-store-connect.json`
  - `docs/privacy-policy.md`

## Release build flow

1. Run `npm.cmd install`.
2. Run `npm.cmd run build:mobile`.
3. Open Android Studio with `npm.cmd run android:open`.
4. Build a signed Android App Bundle from `Build > Generate Signed Bundle / APK`.
5. On macOS, open Xcode with `npm.cmd run ios:open`.
6. Select the `Tag Spotter` scheme, archive the app, and upload it through Organizer to App Store Connect.

## Android signing notes

- Keep the upload keystore outside the repo and configure it locally in Android Studio or Gradle properties.
- Copy `android/keystore.properties.example` to `android/keystore.properties` — **not** the repo
  root. Gradle reads it with `rootProject.file()` from the `:app` subproject, where `rootProject` is
  `android/`, so paths inside it resolve relative to `android/` too.
- **Back the upload keystore up somewhere off this machine before the first Play upload.** Both
  `secrets/` and `android/keystore.properties` are gitignored, by design, which means the only copy
  of the signing key is on one Windows box. Lose it before that first upload enrols the app in Play
  App Signing and `com.tagspotter.app` is unusable forever; lose it after, and it takes an upload-key
  reset request to Google.
- Use version code increments for every Play upload.
- Upload an `.aab`, not an `.apk`, to Google Play.

## Versioning

Never hand-edit the three places a version lives. Use the script:

```bash
npm run version:check     # report package.json / android / ios, non-zero on drift
npm run version:sync      # align ios to the current version without bumping
npm run version:bump -- minor   # or major / patch / build; always bumps versionCode
```

`guardrail:version-parity` enforces all three agreeing. iOS sat at `1.0.0 / 1` while Android was at
`1.1.0 / 3` precisely because the guardrail used to check only two of them.

## iOS signing notes

- Use the `com.tagspotter.app` bundle identifier for the App Store record.
- `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` are maintained by `npm run version:bump`.
- Verify the archive uses Release configuration and explicit signing before upload.
- The target is **iPhone-only** (`TARGETED_DEVICE_FAMILY = "1"`, `dec-0016`), so App Store Connect
  wants an iPhone screenshot set and no iPad set at all. `guardrail:ios-ipad-target` fails the build
  if a regenerated Xcode project quietly restores Capacitor's universal default.
- `Info.plist` answers export compliance up front (`ITSAppUsesNonExemptEncryption = false`), so
  builds do not sit in "Missing Compliance" waiting for a human. Adding encryption to the app means
  revisiting that key, not deleting it.
- CI signs **manually** against the installed profile, overriding the project's
  `CODE_SIGN_STYLE = Automatic` on the `xcodebuild` command line — `dec-0017` explains why automatic
  signing cannot work on a runner. `IOS_PROVISIONING_PROFILE_BASE64` must therefore be an **App
  Store distribution** profile for `com.tagspotter.app`; the workflow reads the profile's own name
  and UUID out of it and stops early if the bundle id does not match.

### Building iOS without a Mac

Development happens on Windows, so `.github/workflows/ios.yml` is the build machine. It runs on
`macos-latest` and is **not** triggered by ordinary pushes — GitHub bills macOS runners at 10x, which
would drain a private repo's free minutes in days. Trigger it from the Actions tab, or by pushing a
`v*` tag.

Two jobs:

| Job | Needs secrets | What it does |
| --- | --- | --- |
| `compile` | no | Builds for device with signing disabled, then asserts `PrivacyInfo.xcprivacy` is actually inside the built `.app` |
| `archive` | yes | Signed archive, exports an `.ipa`, uploads it as a build artifact |

The App Store Connect upload is a separate step gated on the `upload` input, so a tag push alone
never sends a build to Apple.

**Required repository secrets** (Settings → Secrets and variables → Actions). Create these yourself —
they are signing credentials and must never be committed or pasted into a chat:

| Secret | What it is |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | Apple Distribution certificate, exported as .p12, base64-encoded |
| `IOS_DIST_CERT_PASSWORD` | The password set when exporting that .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile for `com.tagspotter.app`, base64-encoded |
| `IOS_TEAM_ID` | 10-character Apple Developer Team ID |
| `APPSTORE_API_KEY_ID` | App Store Connect API key id (upload step only) |
| `APPSTORE_API_ISSUER_ID` | App Store Connect API issuer id (upload step only) |
| `APPSTORE_API_PRIVATE_KEY_BASE64` | The `.p8` private key, base64-encoded (upload step only) |

Base64 on macOS: `base64 -i cert.p12 | pbcopy`. On Windows:
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) | Set-Clipboard`.

> **Status.** The unsigned `compile` job has run green on `macos-latest`, so the Xcode project
> itself builds. The `archive` job has **never run** — it is skipped when the signing secrets are
> absent, and the repository has none yet. Everything about the signed path is reasoned from a
> Windows machine rather than observed, so expect the first signed dispatch to need adjustment.
> Order of dispatch: `signed=false` first whenever the project changed, then `signed=true` with
> `upload=false`, and only then `upload=true`.

## The shared scheme

`ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` is committed deliberately. Xcode writes
schemes into `xcuserdata`, which is gitignored, so without a shared copy `xcodebuild -scheme App`
fails on a clean checkout before compiling anything. If the Xcode project is ever regenerated, check
that the scheme's `BlueprintIdentifier` still matches the App target.

## Release verification

- Run `npm.cmd run lint`.
- Run `npm.cmd run build`.
- Run `npm.cmd run test -- --watch=false --browsers=ChromeHeadless` in an environment where Chrome can launch.
- Verify fresh install behavior on Android and iOS:
  - first launch renders without console errors
  - location prompt appears only when a plate is marked found
  - denying location still records the plate without a distance bonus
  - accepting location awards distance points
  - progress persists after relaunch
- Confirm store listings use the metadata and asset folders tracked in this repo.
