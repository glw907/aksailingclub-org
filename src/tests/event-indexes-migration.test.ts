// asc-club migration 0036 (events-admin fix round, docs/plans/2026-08-22-events-admin.md's
// reviewer fan-out). Like the other migration-text suites in this repo (`event-series-
// migration.test.ts`, `signature-record-migration.test.ts`, `boats-model-migration.test.ts`),
// `fakeD1` executes no SQL, so it cannot enforce an index or a UNIQUE constraint. This suite
// proves the migration TEXT declares the two indexes with the exact shape the plan requires;
// runtime enforcement (the UNIQUE index really rejecting a duplicate, both indexes really
// dropping on rollback) is proven separately against a real, local D1 replica in the migration's
// own scratch-proof transcript (see `migrations/asc-club/0036_event_indexes/README.md`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const migrationDir = path.join(repoRoot, 'migrations/asc-club/0036_event_indexes');
const forward = readFileSync(path.join(migrationDir, 'forward.sql'), 'utf-8');
const rollback = readFileSync(path.join(migrationDir, 'rollback.sql'), 'utf-8');

describe('0036_event_indexes forward.sql', () => {
  it('declares a UNIQUE index on (series_id, season)', () => {
    expect(forward).toContain('CREATE UNIQUE INDEX idx_events_series_season ON events(series_id, season);');
  });

  it('declares a non-unique index on (slug, season DESC)', () => {
    expect(forward).toContain('CREATE INDEX idx_events_slug_season ON events(slug, season DESC);');
    expect(forward).not.toContain('CREATE UNIQUE INDEX idx_events_slug_season');
  });

  it('adds no CHECK constraint (the date-shape backstop is enforced in code, not SQL)', () => {
    // Assert on the code body alone, past the header comment block, since the header's own
    // prose necessarily names the word "CHECK" while explaining why none was added.
    const codeBody = forward.slice(forward.indexOf('CREATE UNIQUE INDEX'));
    expect(codeBody).not.toContain('CHECK');
  });

  it('recreates no table (a bare CREATE INDEX needs no copy)', () => {
    expect(forward).not.toContain('CREATE TABLE');
    expect(forward).not.toContain('DROP TABLE');
  });

  it('writes one migration.backfill audit row naming the migration', () => {
    expect(forward).toMatch(/INSERT INTO audit_log \(actor, action, entity, entity_id, detail\) VALUES/);
    expect(forward).toContain("'system', 'migration.backfill', 'events', NULL,");
    expect(forward).toContain('0036_event_indexes:');
  });
});

describe('0036_event_indexes rollback.sql', () => {
  it('drops both indexes', () => {
    expect(rollback).toContain('DROP INDEX idx_events_series_season;');
    expect(rollback).toContain('DROP INDEX idx_events_slug_season;');
  });

  it('writes one migration.rollback audit row', () => {
    expect(rollback).toContain("'system', 'migration.rollback', 'events', NULL,");
  });
});
