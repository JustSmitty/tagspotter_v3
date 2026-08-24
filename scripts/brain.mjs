#!/usr/bin/env node
/**
 * The Brain — Tag Spotter's memory layer.
 *
 * This is the DETERMINISTIC half of the retrieval system. It does indexing,
 * ranking, provenance checking and contradiction detection with plain code, so
 * that the LATENT half (the agent) only ever spends its context on records that
 * are already known to be relevant, sourced and non-conflicting.
 *
 *   node scripts/brain.mjs index               rebuild .agents/brain/index.json
 *   node scripts/brain.mjs search "<query>"    ranked retrieval (agents call this first)
 *   node scripts/brain.mjs get <id>            print one record
 *   node scripts/brain.mjs lint [--strict]     librarian hygiene pass
 *   node scripts/brain.mjs stats               corpus health at a glance
 *
 * No dependencies. Node >= 20.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAIN_DIR = join(ROOT, '.agents', 'brain');
const INDEX_PATH = join(BRAIN_DIR, 'index.json');

const REQUIRED_FIELDS = ['id', 'type', 'title', 'status', 'date', 'source', 'confidence'];
const VALID_TYPES = ['decision', 'constraint', 'finding', 'postmortem', 'context'];
const VALID_STATUS = ['proposed', 'accepted', 'rejected', 'superseded', 'open', 'resolved'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

/** Statuses whose claims are treated as currently-true facts about the app. */
// 'resolved' belongs here. A finding that has been fixed still asserts a true
// fact about the tree — f-042 says the contrast baseline IS 0, f-048 says the
// claims form IS inline-or-block — and leaving it out meant six records
// declared claims that silently entered nothing. That is F-048 exactly: it
// looked like it was participating and contributed nothing. `superseded` and
// `rejected` stay out, because their claims are meant to be dead.
const AUTHORITATIVE = new Set(['accepted', 'open', 'resolved']);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'for', 'from', 'how', 'i', 'if',
  'in', 'is', 'it', 'of', 'on', 'or', 'our', 'that', 'the', 'this', 'to', 'we', 'what', 'when',
  'where', 'which', 'why', 'with', 'you', 'your',
]);

// ---------------------------------------------------------------- frontmatter

/**
 * Minimal YAML-subset parser: scalars, inline lists, and one level of inline
 * maps. Deliberately not a full YAML implementation — records that need more
 * structure than this are records that should have been split in two.
 */
function parseFrontmatter(raw, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`${file}: missing frontmatter block`);

  const [, head, body] = match;
  const data = {};
  let currentKey = null;
  let blockIndent = null;
  const malformed = [];

  for (const line of head.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const nested = /^(\s+)(-\s+)?(.+)$/.exec(line);
    const topLevel = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);

    if (topLevel) {
      currentKey = topLevel[1];
      blockIndent = null;
      data[currentKey] = parseScalar(topLevel[2]);
      continue;
    }
    if (nested && currentKey) {
      const indent = nested[1].length;
      const value = nested[3].trim();
      if (blockIndent === null) blockIndent = indent;

      // A bare `key:` header opens a block collection, and YAML says which kind
      // by the first child: a leading `- ` is a sequence, `child: value` is a
      // mapping (audit F-48). This used to assume sequence unconditionally, so
      //
      //   claims:
      //     nav-icons.paint-method: mask-image
      //
      // became the ARRAY ["nav-icons.paint-method: mask-image"]. Nothing
      // rejected it — `typeof [] === 'object'` — so the contradiction check
      // in brainLint indexed it under the positional keys '0', '1', '2'. The
      // record's real claims were never compared against anything, and two
      // authoritative records written this way collided on '0' with values
      // that had nothing to do with each other.
      //
      // Dotted keys are allowed because claims use them (`contrast.baseline.light`).
      // The key grammar matches the inline spelling exactly (see parseScalar),
      // so `claims: {a/b: c}` and its indented form parse identically. They did
      // not: the block path required [\w.-]+ and dropped anything else on the
      // floor, which made .agents/brain/README.md's "both parse to the same
      // mapping" false for any key with a slash or a space.
      const pair = nested[2] ? null : /^([^:]+):\s*(.*)$/.exec(value);
      if (data[currentKey] === '' || data[currentKey] === null) {
        data[currentKey] = pair ? {} : [];
      }
      if (Array.isArray(data[currentKey])) data[currentKey].push(parseScalar(value));
      else if (data[currentKey] && typeof data[currentKey] === 'object') {
        // Anything that cannot be a key/value pair here is REPORTED, never
        // dropped. Silently discarding a child line is what F-048 was filed
        // about; doing it per-line instead of per-record is the same bug with
        // a smaller blast radius. Deeper indentation means a nested mapping,
        // which this parser flattens rather than represents, so it is refused
        // outright instead of silently producing sibling keys and an empty
        // parent.
        if (indent > blockIndent) malformed.push(`${currentKey}: nested mappings are not supported (${value})`);
        else if (pair) data[currentKey][pair[1].trim()] = parseScalar(pair[2]);
        else malformed.push(`${currentKey}: not a key/value pair (${value})`);
        if (pair) data[currentKey][pair[1]] = parseScalar(pair[2]);
      }
    }
  }
  return { data, body: body.trim(), malformed };
}

function parseScalar(value) {
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\[.*\]$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item));
  }
  if (/^\{.*\}$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    const map = {};
    if (!inner) return map;
    for (const pair of splitTopLevel(inner)) {
      const kv = /^([^:]+):\s*(.*)$/.exec(pair.trim());
      if (kv) map[kv[1].trim()] = parseScalar(kv[2]);
    }
    return map;
  }
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let buffer = '';
  for (const char of input) {
    if (char === '{' || char === '[') depth += 1;
    if (char === '}' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) parts.push(buffer);
  return parts;
}

// -------------------------------------------------------------------- loading

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.md') && basename(full) !== 'README.md' ? [full] : [];
  });
}

export function loadRecords() {
  return walk(BRAIN_DIR).map((file) => {
    const { data, body, malformed } = parseFrontmatter(readFileSync(file, 'utf8'), relative(ROOT, file));
    return {
      ...data,
      tags: toArray(data.tags),
      related: toArray(data.related),
      supersedes: toArray(data.supersedes),
      claims: isPlainObject(data.claims) ? data.claims : {},
      // Supporting the block form (F-48) fixes the shape people actually write.
      // This catches the ones nobody has written yet: anything that is not a
      // mapping is reported by brainLint rather than quietly coerced, because
      // silent coercion is what let the array form survive in the first place.
      // Lines the frontmatter parser could not represent, reported rather
      // than dropped (F-048).
      malformedLines: malformed,
      malformedClaims: data.claims !== undefined && data.claims !== null
        && data.claims !== '' && !isPlainObject(data.claims),
      body,
      file: relative(ROOT, file).replace(/\\/g, '/'),
    };
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== '');
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

// ------------------------------------------------------------------ retrieval

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Field-weighted term frequency with an inverse-document-frequency damper.
 * Not a neural retriever, and it does not need to be: the corpus is small and
 * hand-curated, so lexical overlap plus tag boosting is enough to put the right
 * three records in front of an agent.
 */
function search(records, query, limit = 5) {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const df = new Map();
  const docs = records.map((record) => {
    const fields = {
      title: tokenize(record.title),
      tags: record.tags.flatMap(tokenize),
      claims: Object.entries(record.claims).flatMap(([k, v]) => tokenize(`${k} ${v}`)),
      body: tokenize(record.body),
    };
    const seen = new Set([...fields.title, ...fields.tags, ...fields.claims, ...fields.body]);
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
    return { record, fields };
  });

  const weights = { title: 6, tags: 4, claims: 3, body: 1 };
  const total = records.length || 1;

  return docs
    .map(({ record, fields }) => {
      let score = 0;
      for (const term of terms) {
        const idf = Math.log(1 + total / (1 + (df.get(term) ?? 0)));
        for (const [field, weight] of Object.entries(weights)) {
          const hits = fields[field].filter((token) => token === term || token.startsWith(term)).length;
          if (hits) score += weight * idf * (1 + Math.log(hits));
        }
      }
      // Superseded and rejected records are still retrievable — history matters —
      // but they must never outrank the record that replaced them.
      if (record.status === 'superseded' || record.status === 'rejected') score *= 0.35;
      if (record.confidence === 'low') score *= 0.8;
      return { record, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ------------------------------------------------------- librarian hygiene

export function lint(records, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const byId = new Map(records.map((record) => [record.id, record]));
  const today = new Date().toISOString().slice(0, 10);

  for (const record of records) {
    const at = record.file;

    for (const field of REQUIRED_FIELDS) {
      if (record[field] === undefined || record[field] === '') {
        errors.push(`${at}: missing required field '${field}'`);
      }
    }
    if (record.id && basename(record.file, '.md') !== record.id) {
      errors.push(`${at}: id '${record.id}' does not match filename`);
    }
    if (record.type && !VALID_TYPES.includes(record.type)) {
      errors.push(`${at}: type '${record.type}' not one of ${VALID_TYPES.join('|')}`);
    }
    if (record.status && !VALID_STATUS.includes(record.status)) {
      errors.push(`${at}: status '${record.status}' not one of ${VALID_STATUS.join('|')}`);
    }
    if (record.confidence && !VALID_CONFIDENCE.includes(record.confidence)) {
      errors.push(`${at}: confidence '${record.confidence}' not one of ${VALID_CONFIDENCE.join('|')}`);
    }
    // `claims:` must be a mapping. Both spellings work — inline
    // `{key: value}` and an indented block — but a sequence or a bare scalar
    // cannot carry keys, and the contradiction check silently indexed those
    // under '0', '1', '2' instead of saying so (audit F-48).
    for (const problem of record.malformedLines ?? []) {
      errors.push(`${at}: ${problem}`);
    }
    if (record.malformedClaims) {
      errors.push(
        `${at}: 'claims' must be a mapping, not a list or scalar — write `
          + `\`claims: {key: value}\` or an indented block of \`key: value\` lines`,
      );
    }
    if (record.body.length < 80) {
      warnings.push(`${at}: body is thin (${record.body.length} chars) — a record nobody can act on is noise`);
    }
    // Filing rule 5: "A record still under discussion should carry
    // `status: proposed` and **no claims**, so it can sit alongside the
    // decision it may eventually replace without breaking the build." A
    // proposed record with claims is therefore asserting something it has not
    // earned the right to assert — and, because proposed is not authoritative,
    // asserting it into nothing.
    if (Object.keys(record.claims ?? {}).length && record.status === 'proposed') {
      warnings.push(
        `${at}: declares claims but status '${record.status}' is not authoritative`
          + ` — they never enter the contradiction check`,
      );
    }

    // Provenance: every fact must be traceable to something outside this file.
    if (record.source && !/[:/#]/.test(String(record.source))) {
      warnings.push(`${at}: source '${record.source}' is not a traceable pointer (want commit/file/url/audit ref)`);
    }

    for (const ref of [...record.related, ...record.supersedes]) {
      if (!byId.has(ref)) errors.push(`${at}: dangling reference '${ref}'`);
    }

    // A superseded record must be claimed by its replacement, otherwise the
    // corpus has an orphan that retrieval will keep surfacing forever.
    if (record.status === 'superseded') {
      const replacement = records.find((other) => other.supersedes.includes(record.id));
      if (!replacement) errors.push(`${at}: status 'superseded' but no record supersedes it`);
    }

    if (record.review_by && record.review_by < today) {
      const message = `${at}: review_by ${record.review_by} has passed — librarian must re-verify or re-date`;
      (strict ? errors : warnings).push(message);
    }
  }

  // Contradiction check: two authoritative records asserting different values
  // for the same claim key. This is the rule that catches "the README says
  // MapLibre in one paragraph and inline SVG in the next".
  const claimIndex = new Map();
  for (const record of records) {
    if (!AUTHORITATIVE.has(record.status)) continue;
    for (const [key, value] of Object.entries(record.claims)) {
      if (!claimIndex.has(key)) claimIndex.set(key, []);
      claimIndex.get(key).push({ record, value });
    }
  }
  for (const [key, holders] of claimIndex) {
    const distinct = new Set(holders.map((holder) => String(holder.value)));
    if (distinct.size > 1) {
      const detail = holders.map((holder) => `${holder.record.id}='${holder.value}'`).join(' vs ');
      errors.push(`CONTRADICTION on claim '${key}': ${detail}`);
    }
  }

  return { errors, warnings };
}

// -------------------------------------------------------------------- indexing

/**
 * Deliberately carries no timestamp. The index is derived data committed so CI
 * can prove it matches the corpus (`brain index` + `git diff --exit-code`), and
 * a generation timestamp makes that check impossible to pass — every run
 * produces a different file. Git already records when it changed.
 */
function buildIndex(records) {
  return {
    count: records.length,
    records: records
      .map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title,
        status: record.status,
        date: record.date,
        source: record.source,
        confidence: record.confidence,
        tags: record.tags,
        claims: record.claims,
        supersedes: record.supersedes,
        related: record.related,
        file: record.file,
        review_by: record.review_by ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

// ----------------------------------------------------------------------- CLI

function main() {
  const [command = 'stats', ...rest] = process.argv.slice(2);
  const records = loadRecords();

  if (command === 'index') {
    writeFileSync(INDEX_PATH, `${JSON.stringify(buildIndex(records), null, 2)}\n`);
    console.log(`brain: indexed ${records.length} records -> ${relative(ROOT, INDEX_PATH)}`);
    return;
  }

  if (command === 'search') {
    const query = rest.filter((arg) => !arg.startsWith('--')).join(' ');
    const limitArg = rest.find((arg) => arg.startsWith('--limit='));
    const hits = search(records, query, limitArg ? Number(limitArg.split('=')[1]) : 5);

    if (!hits.length) {
      console.log(`brain: no records matched "${query}".`);
      console.log('If this question was worth asking, the answer is worth filing. See .agents/filing-rules.md.');
      process.exitCode = 0;
      return;
    }
    console.log(`brain: ${hits.length} record(s) for "${query}"\n`);
    for (const { record, score } of hits) {
      console.log(`  ${record.id}  [${record.type}/${record.status}, confidence=${record.confidence}, score=${score.toFixed(2)}]`);
      console.log(`    ${record.title}`);
      console.log(`    source: ${record.source}   file: ${record.file}`);
      if (Object.keys(record.claims).length) {
        console.log(`    claims: ${Object.entries(record.claims).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
      console.log('');
    }
    return;
  }

  if (command === 'get') {
    const record = records.find((candidate) => candidate.id === rest[0]);
    if (!record) {
      console.error(`brain: no record with id '${rest[0]}'`);
      process.exitCode = 1;
      return;
    }
    console.log(readFileSync(join(ROOT, record.file), 'utf8'));
    return;
  }

  if (command === 'lint') {
    const { errors, warnings } = lint(records, { strict: rest.includes('--strict') });
    for (const warning of warnings) console.log(`  warn  ${warning}`);
    for (const error of errors) console.log(`  ERROR ${error}`);
    console.log(`\nbrain lint: ${records.length} records, ${errors.length} error(s), ${warnings.length} warning(s)`);
    if (errors.length) process.exitCode = 1;
    return;
  }

  if (command === 'stats') {
    const byType = {};
    const byStatus = {};
    for (const record of records) {
      byType[record.type] = (byType[record.type] ?? 0) + 1;
      byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    }
    const stale = records.filter((r) => r.review_by && r.review_by < new Date().toISOString().slice(0, 10));
    console.log(`brain: ${records.length} records`);
    console.log(`  by type:   ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join('  ')}`);
    console.log(`  by status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  ')}`);
    console.log(`  claims:    ${records.reduce((sum, r) => sum + Object.keys(r.claims).length, 0)} machine-checkable facts`);
    console.log(`  stale:     ${stale.length} past review_by${stale.length ? ` (${stale.map((r) => r.id).join(', ')})` : ''}`);
    return;
  }

  console.error(`brain: unknown command '${command}'. Try: index | search | get | lint | stats`);
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
