---
name: tagspotter-asset-pipeline
description: Owns everything under src/assets and the app's shipped weight — state flag SVGs, fonts, icons, the GeoJSON atlas, and the angular.json asset globs. Use when the request involves assets, images, SVGs, flags, icons, fonts, bundle size, payload, optimization, or the asset budget. Enforces the offline-first constraint and the per-asset size budgets.
---

# Tag Spotter — Asset Pipeline

Every asset ships inside the app. There is no CDN and there never will be
(`con-0001-offline-first`). That makes asset weight a permanent, first-class concern rather than a
deploy-time detail.

## Current state (Phase 2 landed 2026-08-15)

| | Size | Verdict |
|---|---|---|
| `src/assets/stateflags/` | **0.44 MB**, 51 files (20 SVG + 31 WebP) | Produced by `npm run assets:flags` (`dec-0010`). Was 8.4 MB. |
| `src/assets/fonts/` | 436 KB | Correct — keep (`dec-0003-self-host-fonts`). |
| `src/assets/us-states.json` | 76 KB | Correct — the atlas needs it. |
| **`www/` total** | **2.1 MB** | Was 15 MB. Release APK 2.9 MB. |

The ionicons glob is gone — every icon goes through `addIcons()` and inlines as a data URI.

**Do not hand-edit the flags directory.** It is generated:

```bash
npm run assets:flags          # idempotent; re-run after adding or replacing a flag
npm run assets:flags -- --dry-run
```

## Budgets (enforced by `guardrail:flag-budget`)

| Rule | Limit |
|---|---|
| Any single flag SVG | ≤ 40 KB |
| `src/assets/stateflags/` total | ≤ 1 MB |
| Any font file | ≤ 160 KB |
| `src/assets/` total | ≤ 2 MB |

Exceeding a budget fails the build. Raising a budget requires a `decision` record explaining what the
weight buys the player.

## How the flag pipeline works

`scripts/optimize-flags.mjs` runs SVGO over every flag, then rasterizes to WebP **only** those still
over the per-file budget. Simple flags stay vector (scalable, themeable); detailed state seals become
384 px WebP, because their weight is thousands of path points and no minifier fixes that.

The script rewrites `flagURL` in `src/data/states.json` to match what is on disk. That is safe —
only `{ID, fnd}` is persisted (`dec-0002-slim-save-payload`), so seed edits reach every player
harmlessly. **Never hand-edit `flagURL`.**

After running it:

1. `git diff --stat` — expect a large reduction. A file that barely moved was already optimized.
2. **Look at the flags.** Rasterization and aggressive path merging can drop detail. Build a contact
   sheet and actually view it rather than trusting the byte count:
   ```bash
   node -e "const s=require('sharp'),fs=require('fs');/* composite all 51 into one PNG */"
   ```
   This is how `dec-0010` was verified. Check the seals — PA, FL, VT, ID, ME are the demanding ones.
3. `npm run evals -- --only=flag-budget`.

### Adding a new flag

Drop the SVG in, run `npm run assets:flags`, commit whatever the script produces. If it exceeds
budget even after rasterizing, the source art is the problem — do not raise the budget to fit it.

## Icons

Every icon is registered through `addIcons({...})` from `ionicons/icons`, which inlines it as a data
URI. There is no icon directory in the build any more, and no lazy-fetch fallback to rescue a missing
registration — an unregistered name renders an empty box.

So when adding an `ion-icon`, **register it in the component's `addIcons()` call**, then verify
visually. This check catches an unregistered name across the whole app:

```bash
# compare ion-icon name="..." in templates against addIcons({...}) keys
```

## Adding any new asset

1. Does it work offline? (It must — `con-0001`.)
2. Is it under budget *before* it lands, not after?
3. SVG: run SVGO first, strip Inkscape/Illustrator metadata, no embedded rasters.
4. Raster: WebP, sized to its largest actual render box × 2, never larger.
5. Fonts: subset to the glyphs used; declare in `src/theme/fonts.scss`; never add a font host.

## Workflow

```bash
npm run brain -- search "assets offline bundle fonts flags"
npm run evals -- --only=flag-budget
npm.cmd run build && du -sh www
```

## Definition of done

- [ ] Every budget passes
- [ ] `du -sh www` reported in the summary, before and after
- [ ] Visually verified: plate grid, flag quiz question, all icon surfaces
- [ ] No new remote host anywhere
- [ ] `states.json` `flagURL` values still resolve
- [ ] Budget changes (if any) justified in a `decision` record
