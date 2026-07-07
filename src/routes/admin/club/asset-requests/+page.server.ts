// /admin/club/asset-requests: the request review inbox (portal-capstone scope item 6, the signup
// queue's exact pattern applied to `asset_requests`). approve branches by kind: 'new' assigns
// directly into a free slot or queues; 'retention' opens the pay task (the merit gate, never
// assigns outright). deny requires a reason, matching the signup queue's own convention.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { resolveClubDb } from '$admin-club/lib/club-roles';
import { approveNewRequest, approveRetentionRequest, denyAssetRequest, listPendingAssetRequests } from '$member-portal/lib/assets';

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) return { requests: [] };
  return { requests: await listPendingAssetRequests(db) };
};

function requireRequestId(formData: FormData): string | null {
  const id = formData.get('id');
  return typeof id === 'string' && id ? id : null;
}

const DENIED_MESSAGE = 'A club role is required to review asset requests.';

export const actions: Actions = {
  approveNew: clubAdminAction(
    async ({ form, ctx }) => {
      const id = requireRequestId(form);
      if (!id) {
        ctx.audit({ action: 'approve', entity: 'asset-request', detail: 'rejected: missing request id' });
        return fail(400, { error: 'Missing request id.' });
      }
      const result = await approveNewRequest(ctx.db, id, ctx.editor.email);
      if ('error' in result) {
        ctx.audit({ action: 'approve', entity: 'asset-request', entityId: id, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      ctx.audit({ action: 'approve', entity: 'asset-request', entityId: id, detail: result.outcome });
      redirect(303, '/admin/club/asset-requests');
    },
    { action: 'approve', entity: 'asset-request', deniedMessage: DENIED_MESSAGE },
  ),

  approveRetention: clubAdminAction(
    async ({ form, ctx }) => {
      const id = requireRequestId(form);
      if (!id) {
        ctx.audit({ action: 'approve', entity: 'asset-request', detail: 'rejected: missing request id' });
        return fail(400, { error: 'Missing request id.' });
      }
      const result = await approveRetentionRequest(ctx.db, id, ctx.editor.email);
      if ('error' in result) {
        ctx.audit({ action: 'approve', entity: 'asset-request', entityId: id, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      ctx.audit({ action: 'approve', entity: 'asset-request', entityId: id, detail: 'approved_awaiting_payment' });
      redirect(303, '/admin/club/asset-requests');
    },
    { action: 'approve', entity: 'asset-request', deniedMessage: DENIED_MESSAGE },
  ),

  deny: clubAdminAction(
    async ({ form, ctx }) => {
      const id = requireRequestId(form);
      if (!id) {
        ctx.audit({ action: 'deny', entity: 'asset-request', detail: 'rejected: missing request id' });
        return fail(400, { error: 'Missing request id.' });
      }
      const reason = form.get('reason');
      if (typeof reason !== 'string' || !reason.trim()) {
        ctx.audit({ action: 'deny', entity: 'asset-request', entityId: id, detail: 'rejected: missing reason' });
        return fail(400, { error: 'A reason is required to deny a request.', id });
      }
      const trimmedReason = reason.trim();
      const result = await denyAssetRequest(ctx.db, id, trimmedReason, ctx.editor.email);
      if ('error' in result) {
        ctx.audit({ action: 'deny', entity: 'asset-request', entityId: id, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      ctx.audit({ action: 'deny', entity: 'asset-request', entityId: id, detail: trimmedReason });
      redirect(303, '/admin/club/asset-requests');
    },
    { action: 'deny', entity: 'asset-request', deniedMessage: DENIED_MESSAGE },
  ),
};
