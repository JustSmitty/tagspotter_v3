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

1. **Start the Play closed test.** A personal Play developer account opened after November 2023
   cannot apply for production until a closed test has run with 12 or more testers opted in for 14
   continuous days. It is a calendar constraint, not a work item, so it should start before anything
   else here. Confirm whether the account is subject to it before assuming either way.
2. **Play Console questionnaires**: content rating, Data Safety (the answers are drafted in
   `docs/store-metadata.google-play.json` and in this file), target audience, ads (there are none),
   and app access (no login exists).
3. **Apple Developer enrolment, then the signing secrets** listed in `docs/app-store-release.md`.
   The iOS `archive` job has never run; expect the first dispatch to need adjustment.
   The App Store Connect App Privacy and age-rating answers are already drafted, with the
   code evidence for each, in `docs/store-questionnaire.app-store-connect.md` — including
   the notes-to-reviewer text that pre-empts the "why does a trivia game want location"
   question. They are answers to transcribe, not decisions to re-make.
4. **iPhone screenshots** at 6.9" or 6.7", from a Simulator or device running the release build.
   This is the one asset gap. No iPad set is needed — the target is iPhone-only (`dec-0016`).
5. **Device QA against the signed build**, not a debug build: first launch clean, the location prompt
   appearing only when a plate is marked found, denial still recording the plate, and progress
   surviving a relaunch. Those are the exact behaviours both privacy questionnaires assert, so they
   should be observed rather than assumed.
6. **Bump the version** when the store build is cut. `npm run version:bump` moves all three numbers
   together; `versionCode` may never repeat a value Play has already seen.
