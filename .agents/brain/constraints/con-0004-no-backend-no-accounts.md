---
id: con-0004-no-backend-no-accounts
type: constraint
title: No backend, no accounts, no server that trusts client data
status: accepted
date: 2026-07-09
source: file:capacitor.config.ts:1
author: justin
confidence: high
tags: [architecture, privacy, threat-model]
claims: {backend: none, accounts: none}
supersedes: []
related: [con-0001-offline-first, dec-0005-retire-save-encryption, dec-0007-coarse-location-default]
review_by: 2027-06-30
---

Tag Spotter is a single-player local app. There is no server, no account, no leaderboard, and no
sync. All state lives in Capacitor Preferences on the device.

**This constraint defines the threat model.** There is no actor who benefits from tampering with
another player's data, because no other player and no server ever reads it. Any proposal justified
by "a user could cheat" must first say who is harmed. See dec-0005-retire-save-encryption.

It also defines the privacy posture that the store listing and the Home footer both claim: location
is read, used for one arithmetic operation, and discarded. Adding any transmission of user data
would make existing published copy false, so it is a store-listing change as well as a code change.
