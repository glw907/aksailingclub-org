#!/usr/bin/env node
/**
 * Import script: asc-ops.classes -> asc-club.classes (read-only source, idempotent target).
 *
 * asc-ops is never altered; this only ever SELECTs from it. The write side is a
 * natural-key upsert keyed on id (asc-ops's own text ids, e.g. "1st_adult_teen_intro",
 * are already stable and unique, so they carry straight over): re-running never creates
 * a duplicate row, it only updates a row whose mapped columns actually changed and
 * otherwise skips it. Every insert or update is audited (actor 'import:ops'); a no-op
 * re-run still audits one batch-summary row so the run itself stays observable.
 *
 * asc-club's `classes` table models a different domain than asc-ops's: registration is
 * now the internal enrollment/waitlist/offer machine (plan Tasks 6/7), not an external
 * MembershipWorks link, so `registration_url` and `registration_status` intentionally do
 * not carry forward (no matching column). Three columns asc-ops never tracked are new,
 * documented judgment calls this script makes explicit rather than leaving unset:
 *
 * - `track` ('adult-teen' | 'youth'): asc-ops carries no age-track field. Derived from the
 *   class name (every live row names itself "Adult" or "Youth" except one); the one
 *   ambiguous row (Fleet Tune-Up Weekend, open to any member, no age restriction stated)
 *   defaults to 'adult-teen', this script's own documented call.
 * - `capacity`: asc-ops carries no capacity column (MembershipWorks managed the real
 *   registration limit externally). Every row imports with a placeholder DEFAULT_CAPACITY;
 *   the club admin should confirm or edit the real cap once the classes admin screen
 *   (plan Task 6) lands, since fullness derives from this value.
 * - `fee`: every live asc-ops row's `fee` column is NULL (MembershipWorks handled the
 *   actual charge externally). Imports as 0, the schema's NOT NULL floor, not a real price.
 *
 * `short_description` and `long_description` merge into asc-club's single `description`
 * column (asc-ops's own split does not exist in the target schema): both pieces of
 * authored copy are kept, joined by a blank line, rather than dropping one.
 *
 * One known data-quality anomaly imports verbatim, unfixed, per the read-only-source
 * precedent already recorded in docs/events-integration-findings.md: `2nd_adult_teen_intro`
 * carries `end_date: '2016-07-12'`, eighteen years off its `start_date`. This importer is
 * not the place to silently correct asc-ops's own authored data.
 *
 * Usage: node scripts/import/ops-classes.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

const DEFAULT_CAPACITY = 10;
const DEFAULT_FEE = 0;

/** The mapped column order for asc-club's `classes` table (excludes season, created_at,
 *  updated_at, which are resolved or preserved separately from the plain diff check). */
const COLUMNS = [
  'id',
  'name',
  'slug',
  'track',
  'capacity',
  'fee',
  'start_date',
  'end_date',
  'location',
  'description',
  'instructor_notes',
  'visible',
];

function d1Binding(toml, bindingName) {
  const re = new RegExp(
    `\\[\\[d1_databases\\]\\]\\s*\\nbinding = "${bindingName}"\\s*\\ndatabase_name = "([^"]+)"\\s*\\ndatabase_id = "([^"]+)"`,
  );
  const m = toml.match(re);
  if (!m) throw new Error(`ops-classes: could not find d1_databases binding ${bindingName} in wrangler.toml`);
  return { name: m[1], id: m[2] };
}

function execStatements(dbName, sql) {
  const stdout = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', dbName, '--remote', '--command', sql, '--json'],
    { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Derives the age track from the class name. Every live row names itself "Adult" or
 *  "Youth" except Fleet Tune-Up Weekend, which is open to any member with no age
 *  restriction; it defaults to 'adult-teen', this script's own documented call, since
 *  asc-ops carries no track field to read instead. */
function trackFor(name) {
  if (/youth/i.test(name)) return 'youth';
  return 'adult-teen';
}

function toClassRow(src, season) {
  const description = [src.short_description, src.long_description].filter(Boolean).join('\n\n') || null;
  return {
    id: src.id,
    season,
    name: src.name,
    slug: src.slug,
    track: trackFor(src.name),
    capacity: DEFAULT_CAPACITY,
    fee: src.fee ?? DEFAULT_FEE,
    start_date: src.start_date,
    end_date: src.end_date,
    location: src.location,
    description,
    instructor_notes: null,
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

  const [seasonResult] = execStatements(
    clubDb.name,
    `SELECT value FROM settings WHERE key = 'current_season'`,
  );
  const season = Number(seasonResult.results[0].value);

  const [opsResult] = execStatements(
    opsDb.name,
    `SELECT id, name, slug, registration_status, registration_url, fee, start_date, start_time,
            end_date, end_time, location, short_description, long_description, hero_image,
            hero_image_alt, thumbnail_image, visible, sort_order, created_at, updated_at
     FROM classes ORDER BY sort_order, id`,
  );
  const sourceRows = opsResult.results;

  const [clubResult] = execStatements(clubDb.name, `SELECT * FROM classes`);
  const existingById = new Map(clubResult.results.map((row) => [row.id, row]));

  const batchId = `ops-classes-${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const statements = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const src of sourceRows) {
    const row = toClassRow(src, season);
    const existing = existingById.get(row.id);
    const diff = changedColumns(existing, row);

    if (!existing) {
      const cols = [...COLUMNS, 'season', 'created_at', 'updated_at'];
      const vals = cols.map((c) => sqlLiteral(row[c]));
      statements.push(`INSERT INTO classes (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
      statements.push(
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
          `('import:ops', 'import.insert', 'class', ${sqlLiteral(row.id)}, ` +
          `${sqlLiteral(`import_batch=${batchId}; source=asc-ops.classes.id=${row.sourceId}`)});`,
      );
      inserted += 1;
    } else if (diff.length > 0) {
      const sets = diff
        .map((c) => `${c} = ${sqlLiteral(row[c])}`)
        .concat(`updated_at = ${sqlLiteral(row.updated_at)}`)
        .join(', ');
      statements.push(`UPDATE classes SET ${sets} WHERE id = ${sqlLiteral(row.id)};`);
      statements.push(
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
          `('import:ops', 'import.update', 'class', ${sqlLiteral(row.id)}, ` +
          `${sqlLiteral(`import_batch=${batchId}; source=asc-ops.classes.id=${row.sourceId}; changed=${diff.join(',')}`)});`,
      );
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  statements.push(
    `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
      `('import:ops', 'import.batch', 'class', NULL, ` +
      `${sqlLiteral(`import_batch=${batchId}; source_count=${sourceRows.length}; inserted=${inserted}; updated=${updated}; unchanged=${unchanged}`)});`,
  );

  const sql = statements.join('\n');
  console.log(`ops-classes: batch ${batchId}, ${sourceRows.length} source rows (season ${season}), ` +
    `${inserted} to insert, ${updated} to update, ${unchanged} unchanged`);

  if (DRY_RUN) {
    console.log('--dry-run: planned SQL follows, nothing executed\n');
    console.log(sql);
    return;
  }

  execStatements(clubDb.name, sql);
  console.log(`ops-classes: applied to ${clubDb.name}`);
}

main();
