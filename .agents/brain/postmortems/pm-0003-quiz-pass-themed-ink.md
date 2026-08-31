---
id: pm-0003-quiz-pass-themed-ink
type: postmortem
title: The quiz pass shipped unreadable in dark mode — with its rule already on file
status: resolved
date: 2026-08-31
source: commit:2866dd4
author: claude
confidence: high
tags: [dark-mode, contrast, accessibility, theming, quiz, guardrails, bug]
claims: {quiz-modal.ink: fixed-on-ephemera}
supersedes: []
related: [dec-0015-ink-follows-its-ground, dec-0012-dark-mode-instrument-cluster, f-042-contrast-debt, f-049-guardrails-do-not-cover-the-instruction-layer]
review_by: 2027-02-28
---

## What happened

First device test of the 1.2.0 internal-track build (versionCode 4), phone in dark mode: the
Roadside Quiz opened to a cream ticket with no visible question, no visible answers, and — after a
blind tap — no visible feedback. The maintainer sent a screenshot of a ticket that was, apart from
its header band and option markers, blank.

Three rules in `quiz-modal.component.scss` printed `var(--app-ink-deep)` — a **themed** ink that
flips to cream `#f2e7d3` in dark mode — onto grounds that never theme: the ticket's cream card
stock (`.question-text`), its fixed option rows (`.option-label`), and the literal `#fff3e8`
feedback slip (`.answer-feedback`). Reproduced in Karma under an ambient-dark headless Chrome at
**1.15:1, 1.13:1 and 1.12:1**. This is dec-0015's case-1 bug — same token, same mistake — for the
fifth time.

A fourth site, `--quiz-surface: var(--app-surface-card)`, was the same violation on the option-row
ground itself, unreachable in practice only because every region variant overrides it with fixed
paper. Pinned to `#fff7ec` in the same fix.

## Root cause

**Every surface the contrast checks could see was owned; the modal was in none of their
populations.** F-42's audit (`scripts/contrast-audit.js`) walks the five routes of a populated app
— the quiz pass exists only behind the spot-confirmation overlay flow, so no audit run ever had it
in the DOM. The `background-token-as-ink` guardrail scans for `--app-bg-*` used as ink — these
three were a *legitimate* ink token on the wrong ground, the exact slice dec-0015's enforcement
note admits the regex cannot see. Green build, green audit, unreadable phone.

The sharpest version: two of the inks predate the rule (`2866dd4`, April), but the third was
**added by `1a0b5b2` — the audit-remediation commit that wrote dec-0015 itself**. The same change
that filed "an ink themes only if its ground themes" introduced a fresh violation of it, in a file
it was editing anyway for F-01 copy, and nothing went red. Remediation worked from the audit's
failure list, not from the rule; a surface missing from the population was invisible even to the
pass that was fixing its neighbours.

## The lesson

A rule enforced by a manually-driven sweep protects only the surfaces someone remembers to open,
and overlays are precisely what nobody remembers to open. Enforcement has to live where the
component lives: a component spec reaches the modal's DOM by construction, with no navigation, no
overlay animation, and no human in the loop. The corollary of dec-0015 is directly testable without
any theme emulation — dark mode is nothing but a media block redefining tokens on `:root`, so a
spec can perform the flip itself and assert that nothing on fixed stock moves.

## Guardrail

Two, both in the fix commit:

- **Runtime, token-agnostic:** the "ink discipline" describe in `quiz-modal.component.spec.ts`
  redefines every token the dark block owns and fails if any glyph-bearing element, background, or
  drawn border on the ticket changes — plus an AA floor (≥ 4.5:1) on the three shipped inks against
  their actual grounds. Catches this class for tokens that do not exist yet.
- **Static, named tokens:** `themed-ink-on-ephemera-sheet` in `guardrails.json` bans the themed ink
  tokens from ephemera-only stylesheets outright (membership = the include list; today, the quiz
  pass sheet). Catches the mistake at diff time, before anyone runs a browser.
