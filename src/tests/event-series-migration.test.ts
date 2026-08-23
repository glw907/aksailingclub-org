// asc-club migration 0035 (events admin build pass, Task 1, docs/plans/2026-08-22-events-admin.md
// "Task 1: The 0035_event_series migration") has no application code of its own yet -- Task 2's
// store is the first reader -- and the repo's `fakeD1` double (`_fake-d1.ts`) never executes real
// SQL, so it cannot enforce a CHECK, a table recreate, or a NOT NULL column the way a real SQLite
// engine would. This suite proves the migration TEXT itself declares every constraint the plan
// requires (the same pattern `signature-record-migration.test.ts` and
// `boats-model-migration.test.ts` already use for their own migrations), so an edit that silently
// drops a CHECK, narrows a column, or reorders the recreate's statements fails immediately. Actual
// runtime enforcement (a duplicate (season, slug) really rejected, the recreate really carrying
// every existing row's data across, the rollback really restoring the original shape) is proven
// separately against a real, local D1 replica in the migration's own scratch-proof transcript
// (see `migrations/asc-club/0035_event_series/README.md`'s "Scratch-proof procedure").
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const migrationDir = path.join(repoRoot, 'migrations/asc-club/0035_event_series');
const forward = readFileSync(path.join(migrationDir, 'forward.sql'), 'utf-8');
const rollback = readFileSync(path.join(migrationDir, 'rollback.sql'), 'utf-8');

describe('0035_event_series forward.sql', () => {
  it('recreates events in six statements, in order: create series, seed series, create the new events shape, copy rows, drop the old table, rename in place', () => {
    const createSeriesIndex = forward.indexOf('CREATE TABLE event_series (');
    const insertSeriesIndex = forward.indexOf('INSERT INTO event_series');
    const createEventsNewIndex = forward.indexOf('CREATE TABLE events_new (');
    const insertEventsNewIndex = forward.indexOf('INSERT INTO events_new');
    const dropIndex = forward.indexOf('DROP TABLE events;');
    const renameIndex = forward.indexOf('ALTER TABLE events_new RENAME TO events');

    expect(createSeriesIndex).toBeGreaterThanOrEqual(0);
    expect(insertSeriesIndex).toBeGreaterThan(createSeriesIndex);
    expect(createEventsNewIndex).toBeGreaterThan(insertSeriesIndex);
    expect(insertEventsNewIndex).toBeGreaterThan(createEventsNewIndex);
    expect(dropIndex).toBeGreaterThan(insertEventsNewIndex);
    expect(renameIndex).toBeGreaterThan(dropIndex);
  });

  it('declares the recurrence CHECK vocabulary verbatim', () => {
    expect(forward).toMatch(/recurrence TEXT NOT NULL CHECK \(recurrence IN \('annual', 'once'\)\)/);
  });

  it('inserts exactly one series per existing events row, selected FROM events', () => {
    expect(forward).toContain('INSERT INTO event_series (id, title, recurrence)');
    expect(forward).toMatch(/SELECT\s+'series-' \|\| id, title, 'annual'\s+FROM events;/);
  });

  it('declares series_id as a required foreign key to event_series', () => {
    expect(forward).toMatch(/series_id TEXT NOT NULL REFERENCES event_series\(id\),/);
  });

  it('declares season as a required integer', () => {
    expect(forward).toMatch(/season INTEGER NOT NULL/);
  });

  it('drops the column-level UNIQUE on slug and declares the table-level UNIQUE (season, slug) instead', () => {
    expect(forward).toContain('slug TEXT NOT NULL,');
    expect(forward).not.toMatch(/slug TEXT NOT NULL UNIQUE/);
    expect(forward).toContain('UNIQUE (season, slug)');
  });

  it('carries the category CHECK across unchanged', () => {
    expect(forward).toContain(
      "category TEXT NOT NULL CHECK (category IN ('racing','class','operations','social','governance')),",
    );
  });

  it('derives season from the start_date year, falling back to settings.current_season, verbatim', () => {
    expect(forward).toContain(
      "COALESCE(\n    CAST(substr(start_date, 1, 4) AS INTEGER),\n    (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season')\n  )",
    );
  });

  it("derives series_id as 'series-' || id in the events copy", () => {
    expect(forward).toContain("'series-' || id,\n  COALESCE(");
  });

  it('writes one migration.backfill audit row naming the migration', () => {
    expect(forward).toMatch(/INSERT INTO audit_log \(actor, action, entity, entity_id, detail\) VALUES/);
    expect(forward).toContain("'system', 'migration.backfill', 'event_series', NULL,");
    expect(forward).toContain('0035_event_series:');
  });
});

describe('0035_event_series rollback.sql', () => {
  it('restores the original column-level UNIQUE on slug', () => {
    expect(rollback).toMatch(/slug TEXT NOT NULL UNIQUE,/);
  });

  it('drops event_series', () => {
    expect(rollback).toContain('DROP TABLE event_series;');
  });

  it('mentions no season or series_id column in the rebuilt table', () => {
    const createIndex = rollback.indexOf('CREATE TABLE events_new (');
    const closeIndex = rollback.indexOf(');', createIndex);
    const createBody = rollback.slice(createIndex, closeIndex);
    expect(createBody).not.toContain('season');
    expect(createBody).not.toContain('series_id');
  });

  it('copies every row back into the restored shape', () => {
    expect(rollback).toMatch(/INSERT INTO events_new \(/);
    expect(rollback).toMatch(/FROM events;/);
  });

  it('writes one migration.rollback audit row', () => {
    expect(rollback).toContain("'system', 'migration.rollback', 'event_series', NULL,");
  });
});
