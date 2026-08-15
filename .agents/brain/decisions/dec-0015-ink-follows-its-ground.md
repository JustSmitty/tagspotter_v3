---
id: dec-0015-ink-follows-its-ground
type: decision
title: An ink themes only if the thing it is printed on themes
status: accepted
date: 2026-08-15
source: audit:contrast-audit-2026-08-15
author: claude
confidence: high
tags: [design-system, dark-mode, accessibility, theming, tokens]
claims: {ink-themes-with-ground: true, fixed-ground-fixed-ink: true}
supersedes: []
related: [dec-0012-dark-mode-instrument-cluster, f-042-contrast-debt, con-0006-design-system-authority]
review_by: 2027-02-28
---

`dec-0012` settled which **surfaces** invert: chrome does, ephemera does not. This is the corollary it
took four separate bugs to state, and it is the rule that actually gets applied day to day.

> **A surface that does not change needs ink that does not change.**

Dark mode broke the same way four times, each time in a place nobody thought of as ephemera:

| # | Ink | Ground | What happened |
|---|---|---|---|
| 1 | `--app-ink-deep` | postcard | cream text on cream card stock, 1.01:1 |
| 2 | `--app-bg-cream` | pine ribbons | the token *is* the page colour; near-black on green |
| 3 | `--app-rust-ink` | postcard | brightens to `#e8703a` for the dark page, 2.79:1 on paper |
| 4 | `--app-bg-cream` | stamp pill, quiz banner, reset badge | same as 2, on fills nobody had classed as fixed |

Every one is the same mistake: a token that inverts, printed on something that doesn't.

## The rule

Before setting any `color`, ask **does the background of this element change between themes?**

| Ground | Ink | Tokens |
|---|---|---|
| Ephemera — postcard, plates, stamps | fixed | `--app-ink-on-ephemera`, `--app-ink-on-ephemera-muted`, `--app-rust-on-ephemera` |
| Fixed coloured fills — ribbons, chips, quiz banner, filled buttons | fixed cream | `--app-ink-on-fill` (and `--app-rust-fill` for the fill itself) |
| Chrome — cards, page, nav | themed | `--app-ink-deep`, `--app-ink-muted`, `--app-rust-ink`, `--app-success-ink` |

The palette therefore carries **three rusts on purpose**, which looks redundant until you see what
each is for: `--app-rust-ink` themes because it sits on the page; `--app-rust-fill` does not, because
it is a background whose text moves with it; `--app-rust-on-ephemera` does not, because the paper
under it never darkens. Same hex, three different reasons — and merging any two of them re-introduces
one of the bugs above.

## Naming

`--app-ink-on-fill` began life as `--app-ink-on-green`, named for the pine ribbons that motivated it.
The name stopped being true the moment the identical fix was needed on a red badge and a rust
gradient, and a token named for one instance invites the next person to invent a fourth near-duplicate
rather than reuse it. **Name the token for the role, not for the first colour that needed it.**

## Enforcement

`guardrail:background-token-as-ink` catches the mechanical slice — `--app-bg-*` used as a `color` —
at baseline 0. It cannot see cases 1 and 3, where a legitimate ink token is simply on the wrong
ground; those need `scripts/contrast-audit.js` against a **populated** app in both themes.
