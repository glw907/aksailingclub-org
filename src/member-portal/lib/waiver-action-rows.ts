// The portal landing's own waiver rows (member-waivers T5b, spec rule 7's own "between money
// moments an outstanding document is a portal 'Needs your attention' row, never a lockout"; the
// household-complete loop's own "Portal row while waiting"): two distinct rows, kept as one
// function since they share the same inputs and are mutually exclusive for one signed-in member --
// the plain row names the SIGNER's own outstanding documents (`signing-framing-copy.md`'s "Needs
// your attention" copy, exact); the waiting row only ever shows once the signer's own part is
// already done, one per OTHER remaining adult, with its own cooldown-guarded nudge
// (`signing-framing-copy.md`'s "Portal row while waiting" copy, exact). Every string here is
// verbatim from that file; only the interpolated name/count/season varies.
import type { ActionRow } from './action-rows';
import type { HouseholdRequirements } from './waiver-requirements';
import { householdSignatureGate } from './household-signature-gate';
import { firstNameOf } from './person-name';

/** Every word here follows `signing-framing-copy.md` verbatim; only `{title}`/`{N}`/`{season}`/
 *  `{name}` vary. `inWaitingLoop` restricts the "waiting on {name}" row to a household actually
 *  mid-renewal (the masthead's own `renewal-window` state) -- an already-active, fully-paid
 *  household that later gains a stray outstanding OTHER adult (a new member added after payment,
 *  never itself a money moment) never claims a family membership is "waiting" on anyone, since
 *  none is: rule 7's own "never a lockout" between money moments covers that member's own row
 *  alone, and this function only ever surfaces it to that member themself, on their own visit.
 */
export function buildWaiverActionRows(args: {
  requirements: HouseholdRequirements;
  signerMemberId: string;
  inWaitingLoop: boolean;
}): ActionRow[] {
  const { requirements, signerMemberId } = args;
  const signer = requirements.adults.find((adult) => adult.memberId === signerMemberId);
  const ownOutstanding = signer?.requirements.filter((r) => !r.signed) ?? [];

  if (ownOutstanding.length > 0) {
    const title =
      ownOutstanding.length === 1
        ? `The ${ownOutstanding[0].document.frontmatter.title} needs your signature for the ${requirements.season} season.`
        : `${ownOutstanding.length} documents need your signature for the ${requirements.season} season.`;
    return [{ id: 'waiver-outstanding', title, amountCents: null, actionLabel: 'Read and sign', kind: 'link', href: '/my-account/sign' }];
  }

  if (!args.inWaitingLoop) return [];

  return householdSignatureGate(requirements)
    .remaining.filter((r) => r.role === 'adult' && r.memberId !== signerMemberId)
    .map((remaining) => ({
      id: `waiver-waiting-${remaining.memberId}`,
      title: `Your family's ${requirements.season} membership is waiting on ${firstNameOf(remaining.name)}'s signatures.`,
      amountCents: null,
      actionLabel: 'Send a sign-in link',
      kind: 'form',
      formAction: '/my-account/sign?/sendNudge&context=renewal',
      fieldName: 'targetMemberId',
      fieldValue: remaining.memberId,
    }));
}
