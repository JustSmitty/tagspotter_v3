---
id: f-045-resolver-substring-keyword-collisions
type: finding
title: F-45 — the resolver matches keywords as bare substrings, so ordinary English mis-routes
status: open
date: 2026-08-24
source: file:scripts/resolve.mjs:44
author: claude
confidence: high
tags: [resolver, routing, tooling, agents]
claims: {resolver.keyword-matching: substring}
supersedes: []
related: [audit-2026-08-15]
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

**Not fixed here** — this was found while rewriting `tagspotter-release`, and changing how every
route is scored is its own change with its own eval work. The fix is a word-boundary match
(`\b<keyword>\b`, escaped) rather than pruning the short keywords, because pruning `ci` loses the
real CI route. It should land with routing evals built from *adversarial* phrasings — requests that
contain a keyword as a substring and must **not** route to it — since the existing cases cannot fail.
