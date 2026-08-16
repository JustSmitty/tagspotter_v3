# Plan — Rewarded Hint Ads

Status: **DRAFT, not approved.** Nothing here is implemented.

Adding ads to Tag Spotter is not a feature, it is a change of category: the app stops being a thing
that keeps everything on your device and becomes a thing that talks to an ad network. This plan is
written so that decision is made once, deliberately, with the cost visible — rather than arrived at
one plugin install at a time.

## The scope, deliberately narrow

**One ad, user-initiated, inside the trivia modal.**

A "Stuck?" control on a quiz question. Tapping it plays a rewarded video; on completion two wrong
answers are removed. Nothing else in the app shows an ad.

Explicitly **out** of scope, and why:

| Rejected | Reason |
| --- | --- |
| Interstitial per quiz | 17 trivia finds in a typical trip = 17 forced full-screen ads. Google Play's Disruptive Ads policy names this pattern. |
| Banner anywhere | The floating luggage-tag nav owns the bottom of every screen; a banner fights it or forces reworking `--app-bottom-nav-total-height`. |
| Any ad the user did not ask for | The app is used one-handed in a moving car. Hunting a close button in that context is hostile, and worse if the driver is doing it. |

## Constraint supersession — read this first

Three recorded constraints are in the way. Only one actually breaks, but that one is real.

| Constraint | Verdict |
| --- | --- |
| `con-0001-offline-first` — "no runtime fetch to any host the app does not ship" | **SUPERSEDED.** An ad SDK fetches from Google's servers. This is the decision being made. |
| `con-0002-csp-no-remote-hosts` | **Survives.** Capacitor AdMob renders native views above the webview. `script-src 'self'` and `frame-src 'none'` are untouched. Verify, do not assume. |
| `con-0004-no-backend-no-accounts` | **Survives.** Still no account, no sync, no server of ours. |

`con-0001` does not merely bend. The offline rule becomes: **the game must remain complete and
fully playable with no network, forever — the ad is an optional extra that silently disappears.**
That is weaker than the original and must be written down as such, as a new constraint that
supersedes `con-0001`, not as a footnote to it.

**Acceptance for the supersession:** a brain record `con-0007` exists, `con-0001` is marked
superseded with a pointer to it, and `npm run brain -- lint` passes (contradiction detection will
otherwise flag two accepted records making opposite claims).

---

## Phase 0 — Spike, before committing to anything

Cheapest possible answer to "is this even buildable here".

| Task | Owner | Acceptance |
| --- | --- | --- |
| Confirm a maintained AdMob plugin supports **Capacitor 8** | `tagspotter-release` | plugin installs, `npx cap sync` clean, app boots on device with the SDK present and no ad calls |
| Confirm the CSP survives | `tagspotter-a11y-gate` | `guardrail:csp-unsafe-eval` still 0; `src/index.html` CSP unchanged; a rewarded ad renders with the meta CSP untouched |
| Confirm APK growth | `tagspotter-asset-pipeline` | release APK delta recorded; abort if > 3 MB |

`@capacitor-community/admob` is the obvious candidate but its Capacitor 8 support is **unverified** —
this repo is on Capacitor 8.2 and the plugin ecosystem lags major versions. If Phase 0 fails, stop:
the rest of the plan is worthless without it.

**Stop condition:** no maintained plugin for Capacitor 8 → park the whole effort. Do not fork a
plugin to serve ads.

---

## Phase 1 — Compliance artifacts, BEFORE any ad code

Deliberately first. Doing the paperwork first means the code cannot ship ahead of the disclosures,
which is the failure mode that gets apps pulled.

| Artifact | Change | Acceptance |
| --- | --- | --- |
| `ios/App/App/PrivacyInfo.xcprivacy` | `NSPrivacyCollectedDataTypes` gains Device ID (and Advertising Data if personalized); `NSPrivacyTracking` true if ATT is used | manifest validates; the iOS `compile` job's bundle assertion still passes |
| `ios/App/App/Info.plist` | add `NSUserTrackingUsageDescription` | present, and written in the app's voice per `tagspotter-copy` |
| `docs/store-metadata.google-play.json` | `dataSafety` gains device IDs collected **and shared**, purpose advertising | JSON updated; no `example.` placeholders |
| `docs/privacy-policy.md` | "Data we do not currently collect" section rewritten — it becomes false the moment an ad loads | policy names the ad provider, the data, and the opt-out |
| Play listing | "Contains ads" declared | checked in Play Console |

> The privacy manifest currently declares `NSPrivacyCollectedDataTypes` as an **empty array**, and the
> comment in it says so explicitly. Shipping an ad SDK while that stays empty is a false statement to
> App Review, not an oversight.

### The audience question gates everything

Before writing any of the above, decide: **is Tag Spotter child-directed, mixed-audience, or not
directed to children?**

A states-trivia game rated Everyone is plausibly kid-appealing. If Play treats it as child-directed
or mixed:

- only certified ad SDKs may serve
- **personalized ads are prohibited** — which removes most of the revenue
- `setTagForChildDirectedTreatment` / `tagForUnderAgeOfConsent` must be set

**If the answer is child-directed, revisit whether this is worth doing at all.** The compliance cost
stays and the revenue largely does not.

---

## Phase 2 — Consent, before the first ad request

| Task | Owner | Acceptance |
| --- | --- | --- |
| Google UMP consent flow | `tagspotter-feature` | no ad is requested before consent resolves, in EEA/UK **and** US state-privacy regions |
| Consent state persisted | `tagspotter-feature` | uses the existing `PreferenceStorage` token, not a new storage path |
| Declined / unavailable consent | `tagspotter-feature` | spec proves the hint control is hidden and the quiz is unaffected |

The consent SDK is a second network dependency and a second thing that can hang. It must fail
closed: **no consent, no ad, no blocking**.

---

## Phase 3 — The hint itself

| Task | Owner | Acceptance |
| --- | --- | --- |
| `HintService` — eligibility, cooldown, availability | `tagspotter-feature` | pure functions + spec, in the style of `challenge-streak.service.ts` |
| "Stuck?" control in the quiz modal | `tagspotter-a11y-gate` | contrast audit still **0/0 in both themes**; control reachable by keyboard with a visible focus ring |
| Reward applies 50/50 | `tagspotter-feature` | two wrong options removed; spec covers each region theme |
| Ad unavailable → control hidden | `tagspotter-feature` | spec: no fill, no network, consent declined, SDK missing — quiz behaves exactly as today |
| Copy | `tagspotter-copy` | `guardrail:copy-lexicon` = 0; no "free", no "watch now", period voice |

**Design rules, non-negotiable:**

- The hint is **never** required to answer, and never gates a question, a state, or an achievement.
- A quiz with no hint available must be indistinguishable from today's quiz.
- The control never appears mid-question after the user has started answering — it is present or it
  is not.

### Open decision: does a hinted correct answer score full points?

Not a detail. Trivia points feed the score, the streak (F-11) and the trip comparison (F-14). Full
points for a hinted answer makes score partly a function of ad-watching.

Options: full points (simplest, mildly pay-to-attention) · reduced points · full points but the trip
summary counts hinted solves separately. **Maintainer decides.** `dec-0014` says rewards only ever
move up, so whatever is chosen must not *lower* any existing award.

---

## Phase 4 — Guardrails

| Guardrail | Rule | Baseline |
| --- | --- | --- |
| `ads-test-unit-ids` | AdMob test unit IDs (`ca-app-pub-3940256099942544/…`) may not appear outside `*.spec.ts` | 0 |
| `ads-never-gate` | no `await` on an ad call inside the answer-submission path | 0 |
| `ads-consent-first` | spec-enforced, not regex — a test proving no request precedes consent | n/a |
| `csp-unsafe-eval` | unchanged, must stay 0 | 0 |

Shipping a test ad unit ID serves fake ads and earns nothing; clicking your own live ads is a
policy violation that can terminate the AdMob account. The first guardrail exists because that
mistake is silent.

**There is no remote kill switch.** With no backend (`con-0004`), disabling ads means shipping an
update and waiting for review. The build-time flag must default to **off**, so the ad path is opt-in
per release rather than something that ships by accident.

---

## Phase 5 — Verification on device

Everything below is on the Pixel, release build, both themes:

- [ ] Airplane mode: quiz works, hint control absent, no error surfaced
- [ ] Consent declined: same
- [ ] Ad watched to completion: two options removed, points awarded per the Phase 3 decision
- [ ] Ad dismissed early: no reward, no state change, question still answerable
- [ ] Contrast audit **0/0**, five routes, both themes, with the hint control visible
- [ ] Reduced motion: nothing in the hint flow animates
- [ ] APK size delta recorded against the 2.75 MB baseline

---

## Reasons to stop, at any point

Written down now, while it is still cheap to walk away:

1. No maintained AdMob plugin for Capacitor 8 (Phase 0)
2. The app is child-directed → personalized ads prohibited → revenue case mostly gone
3. APK grows more than 3 MB
4. The consent flow cannot be made to fail closed without blocking gameplay
5. Contrast or reduced-motion regressions that cannot be fixed without redesigning the quiz

## What this costs

Realistically a multi-session effort comparable to one phase of the original remediation — and the
majority of it is Phases 1 and 2, which produce no user-visible feature at all.

**The recommendation on record remains: ship v1 ad-free, and revisit with real retention data.** An
app with no installs earns nothing from ads, and this plan's cost is the same whether it runs before
or after launch. Running it after means the disclosures are already correct for the app as shipped.
