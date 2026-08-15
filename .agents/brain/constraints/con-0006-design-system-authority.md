---
id: con-0006-design-system-authority
type: constraint
title: docs/design_principles.md is the authority for visuals and voice
status: accepted
date: 2026-08-15
source: file:docs/design_principles.md:3
author: justin
confidence: high
tags: [design-system, copy, brand]
claims: {design-authority: docs/design_principles.md}
supersedes: []
related: [dec-0008-americana-brand-voice]
review_by: 2027-02-28
---

When code and the design doc disagree, the doc wins and the code is the bug. The doc defines:

- **Palette:** cream `#fdfae9`, Interstate Rust `#D9541C`, Forest Pine `#396754`, Antique Gold
  `#F1C40F` — all "sun-faded" Americana, no saturated web colors.
- **Type:** Newsreader (headline serif), Work Sans (UI/data), Special Elite (stamped tag).
- **Physicality:** every element reads as a physical object — stamped metal, layered cardstock,
  grain. New components use the `.stamped-effect` and `.cardstock-layer` utilities in `global.scss`
  rather than inventing new shadow recipes.
- **Voice:** 1950s golden-age-of-travel. The current golf copy is a violation, not a variant
  (dec-0008-americana-brand-voice).

An agent introducing a new component must cite which section of the doc it is implementing. If the
doc does not cover the case, extend the doc in the same commit — do not improvise silently.
