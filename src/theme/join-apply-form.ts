// The public join door's own schema and handler logic, factored out of `join-apply.remote.ts`
// (a `.remote.ts` file may only export remote functions) the same way `class-signup-form.ts`
// factors `handleClassSignup` out of `class-signup.remote.ts`. This is the one thin entry the
// design doc names ("The join flow"): it owns turnstile verification, the household-lookup
// pivots, and the checkout construction, and delegates every rule the engine already owns
// (validation, pricing, the write batch) to `$member-signup/lib`, never re-deriving them here.
import * as v from 'valibot';
import { invalid } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import { validateJoinInput } from '$member-signup/lib/validate.js';
import { computeJoinPricing } from '$member-signup/lib/pricing.js';
import { buildJoinStatements } from '$member-signup/lib/statements.js';
import type { JoinInput } from '$member-signup/lib/types.js';
import type { MembershipTier } from '$admin-club/lib/demo-members';
import { getClassWithCounts, isPubliclyOpen } from '$admin-club/lib/classes-store';
import { hasActiveOfferForClass } from '$admin-club/lib/offers';
import { getCurrentSeason, getTierPrices, getWaiverTextVersion } from '$admin-club/lib/club-settings';
import { MEMBERSHIP_TIER_LABEL } from '$member-auth/lib/standing';
import { createCheckout, CheckoutUnavailableError, type CreateCheckoutEnv, type CreateCheckoutResult } from '$admin-club/lib/payments';
import { verifyTurnstile } from './turnstile';

const memberSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty('Household member name is required.')),
  birthdate: v.optional(v.pipe(v.string(), v.trim()), ''),
  email: v.optional(v.pipe(v.string(), v.trim()), ''),
});

/** `MembershipTier`'s own three values, matching `classes-store.ts`'s own `CLASS_TRACKS`
 *  precedent for pairing a plain literal array (`v.picklist`'s input) with the type it must stay
 *  in lockstep with. */
const MEMBERSHIP_TIERS: readonly MembershipTier[] = ['individual', 'family', 'young-adult'];

export const joinApplySchema = v.object({
  tier: v.picklist(MEMBERSHIP_TIERS, 'Please choose a membership tier.'),
  purchaserName: v.pipe(v.string(), v.trim(), v.nonEmpty('Please enter your name.')),
  purchaserEmail: v.pipe(v.string(), v.trim(), v.email('Please enter a valid email address.')),
  purchaserPhone: v.optional(v.pipe(v.string(), v.trim()), ''),
  purchaserBirthdate: v.optional(v.pipe(v.string(), v.trim()), ''),
  /** Additional household members, family tier only (`validateJoinInput` rejects a non-empty
   *  array for the other two tiers; this schema never pre-empts that rule). */
  members: v.optional(v.array(memberSchema), []),
  /** One entry per roster slot (purchaser at `0`, `members[i]` at `i + 1`): `''` for "no class",
   *  or a class id. Kept index-aligned rather than a sparse pick list so the form's per-member
   *  class select can bind directly by roster position. */
  picks: v.optional(v.array(v.pipe(v.string(), v.trim())), []),
  waiverAccepted: v.optional(v.boolean(), false),
  // Injected by the Turnstile widget, not a rendered field.
  'cf-turnstile-response': v.optional(v.string(), ''),
});

export type JoinApplySubmission = v.InferOutput<typeof joinApplySchema>;

/** The welcome-back pivot: a purchaser email matching a household that has paid for a membership
 *  before (a real returning member, not an abandoned first join). No row is written; Task 5 owns
 *  rendering this outcome as the welcome-back flow. */
export interface JoinKnownEmailPivot {
  pivot: 'known-email';
}

export type JoinApplyResult = CreateCheckoutResult | JoinKnownEmailPivot;

interface JoinApplyEnv extends CreateCheckoutEnv {
  CLUB_DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

function toJoinInput(input: JoinApplySubmission): JoinInput {
  return {
    tier: input.tier,
    purchaser: {
      name: input.purchaserName,
      email: input.purchaserEmail,
      phone: input.purchaserPhone || undefined,
      birthdate: input.purchaserBirthdate || undefined,
    },
    members: input.members.map((member) => ({
      name: member.name,
      birthdate: member.birthdate || undefined,
      email: member.email || undefined,
    })),
    classPicks: input.picks
      .map((classId, memberIndex) => (classId ? { memberIndex, classId } : null))
      .filter((pick): pick is { memberIndex: number; classId: string } => pick !== null),
    waiverAccepted: input.waiverAccepted,
  };
}

/** Today as a calendar date in the club's own timezone, matching `class-schedule.remote.ts`'s own
 *  helper: a Worker's clock is UTC, and the young-adult age gate must read the same civil date a
 *  member would read locally. */
function anchorageTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Anchorage' }).format(new Date());
}

interface MemberLookupRow {
  id: string;
  household_id: string;
}

async function findMemberByEmail(db: D1Database, email: string): Promise<MemberLookupRow | null> {
  return db.prepare('SELECT id, household_id FROM members WHERE email = ?1 LIMIT 1').bind(email).first<MemberLookupRow>();
}

async function householdHasPaidMembership(db: D1Database, householdId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS found FROM memberships WHERE household_id = ?1 AND paid_at IS NOT NULL LIMIT 1')
    .bind(householdId)
    .first<{ found: number }>();
  return row !== null;
}

interface UnpaidMembershipRow {
  id: string;
}

async function findUnpaidMembershipForSeason(db: D1Database, householdId: string, season: number): Promise<UnpaidMembershipRow | null> {
  return db
    .prepare('SELECT id FROM memberships WHERE household_id = ?1 AND season = ?2 AND paid_at IS NULL LIMIT 1')
    .bind(householdId, season)
    .first<UnpaidMembershipRow>();
}

/**
 * Reuse an abandoned join's still-unpaid membership row (the design's own "duplicate protection":
 * a checkout abandoned after submit leaves the unpaid row in place, and a retry reuses it instead
 * of failing the `UNIQUE(household_id, season)` constraint). This path is reached only for a
 * household that has NEVER paid a membership (see {@link handleJoinApply}): a real returning
 * member instead answers the {@link JoinKnownEmailPivot} Task 5 owns. Class picks are not
 * re-processed here: the row's original enrollment/waitlist rows (if any) still stand from the
 * first attempt, and reconciling a changed roster against them is welcome-back's own job, not a
 * same-transaction retry's.
 */
async function retryUnpaidJoin(
  db: D1Database,
  env: JoinApplyEnv,
  origin: string,
  membershipId: string,
  purchaserMemberId: string,
  tier: MembershipTier,
): Promise<CreateCheckoutResult> {
  const prices = await getTierPrices(db);
  const duesCents = Math.round(prices[tier] * 100);
  const priceDollars = Math.round(duesCents / 100);

  await db.prepare('UPDATE memberships SET tier = ?1, price_paid = ?2 WHERE id = ?3').bind(tier, priceDollars, membershipId).run();
  await db
    .prepare('INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind('public:join', 'retry', 'membership', membershipId, `tier=${tier}`)
    .run();

  return createJoinCheckout(env, origin, {
    refId: membershipId,
    tier,
    duesCents,
    paidLines: [],
    enrollmentIds: [],
    coveredEnrollmentIds: [],
    purchaserMemberId,
  });
}

interface JoinCheckoutPlan {
  refId: string;
  tier: MembershipTier;
  duesCents: number;
  paidLines: Array<{ amountCents: number; name: string }>;
  enrollmentIds: string[];
  coveredEnrollmentIds: string[];
  purchaserMemberId: string;
}

async function createJoinCheckout(env: JoinApplyEnv, origin: string, plan: JoinCheckoutPlan): Promise<CreateCheckoutResult> {
  const tierLabel = MEMBERSHIP_TIER_LABEL[plan.tier];
  const lines = [{ amountCents: plan.duesCents, name: `${tierLabel} Membership dues` }, ...plan.paidLines];
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  try {
    return await createCheckout(env, {
      kind: 'join',
      refId: plan.refId,
      amountCents: totalCents,
      description: `${tierLabel} Membership`,
      origin,
      successPath: '/payment/confirmation/',
      cancelPath: '/join/apply/',
      lines,
      metadata: {
        enrollment_ids: plan.enrollmentIds.join(','),
        covered_enrollment_ids: plan.coveredEnrollmentIds.join(','),
        grant_credits: '1',
        purchaser_member_id: plan.purchaserMemberId,
      },
    });
  } catch (err) {
    if (err instanceof CheckoutUnavailableError) invalid(err.message);
    throw err;
  }
}

interface ClassFacts {
  name: string;
  fee: number;
  isFull: boolean;
}

/** Live class facts (name, fee, current fullness) for every distinct class id a submission
 *  picked, refusing the whole submission if any pick names an unknown or hidden class. */
async function loadPickedClassFacts(db: D1Database, classIds: string[]): Promise<Map<string, ClassFacts>> {
  const facts = new Map<string, ClassFacts>();
  for (const id of new Set(classIds)) {
    const cls = await getClassWithCounts(db, id);
    if (!cls || !cls.visible) invalid('One of the selected classes is no longer available.');
    const open = isPubliclyOpen(cls, await hasActiveOfferForClass(db, id));
    facts.set(id, { name: cls.name, fee: cls.fee, isFull: !open });
  }
  return facts;
}

/**
 * The public join door's own action (Task 3, `docs/2026-07-13-unified-signup-design.md`): reuses
 * `$member-signup/lib`'s engine for every rule and pricing decision, and owns only what is specific
 * to a live submission: turnstile, the household-lookup pivots (a real returning member answers
 * {@link JoinKnownEmailPivot}; an abandoned first join's own unpaid row is reused per
 * {@link retryUnpaidJoin}), the live class facts a submission's picks need, and the checkout
 * itself.
 */
export async function handleJoinApply(input: JoinApplySubmission, env: unknown, clientAddress: string, origin: string): Promise<JoinApplyResult> {
  const platformEnv = env as JoinApplyEnv | undefined;

  const secret = platformEnv?.TURNSTILE_SECRET_KEY;
  const token = input['cf-turnstile-response'];
  if (secret && !(await verifyTurnstile(token, clientAddress, secret))) {
    invalid('Spam check failed. Please try again.');
  }

  const db = platformEnv?.CLUB_DB;
  if (!db) invalid('Joining online is not available right now. You can email board@aksailingclub.org instead.');

  const joinInput = toJoinInput(input);
  const validation = validateJoinInput(joinInput, { today: anchorageTodayIso() });
  if (!validation.valid) invalid(...validation.errors);
  const validated = validation.normalized!;

  const known = await findMemberByEmail(db, validated.purchaser.email);
  if (known) {
    const hasPaid = await householdHasPaidMembership(db, known.household_id);
    if (hasPaid) return { pivot: 'known-email' };

    const season = await getCurrentSeason(db);
    const unpaid = await findUnpaidMembershipForSeason(db, known.household_id, season);
    if (unpaid) return retryUnpaidJoin(db, platformEnv!, origin, unpaid.id, known.id, validated.tier);

    // A member row with no membership row at all (paid or unpaid) yet: nothing to reuse or
    // welcome back into. Treated as a pivot rather than minting a second household for the same
    // email, which `members.email UNIQUE` would refuse anyway.
    return { pivot: 'known-email' };
  }

  const classFacts = await loadPickedClassFacts(
    db,
    validated.classPicks.map((pick) => pick.classId),
  );
  const fullClassIds = new Set([...classFacts.entries()].filter(([, facts]) => facts.isFull).map(([id]) => id));
  const nonFullPicks = validated.classPicks.filter((pick) => !fullClassIds.has(pick.classId));

  const prices = await getTierPrices(db);
  const classFees = new Map([...classFacts.entries()].map(([id, facts]) => [id, facts.fee]));
  const pricing = computeJoinPricing({ ...validated, classPicks: nonFullPicks }, prices, classFees);

  const season = await getCurrentSeason(db);
  const waiverVersion = await getWaiverTextVersion(db);
  const built = await buildJoinStatements(db, validated, pricing, { season, waiverVersion, fullClassIds });
  await db.batch(built.statements);

  const paidLines = pricing.paidPicks.map((pick) => {
    const classId = nonFullPicks[pick.pickIndex].classId;
    const name = classFacts.get(classId)?.name ?? 'Class';
    return { amountCents: pick.amountCents, name: `${name} class fee` };
  });
  const coveredEnrollmentIds = pricing.coveredPicks.map((pickIndex) => built.enrollmentIds[pickIndex]);

  return createJoinCheckout(platformEnv!, origin, {
    refId: built.membershipId,
    tier: validated.tier,
    duesCents: pricing.duesCents,
    paidLines,
    enrollmentIds: built.enrollmentIds,
    coveredEnrollmentIds,
    purchaserMemberId: built.purchaserMemberId,
  });
}
