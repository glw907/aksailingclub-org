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
// `/my-account/gear`.
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
       *  own identity. */
      waitlistId: string;
      origin: string;
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

/**
 * Send the decision email for `args.kind`, resolving the recipient and minting their sign-in link
 * first. Never throws: a request or waitlist entry that no longer resolves, or a household with no
 * usable email anywhere, degrades to `{ ok: false }` the same way {@link sendClubEmail} degrades an
 * unbound `EMAIL` binding, so a caller can pass either failure straight through without special
 * casing which one happened.
 */
export async function sendAssetDecisionEmail(db: D1Database, env: EmailBindingEnv, args: AssetDecisionEmailArgs): Promise<SendClubEmailResult> {
  if (args.kind === 'slot_opened') {
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

    const recipient = await resolveRecipient(db, entry.member_id, entry.household_id);
    if (!recipient) return NO_RECIPIENT;

    const link = await mintMemberSignInLink(db, recipient.memberId, args.origin, '/my-account/gear');
    return sendClubEmail(db, env, {
      to: recipient.email,
      raw: {
        subject: 'A {{assetTypeName}} spot is open for your household',
        body: 'A {{assetTypeName}} spot has opened. Visit {{link}} to claim it for your household.',
      },
      vars: { assetTypeName: entry.asset_type_name, link },
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

  const link = await mintMemberSignInLink(db, recipient.memberId, args.origin, '/my-account/gear');
  const segment = assetDecisionSegment(args.requestId, args.kind);
  const vars = { assetTypeName: request.asset_type_name, link };

  switch (args.kind) {
    case 'assigned':
      return sendClubEmail(db, env, {
        to: recipient.email,
        raw: {
          subject: 'Your {{assetTypeName}} request is approved',
          body: "The club approved your household's request for {{assetTypeName}} and has assigned it to your household. See the details at {{link}}.",
        },
        vars,
        segment,
      });
    case 'queued':
      return sendClubEmail(db, env, {
        to: recipient.email,
        raw: {
          subject: 'Your {{assetTypeName}} request is approved',
          body:
            "The club approved your household's request for {{assetTypeName}}. There is no open slot right now, so your household is on the waitlist. The club will reach out when one opens. See your household's requests at {{link}}.",
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
    case 'denied':
      return sendClubEmail(db, env, {
        to: recipient.email,
        raw: {
          subject: 'Your {{assetTypeName}} request was not approved',
          body:
            "The club did not approve your household's request for {{assetTypeName}}. The reason given: {{reason}}. See your household's requests at {{link}}.",
        },
        vars: { ...vars, reason: args.reason },
        segment,
      });
  }
}
