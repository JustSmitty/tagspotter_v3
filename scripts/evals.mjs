#!/usr/bin/env node
/**
 * Trigger Evals — automated performance reviews for the agent workforce.
 *
 * Four suites:
 *   structural  every skill is registered, every route points at a real skill
 *   brain       the memory layer passes its own hygiene rules
 *   routing     a given request still reaches the skill that owns it
 *   guardrails  the acceptance criteria from docs/remediation-plan.md, ratcheted
 *
 * The guardrail ratchet is the important idea. Each check records the violation
 * count on the day of the audit as its `baseline`. CI fails when a count goes
 * ABOVE its baseline, so debt can only shrink — the suite is green today and
 * tightens automatically as fixes land.
 *
 *   node scripts/evals.mjs                    run everything
 *   node scripts/evals.mjs --only=copy-lexicon
 *   node scripts/evals.mjs --only=guardrails
 *   node scripts/evals.mjs --update-baselines write measured counts back (review the diff!)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRecords, lint as brainLint } from './brain.mjs';
import { resolve as resolveRequest, loadResolver } from './resolve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDRAILS_PATH = join(ROOT, '.agents', 'evals', 'guardrails.json');
const ROUTING_PATH = join(ROOT, '.agents', 'evals', 'routing.json');
const SKILLS_DIR = join(ROOT, '.claude', 'skills');

const IGNORED_DIRS = new Set(['node_modules', '.git', '.angular', 'www', 'dist', 'coverage', 'build', '.nx']);

// ------------------------------------------------------------------- helpers

function walk(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) walk(full, results);
    else results.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return results;
}

const ALL_FILES = walk(ROOT);

function globToRegExp(pattern) {
  let out = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          out += '(?:.*/)?';
          index += 2;
        } else {
          out += '.*';
          index += 1;
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      continue;
    }
    out += '.+^${}()|[]\\'.includes(char) ? `\\${char}` : char;
  }
  return new RegExp(`^${out}$`);
}

function selectFiles({ include = [], exclude = [] }) {
  const includeRe = include.map(globToRegExp);
  const excludeRe = exclude.map(globToRegExp);
  return ALL_FILES.filter(
    (file) => includeRe.some((re) => re.test(file)) && !excludeRe.some((re) => re.test(file)),
  );
}

function readText(file) {
  try {
    return readFileSync(join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function dirSize(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return 0;
  return readdirSync(full).reduce((total, entry) => {
    const path = join(full, entry);
    const stats = statSync(path);
    return total + (stats.isDirectory() ? dirSize(join(dir, entry)) : stats.size);
  }, 0);
}

// -------------------------------------------------------------- guardrail types

/** Count regex hits across a file selection. Each hit is one violation. */
function runRegexScan(guardrail) {
  const flags = guardrail.caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(guardrail.pattern, flags);
  const hits = [];
  for (const file of selectFiles(guardrail)) {
    const lines = readText(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(regex)) {
        hits.push(`${file}:${index + 1}  ${match[0].trim().slice(0, 60)}`);
      }
    });
  }
  return hits;
}

/** Files that contain `pattern` but are missing `requires`. */
function runPairedPattern(guardrail) {
  const trigger = new RegExp(guardrail.pattern, 'i');
  const required = new RegExp(guardrail.requires, 'i');
  return selectFiles(guardrail)
    .filter((file) => {
      const text = readText(file);
      return trigger.test(text) && !required.test(text);
    })
    .map((file) => `${file}  has /${guardrail.pattern}/ without /${guardrail.requires}/`);
}

/** Per-file and whole-directory size ceilings. */
function runSizeBudget(guardrail) {
  const violations = [];
  for (const file of selectFiles(guardrail)) {
    const size = statSync(join(ROOT, file)).size;
    if (guardrail.maxBytesPerFile && size > guardrail.maxBytesPerFile) {
      violations.push(`${file}  ${(size / 1024).toFixed(0)} KB > ${(guardrail.maxBytesPerFile / 1024).toFixed(0)} KB`);
    }
  }
  if (guardrail.maxBytesTotal && guardrail.dir) {
    const total = dirSize(guardrail.dir);
    if (total > guardrail.maxBytesTotal) {
      violations.push(`${guardrail.dir}  total ${(total / 1048576).toFixed(2)} MB > ${(guardrail.maxBytesTotal / 1048576).toFixed(2)} MB`);
    }
  }
  return violations;
}

const CUSTOM_CHECKS = {
  /** package.json version must equal android versionName. */
  'version-parity'() {
    const pkg = JSON.parse(readText('package.json'));
    const gradle = readText('android/app/build.gradle');
    const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
    const versionCode = /versionCode\s+(\d+)/.exec(gradle)?.[1];
    const violations = [];
    if (!versionName) violations.push('android/app/build.gradle: versionName not found');
    else if (versionName !== pkg.version) {
      violations.push(`versionName '${versionName}' != package.json version '${pkg.version}'`);
    }
    if (!versionCode) violations.push('android/app/build.gradle: versionCode not found');
    return violations;
  },

  /** Injectable services with no sibling spec file. */
  'untested-services'() {
    return selectFiles({
      include: ['src/app/services/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    })
      .filter((file) => /@Injectable/.test(readText(file)))
      .filter((file) => !existsSync(join(ROOT, file.replace(/\.ts$/, '.spec.ts'))))
      .map((file) => `${file}  no sibling .spec.ts`);
  },

  /**
   * Public component methods that no template binds and no other source file
   * references — dead handlers like home.page.ts openSummary() (audit F-08).
   */
  'dead-handlers'() {
    const lifecycle = new Set([
      'constructor', 'ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'ngAfterViewInit',
      'ngAfterContentInit', 'ngAfterViewChecked', 'ngAfterContentChecked', 'ngDoCheck',
    ]);
    const componentFiles = selectFiles({
      include: ['src/app/**/*.page.ts', 'src/app/**/*.component.ts'],
      exclude: ['**/*.spec.ts'],
    });
    const violations = [];

    for (const file of componentFiles) {
      const source = readText(file);
      const templateFile = file.replace(/\.ts$/, '.html');
      const template = readText(templateFile);
      // Only templates and specs count as "used". Scanning all of src would let
      // an unrelated service method of the same name mask a dead handler —
      // home.page.ts openSummary() is shadowed by HomeWorkflowService.openSummary().
      const elsewhere = ALL_FILES.filter(
        (candidate) =>
          candidate.startsWith('src/') &&
          candidate !== templateFile &&
          (candidate.endsWith('.html') || candidate.endsWith('.spec.ts')),
      )
        .map(readText)
        .join('\n');

      for (const match of source.matchAll(/^\s{2}(?:async\s+)?([a-z][A-Za-z0-9_]*)\s*\(/gm)) {
        const name = match[1];
        if (lifecycle.has(name)) continue;
        if (/^\s{2}(private|protected|readonly)/.test(match[0])) continue;
        const used = template.includes(name) || new RegExp(`\\b${name}\\b`).test(elsewhere);
        if (!used) violations.push(`${file}  ${name}() is never bound or referenced`);
      }
    }
    return violations;
  },

  /** Docs naming a dependency the project no longer has. */
  'stale-tech-claims'() {
    const pkg = JSON.parse(readText('package.json'));
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ].map((name) => name.toLowerCase()));
    const removed = ['maplibre', 'mapbox', 'leaflet', 'd3'];
    const violations = [];

    for (const file of selectFiles({
      include: ['README.md', 'docs/**/*.md'],
      exclude: ['docs/remediation-plan.md'],
    })) {
      const lines = readText(file).split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const name of removed) {
          if (!new RegExp(`\\b${name}`, 'i').test(line)) continue;
          const present = [...declared].some((dep) => dep.includes(name));
          if (!present) violations.push(`${file}:${index + 1}  claims '${name}', not in package.json`);
        }
      });
    }
    return violations;
  },
};

function runGuardrail(guardrail) {
  switch (guardrail.type) {
    case 'regex-scan': return runRegexScan(guardrail);
    case 'paired-pattern': return runPairedPattern(guardrail);
    case 'size-budget': return runSizeBudget(guardrail);
    case 'custom': {
      const check = CUSTOM_CHECKS[guardrail.id];
      if (!check) throw new Error(`no custom check implemented for '${guardrail.id}'`);
      return check();
    }
    default: throw new Error(`unknown guardrail type '${guardrail.type}'`);
  }
}

// ----------------------------------------------------------------- suites

/**
 * Which skills are vendored, decided from skills-lock.json and .agents/skills
 * rather than from a filesystem symlink check.
 *
 * The vendored skills are symlinks in a local Windows checkout, but git stored
 * them as regular files (mode 100644), so `isSymbolicLink()` answered true on
 * the author's machine and false in CI — where the four unrouted vendored
 * skills were then treated as project-owned and failed the "registered" check.
 * The lockfile is the actual definition of vendored and is the same everywhere.
 */
function vendoredSkillNames() {
  const names = new Set();

  const lockPath = join(ROOT, 'skills-lock.json');
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    for (const name of Object.keys(lock.skills ?? {})) names.add(name);
  }

  const vendoredDir = join(ROOT, '.agents', 'skills');
  if (existsSync(vendoredDir)) {
    for (const entry of readdirSync(vendoredDir)) names.add(entry);
  }

  return names;
}

function loadSkills() {
  if (!existsSync(SKILLS_DIR)) return [];
  const vendored = vendoredSkillNames();

  return readdirSync(SKILLS_DIR)
    .map((entry) => {
      const skillPath = join(SKILLS_DIR, entry, 'SKILL.md');
      if (!existsSync(skillPath)) return null;
      const raw = readFileSync(skillPath, 'utf8');
      const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? '';
      return {
        dir: entry,
        vendored: vendored.has(entry),
        name: /^name:\s*(.+)$/m.exec(head)?.[1]?.trim(),
        description: /^description:\s*([\s\S]+?)(?:\n[a-z_-]+:|$)/m.exec(head)?.[1]?.trim(),
        body: raw,
      };
    })
    .filter(Boolean);
}

function structuralSuite() {
  const results = [];
  const skills = loadSkills();
  const resolver = loadResolver();
  const routedSkills = new Set(resolver.routes.map((route) => route.skill));
  const vendoredOnDisk = existsSync(join(ROOT, '.agents', 'skills'))
    ? new Set(readdirSync(join(ROOT, '.agents', 'skills')))
    : new Set();

  for (const skill of skills) {
    results.push({
      id: `skill:${skill.dir}:frontmatter`,
      pass: Boolean(skill.name && skill.description),
      detail: skill.name && skill.description ? '' : 'missing name or description in frontmatter',
    });
    results.push({
      id: `skill:${skill.dir}:name-matches-dir`,
      pass: skill.name === skill.dir,
      detail: skill.name === skill.dir ? '' : `name '${skill.name}' != directory '${skill.dir}'`,
    });
    if (!skill.vendored) {
      // Filing rule 6: a project skill that no route can reach is a skill nobody
      // will ever use. Skillification has to be structurally enforced.
      results.push({
        id: `skill:${skill.dir}:registered`,
        pass: routedSkills.has(skill.dir),
        detail: routedSkills.has(skill.dir) ? '' : 'not present in .agents/resolver.json routes',
      });
    }
  }

  const skillNames = new Set(skills.map((skill) => skill.dir));
  for (const route of resolver.routes) {
    const exists = skillNames.has(route.skill) || vendoredOnDisk.has(route.skill);
    results.push({
      id: `route:${route.skill}:skill-exists`,
      pass: exists,
      detail: exists ? '' : 'route points at a skill that does not exist on disk',
    });
  }

  results.push({
    id: 'resolver:default-is-routable',
    pass: routedSkills.has(resolver.default),
    detail: routedSkills.has(resolver.default) ? '' : `default '${resolver.default}' has no route`,
  });

  return results;
}

function brainSuite() {
  const records = loadRecords();
  const { errors, warnings } = brainLint(records, { strict: true });
  return [
    { id: 'brain:lint', pass: errors.length === 0, detail: errors.join('; ') },
    { id: 'brain:no-stale-warnings', pass: warnings.length === 0, detail: warnings.slice(0, 3).join('; ') },
    { id: 'brain:has-records', pass: records.length > 0, detail: `${records.length} records` },
  ];
}

function routingSuite() {
  if (!existsSync(ROUTING_PATH)) return [];
  const cases = JSON.parse(readFileSync(ROUTING_PATH, 'utf8')).cases;
  return cases.map((testCase) => {
    const result = resolveRequest(testCase.request, { files: testCase.files ?? [] });
    const failures = [];

    if (testCase.expectPrimary && result.primary !== testCase.expectPrimary) {
      failures.push(`primary was '${result.primary}', expected '${testCase.expectPrimary}'`);
    }
    for (const expected of testCase.expectSupport ?? []) {
      if (!result.support.includes(expected)) failures.push(`missing support skill '${expected}'`);
    }
    for (const expected of testCase.expectEscalation ?? []) {
      if (!result.escalations.some((escalation) => escalation.id === expected)) {
        failures.push(`missing escalation '${expected}'`);
      }
    }
    if (testCase.expectNoEscalation && result.escalations.length) {
      failures.push(`unexpected escalation(s): ${result.escalations.map((e) => e.id).join(', ')}`);
    }

    return { id: `routing:${testCase.id}`, pass: failures.length === 0, detail: failures.join('; ') };
  });
}

function guardrailSuite({ update = false, only = null } = {}) {
  const config = JSON.parse(readFileSync(GUARDRAILS_PATH, 'utf8'));
  const results = [];
  let changed = false;

  for (const guardrail of config.guardrails) {
    if (only && guardrail.id !== only) continue;

    let violations;
    try {
      violations = runGuardrail(guardrail);
    } catch (error) {
      results.push({ id: `guardrail:${guardrail.id}`, pass: false, detail: `check errored: ${error.message}` });
      continue;
    }

    const count = violations.length;
    const baseline = guardrail.baseline ?? 0;

    if (update) {
      if (guardrail.baseline !== count) changed = true;
      guardrail.baseline = count;
      guardrail.measuredAt = new Date().toISOString().slice(0, 10);
    }

    const pass = count <= baseline;
    const improved = count < baseline;
    const detail = pass
      ? improved
        ? `${count}/${baseline} — improved, lower the baseline to lock it in`
        : count === 0 ? 'clean' : `${count} known (at baseline)`
      : `${count} violations, baseline ${baseline}:\n      ${violations.slice(0, 8).join('\n      ')}`;

    results.push({
      id: `guardrail:${guardrail.id}`,
      pass: update ? true : pass,
      improved,
      detail: `[${guardrail.finding ?? '—'} · phase ${guardrail.phase ?? '—'} · ${guardrail.owner}] ${detail}`,
    });
  }

  if (update && changed) {
    writeFileSync(GUARDRAILS_PATH, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`baselines written to ${relative(ROOT, GUARDRAILS_PATH)} — review the diff before committing\n`);
  }
  return results;
}

// -------------------------------------------------------------------- runner

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update-baselines');
  const onlyArg = args.find((arg) => arg.startsWith('--only='))?.split('=')[1] ?? null;

  const suites = [];
  const wantsSuite = (name) => !onlyArg || onlyArg === name;
  const isGuardrailId = onlyArg && !['structural', 'brain', 'routing', 'guardrails'].includes(onlyArg);

  if (!isGuardrailId && wantsSuite('structural')) suites.push(['structural', structuralSuite()]);
  if (!isGuardrailId && wantsSuite('brain')) suites.push(['brain', brainSuite()]);
  if (!isGuardrailId && wantsSuite('routing')) suites.push(['routing', routingSuite()]);
  if (isGuardrailId || wantsSuite('guardrails')) {
    suites.push(['guardrails', guardrailSuite({ update, only: isGuardrailId ? onlyArg : null })]);
  }

  let failed = 0;
  let passed = 0;
  let improvable = 0;

  for (const [name, results] of suites) {
    if (!results.length) continue;
    console.log(`\n  ${name.toUpperCase()}`);
    for (const result of results) {
      if (result.pass) passed += 1;
      else failed += 1;
      if (result.improved) improvable += 1;
      const mark = result.pass ? (result.improved ? '↓' : '✓') : '✗';
      console.log(`    ${mark} ${result.id}${result.detail ? `  ${result.detail}` : ''}`);
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed${improvable ? `, ${improvable} improved (ratchet down)` : ''}\n`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
