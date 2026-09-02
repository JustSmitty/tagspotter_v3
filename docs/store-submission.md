# Store Submission Notes

## Store listing copy

**App name**

Tag Spotter

**Short description**

Spot state plates, answer trivia, and build your road-trip collection across the U.S.

**Full description**

Tag Spotter turns every road trip into a collection challenge. Mark plates as you find them, unlock state trivia, and earn bonus points for how far each sighting is from your current location.

Built with a retro travel look and fast one-tap gameplay, Tag Spotter keeps score across your full collection and lets you chase all 50 states plus Washington, D.C.

## Privacy and permission answers

**Why location is requested**

Tag Spotter asks for location only when a player marks a plate as found. The app uses that one-time reading to calculate a distance bonus.

**How location is handled**

- The app does not require location to function.
- Coordinates are not stored in app state.
- The app still records the plate if location access is denied or unavailable.
- Based on the current codebase, no location data is sent to a backend service.

## Before submission

Status as of 2026-08-24. Everything the repository can settle is settled; what remains needs an
account, a Mac, or a physical device.

### Done

- Privacy policy published at a live HTTPS URL and referenced from both metadata files.
- Real support and website URLs in the metadata JSON, with a guardrail against placeholders returning.
- Google Play listing assets captured from a release build and committed under `store-assets/`.
- Signed Android App Bundle builds locally against the upload keystore.
- iOS privacy manifest present, and CI asserts it lands inside the built `.app` rather than trusting
  the project file.

### Left, in the order worth doing it

Status as of 2026-09-01, after the App Store submission.

1. **Recruit 12+ Play closed testers.** The whole method, the exact opt-in mechanics, a message to
   send people, and the production-access questions are in `docs/play-closed-testing.md`. This is the
   only remaining work in either store that is purely elapsed time — 14 continuous days once twelve
   people are opted in — so it is the one thing worth starting today.
2. **Apply for Play production access** once the 14 days are clear. Three sections of questions, and
   one of them requires summarising real tester feedback, so collect some while the clock runs.
3. **Get the app onto an iPhone.** Nothing has ever run on iOS hardware. The TestFlight build is
   installable by anyone invited, and it is the same pool of people as item 1. iOS release is set to
   **manual**, so an approved build waits in "Pending Developer Release" — that window is the last
   free chance to catch a device-only bug before anyone can download it.
4. **Press the iOS release button** after review passes. It will not publish itself.

### Done

- **App Store: submitted 2026-09-01**, "Waiting for Review". Free, **United States only** (which
  removes the EU trader-status requirement), manual release. Full listing configured — screenshots,
  copy, categories, age rating, App Privacy, review notes. See
  `docs/store-questionnaire.app-store-connect.md`.
- iOS signing end to end: certificate, App ID, profile, API key, all seven CI secrets, and a signed
  `.ipa` produced and uploaded by `.github/workflows/ios.yml`. All of it built on Windows —
  `docs/app-store-release.md` records how, including the `-legacy` trap.
- Play Console questionnaires: content rating, Data Safety, target audience, ads, app access.
- Version parity at 1.2.0 / versionCode 17; signed AAB and APK build locally.

