---
id: dec-0005-retire-save-encryption
type: decision
title: Retire the save encryption or relabel it as tamper-friction
status: superseded
date: 2026-08-15
source: audit:audit-2026-08-15#F-20
author: claude
confidence: high
tags: [security, storage, threat-model]
claims: {}
supersedes: []
related: [dec-0001-encrypted-save-envelope, con-0004-no-backend-no-accounts]
review_by: 2026-11-30
---

`deriveEncryptionKey` uses a hardcoded password, a hardcoded salt and 1000 PBKDF2 iterations, all
shipped in the client bundle. Anyone who wants to edit their save can read the constants out of
`main.js` in about thirty seconds. It costs a PBKDF2 and AES round-trip on every save and protects
nothing.

Given con-0004-no-backend-no-accounts — single player, offline, no leaderboard, no server that
trusts this data — there is no actor whose cheating harms anyone. Two honest resolutions:

- **Remove it.** Store plain JSON. Simplest, fastest, leaves no false impression in the code.
- **Keep it, relabel it.** Leave the envelope as casual tamper-friction and say so in the comments,
  so the next reader does not mistake it for a security control.

Do not choose a third option of "make it stronger". There is no on-device key-storage story that
changes the outcome for an offline single-player game.

**Status stays `proposed` until the maintainer picks one.** This record deliberately declares no
`claims`, so it does not contradict dec-0001 while it is still under discussion.
