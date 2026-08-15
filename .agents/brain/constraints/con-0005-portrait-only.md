---
id: con-0005-portrait-only
type: constraint
title: Android is locked to portrait; layouts need not handle landscape
status: accepted
date: 2026-08-13
source: commit:dff551d
author: justin
confidence: medium
tags: [layout, android, ux]
claims: {android-orientation: portrait}
supersedes: []
related: []
review_by: 2027-02-28
---

`AndroidManifest.xml` sets `android:screenOrientation="portrait"` on MainActivity. The plate grid,
the postcard header and the atlas viewBox are all tuned for a portrait phone.

**Rules for agents:**

- Do not add landscape-specific CSS or media queries; they are dead code today.
- Do not remove the manifest lock as a side effect of another change — the atlas SVG viewBox
  (`0 0 600 400`) and the two-column plate grid have not been validated in landscape.
- Tablets are not a target. `sw600dp` resources exist only because the Capacitor template ships
  them.

Confidence is `medium` because iOS has no equivalent lock declared yet. If iOS ships, this record
needs re-verification.
