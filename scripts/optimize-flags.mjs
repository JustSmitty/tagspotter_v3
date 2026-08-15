#!/usr/bin/env node
/**
 * State flag asset pipeline (audit F-23).
 *
 * The flags shipped as raw Inkscape exports: 8.4 MB across 51 files, up to
 * 775 KB each, to draw a 56x56 thumbnail. This makes that reproducible instead
 * of a one-time cleanup someone has to remember how to redo.
 *
 * Two passes:
 *   1. SVGO over every flag. Simple flags (stripes, tricolours) come out tiny
 *      and stay vector, which is the better artefact — scalable and themeable.
 *   2. Anything still over the per-file budget is a detailed state seal whose
 *      cost is thousands of path points, not markup. Those rasterize to WebP at
 *      RASTER_WIDTH and the SVG is dropped.
 *
 * `flagURL` in src/data/states.json is rewritten to match what is on disk. That
 * field is seed data, not persisted progress (only {ID, fnd} is saved — see
 * dec-0002-slim-save-payload), so changing an extension is safe for existing
 * players.
 *
 *   node scripts/optimize-flags.mjs [--dry-run]
 *
 * Idempotent: re-running on optimized assets is a no-op.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { optimize } from 'svgo';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLAGS_DIR = join(ROOT, 'src', 'assets', 'stateflags');
const STATES_JSON = join(ROOT, 'src', 'data', 'states.json');
const GUARDRAILS = join(ROOT, '.agents', 'evals', 'guardrails.json');

/**
 * The largest box a flag is ever drawn in is the quiz answer option at 150x100
 * CSS px. 384 covers that at ~2.5x device pixel ratio with room to spare, and
 * keeps every seal comfortably inside the per-file budget.
 */
const RASTER_WIDTH = 384;
const WEBP_QUALITY = 82;

const dryRun = process.argv.includes('--dry-run');

/** Budget lives in the guardrail so there is one number, not two that drift. */
function budgetBytes() {
  const guardrails = JSON.parse(readFileSync(GUARDRAILS, 'utf8')).guardrails;
  return guardrails.find((guardrail) => guardrail.id === 'flag-budget')?.maxBytesPerFile ?? 40960;
}

// SVGO 4 keeps viewBox by default, so the preset needs no overrides. Dimensions
// are dropped so the flags scale to whatever box the CSS gives them, and numeric
// precision is cut to 2 decimals — at 56px nobody can see the difference, and it
// is where most of the weight in an Inkscape export actually lives.
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    'preset-default',
    'removeDimensions',
    { name: 'cleanupNumericValues', params: { floatPrecision: 2 } },
    { name: 'convertPathData', params: { floatPrecision: 2 } },
  ],
};

function listFlags() {
  return readdirSync(FLAGS_DIR)
    .filter((file) => ['.svg', '.webp'].includes(extname(file).toLowerCase()))
    .sort();
}

function sizeOf(file) {
  return statSync(join(FLAGS_DIR, file)).size;
}

/**
 * These SVGs declare wildly different intrinsic sizes (some in mm, some
 * thousands of px), so a fixed DPI either blows past sharp's pixel limit or
 * renders too small to downsample cleanly. Scale the density so the rasteriser
 * lands a little above the target width, then let resize do the rest.
 */
async function densityFor(path) {
  const { width } = await sharp(path).metadata();
  if (!width) return 72;
  const scaled = Math.round(72 * ((RASTER_WIDTH * 1.5) / width));
  return Math.min(Math.max(scaled, 4), 600);
}

async function main() {
  const budget = budgetBytes();
  const before = listFlags().reduce((total, file) => total + sizeOf(file), 0);
  const vectorized = [];
  const rasterized = [];

  for (const file of listFlags()) {
    if (extname(file).toLowerCase() === '.webp') {
      vectorized.push(file);
      continue;
    }

    const path = join(FLAGS_DIR, file);
    const original = readFileSync(path, 'utf8');
    const { data } = optimize(original, { ...SVGO_CONFIG, path });

    if (!dryRun && data.length < Buffer.byteLength(original)) {
      writeFileSync(path, data);
    }

    const optimizedSize = Buffer.byteLength(dryRun ? data : readFileSync(path));

    if (optimizedSize <= budget) {
      vectorized.push(file);
      continue;
    }

    // Still oversized: a detailed seal. Vector buys nothing here.
    const target = `${basename(file, extname(file))}.webp`;
    if (!dryRun) {
      await sharp(path, { density: await densityFor(path) })
        .resize({ width: RASTER_WIDTH, withoutEnlargement: false })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(join(FLAGS_DIR, target));
      unlinkSync(path);
    }
    rasterized.push({ from: file, to: target, was: optimizedSize });
  }

  if (!dryRun) {
    syncStatesJson();
  }

  const after = listFlags().reduce((total, file) => total + sizeOf(file), 0);
  const oversized = listFlags().filter((file) => sizeOf(file) > budget);

  console.log(`\nflags: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB` +
    `  (${(100 - (after / before) * 100).toFixed(0)}% smaller)${dryRun ? '  [dry run]' : ''}`);
  console.log(`  kept as SVG: ${vectorized.length}`);
  console.log(`  rasterized to WebP @${RASTER_WIDTH}px: ${rasterized.length}`);
  for (const entry of rasterized.slice(0, 5)) {
    console.log(`    ${entry.from}  ${(entry.was / 1024).toFixed(0)} KB -> ${(sizeOf(entry.to) / 1024).toFixed(0)} KB`);
  }
  if (rasterized.length > 5) console.log(`    ...and ${rasterized.length - 5} more`);
  console.log(`  over ${(budget / 1024).toFixed(0)} KB budget: ${oversized.length}${oversized.length ? ` (${oversized.join(', ')})` : ''}\n`);
}

/** Point every flagURL at the file that actually exists on disk. */
function syncStatesJson() {
  const states = JSON.parse(readFileSync(STATES_JSON, 'utf8'));
  const onDisk = new Map(listFlags().map((file) => [basename(file, extname(file)), file]));
  let changed = 0;

  for (const state of states) {
    const current = String(state.flagURL ?? '');
    const stem = basename(decodeURIComponent(current), extname(current));
    const actual = onDisk.get(stem);

    if (!actual) {
      console.warn(`  warn: no flag file on disk for '${state.Name}' (flagURL ${current})`);
      continue;
    }

    const next = `/assets/stateflags/${actual}`;
    if (next !== current) {
      state.flagURL = next;
      changed += 1;
    }
  }

  if (changed) {
    writeFileSync(STATES_JSON, `${JSON.stringify(states, null, 4)}\n`);
    console.log(`  states.json: ${changed} flagURL value(s) updated`);
  }
}

await main();
