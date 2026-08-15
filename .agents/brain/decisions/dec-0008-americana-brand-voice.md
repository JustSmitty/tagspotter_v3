---
id: dec-0008-americana-brand-voice
type: decision
title: One voice — 1950s Americana road trip, no golf metaphor
status: accepted
date: 2026-08-15
source: audit:audit-2026-08-15#F-01
author: claude
confidence: high
tags: [copy, brand, design-system, ux]
claims: {brand-voice: americana-roadtrip}
supersedes: []
related: [con-0006-design-system-authority]
review_by: 2027-02-28
---

**Accepted and executed 2026-08-15.** Every string listed below was rewritten; `guardrail:copy-lexicon`
is at 0 and now fails the build on recurrence. The lexicon lives in
`docs/design_principles.md` § Voice. "Scorecard" was deliberately *not* banned — a 1950s road-trip
ledger can legitimately be a scorecard (maintainer call).

One lesson from the rewrite: the first pattern missed four golf strings in the quiz modal
("Pinseeker Challenge", "Clubhouse Shot Tracker", "Shot N of M", "Punch N") because it only listed
terms the audit had already found. The pattern was widened rather than excused. **A guardrail
derived from a list of known instances will always miss the instances nobody looked at** — treat the
first green run as evidence the pattern is too narrow, not that the work is done.

The visual system is a 1950s road-trip scrapbook. Roughly 28 user-facing strings across 9 files are
written as a **golf game**: "On The Bag", LAYUP/ATTACK, "tee off", "Resume the Hole?", "Walk Off the
Green?", "Fairway Hit", "Green In Regulation", "Caddie Guide".

A first-time player opens a license-plate game and is told they are on the 18th green. These are not
a stylistic blend, they are two different products fighting.

Proposal: keep the Americana visuals, rewrite every string to match. LAYUP/ATTACK become SPOT/QUIZ;
"Caddie Guide" becomes "Traveler's Handbook", which is already what the README calls it. Enforced by
`guardrail:copy-lexicon`, which fails the build on any banned term.

Related and non-negotiable regardless of which way this goes: the onboarding modal tells the player
they have an "AI Caddie" (audit F-02). There is no AI in this app. That string is false and is an
app-store review risk, so the same guardrail bans it.
