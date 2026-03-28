# Tag Spotter

Tag Spotter is an Ionic Angular mobile app for spotting state plates, answering trivia, and earning distance bonuses on the road.

## Development

- `npm.cmd run start` starts the Angular dev server.
- `npm.cmd run lint` runs ESLint.
- `npm.cmd run test -- --watch=false --browsers=ChromeHeadless` runs the Karma suite.
- `npm.cmd run build` creates the production web bundle in `www/`.

## Mobile release workflow

- `npm.cmd run assets:mobile` refreshes the Android and iOS app icons and splash artwork.
- `npm.cmd run build:mobile` builds the web app, regenerates mobile assets, and syncs Capacitor.
- `npm.cmd run android:open` opens the Android project in Android Studio.
- `npm.cmd run ios:open` opens the iOS project in Xcode on macOS.

See `docs/app-store-release.md` for signing and upload steps, and `docs/store-submission.md` for store listing copy and privacy answers.

## Store publishing assets

- docs/privacy-policy.md is the publishable privacy-policy source.
- docs/store-metadata.google-play.json and docs/store-metadata.app-store-connect.json hold the app-record metadata defaults.
- store-assets/ is the checked-in folder structure for screenshots and store graphics.

