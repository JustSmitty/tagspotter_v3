---
id: f-044-store-readiness
type: finding
title: F-44 — store readiness: what both stores require, and what is still missing
status: open
date: 2026-08-15
source: commit:51960d8
author: claude
confidence: high
tags: [release, store, ios, android, privacy, ci]
claims: {ios.privacy-collected-data: none, store.android-artifact: aab}
supersedes: []
related: [audit-2026-08-15, con-0004-no-backend-no-accounts, dec-0007-coarse-location-default, f-047-guardrails-do-not-cover-the-instruction-layer]
review_by: 2027-02-28
---

F-44 is the batch of things neither store will accept the app without. It was never in
`docs/remediation-plan.md`, which stops at Phase 5, and had no record until now — it existed only as
`phase: 6` on two guardrails in `.agents/evals/guardrails.json`. Filed retroactively from
`51960d8`, `6f51266`, `7b3b4d3` and `e38b0b1`.

## What landed

- **The AAB was verified, not assumed** (`51960d8`). `docs/app-store-release.md` had said "upload an
  .aab, not an .apk" since it was written, but `bundleRelease` had never actually been run. It
  works — 3.1 MB, valid `BundleConfig.pb`, `base/` module, baseline profile, R8 map embedded.
  `npm run release:aab` / `release:apk` exist now. **Upload `mapping.txt` with the bundle or every
  Play crash report comes back obfuscated.**
- **iOS privacy manifest** — `ios/App/App/PrivacyInfo.xcprivacy`, an App Store blocker. The Xcode
  project is a classic `pbxproj` with no Xcode 16 synchronized groups, so a file sitting in the
  folder *ships nothing and still fails review*: it needs a `PBXFileReference`, a `PBXBuildFile`,
  group membership, and a Copy Bundle Resources entry. Declares `UserDefaults` / `CA92.1` only,
  because `@capacitor/preferences` stores the save there and ships no manifest of its own (Capacitor
  core ships one, but it is empty). Nothing else is declared — over-declaring invites questions
  about APIs the app never calls.
- **`NSPrivacyCollectedDataTypes` is deliberately empty.** Apple defines "collect" as transmitting
  off-device; location is read once per spot, turned into a distance bonus, and discarded
  (`dec-0007-coarse-location-default`). That matches `docs/privacy-policy.md` and the Play Data
  Safety answers. **If sync or a leaderboard ever lands, this array stops being empty** — which is
  another reason `con-0004-no-backend-no-accounts` is load-bearing rather than a preference.
- **macOS CI** — `.github/workflows/ios.yml`, because the maintainer is on Windows. Manual dispatch
  or a `v*` tag only: GitHub bills macOS at 10x and an always-on iOS job drains a private repo's
  free tier in days. `compile` builds unsigned and asserts `PrivacyInfo.xcprivacy` is inside the
  built `.app` rather than trusting the pbxproj edit; `archive` signs and exports an `.ipa`.
  Publishing to App Store Connect sits behind an explicit `upload` input, so a tag push alone never
  sends a build to Apple. A shared scheme is committed because Xcode keeps schemes in gitignored
  `xcuserdata`, so `xcodebuild -scheme App` fails on a clean checkout.
- **Real listing URLs and a Pages site that publishes two pages** (`6f51266`). A Pages site is
  public *even when the repository is private*, and `docs/` holds the remediation plan, the release
  runbook, design principles and both metadata files with draft listing copy — all of which would
  have gone live the moment Pages was switched on. `docs/_config.yml` excludes them explicitly;
  anything added to `docs/` later is published unless it is on that list. The policy URL ends in
  `.html` on purpose — whether the extensionless path also resolves depends on Pages behaviour that
  cannot be verified from here, and a privacy policy URL that 404s is a store rejection.
- **Real contact address** (`7b3b4d3`) — `smittyapps@gmail.com`, support at the issue tracker.
- **Screenshots re-shot against a populated save** (`e38b0b1`). The first set showed 0 of 51 plates
  and 0 of 5 goals, which is unusable for a collection game. The replacements are from the signed
  release build against a 32-state trip, with point totals computed from the app's own reward tiers
  so they reconcile rather than being invented.

## The lesson this phase kept teaching

Both F-44 guardrails had to be **widened, not just re-baselined**, and each time the reason was the
same: the check would have gone green while the thing it is named for was still broken.

- `guardrail:version-parity` compared `package.json` to Android only. iOS sat at `MARKETING_VERSION
  1.0.0` / `CURRENT_PROJECT_VERSION 1` while Android was at `1.1.0` / `3`. A guardrail covering two
  of the three places a version lives reports green while the third drifts.
- `guardrail:store-placeholder-urls` matched `https?://example\.(com|org)` — URLs only — so it would
  have read 0 while `contactEmail` was `support@example.com`, which Play publishes on the listing
  page. Widened to `example\.(com|org)`.
- Its `include` then covered only `docs/store-metadata.*.json`, while `docs/privacy-policy.md` still
  carried a placeholder — and *that* is the file actually served to the public, at the exact URL
  handed to Google and Apple. Enabling Pages made the placeholder publicly visible before the
  guardrail had any opinion about it.

`7b3b4d3` states the general form: when adding a guardrail, the question is not "does this catch the
case I found" but **"what is the full set of files this rule is about"**. That is the same failure as
`guardrail:copy-lexicon` in Phase 1 and the low-alpha contrast rule in Phase 3, and the contrast
audit sampling only a gradient's first stop in `e38b0b1`. It is the most repeated defect in this
repo. See `f-045` and `f-046` for two more instances in the agent tooling itself.

## Still open

Nothing here is blocked on code — all of it is maintainer-only:

- **Pages switched on, and both URLs confirmed to load.** Not verifiable from the repo, and a dead
  privacy policy URL is a store rejection.
- **iPhone and iPad screenshots.** `store-assets/app-store/iphone` and `.../ipad` hold only
  `.gitkeep`. Play's `seven-inch` slot is empty too; `feature-graphic.png` exists.
- **1024×1024 marketing icon review signoff** (`docs/store-assets-checklist.md`).
- **App Store Connect signing secrets** for the `archive` job — documented in
  `docs/app-store-release.md`, but creating them is the maintainer's job.

The iOS workflow's `compile` job has run and passes: the build succeeded on the first attempt, which
was the genuinely uncertain part, and both follow-up commits (`32ba12d`, `fec62a4`) fixed the
*assertion* step rather than the build. Nothing in the repo records `archive` having run.
