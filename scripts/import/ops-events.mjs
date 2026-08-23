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
 * `series_id` and `season` are both NOT NULL as of migration 0035_event_series and this
 * script mirrors that migration's own derivation for every newly inserted row: a fresh
 * `event_series` row (`id = 'series-' || events.id`, `title = events.title`,
 * `recurrence = 'annual'`) is inserted alongside the event, and `season` is the year of
 * `start_date` when there is one, else `settings.current_season` (read once per run, the
 * same fallback the migration's own INSERT uses). Neither column is ever part of the
 * update path: an already-migrated row already carries both, and a source-side title
 * edit updates `events.title` alone, exactly as an officer's own row-form save does.
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

/** A SQL literal for a value already known to be a string, number, or null. Every value spliced
 *  through this function is ops-authored text read back from `asc-ops` (an internal, trusted
 *  source this script only ever reads) -- never a request path or any value a site visitor could
 *  influence -- but it is still escaped (doubling every `'`) and checked for a NUL or other
 *  control character before being spliced into the batch SQL text, since this script emits raw
 *  SQL statements rather than binding parameters through `wrangler d1 execute --command`'s own
 *  parameter support. A NUL or control character (tab, newline, and carriage return excepted --
 *  ordinary whitespace a description field can legitimately carry) throws rather than silently
 *  stripping it, so a malformed source row fails the import loudly instead of writing a quietly
 *  truncated value. */
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  const text = String(value);
  // eslint-disable-next-line no-control-regex -- deliberately matching control characters
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) {
    throw new Error(`ops-events: value contains a NUL or control character: ${JSON.stringify(text)}`);
  }
  return `'${text.replace(/'/g, "''")}'`;
}

/** `start_date`'s year, or `fallbackSeason` for an undated row -- the same fallback
 *  `forward.sql`'s own `season` `COALESCE` uses. */
function seasonFor(startDate, fallbackSeason) {
  return startDate ? Number(String(startDate).slice(0, 4)) : fallbackSeason;
}

function toEventRow(src, fallbackSeason) {
  const category = CATEGORY_BY_EVENT_TYPE[src.event_type];
  if (!category) {
    throw new Error(`ops-events: unmapped event_type "${src.event_type}" on slug ${src.slug}`);
  }
  return {
    id: src.slug,
    series_id: `series-${src.slug}`,
    season: seasonFor(src.start_date, fallbackSeason),
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

  const [settingsResult] = execStatements(clubDb.name, `SELECT value FROM settings WHERE key = 'current_season'`);
  const currentSeasonRow = settingsResult.results[0];
  if (!currentSeasonRow) throw new Error('ops-events: could not read settings.current_season from asc-club');
  const fallbackSeason = Number(currentSeasonRow.value);

  const batchId = `ops-events-${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const statements = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const src of sourceRows) {
    const row = toEventRow(src, fallbackSeason);
    const existing = existingById.get(row.id);
    const diff = changedColumns(existing, row);

    if (!existing) {
      // OR IGNORE: two different asc-ops event ids could in principle slugify to the same
      // series_id (`series-${slug}`), which would otherwise abort the whole batch on
      // event_series's own PRIMARY KEY; ignoring a duplicate insert here matches this script's
      // own idempotent-target contract (this module's own header) rather than failing the run.
      statements.push(
        `INSERT OR IGNORE INTO event_series (id, title, recurrence) VALUES ` +
          `(${sqlLiteral(row.series_id)}, ${sqlLiteral(row.title)}, 'annual');`,
      );
      const cols = [...COLUMNS, 'series_id', 'season', 'created_at', 'updated_at'];
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
