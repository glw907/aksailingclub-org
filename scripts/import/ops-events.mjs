#!/usr/bin/env node
/**
 * Import script: asc-ops.events -> asc-club.events (read-only source, idempotent target).
 *
 * asc-ops is never altered; this only ever SELECTs from it. The write side is a
 * natural-key upsert keyed on slug (asc-ops's own `events.slug` becomes asc-club's
 * `events.id` too, since it is already stable and unique): re-running never creates a
 * duplicate row, it only updates a row whose mapped columns actually changed and
 * otherwise skips it. Every insert or update is audited (actor 'import:ops'); a no-op
 * re-run still audits one batch-summary row so the run itself stays observable.
 *
 * The event_type -> category mapping is this script's own judgment (see
 * CATEGORY_BY_EVENT_TYPE below), matching the migration pattern doc's worked instance.
 * Two source columns intentionally do not carry forward, because asc-club's `events`
 * table has no matching column: `registration_url` (every live event row is null
 * anyway; asc-club events do not carry an external registration link) and
 * `date_history` (a display-only sort/bucket fallback for the public events page, not
 * part of the admin data model; the asc-site cutover, plan Task 9, decides how month
 * bucketing works without it).
 *
 * Usage: node scripts/import/ops-events.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** The mapped column order for asc-club's `events` table (excludes created_at/updated_at,
 *  which are preserved from asc-ops verbatim as genuine historical timestamps but handled
 *  separately since they are never part of the change-detection comparison). */
const COLUMNS = [
  'id',
  'title',
  'slug',
  'category',
  'short_description',
  'long_description',
  'start_date',
  'start_time',
  'end_date',
  'end_time',
  'location',
  'hero_image',
  'hero_image_alt',
  'thumbnail_image',
  'visible',
];

/** asc-ops's `event_type` is free-text; asc-club's `category` is the C7 taxonomy CHECK
 *  constraint. This is the auditable judgment the migration pattern doc calls for, not a
 *  code-side inference: every live asc-ops event_type maps to exactly one category, and an
 *  unmapped value fails loudly rather than defaulting silently. */
const CATEGORY_BY_EVENT_TYPE = {
  regatta: 'racing',
  work_party: 'operations',
  social: 'social',
  meeting: 'governance',
};

function tomlValue(toml, pattern, label) {
  const m = toml.match(pattern);
  if (!m) throw new Error(`ops-events: could not find ${label} in wrangler.toml`);
  return m[1];
}

function d1Binding(toml, bindingName) {
  const re = new RegExp(
    `\\[\\[d1_databases\\]\\]\\s*\\nbinding = "${bindingName}"\\s*\\ndatabase_name = "([^"]+)"\\s*\\ndatabase_id = "([^"]+)"`,
  );
  const m = toml.match(re);
  if (!m) throw new Error(`ops-events: could not find d1_databases binding ${bindingName} in wrangler.toml`);
  return { name: m[1], id: m[2] };
}

/** Runs one or more `;`-joined SQL statements against a named D1 database via wrangler,
 *  returning the parsed per-statement result array (`--json` gives clean stdout, no banner
 *  text to strip). */
function execStatements(dbName, sql) {
  const stdout = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', dbName, '--remote', '--command', sql, '--json'],
    { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

/** A SQL literal for a value already known to be a string, number, or null; never used on
 *  raw user input, only on values already read back from D1 itself. */
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toEventRow(src) {
  const category = CATEGORY_BY_EVENT_TYPE[src.event_type];
  if (!category) {
    throw new Error(`ops-events: unmapped event_type "${src.event_type}" on slug ${src.slug}`);
  }
  return {
    id: src.slug,
    title: src.title,
    slug: src.slug,
    category,
    short_description: src.short_description,
    long_description: src.long_description,
    start_date: src.start_date,
    start_time: src.start_time,
    end_date: src.end_date,
    end_time: src.end_time,
    location: src.location,
    hero_image: src.hero_image,
    hero_image_alt: src.hero_image_alt,
    thumbnail_image: src.thumbnail_image,
    visible: src.visible ?? 1,
    created_at: src.created_at,
    updated_at: src.updated_at,
    sourceId: src.id,
  };
}

function changedColumns(existing, incoming) {
  if (!existing) return COLUMNS;
  return COLUMNS.filter((col) => String(existing[col] ?? '') !== String(incoming[col] ?? ''));
}

function main() {
  const toml = readFileSync(path.join(ROOT_DIR, 'wrangler.toml'), 'utf8');
  const opsDb = d1Binding(toml, 'EVENTS_DB');
  const clubDb = d1Binding(toml, 'CLUB_DB');
  void tomlValue(toml, /account_id\s*=\s*"([^"]+)"/, 'account_id'); // sanity-checked, unused directly

  const [opsResult] = execStatements(
    opsDb.name,
    `SELECT id, title, slug, event_type, short_description, long_description, start_date,
            start_time, end_date, end_time, location, registration_url, hero_image,
            hero_image_alt, thumbnail_image, visible, created_at, updated_at
     FROM events ORDER BY id`,
  );
  const sourceRows = opsResult.results;

  const [clubResult] = execStatements(clubDb.name, `SELECT * FROM events`);
  const existingById = new Map(clubResult.results.map((row) => [row.id, row]));

  const batchId = `ops-events-${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const statements = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const src of sourceRows) {
    const row = toEventRow(src);
    const existing = existingById.get(row.id);
    const diff = changedColumns(existing, row);

    if (!existing) {
      const cols = [...COLUMNS, 'created_at', 'updated_at'];
      const vals = cols.map((c) => sqlLiteral(row[c]));
      statements.push(`INSERT INTO events (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
      statements.push(
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
          `('import:ops', 'import.insert', 'event', ${sqlLiteral(row.id)}, ` +
          `${sqlLiteral(`import_batch=${batchId}; source=asc-ops.events.id=${row.sourceId}`)});`,
      );
      inserted += 1;
    } else if (diff.length > 0) {
      const sets = diff
        .map((c) => `${c} = ${sqlLiteral(row[c])}`)
        .concat(`updated_at = ${sqlLiteral(row.updated_at)}`)
        .join(', ');
      statements.push(`UPDATE events SET ${sets} WHERE id = ${sqlLiteral(row.id)};`);
      statements.push(
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
          `('import:ops', 'import.update', 'event', ${sqlLiteral(row.id)}, ` +
          `${sqlLiteral(`import_batch=${batchId}; source=asc-ops.events.id=${row.sourceId}; changed=${diff.join(',')}`)});`,
      );
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  statements.push(
    `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
      `('import:ops', 'import.batch', 'event', NULL, ` +
      `${sqlLiteral(`import_batch=${batchId}; source_count=${sourceRows.length}; inserted=${inserted}; updated=${updated}; unchanged=${unchanged}`)});`,
  );

  const sql = statements.join('\n');
  console.log(`ops-events: batch ${batchId}, ${sourceRows.length} source rows, ` +
    `${inserted} to insert, ${updated} to update, ${unchanged} unchanged`);

  if (DRY_RUN) {
    console.log('--dry-run: planned SQL follows, nothing executed\n');
    console.log(sql);
    return;
  }

  execStatements(clubDb.name, sql);
  console.log(`ops-events: applied to ${clubDb.name}`);
}

main();
