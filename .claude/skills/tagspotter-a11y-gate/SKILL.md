---
name: tagspotter-a11y-gate
description: Owns Tag Spotter's accessibility invariants — pinch zoom, colour contrast, reduced motion, focus order, keyboard reachability, screen-reader labelling, and dark mode. Use when the request involves accessibility, a11y, WCAG, contrast, colour, screen readers, keyboard navigation, ARIA, focus, tabindex, reduced motion, dark mode, or theming. Enforces the design-system palette while holding the WCAG line.
review_by: 2027-02-28
---

# Tag Spotter — Accessibility Gate

This app is used one-handed, in a moving car, often in low light, sometimes by a passenger who is
not the person who installed it. Accessibility here is not compliance theatre — it is the core use
case.

## The five invariants

Each is a guardrail in `.agents/evals/guardrails.json`. None may regress.

### 1. Pinch zoom is never disabled — `guardrail:viewport-zoom`

Fixed and enforced (audit F-29, guardrail at 0). Ionic handles input-focus zoom on its own, so no
scale lock is needed and none may return.

The viewport meta may contain `viewport-fit=cover`, `width=device-width`, `initial-scale=1.0`. It may
**not** contain `user-scalable=no` or any `maximum-scale`.

### 2. Text meets 4.5:1 — `guardrail:low-alpha-text`

The faded-paper aesthetic is achieved with **warm greys**, not black at low alpha. Use
`--app-ink-muted` / `--app-ink-subtle` and adjust lightness — never reach for alpha.

Rule: **no `color` declaration may use `rgba(0,0,0,α)` with α < 0.55**, and no text colour may fall
below 4.5:1 against its actual background (3:1 for ≥ 24 px or ≥ 19 px bold).

> **The guardrail is a floor, not the standard.** It only sees black-at-low-alpha, and it is at 0.
> Measuring what actually rendered, with `scripts/contrast-audit.js`, found **45 further failures in
> both themes** (F-42) — mostly saturated brand colours on pale surfaces, which that regex could
> never see. All are now fixed and the audit is at **0 in both themes**. Run it anyway. Do not trust
> the green tick.

**Measure a populated app.** The last four failures of F-42 only existed once states were spotted:
stamps, badges and the summary do not render on a fresh save, so a clean audit against an empty
install proves only that the empty state is fine. Seed progress first.

**Two inks, two grounds.** Before changing a text colour, ask whether its *background* themes:

| Ground | Ink | Token |
| --- | --- | --- |
| Ephemera (postcard, plates, stamps) | fixed | `--app-ink-on-ephemera`, `--app-ink-on-ephemera-muted`, `--app-rust-on-ephemera` |
| Fixed coloured fills (ribbons, chips, quiz banner) | fixed cream | `--app-ink-on-fill` |
| Chrome that goes dark (cards, page) | themed | `--app-ink-deep`, `--app-ink-muted`, `--app-rust-ink`, `--app-success-ink` |

Getting this backwards is the single most common way this app breaks: a themed ink on a fixed ground
inverts into its own background. `guardrail:background-token-as-ink` catches the worst version of it
(`--app-bg-*` used as a text colour) but only that version. For stylesheets that draw *only*
ephemera, `guardrail:themed-ink-on-ephemera-sheet` goes further and bans the themed ink tokens from
the file outright — the quiz pass shipped unreadable to a phone through exactly the slice the first
regex cannot see (pm-0003). If a component is printed matter end to end, add its sheet to that
guardrail's include list, and give it a runtime twin like the "ink discipline" describe in
`quiz-modal.component.spec.ts`: redefine the dark block's tokens on `:root` and fail if anything on
the fixed stock moves.

**`currentColor` is inert inside a `background-image` data URI** —
`guardrail:currentcolor-in-background-image`. An SVG used as an image is its own document, so
`currentColor` there resolves to the initial black instead of inheriting the element's colour. That
is why the four bottom-nav glyphs painted black in both themes: invisible on the dark tags, and the
active tab drew a rust label beside a black icon (F-43). Use `mask-image` with
`background-color: currentColor` instead, which does inherit.

**One colour, two jobs.** The regional accents pass easily on the 43px plate code and failed badly on
the 9px state name beneath it. That is why each region now has a separate `--region-*-name` ink: a
colour validated at one size is not validated at another.

Verify against the *real* background — cream, paper, card, or the region-tinted plate — and note that
the postcard's paper is a **gradient**, so a checker that only reads `background-color` will climb
past it and report nonsense.

### 3. Motion respects the OS — `guardrail:reduced-motion`

Every stylesheet that declares an `animation:` must also carry a
`@media (prefers-reduced-motion: reduce)` block that neutralizes it. All six do now (F-31, guardrail
at 0), each using a blanket `*` rule rather than a named allowlist — an allowlist goes stale the
moment someone adds an effect, and the cost of forgetting is motion shown to a user who asked for
none.

The stamp animation is *feedback*, so when it is suppressed the state change must still be obvious
through colour and the "Spotted" label alone. Check that.

### 4. Keyboard reaches everything, once — `guardrail:svg-tabindex`

Fixed (F-32, guardrail at 0). The atlas used to render 51 `<path role="button" tabindex="0">` above a
plate grid that did the same job, putting 51 tab stops in front of the content.

Rule: the atlas SVG is `role="img"` with a descriptive `aria-label`, and **no focusable children**.
The plate grid is the accessible interface — it is already a real `<button>` per state with proper
`aria-pressed` and `aria-label`. Pointer users keep tapping the map; that is a progressive
enhancement, not the only path.

Anything interactive must be a real `<button>`, reachable in DOM order, with a visible
`:focus-visible` style. The grid's 4px secondary-colour ring is the house pattern.

### 5. Screen-reader text matches visible text

`aria-label` that contradicts the visible label is worse than none. Screen-reader strings are copy;
they are subject to `tagspotter-copy` and the same voice rules.

## Dark mode — shipped (`dec-0012`)

**The chrome inverts. The ephemera does not.** Plates, flags, stamps and the postcard keep their
daylight colours in both themes — they are physical objects in the fiction. Only the surfaces holding
them change. That is why `region-*` has no dark override.

Rules when touching theming:

- Define the full light palette on bare `:root` in `src/theme/variables.scss`.
- Redefine **only the tokens that change** under `@media (prefers-color-scheme: dark)`.
- Never give a colour its only definition inside a media block.
- **Text on ephemera uses `--app-ink-on-ephemera`**, which is never redefined in dark. Using
  `--app-ink-deep` there puts cream text on cream card stock — that is exactly how the score went
  invisible at 1.01:1 during this work.
- Re-run the contrast audit in **both** themes. Passing light does not imply passing dark.

## Workflow

```bash
npm run brain -- search "design system accessibility contrast motion"
npm run evals -- --only=guardrails
```

For contrast, the guardrails are not enough — run the real thing:

```bash
npm start
# open localhost:4200, spot some states, paste scripts/contrast-audit.js in the console
# flip the colour scheme, RELOAD (matchMedia lies until you do), run it again
```

Baseline to beat: **0 in light, 0 in dark**, across all five routes (F-42). The CSP blocks `eval`,
so the snippet has to be pasted rather than re-hydrated from storage between reloads.

**The audit only sees what is in the DOM when it runs — and that means routes, not overlays.** The
quiz modal sat behind the spot-confirmation flow, appeared in no audit population, and reached a
device at 1.1:1 in dark mode (pm-0003). A surface that only exists mid-flow needs its contrast
check in a component spec, where mounting it is unconditional.

For component-level ARIA and focus-management recipes, the vendored `fixing-accessibility` and
`accessibility-audit` skills are the reference. This skill owns the project-specific line those
recipes must not cross.

## Definition of done

- [ ] All six guardrails pass and none increased
- [ ] Contrast verified against the element's real background, in both themes if dark shipped
- [ ] Full keyboard pass: every action reachable, focus always visible, no dead-end tab stops
- [ ] Reduced-motion pass: nothing animates, all state changes still legible
- [ ] `aria-label` text matches visible text everywhere it was touched
