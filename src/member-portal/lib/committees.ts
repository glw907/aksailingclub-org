// The member-facing committees domain (member-directory pass T6b, docs/plans/2026-07-17-member-
// directory.md and docs/2026-07-17-roles-committees-design.md): the read that powers
// /my-account/committees and the SERVER-SIDE authorization guards every write on that page runs
// through. Authorization derives from the MEMBER model (the roles spec's permissions table),
// never cairn's editor roles: a "board member" is any member holding an `officer` or `director`
// `member_positions.kind` row (roles spec decision 3 -- a query on `kind`, never a title-string
// match), and a committee's "manager" is a board member OR that committee's own active chair or
// co-chair. The self-service actions (request/cancel/leave) fold the actor's own `member_id` into
// the write's WHERE clause and check `changes`, so a member can never cancel another member's
// request or make someone else leave. The manager and board actions reuse `committees-store.ts`'s
// own write functions (the admin CRUD data layer, T6) after the guard, so the portal and the admin
// screen can never drift on the actual SQL a promotion or a removal runs.
import type { D1Database } from '@cloudflare/workers-types';
import {
  addCommitteeMember,
  approveCommitteeMember,
  createCommittee,
  listCommittees,
  removeCommitteeMember,
  setCommitteeArchived,
  setCommitteeMemberRole,
  updateCommittee,
  type CommitteeKind,
  type CommitteeRole,
} from '$admin-club/lib/committees-store';

/** A guarded write's result: `{ ok: true }` when the actor was authorized and the write ran,
 *  `{ ok: false, error }` when the actor lacked the right or the target row was not found. The
 *  route maps `error` straight to the form's own error message. */
export type GuardResult = { ok: true } | { ok: false; error: string };

const NOT_AUTHORIZED = 'You do not have permission to do that.';
const NOT_FOUND = 'That committee record no longer exists.';

/** One active chair or co-chair, carrying the member id the portal links to the directory on (a
 *  chair name links to `/my-account/directory?q=<name>`, never a contact field: reachability lives
 *  in the directory where the visibility dial is enforced). */
export interface CommitteeChair {
  committeeMemberId: string;
  memberId: string;
  name: string;
  role: 'chair' | 'co-chair';
}

/** One active plain member on a committee's roster (a `role = 'member'` row). Chairs render on
 *  their own "Chair -- Name" lines above, so they never double-list here. `name` shows regardless
 *  of the member's `directory_visibility` (roles spec decision 5: serving is a visible act);
 *  contact never appears on this page. */
export interface RosterMember {
  committeeMemberId: string;
  memberId: string;
  name: string;
}

/** One pending join request, rendered only to the requester (as their own "Request sent" state)
 *  and to the committee's managers (as the approve/decline queue). */
export interface PendingRequest {
  committeeMemberId: string;
  memberId: string;
  name: string;
}

/** The signed-in viewer's own relation to one committee, which drives the member affordance:
 *  `none` shows "Request to join", `pending` shows "Request sent" + Cancel, `member` shows
 *  "You're a member" + Leave. `committeeMemberId` is the viewer's own row, the id the cancel/leave
 *  actions target. */
export type ViewerRelation =
  | { kind: 'none' }
  | { kind: 'pending'; committeeMemberId: string }
  | { kind: 'member'; committeeMemberId: string; role: CommitteeRole };

/** One committee as /my-account/committees renders it for a specific viewer: the read-tier facts
 *  (name, description, standing caption, chairs, roster) plus the viewer's own relation and the
 *  manager-only pending queue. `viewerCanManage` is true when the viewer is a board member or this
 *  committee's own active chair/co-chair; the page renders the queue, roster-with-remove, and add
 *  affordance only then. */
export interface PortalCommittee {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: CommitteeKind;
  chairs: CommitteeChair[];
  roster: RosterMember[];
  pending: PendingRequest[];
  viewerRelation: ViewerRelation;
  viewerCanManage: boolean;
}

/** The whole /my-account/committees payload: every active committee for this viewer, plus the
 *  page-level `viewerIsBoard` flag that gates the "+ New committee" and per-committee Edit/Archive
 *  affordances. */
export interface PortalCommitteesView {
  committees: PortalCommittee[];
  viewerIsBoard: boolean;
}

interface MembershipRawRow {
  id: string;
  committee_id: string;
  member_id: string;
  member_name: string;
  role: CommitteeRole;
  status: 'pending' | 'active';
}

/** Whether a member is a board member: holds any `officer` or `director` position. This is the one
 *  authorization query the roles spec (decision 3) requires read off `member_positions.kind`, never
 *  a title-string match. */
export async function isBoardMember(db: D1Database, memberId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS present FROM member_positions WHERE member_id = ?1 AND kind IN ('officer','director') LIMIT 1")
    .bind(memberId)
    .first<{ present: number }>();
  return row !== null;
}

/** A member's active role on a committee, or `null` when they hold no active row there. A pending
 *  request is not an active role, so it never confers management rights. */
export async function activeRoleInCommittee(db: D1Database, memberId: string, committeeId: string): Promise<CommitteeRole | null> {
  const row = await db
    .prepare("SELECT role FROM committee_members WHERE member_id = ?1 AND committee_id = ?2 AND status = 'active' LIMIT 1")
    .bind(memberId, committeeId)
    .first<{ role: CommitteeRole }>();
  return row ? row.role : null;
}

/** Whether a member may manage a committee (approve/decline requests, add/remove members): a board
 *  member manages every committee, and a committee's own active chair or co-chair manages that one.
 *  Board membership is checked first so a board member never needs a per-committee role. */
export async function canManageCommittee(db: D1Database, memberId: string, committeeId: string): Promise<boolean> {
  if (await isBoardMember(db, memberId)) return true;
  const role = await activeRoleInCommittee(db, memberId, committeeId);
  return role === 'chair' || role === 'co-chair';
}

/** The active chair(s) and co-chair(s) of one committee, joined out to their names and emails, for
 *  the request-to-join notification (the route emails each of them). Ordered chair before co-chair.
 *  Never exposes these emails to the page; only the server-side notify path reads them. */
export async function listCommitteeChairContacts(
  db: D1Database,
  committeeId: string,
): Promise<{ name: string; email: string | null }[]> {
  const { results } = await db
    .prepare(
      `SELECT m.name AS name, m.email AS email
       FROM committee_members cm
       JOIN members m ON m.id = cm.member_id
       WHERE cm.committee_id = ?1 AND cm.status = 'active' AND cm.role IN ('chair','co-chair')
       ORDER BY cm.role, m.name`,
    )
    .bind(committeeId)
    .all<{ name: string; email: string | null }>();
  return results.map((r) => ({ name: r.name, email: r.email }));
}

/** One committee's own name, for the request-to-join notification's subject and body. */
export async function getCommitteeName(db: D1Database, committeeId: string): Promise<string | null> {
  const row = await db.prepare('SELECT name FROM committees WHERE id = ?1').bind(committeeId).first<{ name: string }>();
  return row ? row.name : null;
}

/**
 * The whole /my-account/committees view for one viewer: every active committee (archived ones drop
 * off entirely, roles spec decision 4), each carrying its chairs, its plain-member roster, the
 * viewer's own relation, and, for a committee the viewer manages, the pending-request queue. One
 * committee list read plus one membership read plus one board-check, grouped in JS, so the whole
 * page costs three queries regardless of club size. Archived members never appear on a roster
 * (the join drops them); every active member's NAME shows regardless of `directory_visibility`,
 * and no contact field is read here at all.
 */
export async function listPortalCommittees(db: D1Database, viewerId: string): Promise<PortalCommitteesView> {
  const [committees, membershipResult, viewerIsBoard] = await Promise.all([
    listCommittees(db),
    db
      .prepare(
        `SELECT cm.id, cm.committee_id, cm.member_id, m.name AS member_name, cm.role, cm.status
         FROM committee_members cm
         JOIN committees c ON c.id = cm.committee_id
         JOIN members m ON m.id = cm.member_id
         WHERE c.archived_at IS NULL AND m.archived_at IS NULL
         ORDER BY c.sort_order, c.name, m.name`,
      )
      .all<MembershipRawRow>(),
    isBoardMember(db, viewerId),
  ]);

  const byCommittee = new Map<string, MembershipRawRow[]>();
  for (const row of membershipResult.results) {
    const group = byCommittee.get(row.committee_id);
    if (group) group.push(row);
    else byCommittee.set(row.committee_id, [row]);
  }

  const portalCommittees: PortalCommittee[] = committees.map((committee) => {
    const rows = byCommittee.get(committee.id) ?? [];
    const chairs: CommitteeChair[] = rows
      .filter((r) => r.status === 'active' && (r.role === 'chair' || r.role === 'co-chair'))
      .map((r) => ({ committeeMemberId: r.id, memberId: r.member_id, name: r.member_name, role: r.role as 'chair' | 'co-chair' }))
      .sort((a, b) => (a.role === b.role ? 0 : a.role === 'chair' ? -1 : 1));
    const roster: RosterMember[] = rows
      .filter((r) => r.status === 'active' && r.role === 'member')
      .map((r) => ({ committeeMemberId: r.id, memberId: r.member_id, name: r.member_name }));

    const viewerRow = rows.find((r) => r.member_id === viewerId);
    let viewerRelation: ViewerRelation = { kind: 'none' };
    if (viewerRow) {
      viewerRelation =
        viewerRow.status === 'pending'
          ? { kind: 'pending', committeeMemberId: viewerRow.id }
          : { kind: 'member', committeeMemberId: viewerRow.id, role: viewerRow.role };
    }

    const viewerCanManage = Boolean(
      viewerIsBoard || (viewerRow?.status === 'active' && (viewerRow.role === 'chair' || viewerRow.role === 'co-chair')),
    );

    // Pending names reach the served page data ONLY for a manager of this committee (roles spec
    // decision 5: pending rows render to the requester and the committee's managers). A non-manager
    // sees their OWN pending state through `viewerRelation` above, never a list of other requesters,
    // so no other member's pending name is ever serialized into their page.
    const pending: PendingRequest[] = viewerCanManage
      ? rows
          .filter((r) => r.status === 'pending')
          .map((r) => ({ committeeMemberId: r.id, memberId: r.member_id, name: r.member_name }))
      : [];

    return {
      id: committee.id,
      slug: committee.slug,
      name: committee.name,
      description: committee.description,
      kind: committee.kind,
      chairs,
      roster,
      pending,
      viewerRelation,
      viewerCanManage,
    };
  });

  return { committees: portalCommittees, viewerIsBoard };
}

interface CommitteeMemberLookup {
  committeeId: string;
  memberId: string;
  status: 'pending' | 'active';
}

/** The target committee_member row a manager/board action names, or `null` when it is gone. */
async function getCommitteeMemberRow(db: D1Database, committeeMemberId: string): Promise<CommitteeMemberLookup | null> {
  const row = await db
    .prepare('SELECT committee_id, member_id, status FROM committee_members WHERE id = ?1')
    .bind(committeeMemberId)
    .first<{ committee_id: string; member_id: string; status: 'pending' | 'active' }>();
  return row ? { committeeId: row.committee_id, memberId: row.member_id, status: row.status } : null;
}

/**
 * Request to join a committee: inserts a `pending` row for the ACTOR themself (never another
 * member -- `actorId` is the write's own `member_id`). The insert is `INSERT OR IGNORE`, so a
 * duplicate request or an existing membership hits the `UNIQUE (committee_id, member_id)` pair
 * gracefully rather than throwing; `created` is `false` in that case, and the route skips the
 * chair notification for a no-op. Any listed member may do this, so there is no further guard.
 */
export async function requestToJoin(db: D1Database, args: { actorId: string; committeeId: string }): Promise<{ ok: true; created: boolean }> {
  const id = crypto.randomUUID();
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO committee_members (id, committee_id, member_id, role, status) VALUES (?1, ?2, ?3, 'member', 'pending')",
    )
    .bind(id, args.committeeId, args.actorId)
    .run();
  return { ok: true, created: (result.meta.changes ?? 0) > 0 };
}

/**
 * Cancel one's OWN pending request. Ownership and the pending state both fold into the DELETE's
 * WHERE clause (`member_id = actor AND status = 'pending'`), so a member can never cancel another
 * member's request and can never delete an already-approved membership through this path; a zero-
 * change delete (someone else's row, or none) returns the not-authorized error rather than
 * silently succeeding.
 */
export async function cancelOwnRequest(db: D1Database, args: { actorId: string; committeeMemberId: string }): Promise<GuardResult> {
  const result = await db
    .prepare("DELETE FROM committee_members WHERE id = ?1 AND member_id = ?2 AND status = 'pending'")
    .bind(args.committeeMemberId, args.actorId)
    .run();
  return (result.meta.changes ?? 0) > 0 ? { ok: true } : { ok: false, error: NOT_AUTHORIZED };
}

/**
 * Leave a committee one is an active member of. Same self-scoped shape as {@link cancelOwnRequest}:
 * ownership and the active state fold into the WHERE clause, so a member can only ever remove their
 * own active row, never make another member leave.
 */
export async function leaveOwnCommittee(db: D1Database, args: { actorId: string; committeeMemberId: string }): Promise<GuardResult> {
  const result = await db
    .prepare("DELETE FROM committee_members WHERE id = ?1 AND member_id = ?2 AND status = 'active'")
    .bind(args.committeeMemberId, args.actorId)
    .run();
  return (result.meta.changes ?? 0) > 0 ? { ok: true } : { ok: false, error: NOT_AUTHORIZED };
}

/** Approve a pending request: the actor must manage the request's own committee (a chair/co-chair
 *  of it, or any board member). A request in ANOTHER committee is refused because
 *  {@link canManageCommittee} resolves false there. Only a still-pending row can be approved. */
export async function approveRequest(db: D1Database, args: { actorId: string; committeeMemberId: string }): Promise<GuardResult> {
  const row = await getCommitteeMemberRow(db, args.committeeMemberId);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (row.status !== 'pending') return { ok: false, error: 'That request has already been handled.' };
  if (!(await canManageCommittee(db, args.actorId, row.committeeId))) return { ok: false, error: NOT_AUTHORIZED };
  await approveCommitteeMember(db, args.committeeMemberId);
  return { ok: true };
}

/** Decline a pending request: same manage guard as {@link approveRequest}; deletes the pending
 *  row (roles spec decision 4: a declined request keeps no history). */
export async function declineRequest(db: D1Database, args: { actorId: string; committeeMemberId: string }): Promise<GuardResult> {
  const row = await getCommitteeMemberRow(db, args.committeeMemberId);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (row.status !== 'pending') return { ok: false, error: 'That request has already been handled.' };
  if (!(await canManageCommittee(db, args.actorId, row.committeeId))) return { ok: false, error: NOT_AUTHORIZED };
  await removeCommitteeMember(db, args.committeeMemberId);
  return { ok: true };
}

/** Add a member directly (active) to a committee the actor manages: a chair/co-chair adds a plain
 *  member of their own committee, a board member adds to any. Reuses the admin store's own
 *  active-from-the-start insert. */
export async function addActiveMember(
  db: D1Database,
  args: { actorId: string; committeeId: string; memberId: string; role?: CommitteeRole },
): Promise<GuardResult> {
  if (!(await canManageCommittee(db, args.actorId, args.committeeId))) return { ok: false, error: NOT_AUTHORIZED };
  await addCommitteeMember(db, { committeeId: args.committeeId, memberId: args.memberId, role: args.role ?? 'member' });
  return { ok: true };
}

/** Remove an active member from a committee the actor manages. Same manage guard as the approve
 *  path, keyed off the target row's own committee, so a chair can never remove a member of another
 *  committee. */
export async function removeActiveMember(db: D1Database, args: { actorId: string; committeeMemberId: string }): Promise<GuardResult> {
  const row = await getCommitteeMemberRow(db, args.committeeMemberId);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (!(await canManageCommittee(db, args.actorId, row.committeeId))) return { ok: false, error: NOT_AUTHORIZED };
  await removeCommitteeMember(db, args.committeeMemberId);
  return { ok: true };
}

/** Appoint or change a chair/co-chair (or demote to plain member): BOARD MEMBERS ONLY (the roles
 *  spec's permissions table -- a chair cannot appoint chairs). Sets an existing active member's
 *  role. Reuses the admin store's own role update. */
export async function setMemberRoleAsBoard(
  db: D1Database,
  args: { actorId: string; committeeMemberId: string; role: CommitteeRole },
): Promise<GuardResult> {
  if (!(await isBoardMember(db, args.actorId))) return { ok: false, error: NOT_AUTHORIZED };
  const row = await getCommitteeMemberRow(db, args.committeeMemberId);
  if (!row) return { ok: false, error: NOT_FOUND };
  await setCommitteeMemberRole(db, args.committeeMemberId, args.role);
  return { ok: true };
}

/** Create a committee: BOARD MEMBERS ONLY. Reuses the admin store's own slug-deriving insert. */
export async function createCommitteeAsBoard(
  db: D1Database,
  args: { actorId: string; name: string; description: string | null; kind: CommitteeKind; sortOrder: number },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await isBoardMember(db, args.actorId))) return { ok: false, error: NOT_AUTHORIZED };
  const id = await createCommittee(db, { name: args.name, description: args.description, kind: args.kind, sortOrder: args.sortOrder });
  return { ok: true, id };
}

/** Edit a committee's name/description/kind/sort order: BOARD MEMBERS ONLY. */
export async function editCommitteeAsBoard(
  db: D1Database,
  args: { actorId: string; committeeId: string; name: string; description: string | null; kind: CommitteeKind; sortOrder: number },
): Promise<GuardResult> {
  if (!(await isBoardMember(db, args.actorId))) return { ok: false, error: NOT_AUTHORIZED };
  await updateCommittee(db, args.committeeId, { name: args.name, description: args.description, kind: args.kind, sortOrder: args.sortOrder });
  return { ok: true };
}

/** Archive (or restore) a committee: BOARD MEMBERS ONLY. Archiving keeps roster history and drops
 *  the committee off every member surface (the read filters `archived_at IS NULL`). */
export async function archiveCommitteeAsBoard(
  db: D1Database,
  args: { actorId: string; committeeId: string; archived: boolean },
): Promise<GuardResult> {
  if (!(await isBoardMember(db, args.actorId))) return { ok: false, error: NOT_AUTHORIZED };
  await setCommitteeArchived(db, args.committeeId, args.archived);
  return { ok: true };
}
