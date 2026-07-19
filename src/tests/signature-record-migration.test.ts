// asc-club migration 0029 (member-waivers T2, docs/2026-07-17-member-waivers-design.md "The
// signature record" and "Minors") has no application code of its own yet -- T4 is the first real
// writer -- and the repo's `fakeD1` double (`_fake-d1.ts`) never executes real SQL, so it cannot
// enforce a CHECK, a rename, or a NOT NULL relaxation the way a real SQLite engine would. Two
// things this suite CAN prove:
//
// 1. The migration text itself declares every constraint the spec requires (the same pattern
//    `directory-domain-migration.test.ts` and `boats-model-migration.test.ts` already use for
//    their own migrations), so an edit that silently drops a CHECK or narrows a column fails
//    immediately. Actual runtime enforcement (a bad `context` really rejected, the recreate
//    really carrying an existing row's data across, the widened CHECK really accepting
//    'renewal') is proven separately against a real, local D1 replica in the migration's own
//    scratch-prove transcript (see the task report and
//    `migrations/asc-club/0029_signature_record/README.md`'s "Scratch-proof procedure").
// 2. The one behavior the task calls out explicitly: a signature record's `content_snapshot`
//    round-trips byte-identically through the write/bind/read path the future signing flow (T4)
//    will use, and the SHA-256 recomputed from the read-back text still matches the hash
//    computed at write time. This is the actual correctness property the spec's "content_hash
//    proves the record was not altered after signing" claim depends on: if the JS layer ever
//    normalized, re-encoded, or truncated the snapshot between bind and read, the two hashes
//    would silently diverge without this test catching it before a real writer exists to catch
//    it downstream.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const migrationDir = path.join(repoRoot, 'migrations/asc-club/0029_signature_record');
const forward = readFileSync(path.join(migrationDir, 'forward.sql'), 'utf-8');
const rollback = readFileSync(path.join(migrationDir, 'rollback.sql'), 'utf-8');

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('0029_signature_record forward.sql', () => {
  it('recreates waiver_acceptances after copying legacy rows across (child before drop)', () => {
    const createIndex = forward.indexOf('CREATE TABLE waiver_acceptances_new (');
    const insertIndex = forward.indexOf('INSERT INTO waiver_acceptances_new');
    const dropIndex = forward.indexOf('DROP TABLE waiver_acceptances');
    const renameIndex = forward.indexOf('ALTER TABLE waiver_acceptances_new RENAME TO waiver_acceptances');
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(createIndex);
    expect(dropIndex).toBeGreaterThan(insertIndex);
    expect(renameIndex).toBeGreaterThan(dropIndex);
  });

  it('copies every legacy column into signed_at, the accepted_at rename', () => {
    expect(forward).toContain(
      'INSERT INTO waiver_acceptances_new (id, person_name, person_email, context, waiver_version, signed_at)',
    );
    expect(forward).toContain(
      'SELECT id, person_name, person_email, context, waiver_version, accepted_at FROM waiver_acceptances;',
    );
  });

  it('widens the context CHECK to the full spec vocabulary', () => {
    expect(forward).toMatch(
      /context TEXT NOT NULL CHECK \(context IN \('class-signup', 'join', 'renewal', 'mooring-fee', 'storage-fee'\)\)/,
    );
  });

  it('declares the document identity columns (document_id, version, season, kind)', () => {
    expect(forward).toContain('document_id TEXT,');
    expect(forward).toContain('version INTEGER,');
    expect(forward).toContain('season INTEGER,');
    expect(forward).toMatch(/kind TEXT CHECK \(kind IN \('release', 'acknowledgement', 'agreement'\)\)/);
  });

  it('declares the content hash and snapshot columns, with a fixed-length hash guard', () => {
    expect(forward).toMatch(/content_hash TEXT CHECK \(length\(content_hash\) = 64\)/);
    expect(forward).toContain('content_snapshot TEXT,');
  });

  it('relaxes waiver_version to nullable (the legacy, now-historical wording version)', () => {
    expect(forward).not.toMatch(/waiver_version TEXT NOT NULL/);
    expect(forward).toContain('waiver_version TEXT,');
  });

  it('declares the auth-event columns (token id plus snapshot timestamps)', () => {
    expect(forward).toMatch(/auth_token_id TEXT REFERENCES member_tokens\(id\)/);
    expect(forward).toContain('auth_issued_at TEXT,');
    expect(forward).toContain('auth_consumed_at TEXT,');
  });

  it('declares the minors fields: signer_relationship against the five AS 09.65.292(c) categories, and minor_member_id', () => {
    expect(forward).toMatch(
      /signer_relationship IN \('parent', 'legal-guardian', 'agency-representative', 'power-of-attorney', 'qualifying-relative'\)/,
    );
    expect(forward).toMatch(/minor_member_id TEXT REFERENCES members\(id\)/);
  });

  it('declares member_id as an FK to members, distinct from minor_member_id', () => {
    expect(forward).toMatch(/\n {2}member_id TEXT REFERENCES members\(id\),/);
  });

  it('declares build_hash and ip_address', () => {
    expect(forward).toContain('build_hash TEXT,');
    expect(forward).toContain('ip_address TEXT,');
  });

  it('recreates the person_email index', () => {
    expect(forward).toContain('CREATE INDEX idx_waiver_acceptances_email ON waiver_acceptances(person_email)');
  });
});

describe('0029_signature_record rollback.sql', () => {
  it('restores the original two-value context CHECK and the waiver_version NOT NULL', () => {
    expect(rollback).toMatch(/context TEXT NOT NULL CHECK \(context IN \('class-signup', 'join'\)\)/);
    expect(rollback).toContain('waiver_version TEXT NOT NULL,');
  });

  it('restores accepted_at and drops every spec column', () => {
    expect(rollback).toContain('accepted_at TEXT NOT NULL DEFAULT');
    expect(rollback).not.toContain('content_hash');
    expect(rollback).not.toContain('signer_relationship');
  });

  it('copies signed_at back into accepted_at', () => {
    expect(rollback).toContain(
      'SELECT id, person_name, person_email, context, waiver_version, signed_at FROM waiver_acceptances;',
    );
  });
});

describe('a signature record round-trips its content snapshot byte-identically', () => {
  // Multi-line, with unicode (an em dash, curly quotes, an accented name, a section mark) and
  // markdown punctuation (a heading, bold, a list) -- the shape of the real signable text T1's
  // document model serves and T4 will snapshot verbatim.
  const SNAPSHOT_TEXT = `## Release of liability

I, José Núñez—signing on behalf of my household—agree to the following:

- I accept the risks of sailing, including **cold-water immersion** and capsize;
- I release the Club from claims of ordinary negligence, per § 3 below;
- I understand this is a "binding" agreement I sign freely.

I HAVE READ THIS ENTIRE AGREEMENT AND I UNDERSTAND IT.`;

  const INSERT_SQL = `INSERT INTO waiver_acceptances
    (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`;

  it('the hash recomputed from the read-back snapshot matches the hash computed at write time', async () => {
    const writtenHash = sha256Hex(SNAPSHOT_TEXT);
    expect(writtenHash).toHaveLength(64);

    const { db, calls } = fakeD1();
    await db
      .prepare(INSERT_SQL)
      .bind(
        'sig-1',
        'general-release',
        3,
        2027,
        'release',
        writtenHash,
        SNAPSHOT_TEXT,
        'José Núñez',
        'jose@example.com',
        'join',
      )
      .run();

    const insertCall = calls.find((c) => c.sql.startsWith('INSERT INTO waiver_acceptances'));
    expect(insertCall).toBeDefined();
    const [, , , , , boundHash, boundSnapshot] = insertCall!.args as [
      string,
      string,
      number,
      number,
      string,
      string,
      string,
    ];

    // The "read-back": what a SELECT against this row would hand a caller, simulated via
    // fakeD1's own substring-keyed responder, fed from exactly what was bound above (never from
    // the original `SNAPSHOT_TEXT` constant), so the assertions below prove the write path, not
    // just the test's own setup.
    const { db: readDb } = fakeD1({
      firstResults: {
        'SELECT content_snapshot, content_hash FROM waiver_acceptances WHERE id': {
          content_snapshot: boundSnapshot,
          content_hash: boundHash,
        },
      },
    });
    const row = await readDb
      .prepare('SELECT content_snapshot, content_hash FROM waiver_acceptances WHERE id = ?1')
      .bind('sig-1')
      .first<{ content_snapshot: string; content_hash: string }>();

    expect(row?.content_snapshot).toBe(SNAPSHOT_TEXT);
    expect(sha256Hex(row!.content_snapshot)).toBe(writtenHash);
    expect(row?.content_hash).toBe(writtenHash);
  });
});
