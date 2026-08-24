---
id: f-046-block-form-claims-parse-as-a-list
type: finding
title: F-46 — multi-line `claims:` parses as a list, so those claims are never contradiction-checked
status: open
date: 2026-08-24
source: file:scripts/brain.mjs:141
author: claude
confidence: high
tags: [brain, librarian, claims, tooling]
claims: {brain.claims-form: inline-mapping-only}
supersedes: []
related: [f-045-resolver-substring-keyword-collisions]
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

**Preferred fix:** make the shape a lint error rather than teaching the parser the block form.
`.agents/brain/README.md` and Rule 5 both document the inline form, so the block form is drift, and
a loud failure at write time is better than a parser that accepts two spellings with different
semantics. `Array.isArray(data.claims)` (or any non-plain-object) should fail lint with a message
that names the record and shows the inline form. Convert `f-042` and `f-043` in the same commit.

Filed alongside `f-045-resolver-substring-keyword-collisions`; both are the same shape of defect —
tooling that matches more loosely than it appears to, and stays quiet about it.
