// The member-facing committees domain (T6b, plus the T6b fix round's security findings): the
// read that powers /my-account/committees and, above all, the SERVER-SIDE authorization guards
// every write on that page runs through. Each actor tier is covered including its DENIAL cases
// (the roles spec's permissions table is the contract): a plain member cannot
// approve/decline/add/remove/appoint/edit/archive; a chair cannot touch another committee's queue
// or roster and cannot appoint chairs; a non-board member cannot create/edit/archive; a member
// cannot cancel someone else's request or make someone else leave; a duplicate request hits the
// UNIQUE pair gracefully; a request for an archived/nonexistent committee is refused; a repeat
// request within the notify cooldown suppresses `shouldNotify`; approve/decline/remove/setRole
// refuse a row whose committee has since been archived, and setRole refuses a still-pending row.
import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  activeRoleInCommittee,
  addActiveMember,
  approveRequest,
  archiveCommitteeAsBoard,
  canManageCommittee,
  cancelOwnRequest,
  createCommitteeAsBoard,
  declineRequest,
  editCommitteeAsBoard,
  isBoardMember,
  leaveOwnCommittee,
  listCommitteeChairContacts,
  listPortalCommittees,
  removeActiveMember,
  requestNotifiedRecently,
  requestNotifySegment,
  requestToJoin,
  setMemberRoleAsBoard,
} from '$member-portal/lib/committees';

const BOARD_PRESENT = { 'FROM member_positions WHERE member_id': { present: 1 } };
const BOARD_ABSENT = { 'FROM member_positions WHERE member_id': null };
const COMMITTEE_ACTIVE = { 'FROM committees WHERE id': { present: 1 } };
const COMMITTEE_ARCHIVED = { 'FROM committees WHERE id': null };

describe('isBoardMember', () => {
  it('is true when the member holds an officer or director position', async () => {
    const { db } = fakeD1({ firstResults: BOARD_PRESENT });
    await expect(isBoardMember(db, 'mem-1')).resolves.toBe(true);
  });

  it('is false when the member holds no board position', async () => {
    const { db } = fakeD1({ firstResults: BOARD_ABSENT });
    await expect(isBoardMember(db, 'mem-1')).resolves.toBe(false);
  });

  it('reads kind, never a title string', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_PRESENT });
    await isBoardMember(db, 'mem-1');
    const call = calls.find((c) => c.sql.includes('FROM member_positions'));
    expect(call?.sql).toContain("kind IN ('officer','director')");
  });
});

describe('activeRoleInCommittee', () => {
  it('returns the active role, and only for an active row', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM committee_members WHERE member_id': { role: 'chair' } } });
    await expect(activeRoleInCommittee(db, 'mem-1', 'cmt-1')).resolves.toBe('chair');
    const call = calls.find((c) => c.sql.includes('FROM committee_members WHERE member_id'));
    expect(call?.sql).toContain("status = 'active'");
  });

  it('returns null when the member holds no active row there', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM committee_members WHERE member_id': null } });
    await expect(activeRoleInCommittee(db, 'mem-1', 'cmt-1')).resolves.toBe(null);
  });
});

describe('canManageCommittee', () => {
  it('lets a board member manage any committee without a per-committee role', async () => {
    const { db } = fakeD1({ firstResults: BOARD_PRESENT });
    await expect(canManageCommittee(db, 'mem-board', 'cmt-1')).resolves.toBe(true);
  });

  it("lets a committee's own active chair manage it", async () => {
    const { db } = fakeD1({ firstResults: { ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'chair' } } });
    await expect(canManageCommittee(db, 'mem-chair', 'cmt-1')).resolves.toBe(true);
  });

  it('denies a plain member', async () => {
    const { db } = fakeD1({ firstResults: { ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'member' } } });
    await expect(canManageCommittee(db, 'mem-plain', 'cmt-1')).resolves.toBe(false);
  });

  it("denies a chair of ANOTHER committee (no active row in this one)", async () => {
    const { db } = fakeD1({ firstResults: { ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': null } });
    await expect(canManageCommittee(db, 'mem-chair-elsewhere', 'cmt-1')).resolves.toBe(false);
  });
});

describe('requestToJoin', () => {
  it('inserts a pending row for the actor themself and asks the route to notify', async () => {
    const { db, calls } = fakeD1({ firstResults: COMMITTEE_ACTIVE });
    const result = await requestToJoin(db, { actorId: 'mem-1', committeeId: 'cmt-1' });
    expect(result).toEqual({ ok: true, created: true, shouldNotify: true });
    const insert = calls.find((c) => c.sql.includes('INSERT OR IGNORE INTO committee_members'));
    expect(insert?.sql).toContain("'member', 'pending'");
    // bind order is (id, committeeId, actorId): the actor is always the row's own member_id
    expect(insert?.args[1]).toBe('cmt-1');
    expect(insert?.args[2]).toBe('mem-1');
  });

  it('hits the UNIQUE pair gracefully on a duplicate (created=false, no throw, no notify)', async () => {
    const { db } = fakeD1({
      firstResults: COMMITTEE_ACTIVE,
      runResults: { 'INSERT OR IGNORE INTO committee_members': { changes: 0 } },
    });
    await expect(requestToJoin(db, { actorId: 'mem-1', committeeId: 'cmt-1' })).resolves.toEqual({
      ok: true,
      created: false,
      shouldNotify: false,
    });
  });

  it('refuses a committee that does not exist or is archived, and never inserts', async () => {
    const { db, calls } = fakeD1({ firstResults: COMMITTEE_ARCHIVED });
    const result = await requestToJoin(db, { actorId: 'mem-1', committeeId: 'cmt-gone' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO committee_members'))).toBe(false);
  });

  it('suppresses shouldNotify when a request for this pair already notified recently', async () => {
    const { db } = fakeD1({
      firstResults: { ...COMMITTEE_ACTIVE, 'FROM email_log WHERE segment': { present: 1 } },
    });
    const result = await requestToJoin(db, { actorId: 'mem-1', committeeId: 'cmt-1' });
    expect(result).toEqual({ ok: true, created: true, shouldNotify: false });
  });
});

describe('requestNotifiedRecently', () => {
  it('is true when a send was logged for this pair within the cooldown window', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM email_log WHERE segment': { present: 1 } } });
    await expect(requestNotifiedRecently(db, { committeeId: 'cmt-1', actorId: 'mem-1' })).resolves.toBe(true);
    const call = calls.find((c) => c.sql.includes('FROM email_log WHERE segment'));
    expect(call?.args[0]).toBe(requestNotifySegment('cmt-1', 'mem-1'));
  });

  it('is false when no matching send is logged', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM email_log WHERE segment': null } });
    await expect(requestNotifiedRecently(db, { committeeId: 'cmt-1', actorId: 'mem-1' })).resolves.toBe(false);
  });
});

describe('cancelOwnRequest', () => {
  it('deletes only the actor\'s own pending row (ownership + pending folded into WHERE)', async () => {
    const { db, calls } = fakeD1();
    const result = await cancelOwnRequest(db, { actorId: 'mem-1', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: true });
    const del = calls.find((c) => c.sql.startsWith('DELETE FROM committee_members'));
    expect(del?.sql).toContain('member_id = ?2');
    expect(del?.sql).toContain("status = 'pending'");
    expect(del?.args).toEqual(['cm-1', 'mem-1']);
  });

  it("refuses when the row is not the actor's own (zero changes)", async () => {
    const { db } = fakeD1({ runResults: { 'DELETE FROM committee_members': { changes: 0 } } });
    await expect(cancelOwnRequest(db, { actorId: 'mem-1', committeeMemberId: 'cm-of-someone-else' })).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});

describe('leaveOwnCommittee', () => {
  it('deletes only the actor\'s own active row', async () => {
    const { db, calls } = fakeD1();
    const result = await leaveOwnCommittee(db, { actorId: 'mem-1', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: true });
    const del = calls.find((c) => c.sql.startsWith('DELETE FROM committee_members'));
    expect(del?.sql).toContain('member_id = ?2');
    expect(del?.sql).toContain("status = 'active'");
    expect(del?.args).toEqual(['cm-1', 'mem-1']);
  });

  it('cannot make another member leave (zero changes)', async () => {
    const { db } = fakeD1({ runResults: { 'DELETE FROM committee_members': { changes: 0 } } });
    await expect(leaveOwnCommittee(db, { actorId: 'mem-1', committeeMemberId: 'cm-of-someone-else' })).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});

const PENDING_ROW = { 'FROM committee_members WHERE id': { committee_id: 'cmt-1', member_id: 'mem-req', status: 'pending' } };
const ACTIVE_ROW = { 'FROM committee_members WHERE id': { committee_id: 'cmt-1', member_id: 'mem-x', status: 'active' } };

describe('approveRequest', () => {
  it('lets a board member approve', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_PRESENT } });
    await expect(approveRequest(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes("SET status = 'active'"))).toBe(true);
  });

  it("lets the committee's own chair approve", async () => {
    const { db } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'chair' } } });
    await expect(approveRequest(db, { actorId: 'mem-chair', committeeMemberId: 'cm-1' })).resolves.toEqual({ ok: true });
  });

  it('DENIES a plain member and never writes', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'member' } } });
    const result = await approveRequest(db, { actorId: 'mem-plain', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes("SET status = 'active'"))).toBe(false);
  });

  it('DENIES a chair of another committee (no active role in the request\'s committee)', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': null } });
    const result = await approveRequest(db, { actorId: 'mem-chair-elsewhere', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes("SET status = 'active'"))).toBe(false);
  });

  it('refuses a missing row', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM committee_members WHERE id': null } });
    await expect(approveRequest(db, { actorId: 'mem-board', committeeMemberId: 'gone' })).resolves.toEqual({ ok: false, error: expect.any(String) });
  });

  it('refuses an already-active row', async () => {
    const { db } = fakeD1({ firstResults: { ...ACTIVE_ROW, ...BOARD_PRESENT } });
    await expect(approveRequest(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' })).resolves.toEqual({ ok: false, error: expect.any(String) });
  });

  it('refuses a request whose committee has since been archived, and never writes', async () => {
    const { db, calls } = fakeD1({
      firstResults: { ...PENDING_ROW, ...BOARD_PRESENT, 'SELECT archived_at FROM committees': { archived_at: '2026-01-01' } },
    });
    const result = await approveRequest(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes("SET status = 'active'"))).toBe(false);
  });
});

describe('declineRequest', () => {
  it('lets a manager decline (deletes the pending row)', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_PRESENT } });
    await expect(declineRequest(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(true);
  });

  it('DENIES a plain member and never deletes', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...PENDING_ROW, ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'member' } } });
    const result = await declineRequest(db, { actorId: 'mem-plain', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(false);
  });

  it('refuses a request whose committee has since been archived, and never deletes', async () => {
    const { db, calls } = fakeD1({
      firstResults: { ...PENDING_ROW, ...BOARD_PRESENT, 'SELECT archived_at FROM committees': { archived_at: '2026-01-01' } },
    });
    const result = await declineRequest(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(false);
  });
});

describe('addActiveMember', () => {
  it('lets a manager add an active member', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_PRESENT });
    await expect(addActiveMember(db, { actorId: 'mem-board', committeeId: 'cmt-1', memberId: 'mem-new' })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO committee_members'))).toBe(true);
  });

  it('DENIES a plain member and never inserts', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'member' } } });
    const result = await addActiveMember(db, { actorId: 'mem-plain', committeeId: 'cmt-1', memberId: 'mem-new' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO committee_members'))).toBe(false);
  });

  it('fails gracefully (no throw) when the member already holds a row on this committee', async () => {
    const { db } = fakeD1({
      firstResults: BOARD_PRESENT,
      runResults: { 'INSERT OR IGNORE INTO committee_members': { changes: 0 } },
    });
    await expect(addActiveMember(db, { actorId: 'mem-board', committeeId: 'cmt-1', memberId: 'mem-dup' })).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});

describe('removeActiveMember', () => {
  it('lets a manager remove a member of their committee', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...ACTIVE_ROW, ...BOARD_PRESENT } });
    await expect(removeActiveMember(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(true);
  });

  it('DENIES a chair of another committee', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...ACTIVE_ROW, ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': null } });
    const result = await removeActiveMember(db, { actorId: 'mem-chair-elsewhere', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(false);
  });

  it('refuses a member of a committee that has since been archived, and never deletes', async () => {
    const { db, calls } = fakeD1({
      firstResults: { ...ACTIVE_ROW, ...BOARD_PRESENT, 'SELECT archived_at FROM committees': { archived_at: '2026-01-01' } },
    });
    const result = await removeActiveMember(db, { actorId: 'mem-board', committeeMemberId: 'cm-1' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM committee_members'))).toBe(false);
  });
});

describe('setMemberRoleAsBoard (appoint/change chair)', () => {
  it('lets a board member set a role', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...BOARD_PRESENT, ...ACTIVE_ROW } });
    await expect(setMemberRoleAsBoard(db, { actorId: 'mem-board', committeeMemberId: 'cm-1', role: 'chair' })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes('SET role = ?1'))).toBe(true);
  });

  it('DENIES a chair (appointing chairs is board-only) and never writes', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...BOARD_ABSENT, 'FROM committee_members WHERE member_id': { role: 'chair' } } });
    const result = await setMemberRoleAsBoard(db, { actorId: 'mem-chair', committeeMemberId: 'cm-1', role: 'chair' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('SET role = ?1'))).toBe(false);
  });

  it('refuses a still-pending row (a role change can never mint a pending chair)', async () => {
    const { db, calls } = fakeD1({ firstResults: { ...BOARD_PRESENT, ...PENDING_ROW } });
    const result = await setMemberRoleAsBoard(db, { actorId: 'mem-board', committeeMemberId: 'cm-1', role: 'chair' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('SET role = ?1'))).toBe(false);
  });

  it('refuses a row whose committee has since been archived', async () => {
    const { db, calls } = fakeD1({
      firstResults: { ...BOARD_PRESENT, ...ACTIVE_ROW, 'SELECT archived_at FROM committees': { archived_at: '2026-01-01' } },
    });
    const result = await setMemberRoleAsBoard(db, { actorId: 'mem-board', committeeMemberId: 'cm-1', role: 'chair' });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('SET role = ?1'))).toBe(false);
  });
});

describe('createCommitteeAsBoard / editCommitteeAsBoard / archiveCommitteeAsBoard', () => {
  it('lets a board member create', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_PRESENT });
    const result = await createCommitteeAsBoard(db, { actorId: 'mem-board', name: 'New', description: null, kind: 'established', sortOrder: 9 });
    expect(result).toEqual({ ok: true, id: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('INSERT INTO committees'))).toBe(true);
  });

  it('DENIES a non-board member from creating', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_ABSENT });
    const result = await createCommitteeAsBoard(db, { actorId: 'mem-plain', name: 'New', description: null, kind: 'established', sortOrder: 9 });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('INSERT INTO committees'))).toBe(false);
  });

  it('DENIES a non-board member from editing', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_ABSENT });
    const result = await editCommitteeAsBoard(db, { actorId: 'mem-plain', committeeId: 'cmt-1', name: 'X', description: null, kind: 'established', sortOrder: 0 });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('UPDATE committees'))).toBe(false);
  });

  it('DENIES a non-board member from archiving', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_ABSENT });
    const result = await archiveCommitteeAsBoard(db, { actorId: 'mem-plain', committeeId: 'cmt-1', archived: true });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('UPDATE committees'))).toBe(false);
  });

  it('lets a board member archive', async () => {
    const { db, calls } = fakeD1({ firstResults: BOARD_PRESENT });
    await expect(archiveCommitteeAsBoard(db, { actorId: 'mem-board', committeeId: 'cmt-1', archived: true })).resolves.toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE committees'))).toBe(true);
  });
});

describe('listCommitteeChairContacts', () => {
  it('reads active chairs/co-chairs joined to name and email', async () => {
    const { db, calls } = fakeD1({
      allResults: { "cm.role IN ('chair','co-chair')": [{ name: 'Steve Ryan', email: 'steve@example.com' }] },
    });
    const contacts = await listCommitteeChairContacts(db, 'cmt-fleet');
    expect(contacts).toEqual([{ name: 'Steve Ryan', email: 'steve@example.com' }]);
    const call = calls.find((c) => c.sql.includes("cm.role IN ('chair','co-chair')"));
    expect(call?.sql).toContain("cm.status = 'active'");
  });
});

describe('listPortalCommittees', () => {
  const COMMITTEES = [
    { id: 'cmt-1', slug: 'fleet', name: 'Fleet Committee', description: 'Boats.', kind: 'established', sort_order: 0, archived_at: null },
  ];
  const memberships = [
    { id: 'cm-chair', committee_id: 'cmt-1', member_id: 'mem-chair', member_name: 'Steve Ryan', role: 'chair', status: 'active' },
    { id: 'cm-plain', committee_id: 'cmt-1', member_id: 'mem-plain', member_name: 'Jake Black', role: 'member', status: 'active' },
    { id: 'cm-pend', committee_id: 'cmt-1', member_id: 'mem-req', member_name: 'Taylor Donovan', role: 'member', status: 'pending' },
  ];

  it('splits chairs, roster, and pending; derives the viewer relation and manage right', async () => {
    const { db } = fakeD1({
      allResults: { 'FROM committees': COMMITTEES, 'FROM committee_members cm': memberships },
      firstResults: BOARD_PRESENT, // viewer is board -> can manage, sees pending
    });
    const view = await listPortalCommittees(db, 'mem-board');
    expect(view.viewerIsBoard).toBe(true);
    const cmt = view.committees[0];
    expect(cmt.chairs.map((c) => c.name)).toEqual(['Steve Ryan']);
    expect(cmt.roster.map((r) => r.name)).toEqual(['Jake Black']);
    expect(cmt.viewerCanManage).toBe(true);
    expect(cmt.pending.map((p) => p.name)).toEqual(['Taylor Donovan']);
    expect(cmt.viewerRelation).toEqual({ kind: 'none' });
  });

  it('never serializes pending names for a non-manager viewer', async () => {
    const { db } = fakeD1({
      allResults: { 'FROM committees': COMMITTEES, 'FROM committee_members cm': memberships },
      firstResults: BOARD_ABSENT, // plain viewer
    });
    const view = await listPortalCommittees(db, 'mem-plain');
    const cmt = view.committees[0];
    expect(cmt.viewerCanManage).toBe(false);
    expect(cmt.pending).toEqual([]);
    // The plain viewer is himself an active member here.
    expect(cmt.viewerRelation).toEqual({ kind: 'member', committeeMemberId: 'cm-plain', role: 'member' });
  });

  it("surfaces the requester's own pending state through viewerRelation, not the queue", async () => {
    const { db } = fakeD1({
      allResults: { 'FROM committees': COMMITTEES, 'FROM committee_members cm': memberships },
      firstResults: BOARD_ABSENT,
    });
    const view = await listPortalCommittees(db, 'mem-req');
    const cmt = view.committees[0];
    expect(cmt.pending).toEqual([]);
    expect(cmt.viewerRelation).toEqual({ kind: 'pending', committeeMemberId: 'cm-pend' });
  });
});
