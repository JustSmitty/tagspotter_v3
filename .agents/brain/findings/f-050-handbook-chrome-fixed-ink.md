---
id: f-050-handbook-chrome-fixed-ink
type: finding
title: F-50 — the handbook modal's chrome printed fixed pine on the themed card
status: resolved
date: 2026-08-31
source: audit:contrast-audit-2026-08-31
author: claude
confidence: high
tags: [accessibility, dark-mode, contrast, theming, onboarding, modal, guardrails]
claims:
  handbook-chrome.ink: themed-tokens
  handbook-paper.ink: fixed-on-ephemera
  handbook-footer.background-var: removed-was-inert
supersedes: []
related: [dec-0015-ink-follows-its-ground, pm-0003-quiz-pass-themed-ink, dec-0012-dark-mode-instrument-cluster, f-042-contrast-debt]
review_by: 2027-02-28
---

Measured live under `prefers-color-scheme: dark` emulation: the onboarding handbook's SKIP button
and `ion-title` rendered fixed pine `#396754` on the modal's themed ground `--app-surface-card`
(`#262019` at night) — **2.49:1** against an AA floor of 4.5:1. SKIP was worse than it measured:
its `opacity: 0.6` de-emphasis composited the ink to ~**1.7:1**.

## The shape of the surface

The handbook is **mixed**, which is exactly why dec-0015 kept being violated here:

- `ion-content` is fixed cream paper (`#fdfae9`) — printed matter, correct with fixed inks.
- The header and footer sit directly on the modal's `::part(content)` ground —
  `var(--app-surface-card)` via `.handbook-modal` in `global.scss` — which is **chrome** and goes
  near-black at night. Chrome ink must theme.

**The trap that hid it:** both `.handbook-header` and `.handbook-footer` declared
`--background: #f7efdb`, and neither declaration did anything. `ion-header` paints nothing itself
(its toolbar was `--background: transparent`), and `ion-footer` contains no toolbar to consume the
variable at all. Anyone reading the sheet saw a cream ground and concluded fixed pine was fine.
Both inert declarations are now deleted; do not reintroduce them. When reasoning about a ground,
find what actually paints — a custom property nothing consumes is a comment wearing a costume.

## Everything found in the same pass

| Element | Was | Measured (dark) | Now |
| --- | --- | --- | --- |
| `ion-title`, toolbar ink | fixed `#396754` | 2.49:1 | `--app-nav-ink` → 6.10 light / 8.49 dark |
| SKIP | fixed pine at 0.6 alpha | ~1.7:1 | `--app-ink-muted`, no alpha → 6.36 / 8.45 |
| back chevron | fixed `#396754` | 2.49:1 | `--app-nav-ink` |
| page dots | pine at 0.2 alpha | ~1.1:1 | `--app-ink-subtle` / active `--app-nav-ink` |
| `.secondary` paragraphs | **themed** `--app-ink-muted` on fixed paper | **1.82:1** | `--app-ink-on-ephemera-muted` → 6.58 both |
| `.handbook-p strong` | `#d9541c` on paper | 3.83:1 (both themes) | `--app-rust-on-ephemera` → 6.00 |
| `.p-pts` | `#d9541c` on `#f7efdb` | 3.50:1 (both themes) | `--app-rust-on-ephemera` → 5.49 |
| `.demo-tag.trivia` | themed `--app-rust-ink` fill | label 2.94:1 | `--app-rust-fill` + `--app-ink-on-fill` → 5.30 both |
| header seal | themed `--app-rust-ink` fill | icon 2.94:1 | `--app-rust-fill` + `--app-ink-on-fill` |
| ticket punch holes | fixed `#f7efdb` | cream spots on the dark footer | `--app-surface-card` (they are the ground) |
| folder tab label (`.ephemera-modal::after`, global.scss) | themed `--app-ink-muted` on fixed manila | **1.40:1** | `--app-ink-on-ephemera-muted` → 5.06 both |

The folder-tab fix also corrects the quiz pass's FIELD NOTES tab and the default TOP SECRET tab —
same declaration, same manila.

Note the two directions of the same mistake in one file: themed ink on fixed paper (`.secondary`,
the trivia chip) *and* fixed ink on a themed ground (the whole header/footer). dec-0015 is one
sentence and it covers both; the sheet just had to be read ground-first.

Light-mode appearance is pixel-identical for the pine chrome (`--app-nav-ink` is `#396754` by day);
the deliberate light-mode shifts are the deeper ephemera rust on `strong`/`.p-pts` (the F-42 trade)
and page dots that are now actually visible.

## Enforcement

This is the pm-0003 class — an overlay no route audit ever has in its population — so enforcement
lives where the component lives:

- **Runtime:** the "ink discipline" describe in `onboarding-modal.component.spec.ts`. Because the
  surface is mixed it holds *both* halves of dec-0015: flipping the themed tokens to a sentinel must
  move nothing printed on the paper **and must move every chrome ink**, plus an AA floor on the real
  token pairs in the daylight palette *and* under the dark palette parsed out of the compiled
  stylesheet (not duplicated — a copy would keep passing after the palette moved).
- **Static:** none added. `guardrail:themed-ink-on-ephemera-sheet` is an include-list of sheets that
  are ephemera end to end; a mixed sheet cannot join it, and no line-level regex can tell chrome
  ink from paper ink inside one file. The spec's flip test is the guardrail here.
- `scripts/contrast-audit.js` now says in its header that overlays are out of its population and
  points at the spec pattern, so the next overlay author learns it before shipping, not after.
