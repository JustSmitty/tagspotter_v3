---
name: tagspotter-copy
description: Owns every user-facing string in Tag Spotter — templates, alerts, toasts, onboarding, README and store metadata. Use when the request involves copy, wording, microcopy, voice, tone, brand, labels, renaming user-visible things, or writing/fixing documentation claims. Enforces the single Americana voice and blocks the golf metaphor, the false "AI Caddie" claim, and unverifiable tech claims.
---

# Tag Spotter — Copy & Voice

One product, one voice. Right now the app does not have one, and fixing that is this skill's
standing job.

## The voice

**1950s golden age of American travel.** Warm, plainspoken, slightly nostalgic. It sounds like a
well-made roadside sign or the back of a postcard — never like a marketing deck, never like a sports
broadcast.

Authority: `docs/design_principles.md` (`con-0006-design-system-authority`). When code and that doc
disagree, the doc wins.

| Write this | Not this |
|---|---|
| Spotted · Collected · Carded *(in the "recorded on a card" sense)* | Birdied, carded a par |
| Traveler's Handbook | Caddie Guide |
| SPOT / QUIZ | LAYUP / ATTACK |
| Start a new trip | Tee off from scratch |
| Finish this state? | Resume the hole? |
| Leave the quiz? | Walk off the green? |
| Spotting range | Miles traveled, odometer |

**Banned outright** (`guardrail:copy-lexicon` fails the build on these):

1. **The golf lexicon** — caddie, tee off, fairway, green in regulation, layup, birdie, 18th, on the
   bag, walk off the green, hole. It is a different product wearing this one's clothes
   (`dec-0008-americana-brand-voice`).
2. **"AI Caddie" and any AI claim.** There is no AI in this app. The onboarding modal currently says
   there is (audit F-02). That is false, and false capability claims are an app-store review risk.
3. **"Miles traveled" / "odometer" / "distance driven."** The number is the distance from the player
   to a state's centroid, summed — not travel (audit F-07). Either call it what it is, or build the
   thing the words promise. Do not keep the words.

## Rules for any string you write

- **Say the true thing.** If copy describes behaviour, verify the behaviour first. Two audit findings
  (F-02, F-07) and one README contradiction (F-03) all come from copy that outran the code.
- **Second person plural is the house habit** — "we've already carded that plate." Keep it consistent;
  don't mix "you" and "we" in one flow.
- **Alerts get a real verb pair.** `Cancel / Yes, card it!` beats `No / Yes`. The confirm button says
  what happens.
- **Errors say what the player can do**, not what failed internally. "Storage may be full" is
  actionable; "persist error" is not.
- **No em-dash pileups, no exclamation stacking, no ALL CAPS outside display type** (the plate tags
  and ledger keys are display type; sentences are not).

## Documentation claims

README, `docs/**`, and store metadata are copy too, and they are the easiest place to ship a false
statement.

Before writing any technical claim, verify it against the repo *right now*:

- The README claimed the map was "powered by MapLibre GL" in one section and inline SVG in another
  (audit F-03). MapLibre had been removed in `d2a2eff`. Both sentences had been true; only one still
  was.
- `guardrail:stale-tech-claims` scans docs for named dependencies that are not in `package.json`.

If a claim is load-bearing, file it as a Brain `claim:` so a future contradiction is caught by lint
rather than by a reader (filing rule 5).

## Workflow

```bash
npm run brain -- search "brand voice copy design system americana"
```

1. Retrieve. Read `con-0006` and `dec-0008`.
2. Change the strings. Templates, the alert/toast text in `home-workflow.service.ts`, onboarding, and
   any `aria-label` or `title` that mirrors visible text — **screen-reader text is copy** and must
   match what is on screen (audit F-33 is the live mismatch).
3. `npm run evals -- --only=copy-lexicon` — must not increase.
4. Update `docs/design_principles.md` if you established a new voice rule.
5. If a whole surface changed voice, file or update a `decision` record.

## Definition of done

- [ ] No banned term anywhere in `src/`, `README.md`, or `docs/`
- [ ] Every claim about behaviour verified against current code
- [ ] `aria-label` / `title` text matches the visible label
- [ ] `npm run lint` clean (templates compile)
- [ ] `guardrail:copy-lexicon` and `guardrail:stale-tech-claims` not increased
- [ ] Read the changed flow start to finish out loud — it sounds like one product
