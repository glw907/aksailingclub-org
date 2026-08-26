#!/usr/bin/env node
/**
 * Bootstraps the local CLUB_DB (asc-club) D1 replica the e2e webServer serves against, run
 * before every `npm run test:e2e` (wired into `playwright.config.ts`'s `webServer.command`).
 *
 * WHY THIS SCRIPT EXISTS: `.wrangler/` is gitignored, so a CI runner's local D1 replica starts
 * completely empty every run, while a developer's own workstation replica already carries
 * whatever migrations and rows a prior session left behind. Neither state alone is enough for
 * the join and class-door specs (`e2e/join-and-class-door.spec.ts`), which need the real
 * asc-club schema (settings, households, members, memberships -- not just the events/classes
 * subset the visual suite's own fixture used to need): this script applies every asc-club
 * migration idempotently (skipped if the schema is already there, checked via the `settings`
 * table `0001_substrate` always creates), then reseeds the suite's own fixture rows fresh every
 * run, so both a cold CI checkout and a warm workstation replica end up in the identical state.
 *
 * A second, narrower kind of probe covers the gap between those two states: a warm workstation
 * replica that already has `settings` (so the first probe short-circuits `applyMigrations()` for
 * it) can still predate a migration added after that replica was last bootstrapped. Rather than
 * re-run every migration for it (0001_substrate's own `CREATE TABLE` statements fail outright
 * against an already-populated replica), the script checks for one artifact a later migration
 * adds and applies just that one migration's `forward.sql` on its own when the artifact is
 * missing. Four such probes exist today, each keyed on the schema object its own migration adds:
 * `event_series` the table for `0035_event_series`, `uq_asset_requests_pending_household_type` the
 * index for `0037_asset_request_unique`, `members.club_email_opt_in` the column for
 * `0038_club_email_optin`, and `idx_email_log_sent_at` the index for `0039_email_log_sent_at`.
 * A migration between them (`0036_event_indexes`) carries no probe of its own; a future migration
 * a warm replica needs to catch up on should add one following one of the three shapes above
 * (`tableExists`, `indexExists`, `columnExists`), not assume an earlier probe covers everything
 * since.
 *
 * `wrangler d1 execute --local` never touches the real asc-club data the admin screens and the
 * import scripts own; it only ever writes the gitignored local replica.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const migrationsDir = path.join(repoRoot, 'migrations/asc-club');

function d1File(relativeSqlPath) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'asc-club', '--local', '--file', relativeSqlPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function tableExists(name) {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'asc-club',
      '--local',
      '--json',
      '--command',
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
    ],
    { cwd: repoRoot },
  ).toString();
  const [{ results }] = JSON.parse(out);
  return results.length > 0;
}

function indexExists(name) {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'asc-club',
      '--local',
      '--json',
      '--command',
      `SELECT name FROM sqlite_master WHERE type='index' AND name='${name}'`,
    ],
    { cwd: repoRoot },
  ).toString();
  const [{ results }] = JSON.parse(out);
  return results.length > 0;
}

/** A column probe, for a migration whose only artifact is an added column: neither `tableExists`
 *  nor `indexExists` can see one, since `sqlite_master` records the table's whole DDL as one
 *  string. `pragma_table_info` is the read that can. */
function columnExists(table, column) {
  const out = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'asc-club',
      '--local',
      '--json',
      '--command',
      `SELECT name FROM pragma_table_info('${table}') WHERE name='${column}'`,
    ],
    { cwd: repoRoot },
  ).toString();
  const [{ results }] = JSON.parse(out);
  return results.length > 0;
}

function applyMigrations() {
  const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const dir of migrationDirs) {
    d1File(path.join(migrationsDir, dir, 'forward.sql'));
  }
}

if (!tableExists('settings')) {
  applyMigrations();
} else {
  // A warm workstation replica that already carries 0001-0034 (the `settings` probe above short-
  // circuits `applyMigrations()` for it) still needs later migrations applied on their own: a
  // blanket re-run of every migration is not the fix, since re-running 0001_substrate's own
  // `CREATE TABLE` statements against an already-populated replica fails outright. Each narrow,
  // additive probe below is how one such migration reaches an existing local replica without one.
  if (!tableExists('event_series')) d1File(path.join(migrationsDir, '0035_event_series', 'forward.sql'));
  // 0037_asset_request_unique (fix round B, item 6): a warm replica bootstrapped before this
  // migration existed never gets the partial unique index the retention/request duplicate-guard
  // tests rely on, since it already has `settings` and short-circuits `applyMigrations()` above.
  if (!indexExists('uq_asset_requests_pending_household_type')) {
    d1File(path.join(migrationsDir, '0037_asset_request_unique', 'forward.sql'));
  }
  // 0038_club_email_optin (Email + Announce, Task 1): without this probe a warm replica runs the
  // whole suite against a `members` table with no `club_email_opt_in` column, so every membership
  // segment query throws while cold CI passes. A column needs its own probe shape: `sqlite_master`
  // stores the table's DDL as one string, so neither `tableExists` nor `indexExists` can see one.
  if (!columnExists('members', 'club_email_opt_in')) {
    d1File(path.join(migrationsDir, '0038_club_email_optin', 'forward.sql'));
  }
  // 0039_email_log_sent_at (Email + Announce, Task 1): performance only, so a warm replica missing
  // it would still pass. Probed anyway, because the point of this block is that a replica ends up
  // in the same state as a cold CI checkout, not merely a state the current specs cannot tell
  // apart.
  if (!indexExists('idx_email_log_sent_at')) {
    d1File(path.join(migrationsDir, '0039_email_log_sent_at', 'forward.sql'));
  }
}

d1File(path.join(repoRoot, 'e2e/fixtures/events-seed.sql'));
d1File(path.join(repoRoot, 'e2e/fixtures/signup-seed.sql'));
// Applied AFTER signup-seed.sql: that file's own household/member/membership deletes are
// blanket and unconditional, so this file's rows would be wiped right back out if it ran first
// (portal-seed.sql's own header explains the full ordering).
d1File(path.join(repoRoot, 'e2e/fixtures/portal-seed.sql'));
// The member-waivers e2e fixture (T8): its own `waiver-`-prefixed rows never collide with
// portal-seed.sql's `portal-`-prefixed ones, so ordering relative to that file does not matter.
d1File(path.join(repoRoot, 'e2e/fixtures/waivers-seed.sql'));
// The Assets trial build's request/waitlist fixture (Task 2): MUST run after signup-seed.sql and
// portal-seed.sql, though no longer last overall (email-seed.sql, below, is newer).
// signup-seed.sql's own blanket (no-WHERE) deletes of asset_requests/asset_waitlist/
// asset_payments/asset_assignments would wipe this file's rows if it ran earlier, and its own
// capacity UPDATEs on the real asset_types rows would be undone by portal-seed.sql's
// delete-and-reinsert of those same rows (that file's own header explains why capacity always
// resets to NULL there).
d1File(path.join(repoRoot, 'e2e/fixtures/assets-seed.sql'));
// The Email + Announce admin e2e/visual fixture (Task 11): `email_log` and `announcements` are
// untouched by every other seed file in this pipeline, so this file's own position relative to
// them never matters -- it runs last simply because it is the newest addition, matching this
// pipeline's own convention of appending rather than inserting.
d1File(path.join(repoRoot, 'e2e/fixtures/email-seed.sql'));
