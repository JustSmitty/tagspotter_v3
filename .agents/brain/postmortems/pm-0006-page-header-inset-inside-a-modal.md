---
id: pm-0006-page-header-inset-inside-a-modal
type: postmortem
title: A page header reused inside a modal counted the status bar twice
status: resolved
date: 2026-08-31
source: file:src/global.scss:61
author: claude
confidence: high
tags: [android, safe-area, modal, layout, capacitor, css, bug]
claims: {safe-area.env-top: populated-and-overcounts}
supersedes: []
related: [pm-0004-env-safe-area-is-zero-on-android, dec-0012-dark-mode-instrument-cluster]
review_by: 2027-02-28
---

## What happened

On device, the Roadside Quiz modal opened with a band of empty card stock above its title —
roughly a status bar tall — between the top of the modal card and the "ROADSIDE QUIZ" header. It
looked like something had failed to render. Nothing had: the space was padding.

`.digital-ephemera-header` is the app's shared page-header class, and it pads by
`calc(var(--app-safe-top) + 12px)` so that on a **route** it clears the status bar. The quiz modal
puts that same class on its `ion-header`. But a modal is a card inset well below the status bar, so
the inset was applied a second time, to something that had already cleared it.

Measured off a phone screenshot (1080×2404): the gap from the modal's top edge to the header card
was 175 device px ≈ 67 CSS px. Reproduced exactly by setting `--app-safe-top: 55px` in a browser,
which takes that header's `padding-top` to precisely `67px`.

## Root cause

**A component that encodes "I am the top of the screen" was reused somewhere that isn't.** The
padding is correct on the four routes and wrong in the one place the same class sits inside an
overlay. Nothing in the class name or the markup says which context it is in, so the reuse looked
free.

It survived because the browser cannot see it. `env(safe-area-inset-top)` resolves to `0` on a
desktop browser, so `--app-safe-top` is 0, so the double-count adds nothing and the header measures
70px — exactly right. Every check that mattered ran in that environment.

**Correction to [[pm-0004-env-safe-area-is-zero-on-android]].** That record concluded Android's
WebView "never populates `env(safe-area-inset-*)`", generalising from the bottom inset. The top is
populated — about 55px here — and *over*-reports for a webview that Capacitor has already inset via
`StatusBar.overlaysWebView: false`. So the two ends fail in opposite directions: bottom reads 0 when
there is a navigation bar to clear, top reads a full status bar that has already been cleared.
pm-0004's fix stands (the bottom inset must come from the plugin's injected variable); only its
"never populates" phrasing was too broad. **Neither end of `env()` can be trusted raw on Android.**

## The lesson

Ask what a spacing token is *for*, not just what it evaluates to. `--app-safe-top` means "distance
to the top of the screen" — a fact about the viewport, not about a component. Any component that
consumes it is asserting it sits at the top of the screen, and that assertion has to be re-checked
every time the component is reused. A modal header is not a page header.

The handbook modal had already reached this conclusion independently: its header sets
`padding-top: 0`. One modal solving it privately and the other not is the tell that the rule lived
in someone's head rather than anywhere the next reader would find it.

## Guardrail

`quiz-modal.component.spec.ts › does not add the status-bar inset to the modal header` sets
`--app-safe-top: 55px` — standing in for the device — and asserts the header stays at `12px`.
Against the unfixed stylesheet it fails with `Expected '67px' to be '12px'`, which is the device
measurement to the pixel.

This is the check pm-0004's own record said could not be written ("what no check can prove off-device
is the *value*"). It still cannot prove the value; what it proves is that the header does not
*consume* the inset, which is the actual invariant, and that is assertable anywhere.
