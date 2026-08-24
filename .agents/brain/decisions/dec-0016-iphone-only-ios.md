---
id: dec-0016-iphone-only-ios
type: decision
title: The iOS app ships iPhone-only; iPad is not a target
status: accepted
date: 2026-08-24
source: file:ios/App/App.xcodeproj/project.pbxproj:316
author: claude
confidence: high
tags: [ios, release, store, capacitor]
claims: {ios-device-family: iphone}
supersedes: []
related: [con-0005-portrait-only, dec-0017-manual-signing-in-ci]
review_by: 2027-08-24
---

`TARGETED_DEVICE_FAMILY` moved from Capacitor's scaffolded `"1,2"` (universal) to `"1"` (iPhone),
and the now-dead `UISupportedInterfaceOrientations~ipad` key came out of `Info.plist` with it.

## Why this was not a free default

Nothing had ever *decided* to support iPad — `"1,2"` is what `npx cap add ios` writes. But a
universal binary is a promise to three different audiences:

- **Apple**, who reviews the app on an iPad and rejects layouts that break there.
- **App Store Connect**, which will not accept the listing without 13-inch iPad screenshots
  alongside the iPhone set.
- **Players**, who install it on an iPad and find a phone layout stretched across a tablet.

None of that work exists. Android is deliberately portrait-locked (`con-0005-portrait-only`), the
layouts were never designed against a tablet breakpoint, and no iPad has ever run this app. Shipping
universal would have meant discovering all of that during review.

On an iPad the app still installs and runs, in iPhone compatibility mode. The difference is that it
is now honest about what it is.

## What would reverse this

Real tablet layouts, plus iPad screenshots in `store-assets/app-store/ipad/`. That is a product
decision with design work attached, not a one-line flag flip — even though reversing it *is* a
one-line flag flip, which is exactly why `guardrail:ios-ipad-target` now watches the line. Xcode
regenerating the project would silently restore the universal default otherwise.
