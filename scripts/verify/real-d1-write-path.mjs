#!/usr/bin/env node
/**
 * Scripted end-to-end proof that the FK chain migration 0005_member_domain fixes actually works
 * against REAL (remote) D1, not just the `fakeD1` test double every unit test in this pass uses.
 *
 * This does not import `enrollments.ts`/`offers.ts`/`people.ts` and call them directly: those
 * modules type their one parameter as `D1Database`, the Worker runtime binding object, which a
 * plain Node process has no way to construct without either deploying a Worker or wiring up
 * Miniflare/`getPlatformProxy` plus a TypeScript loader capable of resolving this project's
 * extensionless relative imports, neither of which this repo's toolchain has today. Per the
 * pass's own dispatch ("if wiring the lib against a remote scratch is impractical from node, do
 * it via wrangler d1 execute statements that mirror the exact SQL the functions issue, stating
 * so"), this script instead issues, via `wrangler d1 execute --remote`, the EXACT SQL text each
 * function's own source runs, in the exact order, against a real scratch D1 database. Every
 * statement below is copy-checked against its source function; a change to one of those
 * functions' SQL should update this script's mirror in the same commit, or this proof goes
 * stale (the same discipline `scripts/import/ops-classes.mjs`'s own header sets for its own
 * `wrangler d1 execute` shelling-out convention, reused here).
 *
 * What this proves, matching Part 1's own scratch-DB findings but through the ACTUAL write paths
 * (not raw ad hoc INSERTs): `signUpForClass`'s enrolled branch (ensureMember creates a real
 * `members` row, then a real `class_enrollments.member_id` FK write succeeds against it),
 * `signUpForClass`'s waitlist branch (`class_waitlist.member_id` stays NULL, `applicant_email`
 * carries the identity, no FK write blocked), and `offerSpot` + `claimOffer` (a waitlisted
 * applicant resolves through `ensureMember` into a real member, then enrolls with a real FK-
 * checked `member_id`, the waitlist row is removed). Running this script end to end is also what
 * surfaced migration 0006_offer_cascade_on_waitlist_delete (see that migration's own README): a
 * SECOND, independent real-D1 FK finding, live since 0001_substrate and unrelated to the member
 * domain, that blocked `claimOffer`'s own waitlist-row delete until fixed.
 *
 * Creates a fresh scratch database (`asc-club-scratch-<timestamp>` by default, or `--db-name` to
 * override), runs migrations 0001-0006 forward, exercises the write paths, and deletes the
 * database when done. Pass `--keep` to skip the final delete (leaves the scratch DB in place for
 * manual inspection; the caller is then responsible for `wrangler d1 delete` when finished).
 *
 * Usage: node scripts/verify/real-d1-write-path.mjs [--db-name NAME] [--keep]
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEEP = process.argv.includes('--keep');
const nameFlagIndex = process.argv.indexOf('--db-name');
const DB_NAME =
  nameFlagIndex !== -1 ? process.argv[nameFlagIndex + 1] : `asc-club-scratch-${Date.now()}`;

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

/** Runs one or more `;`-joined SQL statements as a single `wrangler d1 execute --command` call
 *  (D1's own `--command` accepts several statements this way, the closest CLI analogue to a
 *  `db.batch()` call) and returns the parsed `--json` results array, one entry per statement.
 *  D1's own CLI takes no bound-parameter placeholders, so every caller below inlines literals via
 *  {@link sqlLiteral} (the same convention `scripts/import/ops-classes.mjs` already uses). A
 *  value must never itself start with the two characters `--`: wrangler's own argument parser
 *  (confirmed this session) mistakes a leading `--` in `--command`'s VALUE for a new flag,
 *  swallowing the real SQL; every literal below is either an id, a plain word, or a phrase not
 *  shaped like a CLI flag, so this never arises here.
 *
 * A `FOREIGN KEY constraint failed` at a call site that references a row a PRIOR, separate
 * `exec()` call just created was first suspected (this session) to be a cross-request D1 replica-
 * lag artifact of this script's own separate-CLI-process method; that theory did not survive
 * testing (retrying the exact failing statement, even ten times at 1.5s apart, still failed). The
 * REAL cause, found instead: `claimOffer`'s own waitlist-row `DELETE` was genuinely blocked by
 * `class_offers.waitlist_id`'s FK (no `ON DELETE` clause, SQLite's default `NO ACTION`), fixed by
 * migration 0006_offer_cascade_on_waitlist_delete, not a timing issue at all (see that migration's
 * README for the full finding). {@link ensureMember} still returns its own creation statements
 * unexecuted rather than running them immediately, so a caller with its own dependent write can
 * fold both into ONE `exec()` call: not required for correctness (a plain sequence of separate
 * calls was independently confirmed to work fine, e.g. Person A's enrolled-branch flow below), but
 * it is the closer mirror of a single Worker request's one bound `D1Database` instance, and cuts
 * the number of `wrangler` invocations this script makes. The retry below stays as a cheap,
 * genuinely defensive guard for any real transient D1 hiccup, not a fix for the finding above. */
const FK_RETRY_LIMIT = 3;

function exec(sql, attempt = 0) {
  try {
    const stdout = wrangler(['d1', 'execute', DB_NAME, '--remote', '--command', sql, '--json']);
    return JSON.parse(stdout);
  } catch (err) {
    const message = String(err.stdout ?? err.message ?? '');
    if (!/FOREIGN KEY constraint failed/.test(message) || attempt >= FK_RETRY_LIMIT) throw err;
    console.log(`  (retrying after a FOREIGN KEY constraint failure, attempt ${attempt + 1}/${FK_RETRY_LIMIT})`);
    execFileSync('sleep', ['1']);
    return exec(sql, attempt + 1);
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function firstRow(results) {
  return results[0]?.results?.[0] ?? null;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
  console.log(`  ok: ${message}`);
}

/** Mirrors `toSqliteDatetime` (offers.ts): a SQLite `datetime('now')`-shaped UTC string. */
function toSqliteDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Mirrors `hashOfferToken` (offers.ts): the lowercase hex SHA-256 of a token. */
async function hashOfferToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mirrors `ensureMember` (people.ts): the pre-check SELECT, then (only for an unknown email) the
 *  household/member/primary-set batch. Does NOT execute the creation batch itself: returns it as
 *  `creationStatements` (empty when the member already existed) so a caller with its own
 *  dependent write can fold both into one `exec()` call (this file's own header on why). Every
 *  caller below either executes `creationStatements` immediately on its own (mirroring
 *  `ensureMember`'s real, standalone `db.batch()`) or folds it into its next write; either way the
 *  SQL text and order match the source exactly, only the HTTP-call boundary moves. */
async function ensureMember(name, email, phone) {
  const existing = firstRow(exec(`SELECT id, household_id FROM members WHERE email = ${sqlLiteral(email)} LIMIT 1`));
  if (existing) return { memberId: existing.id, created: false, creationStatements: [] };

  const householdId = randomUUID();
  const memberId = randomUUID();
  const creationStatements = [
    `INSERT INTO households (id, name) VALUES (${sqlLiteral(householdId)}, ${sqlLiteral(name)})`,
    `INSERT INTO members (id, household_id, name, email, phone) VALUES (${sqlLiteral(memberId)}, ${sqlLiteral(householdId)}, ${sqlLiteral(name)}, ${sqlLiteral(email)}, ${sqlLiteral(phone)})`,
    `UPDATE households SET primary_member_id = ${sqlLiteral(memberId)} WHERE id = ${sqlLiteral(householdId)}`,
  ];
  return { memberId, created: true, creationStatements };
}

async function main() {
  console.log(`real-d1-write-path: creating scratch database ${DB_NAME}`);
  wrangler(['d1', 'create', DB_NAME]);

  try {
    console.log('\nApplying migrations 0001-0006 forward:');
    for (const m of [
      '0001_substrate',
      '0002_instructor_display_name',
      '0003_class_images',
      '0004_waitlist_integrity',
      '0005_member_domain',
      '0006_offer_cascade_on_waitlist_delete',
    ]) {
      wrangler(['d1', 'execute', DB_NAME, '--remote', '--file', `migrations/asc-club/${m}/forward.sql`]);
      console.log(`  applied ${m}`);
    }

    // A class with capacity 1: the smallest number that lets one signup enroll and the next one
    // waitlist, mirroring `createClass`'s (classes-store.ts) exact column list and value order.
    const classId = 'scratch-class';
    exec(
      `INSERT INTO classes (id, season, name, slug, track, capacity, fee, start_date, end_date, location, description, instructor_notes, visible)
       VALUES (${sqlLiteral(classId)}, 2026, 'Scratch Class', ${sqlLiteral(classId)}, 'adult-teen', 1, 100, NULL, NULL, NULL, NULL, NULL, 1)`,
    );
    console.log(`\nSeeded class ${classId} (capacity 1)`);

    // ---- signUpForClass, enrolled branch (enrollments.ts) ----
    console.log('\n--- signUpForClass: enrolled branch (Person A, the class is not yet full) ---');
    const personA = { name: 'Person A', email: 'person-a@example.com', phone: '+19075551111' };
    const memberA = await ensureMember(personA.name, personA.email, personA.phone);
    assert(memberA.created, 'ensureMember created a fresh members row for Person A (no FK failure creating households/members)');

    const alreadyA = firstRow(
      exec(
        `SELECT 1 AS n FROM class_enrollments WHERE class_id = ${sqlLiteral(classId)} AND member_id = ${sqlLiteral(memberA.memberId)} LIMIT 1`,
      ),
    );
    assert(!alreadyA, 'Person A was not already enrolled');

    const enrollmentAId = randomUUID();
    exec(
      [
        // memberA.creationStatements folds ensureMember's own household/member/primary batch in
        // here (this file's own header): the class_enrollments row below is FK-checked against
        // that same member row, so both must land in one wrangler call, not two.
        ...memberA.creationStatements,
        `INSERT INTO class_enrollments (id, class_id, member_id) VALUES (${sqlLiteral(enrollmentAId)}, ${sqlLiteral(classId)}, ${sqlLiteral(memberA.memberId)})`,
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ('public:signup', 'enroll', 'enrollment', ${sqlLiteral(enrollmentAId)}, ${sqlLiteral(`class=${classId}`)})`,
        `INSERT INTO waiver_acceptances (id, person_name, person_email, context, waiver_version) VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(personA.name)}, ${sqlLiteral(personA.email)}, 'class-signup', '2026-01')`,
      ].join(';\n'),
    );
    const enrolledCount = firstRow(exec(`SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ${sqlLiteral(classId)}`)).n;
    assert(enrolledCount === 1, `class_enrollments now has ${enrolledCount} row for Person A (a real FK-checked member_id write against the real D1 members table succeeded)`);

    // ---- signUpForClass, waitlist branch (enrollments.ts) ----
    console.log('\n--- signUpForClass: waitlist branch (Person B, the class is now full at capacity 1) ---');
    const personB = { name: 'Person B', email: 'person-b@example.com', phone: '+19075552222' };
    const alreadyWaitlistedB = firstRow(
      exec(`SELECT 1 AS n FROM class_waitlist WHERE class_id = ${sqlLiteral(classId)} AND applicant_email = ${sqlLiteral(personB.email)} LIMIT 1`),
    );
    assert(!alreadyWaitlistedB, 'Person B was not already on the waitlist');
    const nextPosition = firstRow(exec(`SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM class_waitlist WHERE class_id = ${sqlLiteral(classId)}`))
      .next_position;

    const waitlistId = randomUUID();
    exec(
      [
        `INSERT INTO class_waitlist (id, class_id, applicant_name, applicant_email, applicant_phone, position) VALUES (${sqlLiteral(waitlistId)}, ${sqlLiteral(classId)}, ${sqlLiteral(personB.name)}, ${sqlLiteral(personB.email)}, ${sqlLiteral(personB.phone)}, ${nextPosition})`,
        `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ('public:signup', 'waitlist', 'waitlist', ${sqlLiteral(waitlistId)}, ${sqlLiteral(`class=${classId} position=${nextPosition}`)})`,
        `INSERT INTO waiver_acceptances (id, person_name, person_email, context, waiver_version) VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(personB.name)}, ${sqlLiteral(personB.email)}, 'class-signup', '2026-01')`,
      ].join(';\n'),
    );
    const waitlistRow = firstRow(exec(`SELECT member_id FROM class_waitlist WHERE id = ${sqlLiteral(waitlistId)}`));
    assert(waitlistRow.member_id === null, 'class_waitlist.member_id is NULL for Person B (identified by applicant_email only, per the CHECK constraint, no member row minted for a waitlist join)');

    // ---- offerSpot (offers.ts): free a spot the way a real admin action would (capacity edit) ----
    console.log('\n--- offerSpot: an admin frees a spot (capacity 1 -> 2) and offers it to Person B ---');
    exec(`UPDATE classes SET capacity = 2, updated_at = datetime('now') WHERE id = ${sqlLiteral(classId)}`);

    const waitlistClassCheck = firstRow(exec(`SELECT class_id FROM class_waitlist WHERE id = ${sqlLiteral(waitlistId)}`));
    assert(waitlistClassCheck.class_id === classId, 'the waitlist entry belongs to this class');
    const activeOffer = firstRow(
      exec(`SELECT token AS token_hash FROM class_offers WHERE waitlist_id = ${sqlLiteral(waitlistId)} AND resolved IS NULL LIMIT 1`),
    );
    assert(!activeOffer, 'no active offer already exists for this waitlist entry');
    const offerWindowRow = firstRow(exec(`SELECT value FROM settings WHERE key = 'offer_window_hours'`));
    const offerWindowHours = offerWindowRow ? Number(offerWindowRow.value) : 72;

    const plaintextToken = 'scratch-proof-token';
    const tokenHash = await hashOfferToken(plaintextToken);
    const offerExpiresAt = toSqliteDatetime(new Date(Date.now() + offerWindowHours * 60 * 60 * 1000));
    exec(
      `INSERT INTO class_offers (token, waitlist_id, class_id, offered_by, expires_at) VALUES (${sqlLiteral(tokenHash)}, ${sqlLiteral(waitlistId)}, ${sqlLiteral(classId)}, 'admin@example.com', ${sqlLiteral(offerExpiresAt)})`,
    );
    const offerRow = firstRow(exec(`SELECT resolved FROM class_offers WHERE token = ${sqlLiteral(tokenHash)}`));
    assert(offerRow && offerRow.resolved === null, 'the offer was minted, unresolved, only its hash stored');

    // ---- claimOffer (offers.ts): consume the offer and enroll Person B via ensureMember ----
    console.log('\n--- claimOffer: Person B claims the offer ---');
    const now = toSqliteDatetime(new Date());
    const consume = exec(
      `UPDATE class_offers SET resolved = 'claimed', resolved_at = ${sqlLiteral(now)} WHERE token = ${sqlLiteral(tokenHash)} AND resolved IS NULL AND expires_at > ${sqlLiteral(now)}`,
    );
    assert((consume[0]?.meta?.changes ?? 0) === 1, 'the atomic consume UPDATE affected exactly one row');

    const claimedWaitlistRow = firstRow(
      exec(`SELECT id, applicant_name, applicant_email, applicant_phone, member_id FROM class_waitlist WHERE id = ${sqlLiteral(waitlistId)} LIMIT 1`),
    );
    let claimMemberId = claimedWaitlistRow.member_id;
    let claimCreationStatements = [];
    if (!claimMemberId && claimedWaitlistRow.applicant_email) {
      const member = await ensureMember(
        claimedWaitlistRow.applicant_name ?? claimedWaitlistRow.applicant_email,
        claimedWaitlistRow.applicant_email,
        claimedWaitlistRow.applicant_phone,
      );
      claimMemberId = member.memberId;
      claimCreationStatements = member.creationStatements;
      assert(member.created, 'ensureMember minted a real member for Person B on claim (first time seen)');
    }

    const enrollmentBId = randomUUID();
    exec(
      [
        // Folds ensureMember's own creation batch in (this file's own header): the enrollment
        // insert below is FK-checked against the SAME member row just minted for Person B.
        ...claimCreationStatements,
        `INSERT INTO class_enrollments (id, class_id, member_id) VALUES (${sqlLiteral(enrollmentBId)}, ${sqlLiteral(classId)}, ${sqlLiteral(claimMemberId)})`,
        `DELETE FROM class_waitlist WHERE id = ${sqlLiteral(waitlistId)}`,
      ].join(';\n'),
    );
    exec(
      `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ('public:claim', 'claim', 'offer', ${sqlLiteral(waitlistId)}, ${sqlLiteral(`class=${classId}`)})`,
    );

    const finalEnrolledCount = firstRow(exec(`SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ${sqlLiteral(classId)}`)).n;
    const finalWaitlistCount = firstRow(exec(`SELECT COUNT(*) AS n FROM class_waitlist WHERE class_id = ${sqlLiteral(classId)}`)).n;
    assert(finalEnrolledCount === 2, `class_enrollments now has ${finalEnrolledCount} rows (Person A + Person B, both real FK-checked member_id writes)`);
    assert(finalWaitlistCount === 0, 'class_waitlist is empty (the claimed row was removed)');

    // ---- The negative case, once more through the same scratch DB, for completeness ----
    // Calls `wrangler` directly, not `exec()`: a bogus id can never resolve, so `exec()`'s own
    // retry-on-FK-failure would just burn `FK_RETRY_LIMIT` attempts before giving up on a result
    // that was never going to change.
    console.log('\n--- a bogus member_id still fails the FK (migration 0005 is what makes this ' +
      'refusal possible at all: pre-0005, the same insert failed with "no such table: ' +
      'main.members" instead, the finding this whole pass fixes) ---');
    let bogusFailed = false;
    try {
      wrangler([
        'd1',
        'execute',
        DB_NAME,
        '--remote',
        '--command',
        `INSERT INTO class_enrollments (id, class_id, member_id) VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(classId)}, 'no-such-member-id')`,
        '--json',
      ]);
    } catch (err) {
      bogusFailed = /FOREIGN KEY constraint failed/.test(String(err.stdout ?? err.message ?? err));
    }
    assert(bogusFailed, 'a bogus member_id was refused with a FOREIGN KEY constraint failure, not silently accepted');

    console.log('\nreal-d1-write-path: all assertions passed.');
  } finally {
    if (KEEP) {
      console.log(`\n--keep set: leaving ${DB_NAME} in place. Delete manually with:`);
      console.log(`  npx wrangler d1 delete ${DB_NAME} -y`);
    } else {
      console.log(`\nDeleting scratch database ${DB_NAME}`);
      wrangler(['d1', 'delete', DB_NAME, '-y']);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
