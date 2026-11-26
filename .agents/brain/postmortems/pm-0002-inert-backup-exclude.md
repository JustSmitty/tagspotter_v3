---
id: pm-0002-inert-backup-exclude
type: postmortem
title: The backup rule that held back the quiz sidecar excluded a file that never existed
status: resolved
date: 2026-08-24
source: commit:1a0b5b2
author: claude
confidence: high
tags: [android, backup, quiz, state, persistence, guardrails, bug]
claims: {quiz-session.stale-guard: resume-path}
supersedes: []
related: [pm-0001-stale-quiz-session, con-0004-no-backend-no-accounts, f-049-guardrails-do-not-cover-the-instruction-layer]
review_by: 2027-02-28
---

## What happened

`backup_rules.xml` and `data_extraction_rules.xml` both carried:

```xml
<include domain="sharedpref" path="." />
<exclude domain="sharedpref" path="CapacitorStorage.temp_quiz_session.xml" />
```

The exclude matched no file, and never had. `temp_quiz_session` is a *key* inside Capacitor
Preferences, not a SharedPreferences file: the plugin calls
`getSharedPreferences(configuration.group, MODE_PRIVATE)` with `group` defaulting to
`CapacitorStorage`, and no `Preferences.configure` call exists anywhere in `src/`. Every key the app
writes therefore lives in one file, `CapacitorStorage.xml`. `domain="sharedpref"` selects files, so
per-key exclusion is not expressible in those XML files at all.

Android does not warn on an exclude that matches nothing. The manifest parsed, the build was green,
and the comments in both files — plus the release skill that instructs agents about them — stated
the sidecar was held back. It was backed up and restored in full for two releases.

## Root cause

**The exclusion was written in the only layer that could not express it.** The rule files address
files; the thing to exclude was a key. That mismatch is invisible at the point of writing, because
the config format accepts any string as a path and the platform silently ignores one that matches
nothing. There is no failing state to notice — an inert rule and a working rule look identical from
every angle except a device.

Two things made it survive. The syntax was plausible: `CapacitorStorage.temp_quiz_session.xml`
reads exactly like a real Capacitor filename. And the belief was written down three times — in both
XML comments and in `tagspotter-release` — so each restatement became evidence for the next reader
rather than an independent check. F-49's failure mode, in a config file.

## What the hazard actually was

Narrower than the comments claimed, and worth recording because the exaggeration is what made the
fix look obvious when it was not.

The save blob (`tagspotter_v1_save_data`) lives in the *same* SharedPreferences file as
`temp_quiz_session`, and Auto Backup carries a sharedpref file as one unit. A restore therefore
normally returns a save and a session captured at the same moment, which are consistent with each
other — the "quiz alongside a save from a different moment" framing in the comments was not
generally reachable.

Where it *was* reachable: `GameStateStore.resetProgress` committed the fresh save
(`stateService.resetSnapshot`) and *then* cleared the sidecar (`clearTempQuizSession`), as two
separate Preferences writes. A backup snapshotting between them captures a fresh save paired with a
stale session — pm-0001's exact shape, arriving by a route pm-0001's fix did not cover.

And the reason that never became a scoring bug: `GameCommandService.completeQuiz` returns `null`
unless `foundState.fnd.stateFound`. That guard was load-bearing for pm-0001's whole hazard class and
**had no test**. Nothing named it as the thing holding the invariant; it was found by reading.

## Fix

`HomeWorkflowService.checkAndResumeQuiz` now drops a loaded session, silently, when the hydrated
save does not have its state spotted. The two `<exclude>` lines are gone and both files say why they
cannot come back.

The resume path was chosen over detecting a restore or moving the key out of Preferences because it
is the only place both halves are visible at once, so it does not need to know *how* they were
paired — restore, the reset race, or a hand-edited save all resolve the same way. It also moves no
persisted player data, so it needed no `data-migration` escalation and adds no fourth persistence
surface to a bug that pm-0001 already attributed to surface mismatch.

The `stateFound` guard now has the spec it should have had, at the layer that enforces it.

The producer-side window in `resetProgress` is closed too, by ordering rather than by atomicity. The
two writes target separate **keys**, and `@capacitor/preferences` exposes `configure/get/set/remove/
clear/keys` with no transaction across them, so while the session remains its own key the window is
unavoidable and the only decision available is which pairing it leaves on disk.

That is a trade rather than an impossibility, and the first draft of this record stated it as the
latter — in bold, in three places an agent will read. Folding the session into the save value makes
the reset a single `set()` and removes the window outright; `PersistedGameSnapshot` already carries
optional additively-migrated fields, so the shape supports it. It was not done because the session
is deliberately outside the save (`dec-0006` — it must survive a corrupt save that the trip does
not) and because moving persisted player data is a `data-migration` escalation. Both are good
reasons. Neither makes the alternative unavailable, and writing it down as unavailable is how the
next reader stops looking.

Clearing first leaves `old save + no session` — a consistent trip that has lost an in-flight quiz.
The old order left `fresh save + stale session`, the hazard itself. The same asymmetry covers a
partial failure: if the second write throws, one order has dropped an ephemeral quiz and the other
has stranded a stale one against a reset trip.

Nothing observable distinguishes the two orders, so a spec pins it — a refactor that swaps them back
goes red.

## The lesson that generalizes

**Configuration that cannot fail cannot be trusted, and prose about it is not verification.** A
guardrail was added — `guardrail:backup-exclude-paths` — asserting that every
`<exclude domain="sharedpref">` names a file the app can actually produce. It derives the producible
set from the Preferences group rather than listing filenames, so a real second group legalises a
matching exclude by itself and an invented name stays a violation. *(As merged, it did not do this
correctly — see the amendment below.)*

Note what it does *not* do: it can tell you a rule is inert, never that it is correct. The class it
catches is "config that silently matches nothing", which is worth catching precisely because that
class produces green builds and confident documentation.

And where two writes cannot be made atomic, **order them so the state in between is the harmless
one.** That choice is free, it is invisible in every observable outcome, and it is therefore worth a
spec — it is not a thing a reader will infer from the code, and a refactor tidying the sequence has
no reason to suspect the order carried meaning.

## Amendment — the guardrail reproduced the shape of the bug it was written for

Source for this section: `commit:c8f464e`, the merge that shipped the check described above. A
review of that merge found seven holes in it. They are recorded as properties of the check **as
merged**, which stays true whatever later commits do to it.

Three let the banned rule through:

- `domain="sharedpref"` was matched with double quotes only, so a **single-quoted copy of the exact
  line this postmortem is about passed clean**. XML treats the two identically.
- Matching ran line by line, so an `<exclude>` whose attributes wrapped across lines was invisible,
  and a second one on the same line was never examined.
- Comments were not stripped. The element-based match only avoided flagging this project's own
  explanatory prose because that prose happens to write `<exclude>` bare — luck, not design, and a
  comment quoting the full tag would have produced a false positive instead.

Two made the producible set wrong in both directions. The scan looked for `/group\s*:/` in every
`src` TypeScript file rather than for `Preferences.configure`, so an unrelated object literal — a
form group, a chart config — silently legalised an invented filename, while a group named through a
constant was still rejected. And only two hardcoded `src/main/` paths were read, so a resource
qualifier (`res/xml-v31`) or a build-type sourceSet (`src/release/res/xml`) — either of which
overrides main and is what actually reaches a player — went unchecked. In a postmortem about a
release-config defect.

Two are the ones worth remembering, because they are not robustness but inverted reasoning:

- `if (!source) continue` meant **deleting both rules files reported clean.** Config that silently
  matches nothing is the literal name of the class this guardrail exists to catch.
- `CapacitorStorage.xml` was the one exclusion the producible test *blessed*. It is producible, so
  it passed — and it is the single most destructive edit available here, because every Preferences
  key including the save blob lives in that file. Excluding it stops the collection surviving a
  phone change, unrecoverable under `con-0004-no-backend-no-accounts`. The check would have put a
  green tick on exactly the edit someone reaches for while still trying to hold the sidecar back.
  Nothing tested the `<include>` either, and losing that line costs every player their trip — worse
  than the inert `<exclude>` that prompted the guardrail in the first place.

**A check written from the defect you just finished reading about tests that defect and little
else.** `f-049` had already recorded this — a sabotage run proved almost nothing because it deleted
the one thing the check could still see — and the guardrail written in response to that record
repeated it one commit later. Knowing the failure mode is not protection from it; the failure mode
is *fluency with the example in front of you*, and fluency feels like understanding.

What distinguishes the two lists above is worth stating on its own. Holes one to five are found by
asking "what else could match?", which an author who just wrote the pattern can do. Holes six and
seven are found by asking "what is the worst edit this permits, and would I catch it?" — a question
whose answer runs opposite to the author's intent, so it has to come from someone re-deriving what
the check should reject rather than reviewing what it does. Build the second question into the
guardrail review, not the first.

## The pm-0001 amendment

The pm-0001 lesson also needs an amendment. It asked that every sidecar key declare its lifetime,
and `temp_quiz_session` did. What it did not ask is where the invariant is *enforced*. pm-0001 fixed
the one producer of a mismatch it knew about and left the consumer trusting whatever it loaded, so
the next unanticipated producer reopened it. **Where two persistence surfaces must agree, check the
agreement at the point of use, not at each site that could break it** — the producers are an open
set and the consumer is one place.
