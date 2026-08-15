# The Brain — memory layer & librarian protocol

Every agent working on Tag Spotter reads from here **before** it touches code, and writes back to
here **after**. An agent that starts from a blank context re-derives decisions the project already
made, and re-makes mistakes the project already paid for.

```bash
npm run brain -- search "why is the save encrypted"   # retrieval: always do this first
npm run brain -- get dec-0001-encrypted-save-envelope # read one record whole
npm run brain -- lint                                 # librarian hygiene pass
npm run brain -- stats                                # corpus health
npm run brain -- index                                # regenerate index.json
```

## What lives here

| Folder | Type | Holds |
|---|---|---|
| `decisions/` | `decision` | Choices with consequences, and *why*. The ADR log. |
| `constraints/` | `constraint` | Non-negotiables an agent must not violate (offline-first, CSP, platform). |
| `findings/` | `finding` | Audit results and open defect registers. |
| `postmortems/` | `postmortem` | Bugs that reached a build, and what actually caused them. |
| `context/` | `context` | Durable background that isn't a decision (domain notes, data provenance). |

## Record format

```yaml
---
id: dec-0004-inline-svg-atlas   # must equal the filename
type: decision                  # decision|constraint|finding|postmortem|context
title: Render the atlas as inline SVG, not MapLibre
status: accepted                # proposed|accepted|rejected|superseded|open|resolved
date: 2026-07-11                # when the record became true
source: commit:d2a2eff          # PROVENANCE — see below. Never omit.
author: justin
confidence: high                # high|medium|low
tags: [map, rendering, offline]
claims: {map-renderer: inline-svg}  # machine-checkable facts (see Contradictions)
supersedes: []
related: [con-0001-offline-first]
review_by: 2027-01-31           # when a human must re-verify this
---
```

## The three librarian rules

Retrieval over a dirty corpus is worse than no retrieval, because it launders bad facts through a
confident-sounding agent. So:

### 1. Provenance on every fact

`source:` must be a *pointer to something outside this file* — `commit:<sha>`, `file:<path>:<line>`,
`audit:<id>`, `url:<...>`, `issue:<n>`. "I remember deciding this" is not a source. `brain lint`
warns on any source without a `:` or `/` in it.

A record with `confidence: low` is retrievable but down-ranked. Use it rather than deleting a
half-known thing — an agent that knows a fact is shaky behaves better than one that never sees it.

### 2. Contradiction checks when new data collides with old

The `claims:` map is how the corpus stays internally consistent. Any two records with
`status: accepted` (or `open`) that assert **different values for the same claim key** are a hard
lint error:

```
CONTRADICTION on claim 'map-renderer': dec-0004-inline-svg-atlas='inline-svg' vs dec-0002-x='maplibre'
```

This is not hypothetical. Finding **F-03** in the audit was exactly this class of bug: the README
said the map was "powered by MapLibre GL" in one section and "inline SVG generated from bundled
GeoJSON" in another, and both had been true at different times. A claims collision would have caught
it the day the second one landed.

When you supersede a fact, don't edit history — set the old record's `status: superseded` and point
the new one at it via `supersedes: [old-id]`. Lint enforces the back-reference in both directions:
an orphaned `superseded` record is an error, because retrieval would keep surfacing it forever with
nothing to redirect to.

### 3. Active pruning

Every record carries `review_by`. Past that date the librarian must re-verify the fact against the
code and either re-date it or supersede it. `brain lint --strict` (run in CI) treats a passed
`review_by` as an error, so the corpus cannot quietly rot.

**Prune aggressively.** Do not file: things the code already says plainly, things git already
records, or anything only relevant to one conversation. File the *non-obvious why* — the constraint
that isn't visible in the diff, the option that was rejected and the reason, the bug whose cause
wasn't where anyone looked first.

## Who is the librarian

Today: the human maintainer, plus any agent running the `tagspotter-feature` or `tagspotter-triage`
skill, both of which end with a mandatory filing step (see `.agents/filing-rules.md`).

The librarian's job is not to write records. It is to **delete and merge** them. A corpus that only
grows becomes a corpus nobody trusts.
