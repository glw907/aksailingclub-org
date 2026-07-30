// /my-account/renew: the renewal door (T2c of the portal redesign pass, decisions.md's own "the
// renewal door" ruling). T2's masthead drew the renewal CTA as one plain fireweed button with a
// hidden tier field defaulting to the household's last-held tier -- a household that grew from
// individual to family would silently buy the wrong tier at the wrong price on that one click (3
// of 88 renewals with a prior season changed tier, roughly 3.4%). This route states the
// household's current tier and price plainly and offers the other tiers at their real settings
// prices, so the member sees exactly what they are buying before they click. The masthead's CTA
// links here now instead of posting.
//
// `?/renew` moved here verbatim from `/my-account/+page.server.ts` (T2b's own "server actions
// move with their forms" precedent): same `mintOrReuseRenewalMembership` call, same
// `checkoutOrStub` degrade-to-stub path, same CSRF handling via `portalAction`. No payment logic
// changed.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { issueMemberCsrfToken } from '$member-auth/lib/auth';
import { resolveMemberDb } from '$member-auth/lib/db';
import { getMemberStanding, MEMBERSHIP_TIER_LABEL, type MembershipTier } from '$member-auth/lib/standing';
import { getCurrentSeason, getTierPrices } from '$admin-club/lib/club-settings';
import { mintOrReuseRenewalMembership, nextUnclaimedRenewalSeason } from '$member-portal/lib/renewal';
import { createAssetRequest, listHouseholdAssignments, listHouseholdRequests, type HouseholdRequestRow } from '$member-portal/lib/assets';
import { portalAction } from '$member-portal/lib/portal-action';
import { checkoutOrStub } from '$member-portal/lib/checkout';
import { documents } from '$chassis/content';
import { loadPublishedDocuments } from '$theme/documents';
import { householdSignaturesComplete } from '$member-portal/lib/waiver-requirements';

/** The signing moment for the renewal household-complete gate: the SAME redirect target, whether
 *  the gate refuses at `load` (a member visiting the page directly) or at `?/renew` (a stale tab
 *  submitting past a page that already redirected everyone else) -- member-waivers T5b, spec rule
 *  7's amendment: "the managing adult's renewal start routes through the signing moment". */
const SIGN_REDIRECT = '/my-account/sign?context=renewal&next=%2Fmy-account%2Frenew';

export const prerender = false;

/** The retention step's own "already in flight" statuses (task 4 finding 2): a request the admin
 *  has approved moves through `approved_awaiting_payment` to `assigned` before it is truly done,
 *  so the duplicate guard and the "Requested" chip both need to stay closed across that whole
 *  span, not just `pending` -- otherwise the button reappears once an admin approves the request
 *  and a second click inserts a duplicate pending row for an asset already granted. */
const OPEN_RETENTION_STATUSES: ReadonlySet<HouseholdRequestRow['status']> = new Set(['pending', 'approved_awaiting_payment', 'assigned']);

/** `MembershipTier`'s own three values (matching `$theme/join-apply-form.ts`'s own
 *  `MEMBERSHIP_TIERS` precedent): the tier picker's own option list and the `?/renew` action's
 *  input validation both need the plain list. */
const MEMBERSHIP_TIERS: readonly MembershipTier[] = ['individual', 'family', 'young-adult'];

function isMembershipTier(value: string): value is MembershipTier {
  return (MEMBERSHIP_TIERS as readonly string[]).includes(value);
}

/** One tier option the picker renders: its display label and the CURRENT settings price, never a
 *  price the template computes itself. */
export interface RenewTierOption {
  tier: MembershipTier;
  label: string;
  priceDollars: number;
}

/** One of the household's own currently-held assets, offered as the retention step's own
 *  "request this again" choice (design spec ruling 3). `alreadyRequested` is a pending
 *  `kind: 'retention'` row already on file for this type, so the template renders the row as done
 *  instead of re-offering a button `?/retainAsset`'s own duplicate guard would refuse anyway. */
export interface RenewHeldAssetOption {
  assetType: string;
  assetTypeName: string;
  alreadyRequested: boolean;
}

export const load: PageServerLoad = async (event) => {
  const csrf = issueMemberCsrfToken(event);
  const { member } = await event.parent();
  if (!member) redirect(303, '/my-account');

  const db = resolveMemberDb(event.platform?.env);
  if (!db) return { csrf, standing: null, currentSeason: null, renewalSeason: null, tiers: null, heldAssets: null };

  const [standing, currentSeason, prices] = await Promise.all([getMemberStanding(db, member.id), getCurrentSeason(db), getTierPrices(db)]);

  // The household-complete gate (member-waivers T5b, spec rule 7's amendment): a renewal start
  // routes through the signing moment first, whether it is the signer's own outstanding documents
  // or the household is only waiting on someone else -- the sign page itself decides which of
  // those two states to show (T5b's own "Waiting on {name}" vs the ordinary moment). Documents key
  // to `getCurrentSeason` throughout this pass (T4's own convention, matched here rather than the
  // renewal-specific `renewalSeason` below), so an early renewer for next season still signs
  // against whatever is published for the season now in effect.
  if (!(await householdSignaturesComplete(db, loadPublishedDocuments(documents, currentSeason), member.householdId, currentSeason))) {
    redirect(303, SIGN_REDIRECT);
  }

  // The season this submit will actually buy (decisions.md's "the renewal door": "the member
  // sees exactly what they are buying before they click"), not just `currentSeason` -- a
  // household that already paid for `currentSeason` renews straight into the NEXT unclaimed one
  // (`nextUnclaimedRenewalSeason`, the same read `?/renew` below re-derives at mint time), and
  // the button naming the wrong year is the exact defect this door exists to prevent.
  const renewalSeason = await nextUnclaimedRenewalSeason(db, member.householdId, currentSeason);

  const tiers: RenewTierOption[] = MEMBERSHIP_TIERS.map((tier) => ({ tier, label: MEMBERSHIP_TIER_LABEL[tier], priceDollars: prices[tier] }));

  // The retention step (design spec ruling 3, task 4): every asset TYPE the household holds
  // today, read through the same `listHouseholdAssignments`/`listHouseholdRequests`
  // `/my-account/gear` already uses, never a new query. A household with no active assignments
  // gets an empty array, which the template reads as "no step at all".
  //
  // Deduplicated by asset type (finding 1): a household can hold more than one active assignment
  // of the same type (three live households do, one holding three trailered-boat-parking
  // assignments), and the whole downstream request model is type-keyed -- `asset_requests`
  // carries no count, `createAssetRequest` takes a type, and the duplicate guard below matches on
  // type. One row and one request per type is the honest representation of what that model can
  // express; a per-assignment request model would need a schema change this pass forbids.
  const [assignments, requests] = await Promise.all([listHouseholdAssignments(db, member.householdId, currentSeason), listHouseholdRequests(db, member.householdId)]);
  const seenAssetTypes = new Set<string>();
  const heldAssets: RenewHeldAssetOption[] = [];
  for (const assignment of assignments) {
    if (seenAssetTypes.has(assignment.assetType)) continue;
    seenAssetTypes.add(assignment.assetType);
    heldAssets.push({
      assetType: assignment.assetType,
      assetTypeName: assignment.assetTypeName,
      alreadyRequested: requests.some(
        (request) => request.assetType === assignment.assetType && request.kind === 'retention' && OPEN_RETENTION_STATUSES.has(request.status),
      ),
    });
  }

  return { csrf, standing, currentSeason, renewalSeason, tiers, heldAssets };
};

export const actions: Actions = {
  // Moved from `/my-account/+page.server.ts` unchanged (T2c): mints or reuses the household's
  // next unclaimed season's unpaid membership row at the submitted tier and the CURRENT settings
  // price (`mintOrReuseRenewalMembership`, `renewal.ts`'s own "duplicate protection" rule), then
  // hands it straight to a plain `dues` Checkout Session.
  renew: portalAction(async ({ event, form, ctx }) => {
    const tierRaw = String(form.get('tier') ?? '');
    if (!isMembershipTier(tierRaw)) return fail(400, { error: 'Please choose a membership tier.' });

    const currentSeason = await getCurrentSeason(ctx.db);
    // The hard gate, re-checked here (never trusting that the page that rendered this form is the
    // one still open in the browser): no payment proceeds until the household's own signatures
    // are complete, member-waivers T5b's own defense-in-depth mirror of `load`'s redirect above.
    if (!(await householdSignaturesComplete(ctx.db, loadPublishedDocuments(documents, currentSeason), ctx.member.householdId, currentSeason))) {
      redirect(303, SIGN_REDIRECT);
    }

    const prices = await getTierPrices(ctx.db);
    const priceDollars = prices[tierRaw];
    const { membershipId } = await mintOrReuseRenewalMembership(ctx.db, ctx.member.householdId, ctx.member.id, tierRaw, priceDollars, currentSeason);

    return checkoutOrStub(event, ctx, 'renewStubbed', {
      kind: 'dues',
      refId: membershipId,
      amountCents: Math.round(priceDollars * 100),
      description: `${MEMBERSHIP_TIER_LABEL[tierRaw]} Membership dues`,
    });
  }),

  // The retention step's own create action (design spec ruling 3, task 4): one row, one button, a
  // "yes" per held asset (`/my-account/gear`'s own per-row action shape). A "no" is simply never
  // submitting this action, so it creates nothing by construction -- releasing a held asset stays
  // the separate, deliberate action on `/my-account/gear`, never reachable from here.
  //
  // Its own `retainError` key, distinct from `?/renew`'s `error` (finding 5): the two actions
  // share this route's one `form` prop, and the retention section renders its own error surface
  // beside itself rather than reusing the renewal form's, so the template needs to tell which
  // action a failure came from.
  retainAsset: portalAction(async ({ form, ctx }) => {
    const currentSeason = await getCurrentSeason(ctx.db);
    // The same defense-in-depth re-check `?/renew` above carries: the retention step never offers
    // a way around the household-complete signing gate, whether or not the page that rendered its
    // button is the one still open in the browser.
    if (!(await householdSignaturesComplete(ctx.db, loadPublishedDocuments(documents, currentSeason), ctx.member.householdId, currentSeason))) {
      redirect(303, SIGN_REDIRECT);
    }

    const assetType = String(form.get('assetType') ?? '').trim();
    if (!assetType) return fail(400, { retainError: 'Missing asset type.' });

    const assignments = await listHouseholdAssignments(ctx.db, ctx.member.householdId, currentSeason);
    if (!assignments.some((assignment) => assignment.assetType === assetType)) {
      return fail(400, { retainError: 'Your household does not hold this asset.' });
    }

    // The duplicate guard (finding 2): a second submission for the same asset type must not
    // create a second pending row, so this checks the household's own existing requests before
    // inserting -- across every OPEN_RETENTION_STATUSES status, not just 'pending', so a request
    // an admin has already approved does not reopen the button and let a second click duplicate
    // an asset already granted.
    const requests = await listHouseholdRequests(ctx.db, ctx.member.householdId);
    const alreadyOpen = requests.some((request) => request.assetType === assetType && request.kind === 'retention' && OPEN_RETENTION_STATUSES.has(request.status));
    if (!alreadyOpen) {
      await createAssetRequest(ctx.db, { assetType, householdId: ctx.member.householdId, requestedBy: ctx.member.id, kind: 'retention', note: null });
    }

    return { retained: true as const };
  }),
};
