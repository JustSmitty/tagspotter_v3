# Filing Rules

The resolver decides *who* does the work. These rules decide *what gets written back* — the
compliance layer that keeps the Brain worth reading and keeps the resolver honest.

Every skill's final step is "file per `.agents/filing-rules.md`". This is that step.

---

## Rule 1 — Retrieve before you act, always

No agent starts work without running the Brain query the resolver handed it:

```bash
npm run resolve -- "<the request>"     # tells you which query to run
npm run brain -- search "<query>"      # run it
```

If retrieval returns a `constraint`, you are bound by it. If it returns a `decision` you are about
to reverse, you must supersede it explicitly (Rule 4) — you may not silently contradict it.

If retrieval returns **nothing**, that is a signal, not a green light: the project has no memory of
this area, so whatever you learn is worth filing.

## Rule 2 — File only the non-obvious *why*

Do **not** file:

- What the code already says plainly. The code is the source of truth for *what*.
- What git already records. Commits are the source of truth for *when*.
- Anything only relevant to one conversation.

**Do** file:

- A constraint that isn't visible in the diff (`con-0001-offline-first` is why the SVG projection is
  hand-rolled — nothing in that component says so).
- An option that was rejected, and why (`dec-0004` — MapLibre bought nothing for a static map).
- A bug whose cause wasn't where anyone looked (`pm-0001` — neither the reset logic nor the quiz
  logic was wrong; the invariant *between* them had no owner).

The test: **would an agent starting cold six months from now make a worse decision without this?**
If no, don't file it.

## Rule 3 — Provenance or it doesn't ship

`source:` must point outside the record: `commit:<sha>`, `file:<path>:<line>`, `audit:<id>`,
`issue:<n>`, `url:<...>`. `brain lint` warns on anything else.

Set `confidence:` honestly. A `low`-confidence record that is retrievable and marked shaky is more
useful than a confident-sounding guess, and far more useful than silence.

Set `review_by:` on every record. Default to 6 months; 12 for things tied to a shipped platform
decision. CI runs `brain lint --strict`, which fails on a passed `review_by` — so the date is a real
commitment, not decoration.

## Rule 4 — Never edit history, supersede it

When a fact changes:

1. Old record → `status: superseded`.
2. New record → `supersedes: [old-id]`.

Lint enforces both directions. An orphaned `superseded` record is an error, because retrieval would
surface it forever with nothing to redirect to. Editing the old record in place destroys the reason
the decision was originally made, which is usually the only part worth keeping.

## Rule 5 — Declare claims, accept the collision

If a record asserts a fact another record could contradict, put it in `claims:`:

```yaml
claims: {map-renderer: inline-svg}
```

Two `accepted` records with different values for the same key is a hard lint failure. This is the
mechanism, not a suggestion — audit finding **F-03** (README claiming both MapLibre and inline SVG)
is exactly the failure mode it exists to prevent.

A record still under discussion should carry `status: proposed` and **no claims**, so it can sit
alongside the decision it may eventually replace without breaking the build. `dec-0005` and
`dec-0008` are both live examples.

## Rule 6 — If you prompted for it twice, skillify it

The rule the whole system rests on. If you have written the same instructions to an agent twice, the
system has failed and the fix is a skill file, not a third prompt.

Promotion path:

1. **Once** — do the work, file what you learned.
2. **Twice** — write `.claude/skills/<name>/SKILL.md`, register it in `.agents/resolver.json`, add at
   least one routing eval in `.agents/evals/routing.json`.
3. **Enforceable?** — if success is machine-checkable, add a guardrail to
   `.agents/evals/guardrails.json` with today's violation count as its `baseline`.
4. **Ratcheted to 0?** — then go back and rewrite the skill that owns it. A guardrail reaching 0
   means the finding is closed, and the skill must now describe the **invariant to hold**, not the
   work to do. This step is the one that gets skipped (F-47): `tagspotter-release` spent months
   telling agents to turn on R8 that was already on, while every guardrail read 0 and the suite
   passed green. A skill file is not documentation about the project — it is the prompt an agent
   executes once the resolver routes to it, so stale text there is a green build shipping wrong
   instructions.

`npm run evals` fails if a skill exists without a route, or a route points at a missing skill. It
also fails if a skill does not name a guardrail it owns, references a guardrail that does not exist,
or has passed its `review_by`. Skillification is enforced structurally, not remembered.

What no check can decide is whether the *prose* is still true — see F-47 for why a scanner for
pending-work wording was measured and rejected. That is what `review_by` on each skill is for: the
same commitment Rule 3 puts on records, applied to the layer that instructs agents.

## Rule 7 — Postmortem on anything that reached a build

If a defect got past CI into a build, a `postmortem` record is mandatory before the fix merges. It
must answer:

- What happened (observable behaviour).
- Root cause — the *invariant* that had no owner, not the line that was wrong.
- The lesson that generalizes beyond this bug.
- Whether a guardrail can catch the class. If yes, add it in the same commit.

`pm-0001-stale-quiz-session` is the reference shape.

## Rule 8 — Escalate rather than widen a constraint

If the resolver returns an escalation, stop and ask the maintainer in chat. Three classes today:

| Escalation | Meaning |
|---|---|
| `publishing` | Outward-facing or hard to reverse. Never proceed unprompted. |
| `constraint-collision` | Would require breaking offline-first, the CSP, or no-backend. |
| `data-migration` | Changes persisted player data. Needs a migration note and a store spec. |

An agent may not resolve an escalation by editing the constraint that produced it.
