// /my-account/committees (member-directory pass T6b): the member-facing committees page. Every
// member sees the club's active committees, their chairs (linked to the directory), and rosters,
// and can request to join, cancel a pending request, or leave. Chairs and board members see
// management affordances derived from the MEMBER model (the roles spec's permissions table), never
// cairn's editor roles: the whole authorization for every write lives in `$member-portal/lib/
// committees.ts`'s guarded functions, which this route calls with the signed-in member's own id, so
// a predicate can never be enforced only in the template. `memberOptions` (the club roster the
// add-member and appoint pickers need) loads ONLY for a viewer who manages at least one committee,
// so a plain member's page never carries the whole member list.
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { issueMemberCsrfToken } from '$member-auth/lib/auth';
import { resolveMemberDb } from '$member-auth/lib/db';
import { portalAction } from '$member-portal/lib/portal-action';
import { listMemberOptions, type MemberOption } from '$admin-club/lib/assets-store';
import { sendClubEmail, type EmailBindingEnv } from '$admin-club/lib/club-email';
import {
  COMMITTEE_KINDS,
  COMMITTEE_ROLES,
  type CommitteeKind,
  type CommitteeRole,
} from '$admin-club/lib/committees-store';
import {
  addActiveMember,
  approveRequest,
  archiveCommitteeAsBoard,
  cancelOwnRequest,
  createCommitteeAsBoard,
  declineRequest,
  editCommitteeAsBoard,
  getCommitteeName,
  leaveOwnCommittee,
  listCommitteeChairContacts,
  listPortalCommittees,
  removeActiveMember,
  requestToJoin,
  setMemberRoleAsBoard,
} from '$member-portal/lib/committees';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
  const csrf = issueMemberCsrfToken(event);
  const { member } = await event.parent();
  if (!member) redirect(303, '/my-account');

  const db = resolveMemberDb(event.platform?.env);
  if (!db) error(503, 'Not available right now.');

  const view = await listPortalCommittees(db, member.id);
  const managesSomething = view.viewerIsBoard || view.committees.some((c) => c.viewerCanManage);
  const memberOptions: MemberOption[] = managesSomething ? await listMemberOptions(db) : [];

  return { csrf, view, memberOptions };
};

function requireId(form: FormData, field: string): string | { error: string } {
  const value = form.get(field);
  if (typeof value !== 'string' || !value.trim()) return { error: 'Something went wrong. Please try again.' };
  return value.trim();
}

function parseCommittee(form: FormData): { name: string; description: string | null; kind: CommitteeKind; sortOrder: number } | { error: string } {
  const name = form.get('name');
  if (typeof name !== 'string' || !name.trim()) return { error: 'A name is required.' };
  const kind = form.get('kind');
  if (typeof kind !== 'string' || !COMMITTEE_KINDS.includes(kind as CommitteeKind)) return { error: 'A valid kind is required.' };
  const sortRaw = form.get('sortOrder');
  const sortOrder = typeof sortRaw === 'string' && sortRaw.trim() !== '' ? Number(sortRaw) : 0;
  if (!Number.isInteger(sortOrder)) return { error: 'Sort order must be a whole number.' };
  const descRaw = form.get('description');
  const description = typeof descRaw === 'string' && descRaw.trim() !== '' ? descRaw.trim() : null;
  return { name: name.trim(), description, kind: kind as CommitteeKind, sortOrder };
}

function parseRole(form: FormData): CommitteeRole | { error: string } {
  const role = form.get('role');
  if (typeof role !== 'string' || !COMMITTEE_ROLES.includes(role as CommitteeRole)) return { error: 'A valid role is required.' };
  return role as CommitteeRole;
}

/** Notify a committee's active chair(s) that a member asked to join. A plain notification, never an
 *  approval token (the chair approves in the portal); best-effort, degrading silently with no EMAIL
 *  binding, the same posture the household screen's leave notify uses. */
async function notifyChairsOfRequest(
  db: Parameters<typeof listCommitteeChairContacts>[0],
  env: EmailBindingEnv | undefined,
  committeeId: string,
  requesterName: string,
): Promise<void> {
  if (!env?.EMAIL) return;
  const [committeeName, chairs] = await Promise.all([getCommitteeName(db, committeeId), listCommitteeChairContacts(db, committeeId)]);
  const name = committeeName ?? 'a committee';
  for (const chair of chairs) {
    if (!chair.email) continue;
    await sendClubEmail(db, env, {
      to: chair.email,
      raw: {
        subject: `New request to join ${name}`,
        body: '{{requester_name}} has asked to join {{committee_name}}. Approve or decline the request from your committees page in the member portal.',
      },
      vars: { requester_name: requesterName, committee_name: name },
    });
  }
}

export const actions: Actions = {
  request: portalAction(async ({ form, ctx, event }) => {
    const committeeId = requireId(form, 'committeeId');
    if (typeof committeeId !== 'string') return { error: committeeId.error };
    const result = await requestToJoin(ctx.db, { actorId: ctx.member.id, committeeId });
    if (result.created) {
      await notifyChairsOfRequest(ctx.db, event.platform?.env as EmailBindingEnv | undefined, committeeId, ctx.member.name);
    }
    return { saved: true as const };
  }),

  cancelRequest: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const result = await cancelOwnRequest(ctx.db, { actorId: ctx.member.id, committeeMemberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  leave: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const result = await leaveOwnCommittee(ctx.db, { actorId: ctx.member.id, committeeMemberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  approve: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const result = await approveRequest(ctx.db, { actorId: ctx.member.id, committeeMemberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  decline: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const result = await declineRequest(ctx.db, { actorId: ctx.member.id, committeeMemberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  addMember: portalAction(async ({ form, ctx }) => {
    const committeeId = requireId(form, 'committeeId');
    if (typeof committeeId !== 'string') return { error: committeeId.error };
    const memberId = requireId(form, 'memberId');
    if (typeof memberId !== 'string') return { error: memberId.error };
    const result = await addActiveMember(ctx.db, { actorId: ctx.member.id, committeeId, memberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  removeMember: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const result = await removeActiveMember(ctx.db, { actorId: ctx.member.id, committeeMemberId });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  // Board-only: appoint or change a chair/co-chair, or demote to plain member (a role update on an
  // existing active membership).
  setRole: portalAction(async ({ form, ctx }) => {
    const committeeMemberId = requireId(form, 'committeeMemberId');
    if (typeof committeeMemberId !== 'string') return { error: committeeMemberId.error };
    const role = parseRole(form);
    if (typeof role !== 'string') return { error: role.error };
    const result = await setMemberRoleAsBoard(ctx.db, { actorId: ctx.member.id, committeeMemberId, role });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  createCommittee: portalAction(async ({ form, ctx }) => {
    const parsed = parseCommittee(form);
    if ('error' in parsed) return { error: parsed.error };
    const result = await createCommitteeAsBoard(ctx.db, { actorId: ctx.member.id, ...parsed });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  editCommittee: portalAction(async ({ form, ctx }) => {
    const committeeId = requireId(form, 'committeeId');
    if (typeof committeeId !== 'string') return { error: committeeId.error };
    const parsed = parseCommittee(form);
    if ('error' in parsed) return { error: parsed.error };
    const result = await editCommitteeAsBoard(ctx.db, { actorId: ctx.member.id, committeeId, ...parsed });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),

  archiveCommittee: portalAction(async ({ form, ctx }) => {
    const committeeId = requireId(form, 'committeeId');
    if (typeof committeeId !== 'string') return { error: committeeId.error };
    const result = await archiveCommitteeAsBoard(ctx.db, { actorId: ctx.member.id, committeeId, archived: true });
    if (!result.ok) return { error: result.error };
    return { saved: true as const };
  }),
};
