---
id: pm-0004-env-safe-area-is-zero-on-android
type: postmortem
title: The safe-area tokens asked a question Android's WebView does not answer
status: resolved
date: 2026-08-31
source: file:src/theme/variables.scss:21
author: claude
confidence: high
tags: [android, edge-to-edge, capacitor, layout, insets, css, bug]
claims: {safe-area.source: capacitor-injected-vars}
supersedes: []
related: [pm-0005-atlas-drawn-before-the-save-arrived, con-0003-windows-dev-commands, f-042-contrast-debt]
review_by: 2027-02-28
---

## What happened

First real device session on the internal build (versionCode 5, Pixel 10 Pro XL, Android 16): the
system navigation bar drew directly on top of the quiz's answer feedback and its "Next question"
button, and over the foot of the home page's region filters. The button was still tappable in the
gaps between the nav pills, which is why the quiz had been playable at all earlier in the day.

Every bottom-anchored surface in the app already asked for the inset — `.quiz-stage`,
`.content-inner`, `.bottom-nav`, the summary page — through `--app-safe-bottom`, defined as
`env(safe-area-inset-bottom, 0px)`. **Android's WebView never populates `env(safe-area-inset-*)`.**
It parses the function, finds no value, and silently takes the `0px` fallback. Every one of those
`calc()`s was adding zero.

Android 15 (targetSdk 35+) removed the opt-out from edge-to-edge, so the window now extends under
the system bars by default. `targetSdkVersion = 36` has been set since March; the enforcement is
what turned a harmless zero into an overlap.

## Root cause

**The fallback was indistinguishable from a correct answer.** `env(x, 0px)` returns a plausible
number on a platform that has never heard of `x`, so the layout stays valid, nothing warns, and the
padding is simply absent. On iOS and in every browser the same declaration works, which is what made
it look proven. There was no platform where it visibly failed until the OS stopped insetting the
window for us.

Capacitor 8 does supply the real numbers: `SystemBars` reads the window insets natively and injects
them as `--safe-area-inset-*` custom properties (density-corrected, gated on `viewport-fit=cover`,
which `index.html` already had). Nothing in the app consumed them — the CSS was asking the one
source that could not answer while the answer sat on the same element.

A second, quieter defect: `--app-safe-*` was defined **twice**, in `theme/variables.scss` and again
in `global.scss`. Both were loaded as global styles, so `global.scss` won on order and pinned the
tokens to the `env()` form. Fixing only the variables file would have changed nothing.

## The lesson

A cross-platform CSS feature with a fallback value is a silent conditional. When the fallback is
"behave as though the inset is zero", the failure has no symptom on the platform you develop on and
no error on the one you ship to. Prefer the value the runtime actually publishes — here, the
plugin's injected custom property — and keep `env()` only as the fallback for the platforms where
it does work.

Corollary, learned the expensive way: **a design token must have exactly one definition.** Two
`:root` blocks for the same name is not redundancy, it is a coin flip decided by stylesheet order.

## Guardrail

`guardrail:raw-env-safe-area` bans `env(safe-area-inset-*)` everywhere under `src/app/**` and in
`global.scss`, leaving `theme/variables.scss` as the only place the fallback may appear. The
component spec `quiz-modal.component.spec.ts › safe-area insets` proves the whole chain end to end:
it sets `--safe-area-inset-bottom` the way the plugin does and asserts the stage's padding moves.

What no check can prove off-device is the *value*: whether the injected inset is the right size on a
given phone is only observable on that phone. The chain is what is testable, so the chain is what is
tested.
