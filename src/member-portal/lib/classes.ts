// The portal's own class actions (design doc's "2. Classes"): register (with the who's-taking-it
// selector and automatic credit redemption), my-classes, withdraw (the reversing-credit,
// freed-spot-aware, auto-offering symmetry the design doc names), and waitlist join/leave. Built
// entirely on `$admin-club/lib/{classes-store,offers,people}` and this tree's own `age-gate.ts`/
// `credits.ts`, never a second copy of any of their logic — the portal's own contribution is
// composing them behind a signed-in member's own identity, where the public routes
// (`enrollments.ts`, `offers.ts`) instead resolve identity from a raw email or a bearer token.
import type { D1Database } from '@cloudflare/workers-types';
import { getClassWithCounts, isPubliclyOpen, type ClassTrack } from '$admin-club/lib/classes-store';
import { hasActiveOfferForClass, offerSpot } from '$admin-club/lib/offers';
import { sendClubEmail, type EmailBindingEnv } from '$admin-club/lib/club-email';
import { eligibilityForTrack } from './age-gate';
import { findRedemptionForEnrollment, getCreditBalance, redeemCreditForEnrollment, reverseCreditForWithdrawal } from './credits';

/** A user-facing refusal, matching every other portal module's `{ error }` shape. */
export interface ClassActionError {
  error: string;
}

/** One household member as the "who's taking this class?" selector reads them: the design doc's
 *  own age-gate-by-track, computed fresh against `track` (never a stored eligibility flag). */
export interface EnrolleeOption {
  memberId: string;
  name: string;
  eligible: boolean;
  needsBirthdate: boolean;
}

/** Every non-archived household member, with their eligibility for `track` already computed
 *  (the selector's own read; ineligible members still list, greyed by the caller, not filtered
 *  out here, so a parent can see WHY a child doesn't show as selectable). */
export async function listEnrolleeOptions(db: D1Database, householdId: string, track: ClassTrack): Promise<EnrolleeOption[]> {
  const { results } = await db
    .prepare('SELECT id, name, birthdate FROM members WHERE household_id = ?1 AND archived_at IS NULL ORDER BY name')
    .bind(householdId)
    .all<{ id: string; name: string; birthdate: string | null }>();
  return results.map((row) => {
    const eligibility = eligibilityForTrack(row.birthdate, track);
    return {
      memberId: row.id,
      name: row.name,
      eligible: eligibility.eligible,
      needsBirthdate: !eligibility.eligible && 'needsBirthdate' in eligibility && eligibility.needsBirthdate,
    };
  });
}

/** One "my classes" row: the enrollment plus enough of the class's own detail to render it. */
export interface MyClassRow {
  enrollmentId: string;
  classId: string;
  className: string;
  memberId: string;
  memberName: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  feePaid: boolean;
  creditRedeemed: boolean;
}

/** Every enrollment held by any member of `householdId`, soonest class first. */
export async function listMyClasses(db: D1Database, householdId: string): Promise<MyClassRow[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id AS enrollment_id, c.id AS class_id, c.name AS class_name, m.id AS member_id, m.name AS member_name,
              c.start_date, c.end_date, c.location, e.fee_paid,
              (SELECT 1 FROM credit_redemptions r WHERE r.enrollment_id = e.id) AS has_redemption
       FROM class_enrollments e
       JOIN classes c ON c.id = e.class_id
       JOIN members m ON m.id = e.member_id
       WHERE m.household_id = ?1
       ORDER BY c.start_date IS NULL, c.start_date ASC`,
    )
    .bind(householdId)
    .all<{
      enrollment_id: string;
      class_id: string;
      class_name: string;
      member_id: string;
      member_name: string;
      start_date: string | null;
      end_date: string | null;
      location: string | null;
      fee_paid: 0 | 1;
      has_redemption: 1 | null;
    }>();
  return results.map((r) => ({
    enrollmentId: r.enrollment_id,
    classId: r.class_id,
    className: r.class_name,
    memberId: r.member_id,
    memberName: r.member_name,
    startDate: r.start_date,
    endDate: r.end_date,
    location: r.location,
    feePaid: r.fee_paid === 1,
    creditRedeemed: r.has_redemption === 1,
  }));
}

/** One "my waitlist" row: position, the queue's own honest length, and a live offer's expiry
 *  when one is outstanding (the design doc's own "each queue's honest length" and "live offer
 *  display with claim/pass"). */
export interface MyWaitlistRow {
  waitlistId: string;
  classId: string;
  className: string;
  position: number;
  queueLength: number;
  offer: { expiresAt: string } | null;
}

/** Every waitlist entry held by any member of `householdId`. */
export async function listMyWaitlistEntries(db: D1Database, householdId: string): Promise<MyWaitlistRow[]> {
  const { results } = await db
    .prepare(
      `SELECT w.id AS waitlist_id, c.id AS class_id, c.name AS class_name, w.position,
              (SELECT COUNT(*) FROM class_waitlist w2 WHERE w2.class_id = w.class_id) AS queue_length,
              (SELECT o.expires_at FROM class_offers o WHERE o.waitlist_id = w.id AND o.resolved IS NULL AND o.expires_at > datetime('now') LIMIT 1) AS offer_expires_at
       FROM class_waitlist w
       JOIN classes c ON c.id = w.class_id
       WHERE w.member_id IN (SELECT id FROM members WHERE household_id = ?1)
       ORDER BY w.position ASC`,
    )
    .bind(householdId)
    .all<{ waitlist_id: string; class_id: string; class_name: string; position: number; queue_length: number; offer_expires_at: string | null }>();
  return results.map((r) => ({
    waitlistId: r.waitlist_id,
    classId: r.class_id,
    className: r.class_name,
    position: r.position,
    queueLength: r.queue_length,
    offer: r.offer_expires_at ? { expiresAt: r.offer_expires_at } : null,
  }));
}

/**
 * Register a household member for a class from the portal: enrolls if the class is publicly open
 * (the freed-spot rule, `classes-store.ts`'s `isPubliclyOpen` — the portal never lets a signed-in
 * member queue-jump a live waitlist or offer any more than a stranger could), otherwise refuses
 * with a "join the waitlist instead" message (the caller's own `?/joinWaitlist` action is the
 * follow-up, not this function). A positive household credit balance is auto-applied and reported
 * back (`creditApplied`), matching the design doc's own "credit auto-applied and visible."
 */
export async function registerForClass(
  db: D1Database,
  args: { classId: string; memberId: string; householdId: string; actorMemberId: string },
): Promise<{ enrollmentId: string; creditApplied: boolean; feeDue: number } | ClassActionError> {
  const cls = await getClassWithCounts(db, args.classId);
  if (!cls || !cls.visible) return { error: 'This class is not open for signup.' };
  const hasActiveOffer = await hasActiveOfferForClass(db, args.classId);
  if (!isPubliclyOpen(cls, hasActiveOffer)) {
    return { error: 'This class is full. Join the waitlist and we\'ll email you if a spot opens.' };
  }

  const already = await db
    .prepare('SELECT 1 AS n FROM class_enrollments WHERE class_id = ?1 AND member_id = ?2 LIMIT 1')
    .bind(args.classId, args.memberId)
    .first<{ n: number }>();
  if (already) return { error: 'Already enrolled in this class.' };

  const balance = await getCreditBalance(db, args.householdId);
  const creditApplied = cls.fee > 0 && balance > 0;
  const enrollmentId = crypto.randomUUID();

  try {
    await db
      .prepare('INSERT INTO class_enrollments (id, class_id, member_id, fee_paid) VALUES (?1, ?2, ?3, ?4)')
      .bind(enrollmentId, args.classId, args.memberId, creditApplied ? 1 : 0)
      .run();
  } catch (err) {
    console.error('member-portal: portal class registration failed', err);
    return { error: 'Something went wrong registering for this class. Please try again.' };
  }

  if (creditApplied) {
    await redeemCreditForEnrollment(db, { householdId: args.householdId, enrollmentId, redeemedBy: args.actorMemberId });
  }

  return { enrollmentId, creditApplied, feeDue: creditApplied ? 0 : cls.fee };
}

/** Join the waitlist for a class from the portal (the design doc's own "waitlist join"). Refuses
 *  a repeat join, matching the public path's own `enrollments.ts` refusal. */
export async function joinWaitlist(db: D1Database, args: { classId: string; memberId: string }): Promise<{ waitlistId: string; position: number } | ClassActionError> {
  const cls = await getClassWithCounts(db, args.classId);
  if (!cls || !cls.visible) return { error: 'This class is not open for signup.' };

  const already = await db
    .prepare('SELECT 1 AS n FROM class_waitlist WHERE class_id = ?1 AND member_id = ?2 LIMIT 1')
    .bind(args.classId, args.memberId)
    .first<{ n: number }>();
  if (already) return { error: 'Already on the waitlist for this class.' };

  const positionRow = await db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM class_waitlist WHERE class_id = ?1')
    .bind(args.classId)
    .first<{ next_position: number }>();
  const position = positionRow?.next_position ?? 1;
  const waitlistId = crypto.randomUUID();
  await db
    .prepare('INSERT INTO class_waitlist (id, class_id, member_id, position) VALUES (?1, ?2, ?3, ?4)')
    .bind(waitlistId, args.classId, args.memberId, position)
    .run();
  return { waitlistId, position };
}

/** Leave a waitlist from the portal (the symmetry rule's own "waitlist join implies leave"),
 *  gated by ownership: refuses (never silently no-ops) if `waitlistId` does not belong to any
 *  member of `householdId`, so one household can never remove another's queue position. */
export async function leaveWaitlist(db: D1Database, waitlistId: string, householdId: string): Promise<{ ok: true } | ClassActionError> {
  const row = await db
    .prepare('SELECT w.id FROM class_waitlist w JOIN members m ON m.id = w.member_id WHERE w.id = ?1 AND m.household_id = ?2')
    .bind(waitlistId, householdId)
    .first<{ id: string }>();
  if (!row) return { error: 'No such waitlist entry.' };
  await db.prepare('DELETE FROM class_waitlist WHERE id = ?1').bind(waitlistId).run();
  return { ok: true };
}

const PROGRAM_COMMITTEE_EMAIL = 'program-committee@aksailingclub.org';

/**
 * Withdraw from a class (the design doc's own "Withdraw" section): confirm-gated by the caller's
 * own route, this is the actual state change. Refuses an enrollment that isn't the acting
 * household's own. Frees the spot, reverses a redeemed credit (never deleting the original
 * `credit_redemptions` row — `credits.ts`'s own header), then applies the freed-spot rule to
 * decide what happens next: an empty queue simply re-opens the class publicly (nothing further to
 * do); a nonempty queue auto-offers the spot to the FIRST waitlisted entry (`offerSpot`, the same
 * token-and-email machinery an admin's own offer uses) and sends one admin-notify email reporting
 * both the withdrawal and where the auto-offer went (the auto-email principle's own "same send,
 * same build" for this exact case). A `notify` bag is optional (mirrors `offerSpot`'s own): a
 * missing `EMAIL` binding degrades to no admin email, never to a failed withdrawal.
 */
export async function withdrawFromClass(
  db: D1Database,
  args: { enrollmentId: string; householdId: string; notify?: { env: EmailBindingEnv; origin: string } },
): Promise<{ ok: true; autoOfferedTo: string | null } | ClassActionError> {
  const enrollment = await db
    .prepare(
      `SELECT e.id, e.class_id, m.name AS member_name, m.household_id, c.name AS class_name
       FROM class_enrollments e JOIN members m ON m.id = e.member_id JOIN classes c ON c.id = e.class_id
       WHERE e.id = ?1`,
    )
    .bind(args.enrollmentId)
    .first<{ id: string; class_id: string; member_name: string; household_id: string; class_name: string }>();
  if (!enrollment || enrollment.household_id !== args.householdId) {
    return { error: 'No such enrollment.' };
  }

  const redemption = await findRedemptionForEnrollment(db, args.enrollmentId);
  await db.prepare('DELETE FROM class_enrollments WHERE id = ?1').bind(args.enrollmentId).run();
  if (redemption) {
    const reversed = await reverseCreditForWithdrawal(db, args.householdId);
    if (!reversed.ok) console.error('member-portal: withdrawal credit reversal failed', reversed.error);
  }

  // The freed-spot rule, re-checked after the drop: a nonempty queue gets the auto-offer: the
  // first waitlisted entry by position, matching the admin's own manual offer's own ordering
  // convention (`listWaitlist`'s `ORDER BY position ASC`).
  const nextInLine = await db
    .prepare('SELECT id FROM class_waitlist WHERE class_id = ?1 ORDER BY position ASC LIMIT 1')
    .bind(enrollment.class_id)
    .first<{ id: string }>();

  let autoOfferedTo: string | null = null;
  if (nextInLine) {
    const offer = await offerSpot(db, {
      classId: enrollment.class_id,
      waitlistId: nextInLine.id,
      actorEmail: 'system:auto-offer',
      notify: args.notify,
    });
    if ('token' in offer) autoOfferedTo = nextInLine.id;
    else console.error('member-portal: auto-offer after withdrawal failed', offer.error);
  }

  if (args.notify?.env.EMAIL) {
    const detail = autoOfferedTo
      ? `The freed spot was automatically offered to the next waitlisted entry.`
      : nextInLine
        ? `A waitlist entry exists but the auto-offer failed; check the class's own Offer control.`
        : `No one was waiting; the class is open to the public again.`;
    await sendClubEmail(db, args.notify.env, {
      to: PROGRAM_COMMITTEE_EMAIL,
      raw: {
        subject: `Class withdrawal: ${enrollment.class_name}`,
        body: `{{member_name}} withdrew from {{class_name}}.\n\n{{detail}}`,
      },
      vars: { member_name: enrollment.member_name, class_name: enrollment.class_name, detail },
    });
  }

  return { ok: true, autoOfferedTo };
}

/**
 * The admin's own class-drop action (this task's own scope item 6: "the admin class-drop
 * action"): the identical freed-spot-aware, reversing-credit, auto-offering withdrawal
 * `withdrawFromClass` performs for a member's own self-service withdrawal, reused rather than
 * duplicated — an admin needs no household-ownership gate (they may drop any enrollment), so this
 * resolves the enrollment's OWN real household id first, then delegates to `withdrawFromClass`
 * with that id, which trivially satisfies its own ownership check.
 */
export async function adminDropEnrollment(
  db: D1Database,
  args: { enrollmentId: string; notify?: { env: EmailBindingEnv; origin: string } },
): Promise<{ ok: true; autoOfferedTo: string | null } | ClassActionError> {
  const row = await db
    .prepare('SELECT m.household_id FROM class_enrollments e JOIN members m ON m.id = e.member_id WHERE e.id = ?1')
    .bind(args.enrollmentId)
    .first<{ household_id: string }>();
  if (!row) return { error: 'No such enrollment.' };
  return withdrawFromClass(db, { enrollmentId: args.enrollmentId, householdId: row.household_id, notify: args.notify });
}

/** One waitlist entry's own live offer, for the portal's claim/pass display (the design doc's
 *  own "live offer display with claim/pass"), resolved by waitlist id (the member is already
 *  authenticated, so the portal never needs the emailed bearer token the public claim route
 *  uses). `null` when there is none outstanding. */
export async function getLiveOfferForWaitlistEntry(db: D1Database, waitlistId: string): Promise<{ tokenHash: string; expiresAt: string } | null> {
  const row = await db
    .prepare("SELECT token AS token_hash, expires_at FROM class_offers WHERE waitlist_id = ?1 AND resolved IS NULL AND expires_at > datetime('now') LIMIT 1")
    .bind(waitlistId)
    .first<{ token_hash: string; expires_at: string }>();
  return row ? { tokenHash: row.token_hash, expiresAt: row.expires_at } : null;
}

/**
 * Claim an offer from the portal, by the owning waitlist entry's id rather than the emailed
 * bearer token: the member is already session-authenticated, so this re-derives the same
 * transition `offers.ts`'s own `claimOffer` performs (enroll, delete the waitlist row, mark the
 * offer claimed) but gated on `householdId` ownership instead of a token, and audits as
 * `member:<memberId>` rather than `'public:claim'` (a real signed-in actor, unlike a bare token
 * bearer). Refuses ownership mismatches, an unknown or already-resolved offer, and an expired one
 * (lazily marking it resolved the same way `offers.ts` does).
 */
export async function claimOfferFromPortal(db: D1Database, waitlistId: string, householdId: string): Promise<{ enrollmentId: string } | ClassActionError> {
  const waitlistRow = await db
    .prepare('SELECT w.id, w.class_id, w.member_id, m.household_id FROM class_waitlist w JOIN members m ON m.id = w.member_id WHERE w.id = ?1')
    .bind(waitlistId)
    .first<{ id: string; class_id: string; member_id: string; household_id: string }>();
  if (!waitlistRow || waitlistRow.household_id !== householdId) return { error: 'No such waitlist entry.' };

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const offerRow = await db
    .prepare('SELECT token, resolved, expires_at FROM class_offers WHERE waitlist_id = ?1 AND resolved IS NULL LIMIT 1')
    .bind(waitlistId)
    .first<{ token: string; resolved: string | null; expires_at: string }>();
  if (!offerRow) return { error: 'There is no offer to claim right now.' };
  if (offerRow.expires_at <= now) {
    await db.prepare("UPDATE class_offers SET resolved = 'expired', resolved_at = ?1 WHERE token = ?2").bind(now, offerRow.token).run();
    return { error: 'This offer has expired.' };
  }

  const consume = await db
    .prepare("UPDATE class_offers SET resolved = 'claimed', resolved_at = ?1 WHERE token = ?2 AND resolved IS NULL AND expires_at > ?1")
    .bind(now, offerRow.token)
    .run();
  if ((consume.meta.changes ?? 0) !== 1) return { error: 'This offer has already been used.' };

  const enrollmentId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare('INSERT INTO class_enrollments (id, class_id, member_id) VALUES (?1, ?2, ?3)').bind(enrollmentId, waitlistRow.class_id, waitlistRow.member_id),
      db.prepare('DELETE FROM class_waitlist WHERE id = ?1').bind(waitlistId),
      db
        .prepare('INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(`member:${waitlistRow.member_id}`, 'claim', 'offer', waitlistId, `class=${waitlistRow.class_id}`),
    ]);
  } catch (err) {
    console.error('member-portal: portal offer claim enrollment batch failed after a committed consume', err);
    return { error: 'Already enrolled in this class.' };
  }
  return { enrollmentId };
}

/** Pass on an offer from the portal ("pass this time", the design doc's own claim/pass control):
 *  the same resolution `offers.ts`'s own `declineOffer` performs, gated on `householdId`
 *  ownership instead of a token. */
export async function passOfferFromPortal(db: D1Database, waitlistId: string, householdId: string): Promise<{ ok: true } | ClassActionError> {
  const waitlistRow = await db
    .prepare('SELECT w.id, m.household_id FROM class_waitlist w JOIN members m ON m.id = w.member_id WHERE w.id = ?1')
    .bind(waitlistId)
    .first<{ id: string; household_id: string }>();
  if (!waitlistRow || waitlistRow.household_id !== householdId) return { error: 'No such waitlist entry.' };

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db
    .prepare("UPDATE class_offers SET resolved = 'declined', resolved_at = ?1 WHERE waitlist_id = ?2 AND resolved IS NULL")
    .bind(now, waitlistId)
    .run();
  await db
    .prepare('INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(`member:pass`, 'decline', 'offer', waitlistId, null)
    .run();
  return { ok: true };
}
