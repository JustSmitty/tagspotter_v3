# Store Assets Checklist

Status as of 2026-08-24. Sizes are what each console actually rejects on, not preferences.

## Google Play — ready

| Asset | Where | State |
|---|---|---|
| Icon, 512x512, no alpha | `store-assets/google-play/icon-512.png` | present, regenerate with `npm run assets:store` |
| Feature graphic, 1024x500 | `store-assets/google-play/feature-graphic/` | present, same script |
| Phone screenshots (5) | `store-assets/google-play/phone/` | present, 1080x2404, captured from a release build |

Tablet folders (`seven-inch`, and any 10-inch set) are empty. Play accepts the listing without them;
it just will not present the app as tablet-ready. That is consistent with the app being portrait,
phone-first (`con-0005-portrait-only`).

## App Store — not ready

| Asset | Where | State |
|---|---|---|
| iPhone screenshots, 6.9" (1320x2868) or 6.7" (1290x2796) | `store-assets/app-store/iphone/` | **missing — required** |
| iPad screenshots | `store-assets/app-store/ipad/` | **not needed**, the target is iPhone-only (`dec-0016`) |
| 1024x1024 marketing icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | present, in the app bundle |

Capturing the iPhone set needs a Mac: either a Simulator running the release build, or a device.
There is no way to produce it from this Windows checkout, and a resized Android capture is not a
substitute — the status bar, safe areas and corner radius all differ.

## URLs — done

- Privacy policy: published and live, linked from both metadata files.
- Support: the repository's issue tracker, in both metadata files.
- `guardrail:store-placeholder-urls` fails the build if a placeholder ever comes back.

## Notes

- Capture screenshots from release builds, not dev builds.
- Use the same app name and point-total style across every screenshot.
- Re-check the permission copy on the screen flow used for location before recapturing.
