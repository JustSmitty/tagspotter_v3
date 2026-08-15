---
id: dec-0001-encrypted-save-envelope
type: decision
title: Store the save blob in a versioned AES-GCM envelope
status: superseded
date: 2026-07-11
source: file:src/app/services/state.service.ts:49
author: justin
confidence: high
tags: [storage, security, save-format]
claims: {save-format: v2-envelope, save-encryption: aes-gcm-hardcoded-key}
supersedes: []
related: [con-0004-no-backend-no-accounts, dec-0002-slim-save-payload]
review_by: 2027-02-28
---

Saves are written as `{version: 2, ciphertext}` where the ciphertext is AES-GCM over the JSON, with
a 12-byte random IV prepended. The v2 envelope replaced a pre-v2 format that stored raw base64 with
a *detached* checksum in a sibling `_sig` key — that was not atomic, so a crash between the two
writes left a save that failed its own integrity check and got discarded.

AES-GCM authenticates the payload itself, which is why the detached checksum could be dropped
entirely. `getStorageItem` still migrates both older shapes in place on read.

**What this decision does not claim:** that the save is secret. The key is derived from a hardcoded
password and hardcoded salt at 1000 PBKDF2 iterations, all of which ship in `main.js`. See
dec-0005-retire-save-encryption for the open challenge to this.
