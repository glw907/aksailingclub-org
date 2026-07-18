// asc-club migration 0027 (docs/plans/2026-07-17-member-directory.md's T1) has no application
// code of its own yet -- it is pure DDL, and the repo's `fakeD1` double (`_fake-d1.ts`) never
// executes real SQL, so it cannot enforce a CHECK, a UNIQUE pair, or a default value the way a
// real SQLite engine would. This suite asserts what a fakeD1-shaped test CAN: that the migration
// text itself declares every constraint the plan requires, so an edit that silently drops a CHECK
// or a default fails this suite immediately. The constraints' actual runtime enforcement (a bad
// insert really rejected, a default really applied) is proven separately against a real, local D1
// replica in the migration's own scratch-prove transcript (see the task report and
// `migrations/asc-club/0027_directory_domain/README.md`'s "Scratch-proof procedure").
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const migrationDir = path.join(repoRoot, 'migrations/asc-club/0027_directory_domain');
const forward = readFileSync(path.join(migrationDir, 'forward.sql'), 'utf-8');
const rollback = readFileSync(path.join(migrationDir, 'rollback.sql'), 'utf-8');

describe('0027_directory_domain forward.sql', () => {
  it('declares the boats.class CHECK against the fixed picker', () => {
    expect(forward).toMatch(/class TEXT NOT NULL CHECK \(class IN \('Buccaneer 18','Laser','Other'\)\)/);
  });

  it('declares the boats.kept_on CHECK and its trailer default', () => {
    expect(forward).toMatch(
      /kept_on TEXT NOT NULL DEFAULT 'trailer' CHECK \(kept_on IN \('trailer','mooring'\)\)/,
    );
  });

  it('declares a table-level CHECK requiring model iff class is Other, both directions', () => {
    expect(forward).toContain("(class = 'Other' AND model IS NOT NULL) OR");
    expect(forward).toContain("(class <> 'Other' AND model IS NULL)");
  });

  it('declares boats.member_id as a NOT NULL FK to members, owner not household', () => {
    expect(forward).toMatch(/member_id TEXT NOT NULL REFERENCES members\(id\)/);
    expect(forward).not.toContain('household_id');
  });

  it('declares committee_members.role CHECK and its member default', () => {
    expect(forward).toMatch(
      /role TEXT NOT NULL DEFAULT 'member' CHECK \(role IN \('chair','co-chair','member'\)\)/,
    );
  });

  it('declares committee_members.status CHECK and its pending default', () => {
    expect(forward).toMatch(
      /status TEXT NOT NULL DEFAULT 'pending' CHECK \(status IN \('pending','active'\)\)/,
    );
  });

  it('declares the UNIQUE (committee_id, member_id) pair on committee_members', () => {
    expect(forward).toContain('UNIQUE (committee_id, member_id)');
  });

  it('declares committee_members FK columns to committees and members', () => {
    const tableStart = forward.indexOf('CREATE TABLE committee_members (');
    const tableEnd = forward.indexOf(');', tableStart);
    expect(tableStart).toBeGreaterThanOrEqual(0);
    const tableBody = forward.slice(tableStart, tableEnd);
    expect(tableBody).toMatch(/committee_id TEXT NOT NULL REFERENCES committees\(id\)/);
    expect(tableBody).toMatch(/member_id TEXT NOT NULL REFERENCES members\(id\)/);
  });

  it('declares member_positions.kind CHECK against the authorization vocabulary', () => {
    expect(forward).toMatch(/kind TEXT NOT NULL CHECK \(kind IN \('officer','director','appointed'\)\)/);
  });

  it('declares committees.slug UNIQUE and committees.kind CHECK', () => {
    expect(forward).toMatch(/slug TEXT NOT NULL UNIQUE/);
    expect(forward).toMatch(/kind TEXT NOT NULL CHECK \(kind IN \('standing','established'\)\)/);
  });

  it('adds the four household address columns additively', () => {
    expect(forward).toContain('ALTER TABLE households ADD COLUMN address_line1 TEXT');
    expect(forward).toContain('ALTER TABLE households ADD COLUMN address_line2 TEXT');
    expect(forward).toContain('ALTER TABLE households ADD COLUMN state TEXT');
    expect(forward).toContain('ALTER TABLE households ADD COLUMN postal_code TEXT');
  });
});

describe('0027_directory_domain rollback.sql', () => {
  it('drops committee_members before committees (child before parent)', () => {
    const membersIndex = rollback.indexOf('DROP TABLE committee_members');
    const committeesIndex = rollback.indexOf('DROP TABLE committees');
    expect(membersIndex).toBeGreaterThanOrEqual(0);
    expect(committeesIndex).toBeGreaterThan(membersIndex);
  });

  it('drops all four new tables and all four new household columns', () => {
    for (const table of ['committee_members', 'member_positions', 'committees', 'boats']) {
      expect(rollback).toContain(`DROP TABLE ${table}`);
    }
    for (const column of ['postal_code', 'state', 'address_line2', 'address_line1']) {
      expect(rollback).toContain(`ALTER TABLE households DROP COLUMN ${column}`);
    }
  });
});
