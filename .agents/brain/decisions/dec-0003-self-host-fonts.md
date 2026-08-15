---
id: dec-0003-self-host-fonts
type: decision
title: Self-host all typefaces as woff2
status: accepted
date: 2026-08-14
source: commit:b110499
author: justin
confidence: high
tags: [typography, offline, csp, assets]
claims: {font-delivery: self-hosted}
supersedes: []
related: [con-0001-offline-first, con-0002-csp-no-remote-hosts]
review_by: 2027-06-30
---

Newsreader, Work Sans and Special Elite are bundled in `src/assets/fonts` (~436 KB total) and
declared in `src/theme/fonts.scss`. The Google Fonts links were removed.

The reason is not performance, it is correctness of first paint on a road trip: the app is used
where there is no signal, and a remote font that failed to load fell back to a system serif, which
broke the entire "physical artifact" premise of the design system. This is also what lets the CSP
declare `font-src 'self' data:` with no remote hosts.

Do not reintroduce a font CDN. If a weight is missing, subset it and add it here.
