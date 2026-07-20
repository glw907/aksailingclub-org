// asc-club member auth: the member portal landing's own household-standing derivation (pass
// 2.2's portal, Part 3's "signed-in landing" — this task keeps the landing auth-focused and
// defers the full task-list/receipts composition to a later pass; only the standing card's own
// data derives here). A MEMBERSHIP is the household's per-season purchase
// (0005_member_domain's own header): standing is a HOUSEHOLD fact every member of it shares.
//
// The three-state vocabulary (Members pass T2, docs/2026-07-20-members-pass-design.md "Standing
// vocabulary and the data tier", superseding this module's own original current/grace/lapsed
// design): Current through the household's own rolling `paid_at` plus one year
// (`renewalExpiryFrom`, Geoff's 2026-07-07 rolling-renewal ruling — never a season boundary),
// Overdue past that boundary while the reminder sequence is still running (FULL member benefits,
// exactly like Current), Former once the sequence's own stated-final `30_after` touch has passed
// unpaid. Former is RECORDED, not re-derived from a time window on every read: migration
// `0033_member_standing` adds `households.former_at`/`former_source`, the daily
// renewal-reminders sweep (`src/jobs/renewal-reminders.ts`) writes it once a household crosses
// the boundary, and {@link classifyHouseholdStanding} — the one exported classifier every
// consumer calls — reads that recorded fact rather than re-computing a grace window. A household
// whose `paid_at` has since advanced past its own `former_at` (a renewal) reads Current/Overdue
// again automatically, with no explicit "clear" write required on the payment path itself; the
// sweep also opportunistically clears a now-stale sequence-sourced marker (see
// {@link clearSequenceFormer}), so the stored column stays eventually accurate too.
//
// The prior grace-window vocabulary and its per-club-configurable settings row retired fully in
// T2/T3: no reader of either survives anywhere in this codebase. A household's terminal state is
// Former, a recorded fact, never a re-derived elapsed-time window.
import type { D1Database } from '@cloudflare/workers-types';
import { toSqliteDatetime } from './crypto';
import { formatMemberDate, parseMemberDate } from './format';

// REFUND-AWARE (migration 0023, docs/plans/2026-07-14-membership-admin.md Task 2): every
// membership lookup in this module carries AND refunded_at IS NULL, so a refunded row reads as
// though it never existed for standing purposes (ruling 4 in the design doc: refunds mark, never
// delete, so the row itself stays for history; only its effect on standing disappears). The
// household-keyed entry point below, getHouseholdStanding, is what the admin's Members list and
// the class/join doors' gate share alongside the member-keyed getMemberStanding, so the admin and
// the public doors can never disagree about who is current.

/** The three membership tiers, matching the ratified schema's own `memberships.tier` CHECK
 *  constraint (`migrations/asc-club/0005_member_domain/forward.sql`). */
export type MembershipTier = 'individual' | 'family' | 'young-adult';

/** Display labels for the three tiers, for a landing page's own "Individual membership" line. */
export const MEMBERSHIP_TIER_LABEL: Record<MembershipTier, string> = {
  individual: 'Individual',
  family: 'Family',
  'young-adult': 'Young Adult',
};

/** A member-facing renewal standing: `'current'` through the household's own paid boundary,
 *  `'overdue'` past it while still a full member, `'former'` once the reminder sequence's own
 *  stated-final touch has passed unpaid (Members pass T2; replaces the retired
 *  current/grace/lapsed vocabulary). Overdue and Current carry identical member benefits
 *  everywhere in this codebase; only Former excludes. */
export type MemberStandingStatus = 'current' | 'overdue' | 'former';

/** A household-keyed renewal standing: {@link MemberStandingStatus}'s three states, plus
 *  `'none'` for a household that has never had a non-refunded paid `memberships` row at all — a
 *  state {@link getMemberStanding} folds into its own `'former'` for a member-facing landing
 *  (this module's own long-standing "no membership on file" convention), but the admin's Members
 *  list needs distinct from a household that was once a member and lapsed. */
export type HouseholdStandingStatus = MemberStandingStatus | 'none';

export interface MemberStanding {
  memberId: string;
  memberName: string;
  householdId: string;
  householdName: string;
  status: MemberStandingStatus;
  /** The most recently paid membership row's tier, or `null` if the household has never had one. */
  tier: MembershipTier | null;
  /** The grounding row's own `season` label (the period a renewal or the import assigned it):
   *  display only, never used to derive a date (see this module's own header). `null` alongside
   *  `tier` when there is no paid row at all. */
  season: number | null;
  /** `paid_at` plus one year, SQLite-datetime shaped (`toSqliteDatetime`'s own format); `null`
   *  when there is no paid row to derive from. */
  expiresOn: string | null;
  /** The plain-words line the standing card leads with (design doc's own "The standing card"
   *  section), e.g. "You're current through July 7, 2027." or "Your membership lapsed July 7,
   *  2026 · renew by August 6, 2026 to avoid a gap." */
  statusLine: string;
}

interface MemberBaseRow {
  id: string;
  household_id: string;
  name: string;
}

interface HouseholdRow {
  name: string;
}

interface PaidMembershipRow {
  tier: MembershipTier;
  season: number;
  paid_at: string;
  price_paid: number;
}

interface HouseholdFormerRow {
  former_at: string | null;
  former_source: 'sequence' | 'manual' | null;
}

export interface HouseholdStanding {
  status: HouseholdStandingStatus;
  /** The grounding row's own `season` label, display only; `null` when `status` is `'none'`. */
  lastSeason: number | null;
  /** The grounding row's tier; `null` when `status` is `'none'`. */
  tier: MembershipTier | null;
  /** The grounding row's `price_paid` snapshot (dollars), honestly reflecting a comp ($0) or a
   *  discount off the settings price; `null` when `status` is `'none'`. */
  pricePaid: number | null;
  /** The grounding row's `paid_at`, raw (not the derived expiry); `null` when `status` is `'none'`. */
  paidAt: string | null;
  /** `households.former_at`, raw: when this household most recently transitioned to Former, or
   *  `null` if it never has (or a later payment has since superseded that marking — see this
   *  module's own header on why a stale `former_at` does not itself force `status: 'former'`). */
  formerAt: string | null;
  /** `households.former_source`: `'sequence'` (the daily sweep) or `'manual'` (the household
   *  desk's own override, T3); `null` alongside `formerAt`. */
  formerSource: 'sequence' | 'manual' | null;
}

/** `date`, one calendar year later (same month and day; JS `Date`'s own rollover handles a Feb 29
 *  boundary, not specially guarded here since no membership pricing or policy hinges on that
 *  single day). */
function plusOneYear(date: Date): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface StandingWindow {
  status: 'current' | 'overdue';
  expiry: Date;
}

/**
 * The current/overdue split off a raw `paid_at` value alone — no grace window, no database
 * access, so a batch reader (the directory's own listing rule, `member-portal/lib/directory.ts`'s
 * `listDirectory`) can derive this half of a household's standing from a single already-loaded
 * `paid_at`. This is NOT the full standing classification: a caller must still combine this with
 * the household's own `former_at` via {@link classifyHouseholdStanding} to know whether it has
 * actually transitioned to Former, since that transition is recorded, not re-derived here (this
 * module's own header on why).
 */
export function standingWindowFromPaidAt(paidAt: string, now: Date): StandingWindow {
  const expiry = plusOneYear(parseMemberDate(paidAt));
  const status: 'current' | 'overdue' = now <= expiry ? 'current' : 'overdue';
  return { status, expiry };
}

/**
 * A household's renewal boundary, one calendar year past its most recently paid `memberships`
 * row's `paid_at`: the same math {@link getMemberStanding} derives `expiresOn` from, exported so
 * the renewal-reminder job (`src/jobs/renewal-reminders.ts`) can compute it directly off a batch
 * of household rows without re-deriving the date parsing or paying a per-household
 * `getMemberStanding` lookup (which needs a `memberId`, not a bare `paid_at`) it has no other use
 * for.
 */
export function renewalExpiryFrom(paidAt: string): Date {
  return plusOneYear(parseMemberDate(paidAt));
}

/** How many days past a household's own renewal boundary the reminder sequence's stated-final
 *  touch (`renewal-reminders.ts`'s own `TOUCH_OFFSET_DAYS['30_after']`) fires: this module's own
 *  Former-transition boundary, kept as one exported constant so the two modules stay in lockstep
 *  by construction rather than by two authors remembering to keep two numbers equal. */
export const FORMER_SEQUENCE_DAYS = 30;

/** A household's own Former boundary: {@link renewalExpiryFrom} plus {@link FORMER_SEQUENCE_DAYS}
 *  days — the point the daily reminder-sequence sweep marks it Former if still unpaid. Also used
 *  by {@link getMemberStanding}'s own "renew by" statusLine wording for an Overdue household,
 *  since it is still the real date the sequence will mark them Former if they do not renew before
 *  then, even though that marking itself only actually happens via the recorded sweep write. */
export function formerBoundaryFrom(paidAt: string): Date {
  return plusDays(renewalExpiryFrom(paidAt), FORMER_SEQUENCE_DAYS);
}

/**
 * The one exported classifier every consumer calls (Members pass T2's own "single exported
 * classifier" requirement): `paidAt` is the household's own most recently paid, non-refunded
 * `memberships` row's `paid_at` (`null` if it has never had one); `formerAt` is the household's
 * raw `households.former_at` (`null` if never marked, or marked and since superseded).
 *
 * A recorded `formerAt` only holds while no payment has happened since it was written: if
 * `paidAt` is newer than `formerAt` (a renewal after the marking), this reads Current/Overdue off
 * the NEW `paidAt` instead, the same "payment clears Former" behavior a caller gets automatically
 * without needing to explicitly clear the column on the payment path itself (this module's own
 * header). `paidAt === null` with `formerAt` set still reads `'former'` (a manual override with
 * no paid history at all is a real, if rare, edge case the household desk's own T3 action can
 * produce).
 */
export function classifyHouseholdStanding(paidAt: string | null, formerAt: string | null, now: Date): HouseholdStandingStatus {
  if (formerAt !== null) {
    const supersededByNewerPayment = paidAt !== null && parseMemberDate(paidAt).getTime() > parseMemberDate(formerAt).getTime();
    if (!supersededByNewerPayment) return 'former';
  }
  if (paidAt === null) return 'none';
  return standingWindowFromPaidAt(paidAt, now).status;
}

/** Marks a household Former, recording `former_at` (now) and `source` — `'sequence'` from the
 *  daily renewal-reminders sweep, `'manual'` from the household desk's own override (T3).
 *  Idempotent via `former_at IS NULL`: a household already marked (by either source) is left
 *  untouched, so a manual mark is never silently overwritten by a same-day sequence tick, and a
 *  re-run sequence tick never rewrites an already-recorded timestamp. Returns whether this call
 *  actually wrote the row, so a caller like the sweep can report an accurate "households
 *  transitioned" count without a second read. */
export async function markHouseholdFormer(db: D1Database, householdId: string, source: 'sequence' | 'manual'): Promise<boolean> {
  const result = await db
    .prepare("UPDATE households SET former_at = datetime('now'), former_source = ?2 WHERE id = ?1 AND former_at IS NULL")
    .bind(householdId, source)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** The daily sweep's own auto-heal: clears a household's Former marker ONLY when it was
 *  `'sequence'`-sourced, so a renewal that moves the boundary back into the future is reflected
 *  in the stored column within one business day, without ever touching a `'manual'`-sourced
 *  marker (which only {@link clearManualFormer} undoes). {@link classifyHouseholdStanding} already
 *  reads a superseded `former_at` correctly on every live lookup regardless of whether this has
 *  run yet — this exists to keep the stored column itself eventually accurate for a caller that
 *  queries `households` directly rather than through the classifier. Returns whether it actually
 *  cleared anything. */
export async function clearSequenceFormer(db: D1Database, householdId: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE households SET former_at = NULL, former_source = NULL WHERE id = ?1 AND former_source = 'sequence'")
    .bind(householdId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** The household desk's own manual clear (T3): unlike {@link clearSequenceFormer}, clears
 *  regardless of source, since an operator's own "they're renewing, unmark it" call overrides
 *  either origin. Returns whether it actually cleared anything. */
export async function clearManualFormer(db: D1Database, householdId: string): Promise<boolean> {
  const result = await db
    .prepare('UPDATE households SET former_at = NULL, former_source = NULL WHERE id = ?1 AND former_at IS NOT NULL')
    .bind(householdId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * A household's renewal standing, keyed directly by `householdId` (no member lookup):
 * {@link classifyHouseholdStanding} combines its grounding `memberships` row (the most recently
 * paid, non-refunded one) with its own `former_at`/`former_source`. Every membership query in
 * this module, this one included, carries `AND refunded_at IS NULL`: a refunded row never
 * grounds a household's standing, so a household whose only paid row for the current season was
 * refunded reads `'former'` (against an older non-refunded row, if marked) or `'none'` (if it has
 * no other paid row and was never marked), never `'current'`.
 */
export async function getHouseholdStanding(db: D1Database, householdId: string): Promise<HouseholdStanding> {
  const [paidRow, formerRow] = await Promise.all([
    db
      .prepare(
        'SELECT tier, season, paid_at, price_paid FROM memberships WHERE household_id = ?1 AND paid_at IS NOT NULL AND refunded_at IS NULL ORDER BY paid_at DESC LIMIT 1',
      )
      .bind(householdId)
      .first<PaidMembershipRow>(),
    db.prepare('SELECT former_at, former_source FROM households WHERE id = ?1').bind(householdId).first<HouseholdFormerRow>(),
  ]);

  const formerAt = formerRow?.former_at ?? null;
  const formerSource = formerRow?.former_source ?? null;
  const status = classifyHouseholdStanding(paidRow?.paid_at ?? null, formerAt, new Date());

  if (!paidRow) {
    return { status, lastSeason: null, tier: null, pricePaid: null, paidAt: null, formerAt, formerSource };
  }

  return {
    status,
    lastSeason: paidRow.season,
    tier: paidRow.tier,
    pricePaid: paidRow.price_paid,
    paidAt: paidRow.paid_at,
    formerAt,
    formerSource,
  };
}

/**
 * A household's renewal standing, read through one of its members (`memberId`). Resolves the
 * member's household, then that household's full standing via {@link getHouseholdStanding}, and
 * derives `expiresOn`/`statusLine` from its grounding `paid_at`. Returns `null` only when
 * `memberId` itself does not resolve to a real `members` row; a member whose household has never
 * had a single paid membership row still resolves, with `status: 'former'`,
 * `tier`/`season`/`expiresOn` all `null`, and a neutral status line (this module's own long-
 * standing "no membership on file" fold, renamed from the retired `'lapsed'`).
 */
export async function getMemberStanding(db: D1Database, memberId: string): Promise<MemberStanding | null> {
  const member = await db
    .prepare('SELECT id, household_id, name FROM members WHERE id = ?1 LIMIT 1')
    .bind(memberId)
    .first<MemberBaseRow>();
  if (!member) return null;

  const household = await db
    .prepare('SELECT name FROM households WHERE id = ?1 LIMIT 1')
    .bind(member.household_id)
    .first<HouseholdRow>();
  const householdName = household?.name ?? member.name;

  const standing = await getHouseholdStanding(db, member.household_id);

  if (standing.status === 'none' || standing.paidAt === null) {
    return {
      memberId: member.id,
      memberName: member.name,
      householdId: member.household_id,
      householdName,
      status: 'former',
      tier: null,
      season: null,
      expiresOn: null,
      statusLine: 'No membership on file yet.',
    };
  }

  const { status, paidAt } = standing;
  const expiry = renewalExpiryFrom(paidAt);
  // A full plain-words sentence (the design doc's own quoted example, "You're current through
  // May 17, 2027."; mock D renders the identical string), not the bare "Current through {date}"
  // fragment this used to read: the masthead's greeting directly above it ("Welcome back,
  // {firstName}.") is already a complete sentence, and this line is the page's single most
  // important one. Overdue keeps the same "renew by" nudge the prior grace-window vocabulary
  // carried (the sequence's own Former boundary, {@link formerBoundaryFrom}) — still the real date the
  // sweep marks Former if unpaid, even though the marking itself happens via the recorded write,
  // not by re-deriving this date on a later read.
  const statusLine =
    status === 'current'
      ? `You're current through ${formatMemberDate(expiry)}.`
      : status === 'overdue'
        ? `Your membership lapsed ${formatMemberDate(expiry)} · renew by ${formatMemberDate(formerBoundaryFrom(paidAt))} to avoid a gap.`
        : `Your membership lapsed ${formatMemberDate(expiry)}.`;

  return {
    memberId: member.id,
    memberName: member.name,
    householdId: member.household_id,
    householdName,
    status,
    tier: standing.tier,
    season: standing.lastSeason,
    expiresOn: toSqliteDatetime(expiry),
    statusLine,
  };
}
