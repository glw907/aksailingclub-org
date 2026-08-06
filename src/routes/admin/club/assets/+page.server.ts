// The Club section's Assets screen (Part 2): the by-asset and by-person lenses over the same
// active-assignment read, the single polymorphic waitlist queue, and every write path (assign,
// release, record a payment, add/remove/move-to-end on the waitlist), all gated the same
// `clubAdminAction` way Classes and Events already establish. Replaces the structural placeholder
// this route previously shipped.
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import type { EmailBindingEnv } from '$admin-club/lib/club-email';
import { sendAssetDecisionEmail } from '$member-portal/lib/asset-decision-notify';
import {
  addToWaitlist,
  assignAsset,
  getAssignment,
  getWaitlistEntry,
  getWaitlistHead,
  listActiveAssignments,
  listAssetTypes,
  listAssetWaitlist,
  listMemberOptions,
  listMembershipOptions,
  moveToEndOfWaitlist,
  promoteWaitlistEntry,
  recordPayment,
  releaseAssignment,
  removeFromWaitlist,
  updateAssetType,
  type AssetTypeRow,
  type AssetWaitlistDisplayRow,
  type AssignmentDisplayRow,
  type MemberOption,
  type MembershipOption,
} from '$admin-club/lib/assets-store';
import {
  parseAssetTypeEditForm,
  parseAssignForm,
  parsePaymentForm,
  parseWaitlistAddForm,
  parseWaitlistPromoteForm,
} from './assets-form-input';

/** The narrow bridge this route reads `EMAIL` off `event.platform.env` through, matching
 *  `asset-requests/+page.server.ts`'s own precedent: `CairnEvent`'s `platform.env` is typed by
 *  cairn's own narrow `CairnEnv`, which never expresses a site-only binding. */
function resolveEmailEnv(env: unknown): EmailBindingEnv {
  return (env as EmailBindingEnv | undefined) ?? {};
}

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) {
    return {
      assetTypes: [] as AssetTypeRow[],
      assignments: [] as AssignmentDisplayRow[],
      waitlist: [] as AssetWaitlistDisplayRow[],
      membershipOptions: [] as MembershipOption[],
      memberOptions: [] as MemberOption[],
      currentSeason: 0,
      error: 'CLUB_DB is not bound.',
    };
  }
  const currentSeason = await getCurrentSeason(db);
  const [assetTypes, assignments, waitlist, membershipOptions, memberOptions] = await Promise.all([
    listAssetTypes(db),
    listActiveAssignments(db, currentSeason),
    listAssetWaitlist(db),
    listMembershipOptions(db, currentSeason),
    listMemberOptions(db),
  ]);
  return { assetTypes, assignments, waitlist, membershipOptions, memberOptions, currentSeason, error: null as string | null };
};

const DENIED_MESSAGE = 'A club role is required to manage assets.';

export const actions: Actions = {
  assign: clubAdminAction(
    async ({ form, ctx }) => {
      const parsed = parseAssignForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'assign', entity: 'assignment', detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const id = await assignAsset(ctx.db, parsed);
      ctx.audit({ action: 'assign', entity: 'assignment', entityId: id });
      return { ok: true };
    },
    { action: 'assign', entity: 'assignment', deniedMessage: DENIED_MESSAGE },
  ),

  release: clubAdminAction(
    async ({ form, ctx }) => {
      const id = form.get('assignmentId');
      if (typeof id !== 'string' || !id.trim()) {
        ctx.audit({ action: 'release', entity: 'assignment', detail: 'rejected: missing assignmentId' });
        return fail(400, { error: 'An assignment is required.' });
      }
      const existing = await getAssignment(ctx.db, id);
      if (!existing) {
        ctx.audit({ action: 'release', entity: 'assignment', entityId: id, detail: 'rejected: no such assignment' });
        return fail(404, { error: 'No such assignment.' });
      }
      await releaseAssignment(ctx.db, id);
      ctx.audit({ action: 'release', entity: 'assignment', entityId: id });
      return { ok: true };
    },
    { action: 'release', entity: 'assignment', deniedMessage: DENIED_MESSAGE },
  ),

  recordPayment: clubAdminAction(
    async ({ form, ctx }) => {
      const assignmentId = form.get('assignmentId');
      if (typeof assignmentId !== 'string' || !assignmentId.trim()) {
        ctx.audit({ action: 'record-payment', entity: 'asset-payment', detail: 'rejected: missing assignmentId' });
        return fail(400, { error: 'An assignment is required.' });
      }
      const existing = await getAssignment(ctx.db, assignmentId);
      if (!existing) {
        ctx.audit({ action: 'record-payment', entity: 'asset-payment', entityId: assignmentId, detail: 'rejected: no such assignment' });
        return fail(404, { error: 'No such assignment.' });
      }
      const parsed = parsePaymentForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'record-payment', entity: 'asset-payment', entityId: assignmentId, detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const currentSeason = await getCurrentSeason(ctx.db);
      await recordPayment(ctx.db, { assignmentId, season: currentSeason, ...parsed });
      ctx.audit({ action: 'record-payment', entity: 'asset-payment', entityId: assignmentId, detail: `method=${parsed.method}` });
      return { ok: true };
    },
    { action: 'record-payment', entity: 'asset-payment', deniedMessage: DENIED_MESSAGE },
  ),

  waitlistAdd: clubAdminAction(
    async ({ form, ctx }) => {
      const parsed = parseWaitlistAddForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'add', entity: 'asset-waitlist', detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const id = await addToWaitlist(ctx.db, parsed);
      ctx.audit({ action: 'add', entity: 'asset-waitlist', entityId: id });
      return { ok: true };
    },
    { action: 'add', entity: 'asset-waitlist', deniedMessage: DENIED_MESSAGE },
  ),

  waitlistRemove: clubAdminAction(
    async ({ form, ctx }) => {
      const id = form.get('waitlistId');
      if (typeof id !== 'string' || !id.trim()) {
        ctx.audit({ action: 'remove', entity: 'asset-waitlist', detail: 'rejected: missing waitlistId' });
        return fail(400, { error: 'A waitlist entry is required.' });
      }
      await removeFromWaitlist(ctx.db, id);
      ctx.audit({ action: 'remove', entity: 'asset-waitlist', entityId: id });
      return { ok: true };
    },
    { action: 'remove', entity: 'asset-waitlist', deniedMessage: DENIED_MESSAGE },
  ),

  waitlistMoveToEnd: clubAdminAction(
    async ({ form, ctx }) => {
      const id = form.get('waitlistId');
      if (typeof id !== 'string' || !id.trim()) {
        ctx.audit({ action: 'reorder', entity: 'asset-waitlist', detail: 'rejected: missing waitlistId' });
        return fail(400, { error: 'A waitlist entry is required.' });
      }
      const existing = await getWaitlistEntry(ctx.db, id);
      if (!existing) {
        ctx.audit({ action: 'reorder', entity: 'asset-waitlist', entityId: id, detail: 'rejected: no such waitlist entry' });
        return fail(404, { error: 'No such waitlist entry.' });
      }
      await moveToEndOfWaitlist(ctx.db, id, existing.assetType);
      ctx.audit({ action: 'reorder', entity: 'asset-waitlist', entityId: id });
      return { ok: true };
    },
    { action: 'reorder', entity: 'asset-waitlist', deniedMessage: DENIED_MESSAGE },
  ),

  waitlistPromote: clubAdminAction(
    async ({ event, form, ctx }) => {
      const parsed = parseWaitlistPromoteForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'promote', entity: 'asset-waitlist', detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const head = await getWaitlistHead(ctx.db, parsed.assetType);
      if (!head) {
        ctx.audit({ action: 'promote', entity: 'asset-waitlist', detail: `rejected: no waitlist entry for ${parsed.assetType}` });
        return fail(404, { error: 'No one is waiting for that asset type.' });
      }
      const currentSeason = await getCurrentSeason(ctx.db);
      const result = await promoteWaitlistEntry(ctx.db, head, currentSeason);
      if ('error' in result) {
        ctx.audit({ action: 'promote', entity: 'asset-waitlist', entityId: head.id, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      ctx.audit({ action: 'promote', entity: 'asset-waitlist', entityId: head.id, detail: `assignment=${result.assignmentId}` });

      // Email delivery is deliberately NOT part of the write's atomicity above: the assignment
      // and dequeue already committed, so a send failure here is reported back rather than
      // swallowed or rolled back (the ordering ruling this route follows).
      const emailResult = await sendAssetDecisionEmail(ctx.db, resolveEmailEnv(event.platform?.env), {
        kind: 'slot_opened',
        waitlistId: head.id,
        origin: event.url.origin,
        resolved: result.emailPayload,
      });
      return { ok: true, assignmentId: result.assignmentId, emailSent: emailResult.ok, emailError: emailResult.ok ? null : emailResult.error };
    },
    { action: 'promote', entity: 'asset-waitlist', deniedMessage: DENIED_MESSAGE },
  ),

  editType: clubAdminAction(
    async ({ form, ctx }) => {
      const id = form.get('id');
      if (typeof id !== 'string' || !id.trim()) {
        ctx.audit({ action: 'edit', entity: 'asset-type', detail: 'rejected: missing id' });
        return fail(400, { error: 'An asset type is required.' });
      }
      const parsed = parseAssetTypeEditForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'edit', entity: 'asset-type', entityId: id, detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      await updateAssetType(ctx.db, id, parsed);
      ctx.audit({ action: 'edit', entity: 'asset-type', entityId: id });
      return { ok: true };
    },
    { action: 'edit', entity: 'asset-type', deniedMessage: DENIED_MESSAGE },
  ),
};
