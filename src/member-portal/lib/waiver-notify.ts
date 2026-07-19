// The member-waivers household loop's own two emails (member-waivers T5b,
// docs/2026-07-17-member-waivers-design.md ratified decision 7's amendment, and
// docs/waivers/signing-framing-copy.md's "The nudge email"/"The resumption email"): the nudge a
// managing adult sends an outstanding household member from the waiting state, and the resumption
// email the managing adult gets when the last signature lands. Both mint their own magic-link
// token (`$member-auth/lib/auth.ts`'s `mintMemberSignInLink`, never the enumeration-safe
// `requestMemberLink` a public form uses -- this module already knows exactly which household
// member it is emailing) and send through `sendClubEmail`'s `raw` path (`$admin-club/lib/
// club-email.ts`), following `classes.ts`'s own precedent for a lib module owning its own
// notification send rather than leaving it to the route.
//
// Cooldown/idempotency, both keyed through `email_log.segment` (`committees.ts`'s own
// `requestNotifiedRecently` idiom): the nudge is time-cooldowned (a member can re-send if the
// first attempt was missed, but never spam the same outstanding adult), the resumption email is
// sent-once-ever per household/season (the loop closes exactly once, whichever signature happens
// to land last).
import type { D1Database } from '@cloudflare/workers-types';
import { mintMemberSignInLink } from '$member-auth/lib/auth';
import { sendClubEmail, type EmailBindingEnv } from '$admin-club/lib/club-email';
import type { SigningContext } from './signatures';

/** The nudge email's own time estimate: the SAME `max(2, 2 x N)` formula the signing page's own
 *  welcome line uses (`sign-view.ts`'s `timeEstimateMinutes`), restated here rather than importing
 *  across the lib/route boundary (a route's own module is never a library import target
 *  elsewhere in this codebase). */
function estimateMinutes(documentCount: number): number {
  return Math.max(2, 2 * documentCount);
}

/** The minutes a re-send may not repeat within, matching `committees.ts`'s own
 *  `NOTIFY_COOLDOWN_MINUTES` (a re-send is a legitimate "I lost the first email" request, not
 *  spam, past this window). */
const NUDGE_COOLDOWN_MINUTES = 15;

/** The `email_log.segment` tag one nudge is logged under: unique per (target member, season), so
 *  a re-send to a DIFFERENT outstanding adult in the same household is never throttled by the
 *  first adult's own send. */
export function nudgeSegment(targetMemberId: string, season: number): string {
  return `waiver-nudge:${targetMemberId}:${season}`;
}

/** Whether a nudge to `targetMemberId` for `season` already went out within the cooldown window. */
export async function nudgeRecentlySent(db: D1Database, targetMemberId: string, season: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS present FROM email_log WHERE segment = ?1 AND sent_at > datetime('now', ?2)`)
    .bind(nudgeSegment(targetMemberId, season), `-${NUDGE_COOLDOWN_MINUTES} minutes`)
    .first<{ present: number }>();
  return row !== null;
}

/** The `email_log.segment` tag the resumption email is logged under: unique per (household,
 *  season), so {@link resumptionAlreadySent} can enforce "at most one, ever" for this household's
 *  own money moment this season, independent of how many signatures led up to it. */
export function resumptionSegment(householdId: string, season: number): string {
  return `waiver-resumption:${householdId}:${season}`;
}

/** Whether the resumption email for this household/season has ALREADY gone out, with no time
 *  bound (unlike the nudge's cooldown): the loop closes exactly once, so a second signature
 *  landing after the household is already complete (an edge no normal flow reaches, since
 *  payment unlocks and the money moment ends) must never re-fire it. */
export async function resumptionAlreadySent(db: D1Database, householdId: string, season: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS present FROM email_log WHERE segment = ?1 AND status = 'sent'`)
    .bind(resumptionSegment(householdId, season))
    .first<{ present: number }>();
  return row !== null;
}

/** The household-loop context word the nudge email's own body names ("your family's {season}
 *  {join/renewal}"): only `join`/`renewal` ever reach the household-complete loop (rule 7's own
 *  money-moment gate), so any other {@link SigningContext} falls back to `renewal`'s wording
 *  rather than failing outright -- a defensive default, never expected to be exercised. */
function loopWord(context: SigningContext): 'join' | 'renewal' {
  return context === 'join' ? 'join' : 'renewal';
}

/**
 * Send the nudge email (signing-framing-copy.md's "The nudge email"): mints a fresh sign-in link
 * deep-linking straight to the signing moment (`next` = `/my-account/sign?context={context}`),
 * then sends the exact subject/body through `sendClubEmail`, logged under
 * {@link nudgeSegment}. Best-effort: a missing `EMAIL` binding or a send failure never throws (the
 * caller's own "link sent" outcome is unconditional, matching every other send-path in this
 * codebase's own degrade-gracefully convention).
 */
export async function sendWaiverNudgeEmail(
  db: D1Database,
  env: EmailBindingEnv,
  args: {
    managerName: string;
    target: { memberId: string; name: string; email: string | null };
    season: number;
    context: SigningContext;
    outstandingCount: number;
    origin: string;
  },
): Promise<void> {
  if (!env.EMAIL || !args.target.email) return;
  const link = await mintMemberSignInLink(db, args.target.memberId, args.origin, `/my-account/sign?context=${args.context}`);
  await sendClubEmail(db, env, {
    to: args.target.email,
    raw: {
      subject: "Your signature is needed for your family's {{season}} membership",
      body:
        '{{manager_name}} completed your family\'s {{season}} {{join_or_renewal}} up to the signatures only you can make. {{count}} documents need your signature—the link below signs you in and takes you straight to them. Plan on about {{minutes}} minutes.\n\n{{link}}',
    },
    vars: {
      manager_name: args.managerName,
      season: String(args.season),
      join_or_renewal: loopWord(args.context),
      count: String(args.outstandingCount),
      minutes: String(estimateMinutes(args.outstandingCount)),
      link,
    },
    segment: nudgeSegment(args.target.memberId, args.season),
  });
}

/**
 * Send the resumption email (signing-framing-copy.md's "The resumption email"): fires once,
 * when the LAST outstanding household signature lands and the signer is not the managing adult
 * themself (their own moment continues straight to payment instead, per the spec's own "unless
 * the signer IS the managing adult"). Deep-links to `paymentPath` (the caller's own resolved
 * return path -- `/my-account/renew` for the renewal loop), logged under
 * {@link resumptionSegment} for the sent-once guard. Best-effort, matching
 * {@link sendWaiverNudgeEmail}.
 */
export async function sendWaiverResumptionEmail(
  db: D1Database,
  env: EmailBindingEnv,
  args: {
    manager: { memberId: string; name: string; email: string | null };
    signerName: string;
    householdId: string;
    season: number;
    paymentPath: string;
    origin: string;
  },
): Promise<void> {
  if (!env.EMAIL || !args.manager.email) return;
  const link = await mintMemberSignInLink(db, args.manager.memberId, args.origin, args.paymentPath);
  await sendClubEmail(db, env, {
    to: args.manager.email,
    raw: {
      subject: "Everyone has signed—finish your family's {{season}} membership",
      body: '{{name}} signed just now, so your household is complete. The last step is payment: {{link}}.',
    },
    vars: { name: args.signerName, season: String(args.season), link },
    segment: resumptionSegment(args.householdId, args.season),
  });
}
