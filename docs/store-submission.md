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

- Publish `docs/privacy-policy.md` at a real HTTPS URL and add it to both stores.
- Replace placeholder support and website URLs in the store metadata JSON files.
- Capture current Android phone and iPhone screenshots from release builds and place them in `store-assets/`.
- Complete the content rating and data safety/privacy questionnaires using the behavior described above.
