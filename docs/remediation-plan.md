# Tag Spotter Remediation Plan

**Source audit:** full-repo scan, 2026-08-15 (see `.agents/brain/findings/audit-2026-08-15.md`)
**Baseline at audit time:** lint clean · 75/75 tests pass · prod build 1.29 MB initial / 15 MB `www/`

Every finding below has an ID, a phase, an **owning skill** (the agent that does the work), and an
**acceptance criterion that a machine can check**. If a criterion can't be automated, it says so and
names the human check instead. Findings without an automated gate are the ones most likely to
regress, which is exactly why they are called out.

Nothing in this plan is "remember to do X." Each phase ends with a guardrail whose ratchet baseline
drops to zero — the eval suite (`npm run evals`) is what actually holds the line.

---

## Phase ordering rationale

The order is **honesty → weight → feel → correctness → depth**, not severity order.

Phase 1 comes first because the app currently makes claims that aren't true (an "AI Caddie" that
doesn't exist, "miles traveled" that aren't traveled, encryption that doesn't encrypt anything
meaningful). Shipping features on top of untrue copy compounds the problem. Phase 2 is next because
it is almost pure deletion — the highest ratio of user-visible improvement to risk in the whole
plan. Phase 3 is the real UX work and needs the room that phases 1–2 clear. Phase 4 is the
correctness and tooling debt, deliberately after UX because none of it is user-visible. Phase 5 is
new product surface, which should only start once the existing surface is trustworthy.

---

## Phase 0 — Instrument the work (this commit)

Build the machinery that enforces every later phase. Without it, this document is a wish list.

| ID | Item | Owning skill | Acceptance |
|---|---|---|---|
| F-35 | No CI at all | `tagspotter-release` | `.github/workflows/ci.yml` runs lint + test + build + evals on push |
| — | No memory layer | `tagspotter-feature` | `npm run brain -- search <q>` returns ranked records; `npm run brain -- lint` passes |
| — | No routing | `tagspotter-triage` | `npm run resolve -- "<request>"` picks a skill; routing evals pass |
| — | No acceptance automation | all | `npm run evals` runs structural + routing + guardrail suites |

---

## Phase 1 — Truth & trust ✅ COMPLETE (2026-08-15)

All ten findings closed; all nine guardrails ratcheted to **0** and now failing the build on
recurrence. Suite: lint clean · 84/84 specs · 85/85 evals.

Three things worth carrying forward:

- **The copy guardrail's first pattern was too narrow.** It was built from terms the audit had
  already found, so it missed four more golf strings in the quiz modal that nobody had looked at.
  Widened, not excused. A guardrail derived from known instances will always miss the unexamined
  ones — treat its first green run as a prompt to look harder.
- **Comments trip their own guardrails, and that is correct.** Three fixes initially failed because
  the explanatory comment named the banned string ("removed `unsafe-eval`", "not an odometer"). Each
  was reworded rather than excluded. A scanner that cannot tell explanation from violation is a
  scanner that cannot be quietly talked around.
- **F-20 could not be a deletion.** Players on ≤ 1.1.0 have encrypted blobs; removing the read path
  would have silently reset their trips. See `dec-0009-plain-json-saves`.

The app should not say things that are false. Ten findings, all low-risk, mostly text.

| ID | Finding | Where | Owning skill | Acceptance |
|---|---|---|---|---|
| F-01 | Golf metaphor fights the road-trip design system | 9 files, ~28 strings | `tagspotter-copy` | `guardrail:copy-lexicon` violations = 0 |
| F-02 | Onboarding claims an "AI Caddie" that does not exist | `onboarding-modal.component.html:23` | `tagspotter-copy` | covered by `guardrail:copy-lexicon` (`ai caddie` is a banned term) |
| F-03 | README says MapLibre GL **and** inline SVG | `README.md:48` vs `:87` | `tagspotter-copy` | `guardrail:stale-tech-claims` = 0 |
| F-07 | "Miles" are device→state-centroid distance, not travel | `game-command.service.ts:48` + all copy | `tagspotter-copy` | `guardrail:copy-lexicon` bans "miles traveled"/"odometer"; rename to Spotting Range |
| F-09 | `viewMap()` navigates to `/dashboard` | `summary.page.ts:50` | `tagspotter-feature` | method renamed; no template/test references the old name |
| F-20 | Save "encryption" uses a hardcoded key + salt, 1000 PBKDF2 iters, shipped in the bundle | `state.service.ts:109-134` | `tagspotter-feature` | `guardrail:crypto-theater` = 0 (removal **or** an ADR that documents it as tamper-friction) |
| F-21 | CSP allows `script-src 'unsafe-eval'` for a MapLibre dep that no longer exists | `index.html:16` | `tagspotter-feature` | `guardrail:csp-unsafe-eval` = 0 |
| F-29 | `user-scalable=no, maximum-scale=1.0` blocks pinch zoom (WCAG 1.4.4) | `index.html:20` | `tagspotter-a11y-gate` | `guardrail:viewport-zoom` = 0 |
| F-30 | Text at `rgba(0,0,0,0.3)` on cream ≈ 2.5:1 | `global.scss:88`, `home.page.html:145` | `tagspotter-a11y-gate` | `guardrail:low-alpha-text` = 0 |
| F-41 | CLI analytics UUID committed to the repo | `angular.json` | `tagspotter-release` | `guardrail:cli-analytics` = 0 |

**Exit:** those seven guardrail baselines are all 0. Human check: read the onboarding flow end to
end out loud — it should sound like one product.

---

## Phase 2 — Weight ✅ COMPLETE (2026-08-15), except F-28

Five of six landed. `www/` **15 MB → 2.1 MB**; initial bundle **1.29 MB → 722 kB** raw
(259 → 182 kB transfer); release APK **2.9 MB**, R8 verified to keep the Capacitor plugin methods.

**F-28 (bundled `states.json`) was deliberately not done.** The finding is real but the fix as
specified is a bad trade: moving 37 KB raw / ~12 KB gzipped out of the bundle introduces a new
failure mode in the seed-data path that *everything* depends on. If the fetch fails there are no
states at all, and guarding against that means bundling a fallback — which is where we started. In a
Capacitor shell both paths are a local file read, so there is no meaningful win to buy the risk with.
Revisit only if `states.json` grows by an order of magnitude.

Almost entirely deletion. `www/` goes from **15 MB → ~2.5 MB**.

| ID | Finding | Owning skill | Acceptance |
|---|---|---|---|
| F-23 | 8.4 MB of raw Inkscape SVG flags (Pennsylvania alone: 775 KB) rendered at 56 px | `tagspotter-asset-pipeline` | `guardrail:flag-budget` — no flag > 40 KB, dir total < 1 MB |
| F-24 | 3.6 MB of ionicons SVGs copied into `www/` but never used (`addIcons()` everywhere) | `tagspotter-asset-pipeline` | `guardrail:ionicons-glob` = 0 |
| F-27 | `PreloadAllModules` eagerly fetches every lazy route, cancelling the lazy loading | `tagspotter-feature` | `guardrail:preload-strategy` = 0 |
| F-28 | `states.json` (37 KB) statically imported into `main.js` | `tagspotter-feature` | initial bundle drops ≥ 30 KB (build-size eval) |
| F-34 | `minifyEnabled false` on the release APK — no R8 | `tagspotter-release` | `guardrail:r8-disabled` = 0 |
| F-25 | Deprecated `browser` (webpack) builder | `tagspotter-release` | `angular.json` uses `@angular/build:application`; build + tests still green |

**Sequencing note:** do F-23/F-24 first (pure deletion, no behaviour change), then F-25 last — the
builder migration changes output layout and is easier to validate against an already-small `www/`.

**Exit:** `du -sh www` < 3 MB, all guardrails 0, build green.

---

## Phase 3 — Feel ✅ COMPLETE (2026-08-15)

All eight landed; all four Phase 3 guardrails ratcheted to 0. Suite: lint clean · 90/90 specs ·
85/85 evals.

Two things came out of it that were not in the plan:

- **A new finding, F-42.** Measuring contrast properly for dark mode revealed **45 WCAG AA failures
  that exist in both themes** — pre-existing debt the Phase 1 regex guardrail could never have seen,
  because it was scoped to `rgba(0,0,0,α)` and most of these are saturated brand colours on pale
  surfaces. 29 of the 45 are `.plate-state-name`. Tracked in `.agents/brain/findings/f-042-contrast-debt.md`;
  the fix is a design call, not a mechanical one.
- **F-15 was pulled forward from Phase 4.** `recordState` was being rewritten line-for-line anyway,
  and leaving a known desync bug inside a line being rewritten would have been worse than the small
  scope creep.

The actual user experience work. Highest value, highest risk — do it after the tree is clean.

| ID | Finding | Owning skill | Acceptance |
|---|---|---|---|
| F-04 | A mis-tap is permanent — no un-spot anywhere | `tagspotter-feature` | new `unspotState` command + store spec covering point reversal (state/distance/trivia) |
| F-05 | Trivia mode commits a plate with no confirmation | `tagspotter-feature` | `home-workflow` spec asserts confirm in **both** modes |
| F-06 | GPS blocks the whole UI up to 10 s with no spinner | `tagspotter-feature` | spot commits before the location await; spec asserts `isBusy` false while the fix resolves |
| F-08 | `/summary` is unreachable; `openSummary()` is dead code | `tagspotter-feature` | `guardrail:dead-handlers` = 0; a template binds `openSummary` |
| F-10 | No dark mode — hardcoded `color-scheme: light` | `tagspotter-a11y-gate` | `prefers-color-scheme: dark` block exists; contrast eval passes in both themes |
| F-12 | Achievements unlock silently | `tagspotter-feature` | unlock emits a toast + haptic; store spec covers the transition |
| F-31 | `prefers-reduced-motion` handled in 1 of 6 stylesheets | `tagspotter-a11y-gate` | `guardrail:reduced-motion` = 0 (every file with `animation:` has a guard) |
| F-32 | 51 focusable SVG paths above a grid that does the same job | `tagspotter-a11y-gate` | `guardrail:svg-tabindex` = 0 |

**Exit:** a keyboard-only pass reaches every action; a mis-tap is recoverable; night mode is usable
in a car. Human check required — no eval proves "feel."

---

## Phase 4 — Hardening ✅ COMPLETE (2026-08-15)

All twelve landed. Suite: lint clean · **146/146 specs** (was 90) · 85/85 evals · zoneless build
741 kB · release APK 2.75 MB with R8. Both Phase 4 guardrails at 0.

Three things worth carrying forward:

- **Zoneless found a bug that zone.js was hiding.** Injecting Capacitor plugins behind tokens made
  them testable, but the first version provided the raw proxy — which answers *any* property,
  including `ngOnDestroy`, so Angular called it during injector teardown and hit the native bridge.
  zone.js swallowed the rejection; zoneless killed the test runner. See `dec-0013`.
- **The ESLint migration nearly smuggled in a strictness change.** Building the flat config from
  `typescript-eslint/recommended` surfaced 34 new errors. That is worth doing — as its own change,
  not hidden inside a format migration. The one rule kept was `no-unused-vars`, because it
  immediately found a dead import left by the F-17 refactor.
- **Specs that fall through to a real plugin are worse than no specs.** Four of the seven service
  specs initially "passed" while silently invoking Capacitor's web implementation. Two got injection
  tokens; `NativeUiService` documents why its device branches are deliberately not covered.

Invisible to users, protective of everything above.

| ID | Finding | Owning skill | Acceptance |
|---|---|---|---|
| F-37 | `home-workflow.service.ts` (270 lines, the most complex file) has **zero** specs; `game-command.service.ts` likewise | `tagspotter-feature` | `guardrail:untested-services` = 0 |
| F-15 | `gameMode()` read after an `await`, can desync mid-dialog | `tagspotter-feature` | mode captured once at entry; spec covers toggle-during-dialog |
| F-16 | `isRouteActive` uses `url.includes(route)` | `tagspotter-feature` | segment comparison; spec covers a substring-colliding route |
| F-17 | `road-atlas` `effect` writes a signal to re-sync a stored object | `tagspotter-feature` | selected **ID** in the signal, record via `computed`; no `effect` in the component |
| F-18 | Quiz assumes 3 questions; `medium` tier has exactly 3 topics with no guard | `tagspotter-feature` | invariant asserted at session creation; accuracy denominator derived, not hardcoded |
| F-19 | Persist-then-apply silently discards a spot on storage failure | `tagspotter-feature` | error message names the failed action; spec covers the rollback path |
| F-22 | `allowBackup="true"` with no `dataExtractionRules` | `tagspotter-release` | explicit rules declared for API 31+ |
| F-26 | Zone.js retained though every component is OnPush + signals | `tagspotter-feature` | `provideZonelessChangeDetection()`; `polyfills.ts` dropped; suite green |
| F-36 | Karma defaults to non-headless `Chrome`, `singleRun: false` | `tagspotter-release` | `npm test` is headless single-run with no extra flags |
| F-38 | Legacy `.eslintrc.json` under ESLint 9 | `tagspotter-release` | flat `eslint.config.js`; lint green |
| F-39 | `target: es2022` but `lib: ["es2018","dom"]`; `useDefineForClassFields: false` | `tagspotter-release` | aligned; build + tests green |
| F-40 | `versionCode` / `versionName` / `package.json` hand-synced | `tagspotter-release` | `guardrail:version-parity` = 0 |

**Exit:** guardrails 0, suite green, `npm test` needs no arguments.

---

## Phase 5 — Depth ✅ COMPLETE (2026-08-15)

All three landed, plus the scoring ADR the plan said F-11 needed (`dec-0014`). Suite: lint clean ·
**165/165 specs** · 85/85 evals.

The rule that shaped all three: **scoring only ever moves up.** The road log now compares the trip in
progress against archived `finalScore` values, so any change that lowered a reward would silently
inflate the archive and make players look like they were getting worse at a game whose rules moved
under them. That ruled out the obvious fixes — cutting trivia multipliers, and paying points for
challenges — and pushed both toward additive answers.

**Not built:** real trip-distance tracking, listed here as the honest version of F-07. It needs
continuous location sampling, which collides directly with `dec-0007-coarse-location-default` and the
privacy posture the store listing already promises. That is a product decision with a permissions
cost, not a backlog item to pick up quietly.

New product surface. Only after the above.

| ID | Finding | Owning skill | Notes |
|---|---|---|---|
| F-11 | Rotating challenges award nothing | `tagspotter-feature` | attach points or a visible streak; needs a scoring ADR first |
| F-13 | Distance caps at 5 pts while a perfect hard round is 9 — the road-trip half is ~10% of score | `tagspotter-feature` | rarity multiplier (spotting HI in ME ≫ spotting your home state) |
| F-14 | Trip history is archived but only rendered as a list | `tagspotter-feature` | trip-over-trip comparison; data already exists |
| — | Real trip distance tracking | `tagspotter-feature` | the honest version of F-07; only worth building after the rename lands |

---

## Phase 6 — Store readiness 🟡 IN PROGRESS

The only live phase. Everything the two stores refuse the app without, plus the Mac that Windows
cannot provide. It has no numbered slot in the audit because it is not audit debt — it is the work of
actually shipping, and it was found by trying (`f-044-store-readiness`, `51960d8`).

Five guardrails, all at baseline 0. Two had to be **widened rather than re-baselined**, which is the
lesson this phase keeps teaching: a check that goes green while the thing it is named for is still
broken is worse than no check. `store-placeholder-urls` matched URLs only, so it read 0 while
`contactEmail` was still `support@example.com`; its `include` then covered the metadata files but not
`docs/privacy-policy.md`, which is the file actually served at the URL handed to Google and Apple.

| ID | Item | Owning skill | Acceptance |
|---|---|---|---|
| F-44 | `example.com` placeholders in anything published to a store | `tagspotter-release` | `guardrail:store-placeholder-urls` = 0, scanning metadata **and** the served policy |
| F-44 | Release signing could reference the debug keystore | `tagspotter-release` | `guardrail:debug-keystore-in-release` = 0 |
| F-45 | iOS target scaffolded universal, with no iPad layout or screenshots | `tagspotter-release` | `guardrail:ios-ipad-target` = 0; `TARGETED_DEVICE_FAMILY = "1"` (`dec-0016`) |
| F-46 | `Info.plist` did not answer export compliance, so every upload stalled | `tagspotter-release` | `guardrail:ios-export-compliance` = 0 (`ITSAppUsesNonExemptEncryption`) |
| PM-0002 | Backup rules excluded a sharedpref file that cannot exist | `tagspotter-release` | `guardrail:backup-exclude-paths` = 0 |

**Landed:** the AAB verified by actually running `bundleRelease` rather than trusting the runbook;
`scripts/bump-version.mjs`, with version parity widened to seven fields across four files; the iOS
privacy manifest wired into a classic `pbxproj`; the macOS workflow, manual-dispatch only at 10x
billing and with App Store Connect upload behind an explicit input; real listing URLs on a Pages site
that publishes two pages and excludes the rest; screenshots re-shot against a populated save.

**Live and verified 2026-08-24:** Pages reports `status: built`; both listing URLs return 200 with
real content, and all six internal docs return 404. Re-check that exclusion whenever anything is added
to `docs/` — a Pages site is public even while the repository is private, and the exclusion is
opt-out, not opt-in.

**Still open, and all of it maintainer-only:**

- iPhone screenshots at 6.9in (1320×2868) or 6.7in (1290×2796). `store-assets/app-store/iphone`
  holds only `.gitkeep`.
- App Store Connect signing secrets for the `archive` job (`dec-0017`). The workflow reads them; only
  the maintainer can create them.

**Exit:** a build accepted by both consoles. No guardrail can assert that, which is the honest reason
this phase ends with a human check.

---

## The five things, if only five happen

1. **F-01/F-02** — rewrite the copy, drop the AI claim. *Phase 1.*
2. **F-04/F-05** — un-spot, and confirm in both modes. *Phase 3.*
3. **F-06** — stop blocking the UI on GPS. *Phase 3.*
4. **F-23/F-24** — 15 MB → 2.5 MB in an afternoon. *Phase 2.*
5. **F-20/F-21** — delete the crypto theater, tighten the CSP. *Phase 1.*

---

## How this plan stays true

This file is **not** the source of truth for progress — `.agents/evals/guardrails.json` is. Each
guardrail carries a `baseline` equal to the violation count on the day of the audit. CI fails if a
count goes **above** its baseline, so the debt can only shrink. When a phase item lands, its
baseline drops to 0 and the guardrail becomes a permanent regression test.

Run `npm run evals` to see the current standing. See `.agents/README.md` for how the workforce that
executes this plan is wired.
