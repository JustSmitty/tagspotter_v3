---
id: con-0003-windows-dev-commands
type: constraint
title: Development happens on Windows — use npm.cmd and PowerShell-safe paths
status: accepted
date: 2026-08-15
source: file:AGENTS.md:3
author: justin
confidence: high
tags: [tooling, environment, windows]
claims: {dev-platform: windows}
supersedes: []
related: []
review_by: 2027-06-30
---

The maintainer develops on Windows 11. Agents that shell out must account for it:

- Use `npm.cmd run <script>`, not bare `npm run`, when invoking through a shell that resolves
  Windows executables strictly.
- `npm run assets:mobile` is a PowerShell script (`scripts/generate-mobile-assets.ps1`).
- Karma/Chrome can fail with `spawn EPERM` in a sandboxed desktop agent unless Chrome is allowed to
  launch outside the sandbox. Same for the Angular compiler during `npm run build`. If a build fails
  with EPERM, that is an environment permission issue, not a code defect — do not "fix" code in
  response to it.

CI runs on Linux, so anything committed must work on both. Do not introduce Windows-only paths or
line-ending assumptions in committed scripts.
