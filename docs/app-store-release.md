# Mobile Release Guide

## Prerequisites

- Node.js and npm
- Android Studio with the Android SDK
- A macOS machine with Xcode for iOS archives and App Store uploads
- A Google Play Console app and Apple Developer app record created with the bundle ID `com.tagspotter.app`
- Release signing material kept outside the repo:
  - Android upload keystore and passwords
  - Apple signing certificate and provisioning profile or automatic signing access
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
- Copy `android/keystore.properties.example` to `keystore.properties` at the repo root and replace the placeholder values before building a signed release locally.
- Use version code increments for every Play upload.
- Upload an `.aab`, not an `.apk`, to Google Play.

## iOS signing notes

- Use the `com.tagspotter.app` bundle identifier for the App Store record.
- Increment `MARKETING_VERSION` for customer-visible releases and `CURRENT_PROJECT_VERSION` for each archive.
- Verify the archive uses Release configuration and automatic or explicit signing before upload.

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
