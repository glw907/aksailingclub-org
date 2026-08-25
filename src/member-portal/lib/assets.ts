// The portal's own asset actions (design doc's "The assets section" and the adversarial review's
// symmetry-rule additions: cancel a pending request, release a held asset) plus the admin's own
// request-review inbox (this task's scope item 6, the signup queue's exact pattern applied to
// `asset_requests`, migration 0011_member_portal). Built on `$admin-club/lib/assets-store.ts`'s
// existing reads/writes (`assignAsset`, `releaseAssignment`, `addToWaitlist`, `listAssetTypes`)
// rather than a second copy of any of them; this module's own contribution is the small state
// machine in front of them (`asset_requests`) and the household-scoped reads the admin's
// household-agnostic store never needed.
import { assignAsset, addToWaitlist, listAssetTypes, releaseAssignment, type AssetTypeRow } from '$admin-club/lib/assets-store';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import type { EmailBindingEnv } from '$admin-club/lib/club-email';
import { sendAssetDecisionEmail, type AssetDecisionKind } from './asset-decision-notify';

/**
 * Fire the decision email for `requestId` best-effort (Assets substrate T5b): a failed or
 * unbound send never fails the admin action that already committed, matching `offers.ts`'s own
 * `try`/`catch`-around-`sendClubEmail` precedent. `sendAssetDecisionEmail` already degrades every
 * failure -- expected refusal or unexpected error mid-lookup -- to `{ ok: false }`, so this
 * `try`/`catch` is defense in depth, not a bridge over a gap.
 */
async function notifyDecision(
  db: D1Database,
  env: EmailBindingEnv,
  origin: string,
  args: { kind: Exclude<AssetDecisionKind, 'slot_opened'>; requestId: string; reason?: string },
): Promise<void> {
  try {
    if (args.kind === 'denied') {
      await sendAssetDecisionEmail(db, env, { kind: 'denied', requestId: args.requestId, origin, reason: args.reason ?? '' });
    } else {
      await sendAssetDecisionEmail(db, env, { kind: args.kind, requestId: args.requestId, origin });
    }
  } catch (err) {
    console.error('member-portal: asset decision email failed', err);
  }
}

/** A user-facing refusal, matching every other portal module's `{ error }` shape. */
export interface AssetActionError {
  error: string;
}

/** One of the household's own currently-held assets: the landing's "current assignments" (design
 *  doc's own "See current assets"). */
export interface HouseholdAssignmentRow {
  id: string;
  assetType: string;
  assetTypeName: string;
  description: string | null;
  paymentStanding: 'not-billed' | 'outstanding' | 'paid';
  /** The outstanding fee, in cents, when `paymentStanding === 'outstanding'`; `null` otherwise.
   *  This task's own portal pay door (`getPayableAssignmentFee`) re-verifies this amount against
   *  the database before ever building a Checkout Session, so this field is display-only. */
  feeCents: number | null;
  /** The asset type's own standing season fee (`asset_types.fee`, whole dollars), regardless of
   *  whether this particular assignment is billed yet. Deliberately NOT `feeCents`: that field is
   *  the outstanding PAYMENT amount and is `null` for most rows, while this is the type's list
   *  price, always present, and in dollars rather than cents -- the retention step on
   *  `/my-account/renew` shows it beside every held asset the way the tier picker shows a tier's
   *  own price, before any billing has happened. */
  feeDollars: number;
}

/** One of the household's own waitlist queue positions, with the queue's honest length (design
 *  doc's own "See the waitlists"). */
export interface HouseholdWaitlistRow {
  id: string;
  assetType: string;
  assetTypeName: string;
  position: number;
  queueLength: number;
}

/** One of the household's own asset requests, at any stage (pending review, awaiting payment,
 *  queued, assigned, denied, or cancelled): the classes/assets screens' and the landing's task
 *  list both read this. */
export interface HouseholdRequestRow {
  id: string;
  assetType: string;
  assetTypeName: string;
  kind: 'new' | 'retention';
  status: 'pending' | 'approved_awaiting_payment' | 'queued' | 'assigned' | 'denied' | 'cancelled';
  note: string | null;
  denyReason: string | null;
  fee: number;
  createdAt: string;
}

/** The household's currently-held assets, joined to the current season's own payment standing
 *  (mirrors `assets-store.ts`'s `listActiveAssignments`, scoped to one household's memberships
 *  rather than every household). */
export async function listHouseholdAssignments(db: D1Database, householdId: string, currentSeason: number): Promise<HouseholdAssignmentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT aa.id, aa.asset_type, at.name AS asset_type_name, aa.description, at.fee AS type_fee, ap.id AS payment_id, ap.paid_at, ap.amount AS fee_amount
       FROM asset_assignments aa
       JOIN asset_types at ON at.id = aa.asset_type
       JOIN memberships m ON m.id = aa.membership_id
       LEFT JOIN asset_payments ap ON ap.assignment_id = aa.id AND ap.season = ?2
       WHERE m.household_id = ?1 AND aa.status = 'active'
       ORDER BY at.sort_order`,
    )
    .bind(householdId, currentSeason)
    .all<{
      id: string;
      asset_type: string;
      asset_type_name: string;
      description: string | null;
      type_fee: number;
      payment_id: string | null;
      paid_at: string | null;
      fee_amount: number | null;
    }>();
  return results.map((r) => {
    const paymentStanding: HouseholdAssignmentRow['paymentStanding'] = !r.payment_id ? 'not-billed' : r.paid_at ? 'paid' : 'outstanding';
    return {
      id: r.id,
      assetType: r.asset_type,
      assetTypeName: r.asset_type_name,
      description: r.description,
      paymentStanding,
      feeCents: paymentStanding === 'outstanding' ? Math.round((r.fee_amount ?? 0) * 100) : null,
      feeDollars: r.type_fee,
    };
  });
}

/** The household's own waitlist queue positions, across every member, with each queue's honest
 *  total length. */
export async function listHouseholdWaitlistEntries(db: D1Database, householdId: string): Promise<HouseholdWaitlistRow[]> {
  const { results } = await db
    .prepare(
      `SELECT aw.id, aw.asset_type, at.name AS asset_type_name, aw.position,
              (SELECT COUNT(*) FROM asset_waitlist w2 WHERE w2.asset_type = aw.asset_type) AS queue_length
       FROM asset_waitlist aw
       JOIN asset_types at ON at.id = aw.asset_type
       WHERE aw.member_id IN (SELECT id FROM members WHERE household_id = ?1)
       ORDER BY at.sort_order, aw.position`,
    )
    .bind(householdId)
    .all<{ id: string; asset_type: string; asset_type_name: string; position: number; queue_length: number }>();
  return results.map((r) => ({ id: r.id, assetType: r.asset_type, assetTypeName: r.asset_type_name, position: r.position, queueLength: r.queue_length }));
}

/** The household's own requests, newest first: the assets screen's own list, and the landing's
 *  "Pay for your mooring" task-list filter (`status = 'approved_awaiting_payment'`). */
export async function listHouseholdRequests(db: D1Database, householdId: string): Promise<HouseholdRequestRow[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.asset_type, at.name AS asset_type_name, r.kind, r.status, r.note, r.deny_reason, at.fee, r.created_at
       FROM asset_requests r JOIN asset_types at ON at.id = r.asset_type
       WHERE r.household_id = ?1 ORDER BY r.created_at DESC`,
    )
    .bind(householdId)
    .all<{
      id: string;
      asset_type: string;
      asset_type_name: string;
      kind: 'new' | 'retention';
      status: HouseholdRequestRow['status'];
      note: string | null;
      deny_reason: string | null;
      fee: number;
      created_at: string;
    }>();
  return results.map((r) => ({
    id: r.id,
    assetType: r.asset_type,
    assetTypeName: r.asset_type_name,
    kind: r.kind,
    status: r.status,
    note: r.note,
    denyReason: r.deny_reason,
    fee: r.fee,
    createdAt: r.created_at,
  }));
}

/** Every asset type, for the request form's picker (a thin re-export of `assets-store.ts`'s own
 *  `listAssetTypes`, so a portal route needs only this module's own import). */
export type { AssetTypeRow };
export const listRequestableAssetTypes = listAssetTypes;

/** Flattens `err`'s own message together with up to `depth` levels of its `.cause` chain, joined
 *  with a space -- workerd sometimes rejects with a generic outer message and puts the real
 *  SQLite text on `.cause` (or a wrapper rethrow drops the original message's own substring
 *  entirely), so matching `err.message` alone can miss a real constraint failure. Walks `unknown`
 *  defensively rather than requiring `instanceof Error` at every hop, since `.cause` is typed
 *  `unknown` even on a real `Error`. */
function errorText(err: unknown, depth = 4): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < depth && current != null; i++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else if (typeof current === 'string') {
      parts.push(current);
      break;
    } else {
      break;
    }
  }
  return parts.join(' ');
}

/** Whether `err` is a raw D1 UNIQUE-constraint failure against `table` (fix round B, item 5:
 *  hardened here against a wrapped or cause-chained rejection; `enrollments.ts`'s,
 *  `household-surgery.ts`'s, and `profile.ts`'s own copies stay on the plain `err instanceof
 *  Error && err.message.includes(...)` match, each its own small copy rather than a shared
 *  import). */
function isUniqueViolation(err: unknown, table: string): boolean {
  const text = errorText(err);
  return text.includes('UNIQUE') && text.includes(table);
}

/**
 * Request an asset (design doc's own "Request an asset"; any adult member may). Lands as
 * `status: 'pending'` in the admin's review inbox, entity `'asset-request'` (the signup queue's
 * own pattern). `kind: 'retention'` is the year-to-year "request your mooring again" ask a
 * renewing member sees in their task list; `kind: 'new'` is a first-time ask.
 *
 * `0037_asset_request_unique`'s partial unique index (`household_id, asset_type WHERE status =
 * 'pending'`) backs this insert: neither caller's own app-level guard (`requestAsset` has none,
 * `retainAsset`'s SELECT-then-insert) can close the double-click race where two concurrent
 * requests both pass a pre-check before either insert lands. A collision surfaces here as the one
 * friendly refusal, never a raw D1 error escaping to a 500.
 */
export async function createAssetRequest(
  db: D1Database,
  args: { assetType: string; householdId: string; requestedBy: string; kind: 'new' | 'retention'; note: string | null },
): Promise<{ id: string } | AssetActionError> {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare('INSERT INTO asset_requests (id, asset_type, household_id, requested_by, kind, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(id, args.assetType, args.householdId, args.requestedBy, args.kind, args.note)
      .run();
  } catch (err) {
    if (isUniqueViolation(err, 'asset_requests')) {
      return { error: 'You already have a pending request for this asset type.' };
    }
    console.error('member-portal: asset request insert failed', err);
    return { error: 'Something went wrong recording your request. Please try again.' };
  }
  return { id };
}

/** Cancel a pending request (the symmetry rule's own "request implies cancel-the-request"):
 *  refuses a request that is not the household's own, or one that has already moved past
 *  `'pending'` (an approved, queued, assigned, or already-resolved request is no longer a plain
 *  cancel — the member would contact the club instead, matching the household-removal screen's
 *  own "contact the club" fallback for anything this lean action does not cover). `actorMemberId`
 *  is the signed-in member who cancelled it, recorded in `resolved_by` the same way an admin
 *  action records its own editor email there. */
export async function cancelAssetRequest(db: D1Database, requestId: string, householdId: string, actorMemberId: string): Promise<{ ok: true } | AssetActionError> {
  const result = await db
    .prepare("UPDATE asset_requests SET status = 'cancelled', resolved_at = datetime('now'), resolved_by = ?1 WHERE id = ?2 AND household_id = ?3 AND status = 'pending'")
    .bind(actorMemberId, requestId, householdId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return { error: 'This request can no longer be cancelled.' };
  return { ok: true };
}

/**
 * Voluntarily release a held asset (the symmetry rule's own "asset held -> member-initiated
 * release"): refuses an assignment that is not the household's own. Reuses `assets-store.ts`'s
 * own `releaseAssignment` (the identical admin write path) once ownership is confirmed, rather
 * than a second copy of the same one-line `UPDATE`.
 */
export async function releaseHouseholdAssignment(db: D1Database, assignmentId: string, householdId: string): Promise<{ ok: true } | AssetActionError> {
  const owned = await db
    .prepare(
      `SELECT aa.id FROM asset_assignments aa JOIN memberships m ON m.id = aa.membership_id
       WHERE aa.id = ?1 AND m.household_id = ?2 AND aa.status = 'active'`,
    )
    .bind(assignmentId, householdId)
    .first<{ id: string }>();
  if (!owned) return { error: 'No such assignment.' };
  await releaseAssignment(db, assignmentId);
  return { ok: true };
}

// ---- Admin: the asset-request review inbox (this task's scope item 6) ----

/** One row in the admin's review inbox: the request plus the evidence a reviewer needs beside
 *  the decision (the household, the requester, and a plain-words prior-holding history line —
 *  design doc's own "the household's prior-holding history"). */
export interface AdminRequestRow {
  id: string;
  assetTypeName: string;
  assetType: string;
  householdName: string;
  householdId: string;
  requesterName: string;
  kind: 'new' | 'retention';
  note: string | null;
  createdAt: string;
  fee: number;
  priorHolding: string | null;
}

/** Every request still pending the admin's decision, oldest first (the signup queue's own
 *  ordering convention). */
export async function listPendingAssetRequests(db: D1Database): Promise<AdminRequestRow[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, at.name AS asset_type_name, r.asset_type, h.name AS household_name, h.id AS household_id,
              m.name AS requester_name, r.kind, r.note, r.created_at, at.fee
       FROM asset_requests r
       JOIN asset_types at ON at.id = r.asset_type
       JOIN households h ON h.id = r.household_id
       JOIN members m ON m.id = r.requested_by
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`,
    )
    .all<{
      id: string;
      asset_type_name: string;
      asset_type: string;
      household_name: string;
      household_id: string;
      requester_name: string;
      kind: 'new' | 'retention';
      note: string | null;
      created_at: string;
      fee: number;
    }>();

  const rows: AdminRequestRow[] = [];
  for (const r of results) {
    const priorHolding = await getPriorHoldingSummary(db, r.household_id, r.asset_type);
    rows.push({
      id: r.id,
      assetTypeName: r.asset_type_name,
      assetType: r.asset_type,
      householdName: r.household_name,
      householdId: r.household_id,
      requesterName: r.requester_name,
      kind: r.kind,
      note: r.note,
      createdAt: r.created_at,
      fee: r.fee,
      priorHolding,
    });
  }
  return rows;
}

/** A plain-words prior-holding history line for one household/asset-type pair (design doc: "held
 *  mooring, 2023 through 2026, paid each season"), derived from every assignment (active or
 *  released) the household has ever held of that type. `null` when the household has never held
 *  this type before (a genuinely new request). Every season with a paid `asset_payments` row
 *  counts as "paid"; a season billed but unpaid, or never billed, breaks the "paid each season"
 *  claim honestly rather than asserting it. */
export async function getPriorHoldingSummary(db: D1Database, householdId: string, assetType: string): Promise<string | null> {
  const { results } = await db
    .prepare(
      `SELECT aa.created_at,
              (SELECT COUNT(*) FROM asset_payments ap WHERE ap.assignment_id = aa.id AND ap.paid_at IS NULL) AS unpaid_seasons,
              (SELECT COUNT(*) FROM asset_payments ap WHERE ap.assignment_id = aa.id) AS billed_seasons
       FROM asset_assignments aa JOIN memberships m ON m.id = aa.membership_id
       WHERE m.household_id = ?1 AND aa.asset_type = ?2
       ORDER BY aa.created_at ASC`,
    )
    .bind(householdId, assetType)
    .all<{ created_at: string; unpaid_seasons: number; billed_seasons: number }>();
  if (results.length === 0) return null;

  const firstYear = results[0].created_at.slice(0, 4);
  const lastYear = results[results.length - 1].created_at.slice(0, 4);
  const everyPaid = results.every((r) => r.billed_seasons > 0 && r.unpaid_seasons === 0);
  const range = firstYear === lastYear ? firstYear : `${firstYear} through ${lastYear}`;
  return everyPaid ? `Held this type ${range}, paid each season.` : `Held this type ${range}; payment history is mixed.`;
}

/**
 * Approve a 'new' request: assigns directly into a free slot when the asset type has one
 * (`asset_types.capacity` vs its live active-assignment count), or queues it otherwise (the
 * design doc's own "approve places the household into the queue (or assigns directly when the
 * type has a free slot)"). Refuses a request that is not pending, or not a 'new' request (a
 * 'retention' request always goes through {@link approveRetentionRequest} instead, the merit-gate
 * sequence). Fires the matching decision email (Assets substrate T5b) once the decision commits;
 * `env`/`origin` reach {@link notifyDecision}, never gate the decision itself.
 */
export async function approveNewRequest(
  db: D1Database,
  requestId: string,
  actorEmail: string,
  env: EmailBindingEnv,
  origin: string,
): Promise<{ ok: true; outcome: 'assigned' | 'queued' } | AssetActionError> {
  const request = await db
    .prepare("SELECT asset_type, household_id, requested_by, kind FROM asset_requests WHERE id = ?1 AND status = 'pending'")
    .bind(requestId)
    .first<{ asset_type: string; household_id: string; requested_by: string; kind: 'new' | 'retention' }>();
  if (!request) return { error: 'No such pending request.' };
  if (request.kind !== 'new') return { error: 'A retention request needs the retention approval action.' };

  const type = await db.prepare('SELECT capacity FROM asset_types WHERE id = ?1').bind(request.asset_type).first<{ capacity: number | null }>();
  const activeCount = await db.prepare("SELECT COUNT(*) AS n FROM asset_assignments WHERE asset_type = ?1 AND status = 'active'").bind(request.asset_type).first<{ n: number }>();
  const hasFreeSlot = type?.capacity == null || (activeCount?.n ?? 0) < type.capacity;

  if (hasFreeSlot) {
    const membership = await db
      .prepare('SELECT id FROM memberships WHERE household_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(request.household_id)
      .first<{ id: string }>();
    if (!membership) return { error: 'No membership on file to attach this assignment to.' };
    const assignmentId = await assignAsset(db, { assetType: request.asset_type, membershipId: membership.id, description: null });
    await db
      .prepare("UPDATE asset_requests SET status = 'assigned', assignment_id = ?1, resolved_at = datetime('now'), resolved_by = ?2 WHERE id = ?3")
      .bind(assignmentId, actorEmail, requestId)
      .run();
    await notifyDecision(db, env, origin, { kind: 'assigned', requestId });
    return { ok: true, outcome: 'assigned' };
  }

  const waitlistId = await addToWaitlist(db, { assetType: request.asset_type, memberId: request.requested_by, notes: null });
  await db
    .prepare("UPDATE asset_requests SET status = 'queued', waitlist_id = ?1, resolved_at = datetime('now'), resolved_by = ?2 WHERE id = ?3")
    .bind(waitlistId, actorEmail, requestId)
    .run();
  await notifyDecision(db, env, origin, { kind: 'queued', requestId });
  return { ok: true, outcome: 'queued' };
}

/**
 * Approve a 'retention' request: opens the pay task, never assigns outright (the design doc's
 * own merit-gate-then-pay sequence -- "the approval moment is leadership's merit gate... before
 * money changes hands"). The member's landing task list then reads `status ===
 * 'approved_awaiting_payment'` as "Pay for your <asset> -- $<fee>". Refuses a request that is not
 * pending or not a 'retention' request. Fires the retention-approved decision email (Assets
 * substrate T5b): `approved_awaiting_payment` is a state the member must still act on, unlike a
 * plain assignment.
 */
export async function approveRetentionRequest(
  db: D1Database,
  requestId: string,
  actorEmail: string,
  env: EmailBindingEnv,
  origin: string,
): Promise<{ ok: true } | AssetActionError> {
  const request = await db.prepare("SELECT kind FROM asset_requests WHERE id = ?1 AND status = 'pending'").bind(requestId).first<{ kind: 'new' | 'retention' }>();
  if (!request) return { error: 'No such pending request.' };
  if (request.kind !== 'retention') return { error: 'A new request needs the new-request approval action.' };
  await db
    .prepare("UPDATE asset_requests SET status = 'approved_awaiting_payment', resolved_at = datetime('now'), resolved_by = ?1 WHERE id = ?2")
    .bind(actorEmail, requestId)
    .run();
  await notifyDecision(db, env, origin, { kind: 'retention_approved', requestId });
  return { ok: true };
}

/** Deny a pending request, requiring a reason (the signup queue's own required-reason
 *  convention). Works for either `kind`. Fires the denied decision email (Assets substrate T5b)
 *  carrying `reason` verbatim, so the household reads exactly what the admin recorded. */
export async function denyAssetRequest(
  db: D1Database,
  requestId: string,
  reason: string,
  actorEmail: string,
  env: EmailBindingEnv,
  origin: string,
): Promise<{ ok: true } | AssetActionError> {
  const result = await db
    .prepare("UPDATE asset_requests SET status = 'denied', deny_reason = ?1, resolved_at = datetime('now'), resolved_by = ?2 WHERE id = ?3 AND status = 'pending'")
    .bind(reason, actorEmail, requestId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return { error: 'No such pending request.' };
  await notifyDecision(db, env, origin, { kind: 'denied', requestId, reason });
  return { ok: true };
}

/**
 * Resolve an approved retention request into a real, active `asset_assignments` row plus an
 * OUTSTANDING `asset_payments` row for the current season (the fee snapshotted at billing, `paid_at`
 * left null): the prerequisite the portal's own asset-fee checkout door needs, since
 * `createCheckout({ kind: 'asset-fee' })` addresses an `asset_assignments.id`, which does not exist
 * until a pending request resolves (`payments.ts`'s own header on this deferred call site). The
 * caller (`?/payRequest`) hands the returned `assignmentId` straight to
 * {@link getPayableAssignmentFee} and a Checkout Session; the season here matches
 * `listHouseholdAssignments`'s and the webhook's own `getCurrentSeason` reads, not a raw calendar
 * year, so every reader of this row agrees on which season it belongs to. Refuses a request that is
 * not the household's own, or not in the `'approved_awaiting_payment'` state.
 */
export async function payForApprovedRequest(db: D1Database, requestId: string, householdId: string): Promise<{ ok: true; assignmentId: string } | AssetActionError> {
  const request = await db
    .prepare("SELECT asset_type, household_id FROM asset_requests WHERE id = ?1 AND household_id = ?2 AND status = 'approved_awaiting_payment'")
    .bind(requestId, householdId)
    .first<{ asset_type: string; household_id: string }>();
  if (!request) return { error: 'No such request awaiting payment.' };

  const membership = await db
    .prepare('SELECT id FROM memberships WHERE household_id = ?1 ORDER BY created_at DESC LIMIT 1')
    .bind(householdId)
    .first<{ id: string }>();
  if (!membership) return { error: 'No membership on file to attach this assignment to.' };

  const type = await db.prepare('SELECT fee FROM asset_types WHERE id = ?1').bind(request.asset_type).first<{ fee: number }>();
  const assignmentId = await assignAsset(db, { assetType: request.asset_type, membershipId: membership.id, description: null });
  const currentSeason = await getCurrentSeason(db);
  await db
    .prepare('INSERT INTO asset_payments (id, assignment_id, season, amount) VALUES (?1, ?2, ?3, ?4)')
    .bind(crypto.randomUUID(), assignmentId, currentSeason, type?.fee ?? 0)
    .run();
  await db
    .prepare("UPDATE asset_requests SET status = 'assigned', assignment_id = ?1, resolved_at = datetime('now') WHERE id = ?2")
    .bind(assignmentId, requestId)
    .run();
  return { ok: true, assignmentId };
}

/** The fee due on an outstanding `asset_payments` row, plus the asset type's own id and display
 *  name: {@link payAssetFeeCheckout}'s (route layer) one read before it ever builds a Checkout
 *  Session, the real amount server-side rather than trusting whatever `listHouseholdAssignments`
 *  last rendered to the browser. `assetType` (member-waivers T5b) is the asset-types.id the
 *  route's own waiver gate maps to a signing context (`mooring` vs. one of the three dry kinds). */
export interface PayableAssignmentFee {
  amountCents: number;
  assetType: string;
  assetTypeName: string;
}

/**
 * The portal's own asset-fee checkout door (this task's own scope): refuses an assignment that is
 * not the household's own, not active, or carries no outstanding `asset_payments` row for
 * `currentSeason` (already paid, or never billed) — "asset pay door only on approved+unpaid
 * assignments". Reuses the already-recorded `asset_payments.amount` (the fee snapshotted at
 * billing) rather than re-reading `asset_types.fee`, which may have changed since.
 */
export async function getPayableAssignmentFee(db: D1Database, assignmentId: string, householdId: string, currentSeason: number): Promise<PayableAssignmentFee | AssetActionError> {
  const row = await db
    .prepare(
      `SELECT aa.asset_type, at.name AS asset_type_name, ap.amount
       FROM asset_assignments aa
       JOIN asset_types at ON at.id = aa.asset_type
       JOIN memberships m ON m.id = aa.membership_id
       JOIN asset_payments ap ON ap.assignment_id = aa.id AND ap.season = ?3
       WHERE aa.id = ?1 AND m.household_id = ?2 AND aa.status = 'active' AND ap.paid_at IS NULL`,
    )
    .bind(assignmentId, householdId, currentSeason)
    .first<{ asset_type: string; asset_type_name: string; amount: number }>();
  if (!row) return { error: 'No outstanding fee to pay for this asset.' };
  return { amountCents: Math.round(row.amount * 100), assetType: row.asset_type, assetTypeName: row.asset_type_name };
}
