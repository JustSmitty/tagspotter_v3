# The Tag Spotter Agent Workforce

Organizational structure, in code. Five parts, each with a runnable implementation:

| Concept | Lives in | Runs as |
|---|---|---|
| **Skill files** — the employees | `.claude/skills/*/SKILL.md` | invoked by name |
| **Resolver table** — the org chart | `.agents/resolver.json` | `npm run resolve -- "<request>"` |
| **The Brain** — the memory layer | `.agents/brain/**` | `npm run brain -- search "<query>"` |
| **Filing rules** — compliance | `.agents/filing-rules.md` | enforced by `brain lint` + evals |
| **Trigger evals** — performance reviews | `.agents/evals/*.json` | `npm run evals` |

## The loop

```
request
   │
   ├─ npm run resolve -- "<request>"     ── who owns this? escalate?
   │        ↓
   ├─ npm run brain -- search "<query>"  ── what do we already know?
   │        ↓
   ├─ <skill executes>                   ── constraints loaded, work done
   │        ↓
   ├─ npm run lint && npm run test:ci    ── did it actually work?
   │        ↓
   ├─ file per .agents/filing-rules.md   ── what did we learn?
   │        ↓
   └─ npm run evals                      ── did the acceptance criteria hold?
```

`npm run verify` runs lint + tests + evals in one shot. CI runs all of it plus a build.

## Latent space vs deterministic space

The load-bearing design rule. Work goes wrong when it runs in the wrong environment, so each half of
the system does only what it is good at:

| Deterministic (plain Node, no model) | Latent (the model) |
|---|---|
| Which skill owns this request (`resolve.mjs`) | What the right change actually is |
| Ranking and retrieving memory (`brain.mjs search`) | Judging which retrieved record applies |
| Detecting contradictions between records | Deciding how to resolve one |
| Counting guardrail violations (`evals.mjs`) | Understanding why a violation matters |
| Enforcing budgets, parity, provenance | Taste, tone, architecture, tradeoffs |

Routing is a lookup, not a judgement call. Contradiction detection is a set comparison, not a
reading-comprehension exercise. Everything that can be a deterministic check *is* one — which leaves
the model's context free for the part only it can do.

This is also why retrieval runs first: the model should never spend its window rediscovering that
the map used to be MapLibre, or that the onboarding flag deliberately survives a reset.

## The three enforcement mechanisms

Documentation that only asks nicely gets ignored. Each rule here has teeth:

1. **`brain lint`** — a record without provenance warns; a dangling reference, an orphaned
   `superseded` record, or two `accepted` records claiming different values for the same key is a
   hard error. `--strict` (used in CI) also fails on a passed `review_by`, so the corpus cannot rot
   quietly.

2. **Structural evals** — a project skill that no resolver route can reach fails the build, and a
   route pointing at a skill that does not exist fails the build. Filing rule 6 ("if you prompted for
   it twice, skillify it") is enforced structurally rather than remembered.

3. **The guardrail ratchet** — every acceptance criterion in `docs/remediation-plan.md` is a check
   whose `baseline` is its violation count on the audit date. CI fails when a count rises above its
   baseline. Debt can only shrink. When a fix lands, run
   `npm run evals -- --update-baselines`, commit the lowered number, and the guardrail becomes a
   permanent regression test.

The ratchet is why the suite is green today with 41 open findings, and why it will still be green —
and stricter — after each phase lands.

## Vendored vs project-owned skills

`.claude/skills/*` contains both:

- **Project-owned** (`tagspotter-*`) — real directories, written here, carrying Tag Spotter's
  constraints. These own work.
- **Vendored** (`angular-*`, `mapbox-*`, `fixing-accessibility`, `accessibility-audit`) — symlinks to
  `.agents/skills/`, managed by `skills-lock.json`. These are **reference material only**.

The resolver marks vendored routes with `"vendored": true` and never selects one as primary. A
change to this app is always owned by a skill that knows this app's constraints, with the vendored
skill attached as support. `angular-signals` can tell you how `linkedSignal` works; only
`tagspotter-feature` knows that mutations must go through the store's queue.

## Adding to the workforce

1. Write `.claude/skills/<name>/SKILL.md` with `name` (matching the directory) and a `description`
   that says both when to use it *and* when not to.
2. Add a route to `.agents/resolver.json` with keywords, paths and a `brainQuery`.
3. Add at least one case to `.agents/evals/routing.json` proving the route reaches it.
4. If success is machine-checkable, add a guardrail to `.agents/evals/guardrails.json` with today's
   count as the baseline.
5. `npm run evals`.

Step 3 is not optional — a skill with no routing eval is a skill whose inbox silently breaks the next
time someone edits a keyword list.

## Current state

- **17** brain records — 8 decisions, 6 constraints, 1 finding register, 1 postmortem, 1 context
- **16** machine-checkable claims under contradiction detection
- **6** project-owned skills, **5** vendored skills routed as support
- **16** routing evals, **18** guardrails covering 18 of the 41 audit findings
- Remaining findings are tracked in `docs/remediation-plan.md` with human acceptance criteria
