---
id: f-048-block-form-claims-parse-as-a-list
type: finding
title: F-48 — multi-line `claims:` parsed as a list; the parser now reads block mappings
status: resolved
date: 2026-08-24
source: file:scripts/brain.mjs:95
author: claude
confidence: high
tags: [brain, librarian, claims, tooling]
claims: {brain.claims-form: inline-or-block-mapping}
supersedes: []
related: [f-047-resolver-substring-keyword-collisions, f-044-store-readiness, f-049-guardrails-do-not-cover-the-instruction-layer]
review_by: 2027-02-28
---

The front-matter parser only understands the **inline** claims form:

```yaml
claims: {map-renderer: inline-svg}     # parses to an object — correct
```

Written in block form it produces an **array of strings**, not a mapping:

```yaml
claims:                                 # parses to ["a: 1", "b: 2"]
  a: 1
  b: 2
```

`brain.mjs:141` guards with `typeof data.claims === 'object'`, and an array satisfies that, so the
bad shape is stored rather than rejected. The contradiction check at `:270` then runs
`Object.entries()` over it and gets **positional keys**: `'0'`, `'1'`, `'2'`.

Two consequences, and the second is the loud one:

1. The record's actual claim keys never enter the index, so the record is invisible to the
   contradiction check that `.agents/filing-rules.md` Rule 5 exists to run. It looks like it is
   participating; it is not.
2. Any two **authoritative** records (`accepted` or `open` — `AUTHORITATIVE` at `:32`) written this
   way collide at key `'0'` with completely unrelated values.

Live instances: `f-042-contrast-debt` and `f-043-nav-icons-were-black` both use the block form.
Neither is checked today only because both are `status: resolved`, which is not authoritative.
Flipping both to `open` reproduces it immediately:

```
ERROR CONTRADICTION on claim '0': f-042-contrast-debt='contrast.baseline.light: 0'
                              vs f-043-nav-icons-were-black='nav-icons.paint-method: mask-image'
ERROR CONTRADICTION on claim '1': f-042-contrast-debt='contrast.baseline.dark: 0'
                              vs f-043-nav-icons-were-black='nav-icons.currentcolor-works: true'
```

So the corpus is consistent by accident, not by construction — and the diagnostic a librarian would
eventually hit names a key nobody wrote and two records that contradict nothing.

## Fixed

Two changes in `scripts/brain.mjs`, and they hold each other up.

**The parser now reads block mappings.** A bare `key:` opens a block collection, and YAML decides
which kind by the first child: a leading `- ` is a sequence, `child: value` is a mapping. The old
code assumed sequence unconditionally. It now branches on the dash the `nested` regex was already
capturing and discarding. Dotted keys are allowed too — the mapping branch matched `[\w-]+`, which
stops at the first `.`, so `contrast.baseline.light` would have been dropped even once the branch was
reachable.

**`claims:` that is not a mapping is now a lint error.** Supporting the block form fixes the shape
people actually write; the type guard catches the shapes nobody has written yet. A sequence or a bare
string is reported against the record that carries it, with both valid spellings in the message,
rather than being coerced to `{}` and forgotten.

## Deviated from what this record recommended

The original entry said to make the block form a lint error and convert `f-042` and `f-043` to inline
— treat the block form as drift. That was wrong, and the evidence was already in the corpus: two
records written months apart independently used it. It is idiomatic YAML and the natural way to write
a mapping of more than two keys. The thing that was actually broken was a hand-rolled parser that
accepted valid YAML and produced something else.

So the form was supported instead of banned, and neither record was edited. Both now parse correctly
with no change to their text.

## Verified

- **Parse output diffed across all 30 records, before and after.** The only differences anywhere are
  `f-042` and `f-043`, whose `claims` go from a 3- and 2-element array of `"key: value"` strings to
  the mappings they were written as. Every other field on every other record is identical, which is
  what makes this a parser fix and not a corpus edit.
- **The original repro no longer reproduces.** Flipping both records to `open` — the state that made
  their claims authoritative — previously produced `CONTRADICTION on claim '0'` and `'1'` between two
  records that contradict nothing. Now clean.
- **Lint rejects both bad shapes.** Checked with a temporary probe record: a `- ` sequence errors, a
  bare scalar errors, a block mapping passes. Probe removed.
- **The guard catches a regression in the parser, not just in a record.** With the parser
  deliberately reverted to sequence-always, `f-042` and `f-043` immediately fail lint with the new
  error. So the two halves are each other's regression test, and CI already runs
  `brain lint --strict`. No separate guardrail was added for the same reason as `f-045`: it would be
  a second lock on one door.

`.agents/brain/README.md` now documents both spellings where a librarian will actually read them.

## Amended after review — the fix dropped lines instead of records

Deciding mapping-vs-sequence from the first child fixed the whole-value shape and left the same bug
at line granularity. Three holes, all silent, all confirmed against the shipped loader:

- **A child line whose key fell outside `[\w.-]` was discarded** with `malformedClaims: false` and
  lint green. So `claims:` with `csp/script-src: self` in it parsed to a valid-looking mapping
  missing that claim, and the contradiction check never saw it — this record's own stated harm, one
  level down.
- **The outcome depended on line order.** The same three lines produced either a hard error or
  silent data loss depending on which one came first, because only the first child chose the
  container.
- **A two-level block flattened into siblings.** `claims:` / `contrast:` / `light: 4.5` / `dark: 7.0`
  parsed to `{contrast: "", light: "4.5", dark: "7.0"}` — nesting lost, an empty-string claim minted
  under a key nobody wrote, and `light`/`dark` promoted to corpus-wide claim keys that would collide
  with any other record using them.

The block key grammar now matches the inline one exactly (`[^:]+`), which is what
`.agents/brain/README.md` already promised readers — that sentence was false for any key with a
slash or a space. Anything still unrepresentable is **reported**, never dropped: a non-pair line and
a nested mapping both fail lint by name and line content.

**The principle this record stated and the fix did not keep:** silent coercion is what let the array
form survive. A parser that cannot represent an input must say so.
