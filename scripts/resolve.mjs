#!/usr/bin/env node
/**
 * The Resolver — Tag Spotter's org chart, executed.
 *
 * A request comes in; this decides which skill owns it, which skills support
 * it, what to ask the Brain first, and whether the request needs to be escalated
 * to a human before any action is taken.
 *
 *   node scripts/resolve.mjs "the plate grid freezes after I tap"
 *   node scripts/resolve.mjs "shrink the flags" --files=src/assets/stateflags/Ohio.svg
 *   node scripts/resolve.mjs "..." --json
 *
 * Routing is deterministic and testable on purpose (see .agents/evals/routing.json).
 * Deciding *who* handles a request is a lookup, not a judgement call — the
 * judgement happens inside the skill, once the right constraints are loaded.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESOLVER_PATH = join(ROOT, '.agents', 'resolver.json');

export function loadResolver() {
  return JSON.parse(readFileSync(RESOLVER_PATH, 'utf8'));
}

/** Turn a glob-ish path pattern into a RegExp. Supports `**` and `*`. */
function patternToRegExp(pattern) {
  // The sentinel is written as '\u0000' rather than a literal NUL byte: a NUL
  // anywhere in the file makes git treat this whole script as binary, so a diff
  // reads "Binary files differ" instead of showing the change. Identical at runtime.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Match a keyword against a request as a WORD, not a substring (audit F-47).
 *
 * `haystack.includes(keyword)` was the original test, and it matched inside
 * unrelated words. `ci` fired on de-ci-sion, spe-ci-fic and effi-ci-ency, so
 * "make the decision explicit in the docs" was owned by tagspotter-release;
 * `aria` fired on inv-aria-nts, `lag` on f-lag, `build` on es-build, `sync` on
 * a-sync-hronous. Escalation keywords were matched the same way, so `migration`
 * raised the data-migration escalation on "toolchain migration".
 *
 * A bad route is not a mislabel. Rule 1 of .agents/filing-rules.md sends every
 * agent through this resolver before it touches anything, so the route decides
 * which skill file that agent reads as its instructions.
 *
 * Word boundaries alone are too strict, because requests say "publishing",
 * "svgs", "the fonts", "renaming". So a keyword also matches its regular
 * inflections, including dropped-e forms (rename -> renaming, optimize ->
 * optimizing). Derivational endings are deliberately NOT guessed at: `deploy`
 * does not reach "deployment", which is listed in resolver.json instead.
 * Guessing morphology is how a matcher starts matching things nobody predicted,
 * which is the defect being replaced here.
 */
const keywordPatterns = new Map();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Prefixes that negate or repeat an action rather than change its subject.
 * `\b` alone cannot see a keyword glued behind one, so word matching silently
 * dropped `publish` out of "republish", "unpublish" and "redeploy", taking the
 * publishing escalation with it — the one failure this resolver must never
 * have. The set is short, explicit and inspectable on purpose: it is not a
 * morphology engine, it is the prefixes that turned up in real requests.
 */
const PREFIXES = '(?:re|un|mis|de|pre|non|auto)?';

/**
 * Regular English inflections of a keyword. Regular is the operative word:
 * these are the endings a speaker applies without thinking, not derivations.
 * `deploy` still does not reach "deployment" — that stays in resolver.json.
 *
 * Three spelling rules, because English has three. Shipping only the first
 * (F-047) left "shipping", "lagging" and "mislabelled" unreachable while the
 * docstring claimed inflections were handled — and `lag` was the very keyword
 * that fix cited as its motivation. A half-applied rule set is worse than
 * none: its gaps follow no pattern a maintainer can predict, so nobody thinks
 * to look for them.
 */
function inflectedForms(keyword) {
  const escaped = escapeRegExp(keyword);
  const forms = [`${escaped}(?:s|es|d|ed|ing)?`];
  // drop-e: rename -> renaming, optimise -> optimising
  if (keyword.endsWith('e')) forms.push(`${escapeRegExp(keyword.slice(0, -1))}(?:ed|ing)`);
  // y -> ies/ied: copy -> copies, verify -> verified
  if (/[^aeiou]y$/.test(keyword)) forms.push(`${escapeRegExp(keyword.slice(0, -1))}(?:ies|ied)`);
  // CVC doubling: ship -> shipping, lag -> lagged, label -> labelled
  if (/[^aeiou][aeiou][bdglmnprt]$/.test(keyword)) forms.push(`${escaped}${keyword.slice(-1)}(?:ed|ing)`);
  return forms;
}

function matchesKeyword(keyword, haystack) {
  let pattern = keywordPatterns.get(keyword);
  if (!pattern) {
    pattern = new RegExp(`\\b${PREFIXES}(?:${inflectedForms(keyword).join('|')})\\b`);
    keywordPatterns.set(keyword, pattern);
  }
  return pattern.test(haystack);
}

/**
 * Identifiers are compounds, not words, and `\b` cannot see inside one.
 * AndroidManifest.xml, versionName, MARKETING_VERSION and storeFile all stopped
 * routing to tagspotter-release the moment matching became word-based — and a
 * request naming a native file or build symbol is the request most likely to
 * belong to that skill. Split camelCase humps and underscores BEFORE
 * lowercasing, because lowercasing is what destroys the humps.
 */
function normalizeRequest(request) {
  return String(request)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_+/g, ' ')
    .toLowerCase();
}

export function resolve(request, { files = [], resolver = loadResolver() } = {}) {
  const haystack = normalizeRequest(request);
  const normalizedFiles = files.map((file) => file.replace(/\\/g, '/').replace(/^\.\//, ''));

  const scored = resolver.routes.map((route) => {
    const matchedKeywords = (route.keywords ?? []).filter((keyword) => matchesKeyword(keyword, haystack));
    const matchedPaths = (route.paths ?? []).filter((pattern) => {
      const regex = patternToRegExp(pattern);
      return normalizedFiles.some((file) => regex.test(file));
    });

    // Keywords express intent, paths express blast radius. Paths score higher
    // because "which files does this touch" is harder to be wrong about than
    // "which words did the human happen to use".
    const raw = matchedKeywords.length * 1 + matchedPaths.length * 1.75;
    const score = raw === 0 ? 0 : raw * (1 + (route.priority ?? 0) / 1000);

    return { route, score, matchedKeywords, matchedPaths };
  });

  const ranked = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.route.priority ?? 0) - (a.route.priority ?? 0));

  // Vendored skills are reference material, never owners. A Tag Spotter change
  // is always owned by a skill that carries Tag Spotter's constraints, even when
  // a vendored skill scores higher on raw keyword overlap.
  const top = ranked.find((entry) => !entry.route.vendored);
  const primary = top ? top.route.skill : resolver.default;
  const primaryScore = top ? top.score : 0;

  const support = ranked
    .filter((entry) => entry !== top)
    .filter((entry) => entry.score >= Math.max(primaryScore, 1) * (resolver.supportThreshold ?? 0.45))
    .map((entry) => entry.route.skill);

  const escalations = (resolver.escalations ?? []).filter((escalation) =>
    escalation.keywords.some((keyword) => matchesKeyword(keyword, haystack)),
  );

  const brainQueries = [top?.route.brainQuery, ...ranked.filter((entry) => entry !== top).slice(0, 2).map((entry) => entry.route.brainQuery)]
    .filter(Boolean)
    .filter((query, index, all) => all.indexOf(query) === index);

  return {
    request: String(request),
    primary,
    support,
    matchedOn: top ? { keywords: top.matchedKeywords, paths: top.matchedPaths } : { keywords: [], paths: [] },
    fellBackToDefault: !top,
    brainQueries: brainQueries.length ? brainQueries : ['architecture store decisions'],
    escalations: escalations.map((escalation) => ({ id: escalation.id, reason: escalation.reason })),
  };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const filesArg = args.find((arg) => arg.startsWith('--files='));
  const request = args.filter((arg) => !arg.startsWith('--')).join(' ');

  if (!request) {
    console.error('usage: node scripts/resolve.mjs "<request>" [--files=a,b] [--json]');
    process.exitCode = 1;
    return;
  }

  const result = resolve(request, { files: filesArg ? filesArg.split('=')[1].split(',') : [] });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n  request   ${result.request}`);
  console.log(`  owner     ${result.primary}${result.fellBackToDefault ? '  (default — no route matched)' : ''}`);
  if (result.support.length) console.log(`  support   ${result.support.join(', ')}`);
  if (result.matchedOn.keywords.length) console.log(`  matched   ${result.matchedOn.keywords.join(', ')}`);
  if (result.matchedOn.paths.length) console.log(`  paths     ${result.matchedOn.paths.join(', ')}`);
  console.log(`\n  first, retrieve:`);
  for (const query of result.brainQueries) {
    console.log(`    npm run brain -- search "${query}"`);
  }
  if (result.escalations.length) {
    console.log('\n  ESCALATE BEFORE ACTING:');
    for (const escalation of result.escalations) console.log(`    [${escalation.id}] ${escalation.reason}`);
  }
  console.log('');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
