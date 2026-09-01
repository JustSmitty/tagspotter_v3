---
id: f-052-armv7-required-device-capability
type: finding
title: Info.plist required a CPU the app does not ship and no supported device has
status: resolved
date: 2026-09-01
source: file:ios/App/App/Info.plist:44
author: claude
confidence: medium
tags: [ios, release, store, capacitor, info-plist]
claims: {ios.required-capability: arm64}
supersedes: []
related: [dec-0016-iphone-only-ios, f-044-store-readiness, con-0002-csp-no-remote-hosts]
review_by: 2027-09-01
---

`UIRequiredDeviceCapabilities` listed `armv7` — a 32-bit ARM instruction set. It is what
`npx cap add ios` scaffolds, and like `TARGETED_DEVICE_FAMILY = "1,2"` before it
(`dec-0016-iphone-only-ios`), nobody ever chose it.

It was wrong in both directions at once:

- **The binary has no armv7 slice.** `IPHONEOS_DEPLOYMENT_TARGET` is 15.0. iOS 11 dropped 32-bit
  support entirely, so Xcode builds arm64 only. The app declared a requirement it does not satisfy.
- **No device that can install the app is armv7.** Every iOS 15 device is 64-bit. The key filtered
  nothing, because there was nothing left to filter.

So the declaration was inert *and* inconsistent with the binary. That is a bad combination to carry
into a first submission: it is exactly the class of metadata mismatch that App Store validation
comments on, and the failure would land during review of the very first upload — the point in this
project where the fewest things have ever been verified end to end (the iOS `archive` job has still
never run; see `f-044-store-readiness`).

Changed to `arm64`, which is what the binary actually contains.

## Why this was worth a guardrail and not just a fix

Capacitor rewrites the iOS scaffold. `dec-0016` records the same shape of regression for
`TARGETED_DEVICE_FAMILY`, and the reason it earned `guardrail:ios-ipad-target` applies unchanged
here: a value nobody chose, restored silently by tooling, invisible in review because it looks like
boilerplate. `guardrail:ios-armv7-capability` holds the line.

## A note on the guardrail's pattern

The pattern is the element form, `<string>armv7</string>`, not the bare token. The explanatory
comment in `Info.plist` names `armv7` on purpose — saying what was replaced is most of the comment's
value — and a pattern matching the bare word would fire on that comment.

This is deliberately *not* the `guardrail:csp-unsafe-eval` treatment, where the comment is worded
around the banned string rather than the scanner being loosened. The distinction: there, the banned
string is a bare token with no narrower form, so any precision has to come from the prose. Here the
defect has an exact shape — the value inside a `<string>` element — and matching that shape is more
precise than matching the word, not less. The scanner is not being excused past a comment; it is
looking for the actual defect.
