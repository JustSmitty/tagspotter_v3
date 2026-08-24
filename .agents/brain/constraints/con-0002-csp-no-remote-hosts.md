---
id: con-0002-csp-no-remote-hosts
type: constraint
title: CSP allows no remote hosts; keep it that way and keep it accurate
status: accepted
date: 2026-08-14
source: file:src/index.html:14
author: justin
confidence: high
tags: [security, csp, offline]
claims: {csp-remote-hosts: none}
supersedes: []
related: [con-0001-offline-first, dec-0003-self-host-fonts, dec-0004-inline-svg-atlas]
review_by: 2027-01-31
---

The meta CSP permits only `self`, the Capacitor local origins, and `data:`/`blob:` for images and
workers. No font hosts, no tile hosts, no script hosts.

**Rules for agents:**

- A change that requires widening the CSP is a change that violates con-0001-offline-first. Stop and
  escalate rather than adding a host.
- Every directive must be justified by a dependency that currently exists. When a dependency is
  removed, its directive and its explanatory comment must be removed in the same commit.

That second rule was broken once, and that is why the guardrail exists. `script-src` carried
`unsafe-eval` with a comment attributing it to MapLibre long after MapLibre itself was removed in
`d2a2eff` (audit F-21). Closed in `1a0b5b2`: the directive and its comment went together, and
`guardrail:csp-unsafe-eval` now scans `src/index.html` and holds it at 0.

One consequence of how that guardrail is built: it is a plain regex scan of `src/index.html`, so an
explanatory comment in that file cannot name the banned string either. The comment there is worded
around it deliberately — reword rather than adding a scanner exclusion.
