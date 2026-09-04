# App Review rejection 2026-09-02 — Guideline 2.1, Information Needed

Submission `0fb12995-85c1-476f-807a-9b288198173a`, app version 1.2.0 (17), rejected
2026-09-02 11:02 PM under **Guideline 2.1 – Information Needed – New App Submission**.

**Nothing was found broken.** Apple's words: *"This app has been submitted by a developer account
that has a limited App Review history. We need additional information to better understand the app
and complete the review."* This is the routine information request for an account with no prior
approvals, and it is answered with information rather than a new build.

Apple asked for six things. Five are below and can be pasted as-is. The sixth is item 1, and it is
the reason this document exists rather than a resubmission.

## 1. Screen recording on a physical device — OUTSTANDING

> "A screen recording captured on a **physical device**, running the latest operating system,
> demonstrating the app's functionality. The recording must begin with launching the app and show
> the typical user flow."

**This cannot be produced from this project's development machine.** Development is Windows-only and
no iPhone exists (`app-store-submission-state` memory). A simulator capture does not satisfy a
request that says *physical device*, and a second rejection on the same guideline is a materially
worse position than the first.

The route is TestFlight: build 17 is already available there, so anyone with an iPhone can install
it and screen-record a run. What the recording needs to show, in order:

1. Launching the app from the home screen
2. The handbook that appears on first launch (skip it or page through it)
3. The Explore map, tapping a state, marking it as found
4. The location prompt — **allow it on one plate and deny it on another**, since both paths are part
   of the typical flow and the denial path is what the privacy answers assert
5. A trivia question answered after marking a plate
6. The Log tab showing the collection

Apple separately notes: *"Before submitting, run the submitted build through your own testing and
quality assurance process on supported physical devices."* That is worth taking at face value —
this app has never run on iOS hardware at all.

## 2. Purpose and target audience

Tag Spotter is a single-player road-trip game. Players spot license plates from other US states while
travelling, mark each one as found, and build a collection across all 50 states and Washington, D.C.
Marking a plate can award a bonus scaled to how far that state is from the player's current position,
and unlocks a short trivia question about the state.

The audience is families and travellers on US road trips. Spotting out-of-state plates is a
long-standing American car-trip pastime played on paper or from memory; the app keeps score,
remembers progress between trips, and adds the geography and civics trivia that the paper version
has no way to include.

## 3. Setting up and accessing the main features

No setup is required and there is nothing to configure. **The app has no accounts, no login, no
credentials and no sample files** — there is nothing for a reviewer to be given access to.

1. Launch the app. A handbook appears on first launch and can be skipped or paged through.
2. **Explore** (the opening tab) shows a map of the United States. Tap any state to open its plate.
3. Mark the state as found. The app asks for location permission at that moment, and only then.
   Allowing it awards a distance bonus; **denying it still records the plate**, without the bonus.
4. A trivia question about that state follows, drawn from its capital, bird, flower, nickname,
   admission year, landmark or flag.
5. **Log** shows the full collection, **Trivia** the topic list, **Goals** the milestone board.

## 4. External services, tools and platforms

**None.** The app makes no network requests of any kind and has no backend
(`con-0004-no-backend-no-accounts`). There are no data providers, authentication services, payment
processors, AI services, advertising networks or analytics SDKs. Its Content Security Policy permits
no remote hosts (`con-0002-csp-no-remote-hosts`).

It is built with Angular and Ionic, packaged for iOS with Capacitor, and runs as a WKWebView loading
files bundled inside the app. The complete runtime dependency list is Angular, Ionic, Capacitor
(core, app, geolocation, haptics, keyboard, preferences, status-bar), Ionicons, RxJS and tslib.

- The map is **inline SVG projected from GeoJSON bundled in the app**, not a tile service
  (`dec-0004-inline-svg-atlas`). There is no map provider.
- Trivia content ships in the app as static data. There is no content API.
- The **only** device API used is Core Location, via `@capacitor/geolocation`. It is read once, at
  the moment a plate is marked, converted to a distance, and discarded — never stored in the save
  file and never transmitted.
- Progress is saved locally with `@capacitor/preferences` (UserDefaults) as plain JSON
  (`dec-0009`).

## 5. Regional differences

There are none. The app behaves identically wherever it runs — there are no region-gated features,
no server to vary behaviour, and no remote configuration. Content is US-specific by design (50 states
plus D.C.) and the app ships in English (U.S.) only, with no localisation framework present.

The App Store listing is available in the **United States only**.

## 6. Regulated industry and third-party material

Neither applies. The app does not operate in a regulated industry and provides no regulated service.

It contains no licensed third-party material. The state flag images are official US state government
insignia and the state boundary geometry is public US government geographic data; the trivia content
is factual civics and geography (state capitals, birds, flowers, admission years) rather than
reproduced third-party work. This is the same basis as the **Content Rights: No** answer in App
Store Connect.

> **Gap worth closing:** the repository holds no provenance record for the 51 flag SVGs or the
> GeoJSON. The answer above is believed correct and is how the Content Rights question was answered,
> but it rests on the nature of the assets rather than on a documented source. If Apple presses on
> this, that record will have to be assembled.

## Resubmitting

Apple's instruction is to **reply in App Store Connect with all of the above and also add it to the
Notes field** of App Review Information, for future submissions. Items 2–6 are in the Notes field
already. The reply is not sent until the item 1 recording exists.

No new build is required — 1.2.0 (17) is still the submitted binary and is unchanged by any of this.
