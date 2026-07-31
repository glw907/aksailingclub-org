// The asset request lifecycle's own decision emails (Assets substrate T5a,
// docs/2026-07-29-assets-functional-design.md ruling 5): the moments a member cannot otherwise
// discover -- a request approved and assigned, approved and queued to the waitlist, denied with
// the recorded reason, a retention request approved (the merit gate clears, payment is next), and
// a waitlist slot opening. Five kinds rather than the spec's own "four message kinds" phrasing:
// ruling 5's enumeration lists retention approval separately from a plain approval, because
// `approved_awaiting_payment` is a state the member must still act on, unlike a plain assignment.
// Sends through `sendClubEmail`'s `raw` path (`$admin-club/lib/club-email.ts`), following
// `waiver-notify.ts`'s own precedent for a lib module owning its send rather than leaving it to
// the route, and mints a fresh sign-in link the same way so the household lands signed in on
// `/my-account/gear` -- except `denied`, which has nothing on that page to act on (a denied
// request is filtered out of its Requests section) and so mints no link at all.
//
// Recipient resolution: the request's own `requested_by` member, falling back to the household's
// `primary_member_id` (`household.ts`'s own "managing adult" -- the same fallback
// `maybeSendResumptionEmail` reads off `getHouseholdInfo`) when the requester has no usable email
// on file. The slot-opened kind resolves the same way off `asset_waitlist.member_id`, since a
// waitlist entry carries no separate requester field.
//
// `email_log.segment` is tagged per request per decision (`assetDecisionSegment`) or per waitlist
// entry (`assetSlotOpenedSegment`), matching the segment idiom at `waiver-notify.ts:41,55` --
// traceability only, never a dedup guard, since the callers already re-check a request is still
// pending before deciding it.
//
// The `EMAIL` binding is checked, alongside the recipient, before any link is minted (matching
// `waiver-notify.ts`'s own guard-before-minting order): an unbound deployment must never write a
// live, unused sign-in token to `member_tokens`. The whole send is also wrapped in one `try`/
// `catch`, so a D1 failure anywhere in the lookup, mint, or log step degrades to `{ ok: false }`
// the same way an expected refusal does, keeping this module's own "never throws" promise true
// for every failure mode, not just the two named lookups.
import type { D1Database } from '@cloudflare/workers-types';
import { mintMemberSignInLink } from '$member-auth/lib/auth';
import { formatMemberCents } from '$member-auth/lib/format';
import { sendClubEmail, type EmailBindingEnv, type SendClubEmailResult } from '$admin-club/lib/club-email';
import { getHouseholdInfo } from './household';

/** The five lifecycle moments a decision email fires for (ruling 5's own enumeration). */
export type AssetDecisionKind = 'assigned' | 'queued' | 'retention_approved' | 'denied' | 'slot_opened';

interface RequestDecisionArgs {
  /** The `asset_requests.id` this decision resolves: also {@link assetDecisionSegment}'s own
   *  identity. */
  requestId: string;
  origin: string;
}

/** The fields `slot_opened`'s own by-id waitlist lookup would otherwise produce, for a caller
 *  that already knows them (waitlist promotion's own case): supplying this SKIPS that lookup
 *  entirely, so a caller whose write already deleted the waitlist row can still send correctly
 *  (the ordering defect this field exists to close -- see this module's own header). */
export interface SlotOpenedResolvedPayload {
  memberId: string;
  householdId: string;
  assetTypeName: string;
}

/** {@link sendAssetDecisionEmail}'s argument, one variant per {@link AssetDecisionKind}. The
 *  `denied` kind alone carries a `reason`, the admin's recorded text sent verbatim; `slot_opened`
 *  alone carries a `waitlistId` in place of a `requestId`, since a freed slot notifies off the
 *  waitlist entry, not a request. */
export type AssetDecisionEmailArgs =
  | (RequestDecisionArgs & { kind: 'assigned' })
  | (RequestDecisionArgs & { kind: 'queued' })
  | (RequestDecisionArgs & { kind: 'retention_approved' })
  | (RequestDecisionArgs & { kind: 'denied'; reason: string })
  | {
      kind: 'slot_opened';
      /** The `asset_waitlist.id` entry whose slot opened: also {@link assetSlotOpenedSegment}'s
       *  own identity. Still required even when `resolved` is supplied, since the segment tag
       *  keys off it. */
      waitlistId: string;
      origin: string;
      /** Optional pre-resolved recipient/asset-type data, bypassing the by-id waitlist lookup
       *  below entirely when present. Omitted, this falls back to that lookup unchanged. */
      resolved?: SlotOpenedResolvedPayload;
    };

/** The `email_log.segment` tag a request-decision send is logged under: unique per (request,
 *  decision), so a later decision on the same request (there is never more than one, since a
 *  resolved request cannot be re-decided) would still log distinctly rather than colliding. */
export function assetDecisionSegment(requestId: string, kind: Exclude<AssetDecisionKind, 'slot_opened'>): string {
  return `asset-decision:${kind}:${requestId}`;
}

/** The `email_log.segment` tag a slot-opened send is logged under: unique per waitlist entry. */
export function assetSlotOpenedSegment(waitlistId: string): string {
  return `asset-decision:slot_opened:${waitlistId}`;
}

/** The member a decision email actually reaches: the requester when they carry a usable email,
 *  the household's managing adult otherwise. `null` when neither resolves to an email on file, the
 *  one case {@link sendAssetDecisionEmail} refuses to guess a recipient for. */
async function resolveRecipient(db: D1Database, memberId: string, householdId: string): Promise<{ memberId: string; email: string } | null> {
  const member = await db.prepare('SELECT email FROM members WHERE id = ?1').bind(memberId).first<{ email: string | null }>();
  if (member?.email) return { memberId, email: member.email };

  const household = await getHouseholdInfo(db, householdId);
  if (household?.primaryMemberId && household.primaryMemberId !== memberId) {
    const primary = await db.prepare('SELECT email FROM members WHERE id = ?1').bind(household.primaryMemberId).first<{ email: string | null }>();
    if (primary?.email) return { memberId: household.primaryMemberId, email: primary.email };
  }
  return null;
}

const NO_RECIPIENT: SendClubEmailResult = { ok: false, error: 'No recipient email on file to notify.' };
const NO_EMAIL_BINDING: SendClubEmailResult = { ok: false, error: 'EMAIL binding is not configured' };

/**
 * Send the decision email for `args.kind`, resolving the recipient and checking the `EMAIL`
 * binding before minting their sign-in link. Never throws: a request or waitlist entry that no
 * longer resolves, a household with no usable email anywhere, an unbound `EMAIL` binding, or any
 * other failure along the way (a D1 error mid-lookup, mid-mint, or mid-log) all degrade to
 * `{ ok: false }`, so a caller can pass any of them straight through without special casing which
 * one happened.
 */
export async function sendAssetDecisionEmail(db: D1Database, env: EmailBindingEnv, args: AssetDecisionEmailArgs): Promise<SendClubEmailResult> {
  try {
    if (args.kind === 'slot_opened') {
      let resolved: SlotOpenedResolvedPayload;
      if (args.resolved) {
        resolved = args.resolved;
      } else {
        const entry = await db
          .prepare(
            `SELECT aw.member_id, m.household_id, at.name AS asset_type_name
             FROM asset_waitlist aw
             JOIN asset_types at ON at.id = aw.asset_type
             JOIN members m ON m.id = aw.member_id
             WHERE aw.id = ?1`,
          )
          .bind(args.waitlistId)
          .first<{ member_id: string; household_id: string; asset_type_name: string }>();
        if (!entry) return { ok: false, error: 'No such waitlist entry to notify about.' };
        resolved = { memberId: entry.member_id, householdId: entry.household_id, assetTypeName: entry.asset_type_name };
      }

      const recipient = await resolveRecipient(db, resolved.memberId, resolved.householdId);
      if (!recipient) return NO_RECIPIENT;
      if (!env.EMAIL) return NO_EMAIL_BINDING;

      const link = await mintMemberSignInLink(db, recipient.memberId, args.origin, '/my-account/gear');
      return sendClubEmail(db, env, {
        to: recipient.email,
        raw: {
          subject: 'A {{assetTypeName}} spot is open for your household',
          body: 'A {{assetTypeName}} spot has opened for your household. See your place on the waitlist at {{link}}.',
        },
        vars: { assetTypeName: resolved.assetTypeName, link },
        segment: assetSlotOpenedSegment(args.waitlistId),
      });
    }

    const request = await db
      .prepare(
        `SELECT r.household_id, r.requested_by, at.name AS asset_type_name, at.fee
         FROM asset_requests r
         JOIN asset_types at ON at.id = r.asset_type
         WHERE r.id = ?1`,
      )
      .bind(args.requestId)
      .first<{ household_id: string; requested_by: string; asset_type_name: string; fee: number }>();
    if (!request) return { ok: false, error: 'No such request to notify about.' };

    const recipient = await resolveRecipient(db, request.requested_by, request.household_id);
    if (!recipient) return NO_RECIPIENT;
    if (!env.EMAIL) return NO_EMAIL_BINDING;

    if (args.kind === 'denied') {
      // No link, no sign-in token: a denied request has nothing left to act on, and a denied
      // row is filtered out of `/my-account/gear`'s own Requests section, so the link would land
      // the household on a page with no trace of what they clicked through for.
      return sendClubEmail(db, env, {
        to: recipient.email,
        raw: {
          subject: 'Your {{assetTypeName}} request was not approved',
          body: "The club did not approve your household's request for {{assetTypeName}}. {{reason}}",
        },
        vars: { assetTypeName: request.asset_type_name, reason: args.reason },
        segment: assetDecisionSegment(args.requestId, 'denied'),
      });
    }

    const link = await mintMemberSignInLink(db, recipient.memberId, args.origin, '/my-account/gear');
    const segment = assetDecisionSegment(args.requestId, args.kind);
    const vars = { assetTypeName: request.asset_type_name, link };

    switch (args.kind) {
      case 'assigned':
        return sendClubEmail(db, env, {
          to: recipient.email,
          raw: {
            subject: 'Your {{assetTypeName}} request is approved',
            body: "The club approved your household's request for {{assetTypeName}} and it's now assigned to you. See the details at {{link}}.",
          },
          vars,
          segment,
        });
      case 'queued':
        return sendClubEmail(db, env, {
          to: recipient.email,
          raw: {
            subject: "Your {{assetTypeName}} request is approved and you're on the waitlist",
            body:
              "The club approved your household's request for {{assetTypeName}}. There is no open slot right now, so your household is on the waitlist. Check your place in line at {{link}}.",
          },
          vars,
          segment,
        });
      case 'retention_approved':
        return sendClubEmail(db, env, {
          to: recipient.email,
          raw: {
            subject: 'Pay to keep your {{assetTypeName}}',
            body: "The club approved your household's request to keep {{assetTypeName}}. The fee is {{fee}}. Pay it at {{link}} to finish.",
          },
          vars: { ...vars, fee: formatMemberCents(Math.round(request.fee * 100)) },
          segment,
        });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
