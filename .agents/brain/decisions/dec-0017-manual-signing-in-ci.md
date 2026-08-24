---
id: dec-0017-manual-signing-in-ci
type: decision
title: The iOS archive signs manually with an installed profile, never automatically
status: accepted
date: 2026-08-24
source: file:.github/workflows/ios.yml:228
author: claude
confidence: medium
tags: [ios, ci, signing, release]
claims: {ios-ci-signing: manual-explicit}
supersedes: []
related: [con-0003-windows-dev-commands, dec-0016-iphone-only-ios]
review_by: 2027-02-24
---

The `archive` job in `.github/workflows/ios.yml` passed `DEVELOPMENT_TEAM` and
`-allowProvisioningUpdates` while the Xcode project sits at `CODE_SIGN_STYLE = Automatic`. That
combination cannot work on a CI runner, and it had never been exercised — the job has only ever
been *skipped*, because the signing secrets do not exist yet.

## The trap

`-allowProvisioningUpdates` reads like "let Xcode sort the signing out". What it actually does is
authorise Xcode to *contact the developer portal* and create or repair a profile — which requires an
authenticated Apple session. A GitHub runner has no such session unless an App Store Connect API key
is handed to `xcodebuild` explicitly. Automatic signing without that key fails before compiling a
single file, and the error names provisioning, not authentication, so it invites the wrong fix.

The profile is already installed on the runner by the previous step. Naming it is strictly simpler
than asking Apple to invent one:

    CODE_SIGN_STYLE=Manual
    CODE_SIGN_IDENTITY="Apple Distribution"
    PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME"

`ExportOptions.plist` carries the same answer (`signingStyle: manual` plus a `provisioningProfiles`
map). Left unset there, `-exportArchive` re-signs automatically and walks into the same wall one
step later, after the expensive part has already succeeded.

## Two things the install step now does that it did not

- **Reads the profile's `Name` and `UUID` out of the profile itself** (`security cms -D` into
  PlistBuddy) rather than hardcoding them, and fails loudly if its `application-identifier` is not
  `com.tagspotter.app`. A wrong profile otherwise surfaces as an opaque codesign error minutes later.
- **Writes the profile to both profile directories.** Xcode 16 moved from
  `~/Library/MobileDevice/Provisioning Profiles` to
  `~/Library/Developer/Xcode/UserData/Provisioning Profiles`. `macos-latest` is well past that, so
  the original path alone installs the profile somewhere current Xcode never reads.

## Confidence is medium on purpose

None of this has run. There is no Mac here (`con-0003-windows-dev-commands`) and no signing material
in the repository, so the whole path is reasoned, not observed. It removes failures that were
*certain*; it does not prove the run succeeds. Treat the first signed dispatch as a debugging
session, and file a postmortem if it fails for a reason listed above as solved.
