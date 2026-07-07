#!/usr/bin/env node
/**
 * Backfill script: asc-ops.classes.hero_image/hero_image_alt -> asc-club.classes (read-only
 * source, idempotent target). Companion to ops-classes.mjs, which ran before migration
 * 0003_class_images added the target columns and so never carried this pair forward (see that
 * script's own header on why `registration_url`/`registration_status` don't carry either; this
 * pair was a plain oversight, not a deliberate omission, closed here rather than by re-running
 * the full importer).
 *
 * asc-ops is never altered; this only ever SELECTs from it. The write side is the same
 * natural-key idempotent update ops-classes.mjs uses, keyed on id: re-running never duplicates
 * anything, it only updates a row whose hero_image or hero_image_alt actually changed and
 * otherwise skips it. Every update is audited (actor 'import:ops-classes-images'); a no-op
 * re-run still audits one batch-summary row so the run itself stays observable.
 *
 * The transform is a verbatim copy, no derivation: asc-club's `hero_image`/`hero_image_alt`
 * columns (migration 0003_class_images) match asc-ops's own column names and meaning exactly,
 * unlike `track` or `description`, which needed a real mapping decision. One of the five live
 * classes (Fleet Tune-Up Weekend) carries a `NULL` hero_image in asc-ops itself, a known,
 * already-documented gap (docs/events-manifest.md's "Per-event images" section); it backfills
 * as `NULL` too, correctly, not an error.
 *
 * The four real filenames this backfill copies were already pulled into the site's media
 * library by the original events-photography migration (`$theme/event-images.ts`'s
 * `EVENT_IMAGE_TOKENS`), so no new upload is needed: once `$theme/events-data.ts`'s
 * `CLASSES_QUERY` selects these columns instead of a literal `NULL`, the existing resolver
 * already knows how to turn each filename into a real media URL.
 *
 * Usage: node scripts/import/ops-classes-images.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

function d1Binding(toml, bindingName) {
  const re = new RegExp(
    `\\[\\[d1_databases\\]\\]\\s*\\nbinding = "${bindingName}"\\s*\\ndatabase_name = "([^"]+)"\\s*\\ndatabase_id = "([^"]+)"`,
  );
  const m = toml.match(re);
  if (!m) throw new Error(`ops-classes-images: could not find d1_databases binding ${bindingName} in wrangler.toml`);
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
  return `'${String(value).replace(/'/g, "''")}'`;
}

function main() {
  const toml = readFileSync(path.join(ROOT_DIR, 'wrangler.toml'), 'utf8');
  const opsDb = d1Binding(toml, 'EVENTS_DB');
  const clubDb = d1Binding(toml, 'CLUB_DB');

  const [opsResult] = execStatements(opsDb.name, `SELECT id, hero_image, hero_image_alt FROM classes ORDER BY id`);
  const sourceRows = opsResult.results;

  const [clubResult] = execStatements(clubDb.name, `SELECT id, hero_image, hero_image_alt FROM classes`);
  const existingById = new Map(clubResult.results.map((row) => [row.id, row]));

  const batchId = `ops-classes-images-${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const statements = [];
  let updated = 0;
  let unchanged = 0;
  let missing = 0;

  for (const src of sourceRows) {
    const existing = existingById.get(src.id);
    if (!existing) {
      // The importer (ops-classes.mjs) always runs first, so every asc-ops class already has a
      // matching asc-club row; a miss here means the two importers ran out of order, not a real
      // data gap, and is surfaced rather than silently skipped.
      missing += 1;
      continue;
    }
    const changed =
      String(existing.hero_image ?? '') !== String(src.hero_image ?? '') ||
      String(existing.hero_image_alt ?? '') !== String(src.hero_image_alt ?? '');
    if (!changed) {
      unchanged += 1;
      continue;
    }
    statements.push(
      `UPDATE classes SET hero_image = ${sqlLiteral(src.hero_image)}, ` +
        `hero_image_alt = ${sqlLiteral(src.hero_image_alt)}, updated_at = datetime('now') ` +
        `WHERE id = ${sqlLiteral(src.id)};`,
    );
    statements.push(
      `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
        `('import:ops-classes-images', 'import.update', 'class', ${sqlLiteral(src.id)}, ` +
        `${sqlLiteral(`import_batch=${batchId}; source=asc-ops.classes.id=${src.id}; changed=hero_image,hero_image_alt`)});`,
    );
    updated += 1;
  }

  statements.push(
    `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ` +
      `('import:ops-classes-images', 'import.batch', 'class', NULL, ` +
      `${sqlLiteral(`import_batch=${batchId}; source_count=${sourceRows.length}; updated=${updated}; unchanged=${unchanged}; missing=${missing}`)});`,
  );

  const sql = statements.join('\n');
  console.log(
    `ops-classes-images: batch ${batchId}, ${sourceRows.length} source rows, ` +
      `${updated} to update, ${unchanged} unchanged, ${missing} missing a matching asc-club row`,
  );

  if (DRY_RUN) {
    console.log('--dry-run: planned SQL follows, nothing executed\n');
    console.log(sql);
    return;
  }

  execStatements(clubDb.name, sql);
  console.log(`ops-classes-images: applied to ${clubDb.name}`);
}

main();
