// The Club section's household desk (Task 4 read side, Task 5 write side,
// docs/plans/2026-07-14-membership-admin.md): the fixture-backed member-detail screen's
// successor, now with every desk action from the design doc's own household-desk section --
// roster CRUD (add/edit/archive/unarchive, visibility, household name/city/primary), household
// surgery (move member, merge household), a manual (check/cash/comp) payment, and a membership
// tier change. `id` in the URL is a household id; a member id (any surviving link to the old
// per-member detail route) resolves through `resolveMemberHousehold` and redirects to the
// household it belongs to. Refunds (Task 6) are not yet wired.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-roles';
import { clubAdminAction } from '$admin-club/lib/club-action';
import {
  getHouseholdDesk,
  resolveMemberHousehold,
  setHouseholdPrimary,
  setMemberArchived,
  updateHouseholdInfo,
  updateMembershipTier,
  updateRosterMember,
  type HouseholdDesk,
} from '$admin-club/lib/households-store';
import { getHouseholdTimeline, type TimelineTransaction } from '$admin-club/lib/money-store';
import { getHouseholdStanding, type HouseholdStanding } from '$member-auth/lib/standing';
import { addHouseholdMember, setDirectoryVisibility, type DirectoryVisibility } from '$member-portal/lib/household';
import { buildMergePlan, buildMovePlan } from '$admin-club/lib/household-surgery';
import { buildManualMembershipPayment, type ManualPaymentSource } from '$admin-club/lib/manual-payment';
import { getCurrentSeason, getTierPrices } from '$admin-club/lib/club-settings';
import type { MembershipTier } from '$admin-club/lib/member-types';

/** See `classes/[id]/+page.server.ts`'s identical `routeId` for why this narrow cast is safe. */
function routeId(event: unknown): string {
  return (event as { params: { id: string } }).params.id;
}

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  const id = event.params.id;

  if (!db) {
    return {
      desk: null as HouseholdDesk | null,
      timeline: [] as TimelineTransaction[],
      standing: null as HouseholdStanding | null,
      currentSeason: new Date().getUTCFullYear(),
      tierPrices: null as Record<MembershipTier, number> | null,
      error: 'CLUB_DB is not bound.',
    };
  }

  const desk = await getHouseholdDesk(db, id);
  if (!desk) {
    const householdId = await resolveMemberHousehold(db, id);
    if (householdId) redirect(307, `/admin/club/members/${householdId}`);
    return {
      desk: null,
      timeline: [] as TimelineTransaction[],
      standing: null as HouseholdStanding | null,
      currentSeason: new Date().getUTCFullYear(),
      tierPrices: null as Record<MembershipTier, number> | null,
      error: null as string | null,
    };
  }

  const [timeline, standing, currentSeason, tierPrices] = await Promise.all([
    getHouseholdTimeline(db, desk.id),
    getHouseholdStanding(db, desk.id),
    getCurrentSeason(db),
    getTierPrices(db),
  ]);

  return { desk, timeline, standing, currentSeason, tierPrices, error: null as string | null };
};

const DENIED_MESSAGE = 'A club role is required to manage members.';

function requiredField(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalField(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export const actions: Actions = {
  addMember: clubAdminAction(
    async ({ event, form, ctx }) => {
      const householdId = routeId(event);
      const name = requiredField(form, 'name');
      if (!name) {
        ctx.audit({ action: 'add', entity: 'member', entityId: householdId, detail: 'rejected: missing name' });
        return fail(400, { error: 'A name is required.' });
      }
      const memberId = await addHouseholdMember(ctx.db, householdId, {
        name,
        email: optionalField(form, 'email'),
        phone: optionalField(form, 'phone'),
        birthdate: optionalField(form, 'birthdate'),
      });
      ctx.audit({ action: 'add', entity: 'member', entityId: memberId, detail: `household=${householdId}` });
      return { ok: true };
    },
    { action: 'add', entity: 'member', deniedMessage: DENIED_MESSAGE },
  ),

  updateMember: clubAdminAction(
    async ({ form, ctx }) => {
      const memberId = requiredField(form, 'memberId');
      const name = requiredField(form, 'name');
      if (!memberId || !name) {
        ctx.audit({ action: 'update', entity: 'member', detail: 'rejected: missing memberId or name' });
        return fail(400, { error: 'A name is required.' });
      }
      await updateRosterMember(ctx.db, memberId, {
        name,
        email: optionalField(form, 'email'),
        phone: optionalField(form, 'phone'),
        birthdate: optionalField(form, 'birthdate'),
      });
      ctx.audit({ action: 'update', entity: 'member', entityId: memberId });
      return { ok: true };
    },
    { action: 'update', entity: 'member', deniedMessage: DENIED_MESSAGE },
  ),

  setArchived: clubAdminAction(
    async ({ form, ctx }) => {
      const memberId = requiredField(form, 'memberId');
      const archived = form.get('archived') === '1';
      if (!memberId) {
        ctx.audit({ action: 'archive', entity: 'member', detail: 'rejected: missing memberId' });
        return fail(400, { error: 'A member is required.' });
      }
      await setMemberArchived(ctx.db, memberId, archived);
      ctx.audit({ action: archived ? 'archive' : 'unarchive', entity: 'member', entityId: memberId });
      return { ok: true };
    },
    { action: 'archive', entity: 'member', deniedMessage: DENIED_MESSAGE },
  ),

  setVisibility: clubAdminAction(
    async ({ form, ctx }) => {
      const memberId = requiredField(form, 'memberId');
      const visibility = form.get('visibility');
      if (!memberId || (visibility !== 'visible' && visibility !== 'partial' && visibility !== 'hidden')) {
        ctx.audit({ action: 'visibility', entity: 'member', detail: 'rejected: missing memberId or bad visibility' });
        return fail(400, { error: 'A valid visibility is required.' });
      }
      await setDirectoryVisibility(ctx.db, memberId, visibility as DirectoryVisibility);
      ctx.audit({ action: 'visibility', entity: 'member', entityId: memberId, detail: visibility });
      return { ok: true };
    },
    { action: 'visibility', entity: 'member', deniedMessage: DENIED_MESSAGE },
  ),

  updateHousehold: clubAdminAction(
    async ({ event, form, ctx }) => {
      const householdId = routeId(event);
      const name = requiredField(form, 'name');
      if (!name) {
        ctx.audit({ action: 'update', entity: 'household', entityId: householdId, detail: 'rejected: missing name' });
        return fail(400, { error: 'A household name is required.' });
      }
      await updateHouseholdInfo(ctx.db, householdId, { name, city: optionalField(form, 'city') });
      const primaryMemberId = optionalField(form, 'primaryMemberId');
      if (primaryMemberId) await setHouseholdPrimary(ctx.db, householdId, primaryMemberId);
      ctx.audit({ action: 'update', entity: 'household', entityId: householdId });
      return { ok: true };
    },
    { action: 'update', entity: 'household', deniedMessage: DENIED_MESSAGE },
  ),

  moveMember: clubAdminAction(
    async ({ event, form, ctx }) => {
      const householdId = routeId(event);
      const memberId = requiredField(form, 'memberId');
      const targetHouseholdId = requiredField(form, 'targetHouseholdId');
      const newPrimaryId = optionalField(form, 'newPrimaryId');
      if (!memberId || !targetHouseholdId) {
        ctx.audit({ action: 'move', entity: 'member', entityId: householdId, detail: 'rejected: missing member or target' });
        return fail(400, { error: 'A member and a target household are both required.' });
      }
      const plan = await buildMovePlan(ctx.db, memberId, targetHouseholdId, newPrimaryId ?? undefined);
      if (!plan.ok) {
        ctx.audit({ action: 'move', entity: 'member', entityId: memberId, detail: `rejected: ${plan.error}` });
        return fail(400, { error: plan.error });
      }
      await ctx.db.batch(plan.statements);
      ctx.audit({ action: 'move', entity: 'member', entityId: memberId, detail: `to=${targetHouseholdId}` });
      redirect(303, `/admin/club/members/${targetHouseholdId}`);
    },
    { action: 'move', entity: 'member', deniedMessage: DENIED_MESSAGE },
  ),

  mergeHousehold: clubAdminAction(
    async ({ event, form, ctx }) => {
      const survivorId = routeId(event);
      const mergedId = requiredField(form, 'mergedHouseholdId');
      if (!mergedId) {
        ctx.audit({ action: 'merge', entity: 'household', entityId: survivorId, detail: 'rejected: missing household' });
        return fail(400, { error: 'A household to merge in is required.' });
      }
      if (mergedId === survivorId) {
        ctx.audit({ action: 'merge', entity: 'household', entityId: survivorId, detail: 'rejected: same household' });
        return fail(400, { error: 'A household cannot merge with itself.' });
      }
      const plan = await buildMergePlan(ctx.db, survivorId, mergedId);
      if (!plan.ok) {
        const seasons = plan.conflictSeasons.join(', ');
        ctx.audit({ action: 'merge', entity: 'household', entityId: survivorId, detail: `rejected: conflict seasons ${seasons}` });
        return fail(400, { error: `Both households hold a membership for ${seasons}. Resolve the duplicate season first.` });
      }
      await ctx.db.batch(plan.statements);
      ctx.audit({ action: 'merge', entity: 'household', entityId: survivorId, detail: `merged=${mergedId}` });
      return { ok: true };
    },
    { action: 'merge', entity: 'household', deniedMessage: DENIED_MESSAGE },
  ),

  recordPayment: clubAdminAction(
    async ({ event, form, ctx }) => {
      const householdId = routeId(event);
      const seasonRaw = requiredField(form, 'season');
      const amountRaw = requiredField(form, 'amount');
      const tier = form.get('tier');
      const source = form.get('source');
      const memo = optionalField(form, 'memo');
      const season = seasonRaw ? Number(seasonRaw) : NaN;
      const amountDollars = amountRaw ? Number(amountRaw) : NaN;
      const validTier = tier === 'individual' || tier === 'family' || tier === 'young-adult';
      const validSource = source === 'check' || source === 'cash' || source === 'comp';
      if (!Number.isInteger(season) || !validTier || !Number.isFinite(amountDollars) || amountDollars < 0 || !validSource) {
        ctx.audit({ action: 'record-payment', entity: 'transaction', entityId: householdId, detail: 'rejected: invalid input' });
        return fail(400, { error: 'A season, tier, non-negative amount, and source are all required.' });
      }
      const result = await buildManualMembershipPayment(ctx.db, {
        householdId,
        season,
        tier: tier as MembershipTier,
        amountCents: Math.round(amountDollars * 100),
        source: source as ManualPaymentSource,
        memo,
      });
      if (!result.ok) {
        ctx.audit({ action: 'record-payment', entity: 'transaction', entityId: householdId, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      await ctx.db.batch(result.statements);
      ctx.audit({ action: 'record-payment', entity: 'transaction', entityId: result.membershipId, detail: `household=${householdId} season=${season}` });
      return { ok: true };
    },
    { action: 'record-payment', entity: 'transaction', deniedMessage: DENIED_MESSAGE },
  ),

  changeTier: clubAdminAction(
    async ({ form, ctx }) => {
      const membershipId = requiredField(form, 'membershipId');
      const tier = form.get('tier');
      const validTier = tier === 'individual' || tier === 'family' || tier === 'young-adult';
      if (!membershipId || !validTier) {
        ctx.audit({ action: 'change-tier', entity: 'membership', detail: 'rejected: missing membership or bad tier' });
        return fail(400, { error: 'A membership and a valid tier are both required.' });
      }
      await updateMembershipTier(ctx.db, membershipId, tier as MembershipTier);
      ctx.audit({ action: 'change-tier', entity: 'membership', entityId: membershipId, detail: tier });
      return { ok: true };
    },
    { action: 'change-tier', entity: 'membership', deniedMessage: DENIED_MESSAGE },
  ),
};
