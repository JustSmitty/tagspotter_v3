---
id: f-045-resolver-substring-keyword-collisions
type: finding
title: F-45 — the resolver matched keywords as bare substrings; now word-boundary with inflections
status: resolved
date: 2026-08-24
source: file:scripts/resolve.mjs:44
author: claude
confidence: high
tags: [resolver, routing, tooling, agents]
claims: {resolver.keyword-matching: word-boundary-with-inflections}
supersedes: []
related: [audit-2026-08-15, f-044-store-readiness, f-046-block-form-claims-parse-as-a-list, f-047-guardrails-do-not-cover-the-instruction-layer]
review_by: 2027-02-28
---

`resolve.mjs:44` scores a route with `haystack.includes(keyword)` over the lowercased request, and
`:76` fires escalations the same way. There is no word boundary, so any keyword shorter than a word
matches inside unrelated words. Escalation keywords have the same flaw.

Measured against the current `.agents/resolver.json`:

| Request | Matched on | Owner it picked |
|---|---|---|
| `make the decision explicit in the docs` | `ci` inside **de-ci-sion** | `tagspotter-release` |
| `improve efficiency of the scoring math` | `ci` inside **effi-ci-ency** | `tagspotter-release` |
| `add a specific spec for the quiz service` | `ci` inside **spe-ci-fic** | `tagspotter-release` |
| `describe invariants` | `aria` inside **inv-aria-nts** | `tagspotter-a11y-gate` |
| `rewrite the toolchain migration section` | `migration` | escalates `data-migration` |
| `make the call asynchronous` | `sync` | escalates `constraint-collision` |
| `who is accountable for this` | `account` | escalates `constraint-collision` |

`ci` is the damaging one. "decision", "specific", "efficiency" and "precision" are ordinary words in
a request about anything, and each of them silently hands ownership to `tagspotter-release`.

**Why it matters more than a cosmetic bug.** `.agents/filing-rules.md` Rule 1 makes *every* agent
run `npm run resolve` before it touches code, and hands it the retrieval queries and escalations
that come back. A bad route sends the agent to the wrong skill's instructions and the wrong Brain
queries — it does not just mislabel the work, it changes what the agent reads as its rules. False
escalations are the cheaper failure (the agent stops and asks); a false *owner* is the expensive one.

The routing evals do not catch it because all sixteen cases in `.agents/evals/routing.json` are
phrased in the vocabulary the keyword lists were written from, so every keyword lands on a real word
boundary by construction. This is the same shape as the Phase 1 lesson about `guardrail:copy-lexicon`:
a matcher built from the instances you already know about will pass on exactly those instances.

## Fixed

`matchesKeyword()` in `scripts/resolve.mjs` replaces `includes()` for both routes and escalations.
A keyword now has to start and end on a word boundary, plus its regular inflections:

```
\b(?: <keyword>(?:s|es|d|ed|ing)?  |  <keyword minus trailing e>(?:ed|ing) )\b
```

Pruning the short keywords was the other option and was rejected: `ci` has to keep matching "the ci
pipeline is red on master".

**Why inflections, and why only inflections.** Plain `\b<keyword>\b` tests clean against every
collision but silently loses fifteen real matches — `publish` stops reaching "publishing", `svg`
stops reaching "svgs", `font` stops reaching "the fonts". Losing the *publishing* escalation to a
gerund is a worse bug than the one being fixed. The dropped-e branch covers `rename` → "renaming"
and `optimize` → "optimizing". Derivational endings are deliberately not guessed at: `deploy` does
not reach "deployment", so `deployment` is now listed in `resolver.json` instead. Guessing morphology
is how a matcher starts matching things nobody predicted, which is the defect being replaced.

`migration` still raises the data-migration escalation on "toolchain migration". That is a keyword
scoped too broadly, not a matcher bug, and it is left alone on purpose: a false escalation stops an
agent to ask a question, while a missed one lets it change persisted player data quietly. The safe
error is the loud one.

## What holds it

Eleven cases added to `.agents/evals/routing.json`, checked in **both** directions rather than just
observed to pass:

- **Six collision cases** — decision / efficiency / city (`ci`), invariants (`aria`), asynchronous
  (`sync`), accountable (`account`). Run against the old `includes()` matcher, **all six fail**. The
  sixteen pre-existing cases all still pass, which is the evidence the fix is not over-tight.
- **Five inflection cases** — publishing, deployment, svgs, fonts, and `ci` as a real word. Run
  against a deliberately over-tightened `\b<keyword>\b`, **two fail**
  (`publishing-still-escalates`, `plural-fonts-route-to-pipeline`). The file now goes red if someone
  tightens too far as well as if they loosen.

No guardrail was added. Reverting `matchesKeyword` to `includes()` already turns those six cases red,
so a `regex-scan` on `resolve.mjs` would be a second lock on the same door.

Two collisions nobody had measured turned up while building this, both hidden inside cases that were
passing green: `lag` matched f-**lag**, routing a flag-optimisation request to triage, and `build`
matched es-**build**. The suite absorbed them because it only ever asserted the winner, never who
else was in the room — which is the same blind spot as `f-047`, one layer down.
