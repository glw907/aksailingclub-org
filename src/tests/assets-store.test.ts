import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  addToWaitlist,
  assignAsset,
  getAssignment,
  getWaitlistEntry,
  getWaitlistHead,
  listActiveAssignments,
  listAssetTypes,
  listAssetWaitlist,
  listAssignments,
  listMemberOptions,
  listMembershipOptions,
  moveToEndOfWaitlist,
  promoteWaitlistEntry,
  recordPayment,
  releaseAssignment,
  removeFromWaitlist,
  updateAssetType,
  type WaitlistHeadEntry,
} from '$admin-club/lib/assets-store';
import { getHouseholdDesk, listHouseholds } from '$admin-club/lib/households-store';

describe('listAssetTypes', () => {
  it('maps each raw row to the camelCased shape', async () => {
    const { db } = fakeD1({
      allResults: { 'FROM asset_types ORDER BY': [{ id: 'mooring', name: 'Mooring', fee: 300, capacity: 12, sort_order: 1 }] },
    });
    await expect(listAssetTypes(db)).resolves.toEqual([{ id: 'mooring', name: 'Mooring', fee: 300, capacity: 12, sortOrder: 1 }]);
  });
});

describe('updateAssetType', () => {
  it('writes name, fee, and capacity, keyed by id in the WHERE clause, never the SET clause', async () => {
    const { db, calls } = fakeD1();
    await updateAssetType(db, 'mooring', { name: 'Mooring (renamed)', fee: 350, capacity: 15 });
    expect(calls).toEqual([
      { sql: 'UPDATE asset_types SET name = ?1, fee = ?2, capacity = ?3 WHERE id = ?4', args: ['Mooring (renamed)', 350, 15, 'mooring'] },
    ]);
    // The id appears only after WHERE: no SET clause token contains it, so no code path here can
    // ever rename the row (asset_types.id keys the waiver signing lists).
    const setClause = calls[0].sql.split('WHERE')[0];
    expect(setClause).not.toContain('id');
  });

  it('clears capacity to null as a supported edit', async () => {
    const { db, calls } = fakeD1();
    await updateAssetType(db, 'boat-parking', { name: 'Trailered Boat Parking', fee: 0, capacity: null });
    expect(calls[0].args).toEqual(['Trailered Boat Parking', 0, null, 'boat-parking']);
  });

  it('accepts a capacity below the current active-assignment count, issuing no guard read', async () => {
    // No fixture answering a COUNT-style read: if this function queried current assignments to
    // guard the new capacity, the fake would still answer, but the point is it never asks --
    // capacity is advisory only, never a write barrier.
    const { db, calls } = fakeD1();
    await expect(updateAssetType(db, 'small-boat-rack', { name: 'Small Boat Rack', fee: 100, capacity: 1 })).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls.some((c) => c.sql.includes('COUNT'))).toBe(false);
  });
});

const ASSIGNMENT_RAW_ROW = {
  id: 'a-1',
  asset_type: 'mooring',
  asset_type_name: 'Mooring',
  membership_id: 'ms-1',
  household_id: 'hh-1',
  household_name: 'The Larsens',
  primary_member_name: 'Kaija Larsen',
  description: 'Buoy M-14',
  status: 'active',
  created_at: '2026-01-01 00:00:00',
  payment_id: null,
  paid_at: null,
};

describe('listActiveAssignments', () => {
  const RAW = ASSIGNMENT_RAW_ROW;

  it('derives not-billed when no payment row exists', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM asset_assignments aa': [RAW] } });
    const rows = await listActiveAssignments(db, 2026);
    expect(rows).toEqual([
      {
        id: 'a-1',
        assetType: 'mooring',
        assetTypeName: 'Mooring',
        membershipId: 'ms-1',
        householdId: 'hh-1',
        householdName: 'The Larsens',
        primaryMemberName: 'Kaija Larsen',
        description: 'Buoy M-14',
        status: 'active',
        createdAt: '2026-01-01 00:00:00',
        paymentId: null,
        paymentStanding: 'not-billed',
      },
    ]);
    expect(calls[0].args).toEqual([2026, 'active']);
  });

  it('derives outstanding when a payment row exists with no paid_at', async () => {
    const { db } = fakeD1({ allResults: { 'FROM asset_assignments aa': [{ ...RAW, payment_id: 'p-1', paid_at: null }] } });
    const rows = await listActiveAssignments(db, 2026);
    expect(rows[0].paymentStanding).toBe('outstanding');
  });

  it('derives paid when a payment row has paid_at set', async () => {
    const { db } = fakeD1({ allResults: { 'FROM asset_assignments aa': [{ ...RAW, payment_id: 'p-1', paid_at: '2026-03-01 00:00:00' }] } });
    const rows = await listActiveAssignments(db, 2026);
    expect(rows[0].paymentStanding).toBe('paid');
  });
});

describe('listAssignments', () => {
  it('returns an empty array for an empty statuses scope without querying the database', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM asset_assignments aa': [ASSIGNMENT_RAW_ROW] } });
    const rows = await listAssignments(db, 2026, { statuses: [], orderBy: 'type-household' });
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('binds each status as a placeholder rather than interpolating it into the WHERE clause', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM asset_assignments aa': [ASSIGNMENT_RAW_ROW] } });
    await listAssignments(db, 2026, { statuses: ['active', 'released'], orderBy: 'status-season' });
    const [call] = calls;
    // The status scope itself must never appear as a literal in the WHERE clause: only the
    // fixed, caller-uncontrolled CASE literal in the payment join (asserted separately below)
    // may.
    expect(call.sql).toContain('WHERE aa.status IN (?2, ?3)');
    expect(call.sql).not.toContain("IN ('active'");
    expect(call.sql).not.toContain("IN ('released'");
    expect(call.args).toEqual([2026, 'active', 'released']);
  });

  it('derives a released row\'s payment standing from its own season, not the current one', async () => {
    const PAST_RELEASED_ROW = {
      ...ASSIGNMENT_RAW_ROW,
      status: 'released',
      season: 2024,
      payment_id: 'ap-2024',
      paid_at: '2024-03-01 00:00:00',
    };
    const { db, calls } = fakeD1({ allResults: { 'FROM asset_assignments aa': [PAST_RELEASED_ROW] } });
    const [row] = await listAssignments(db, 2026, { statuses: ['released'], orderBy: 'status-season' });
    expect(row.paymentStanding).toBe('paid');
    const [call] = calls;
    expect(call.sql).toContain("ap.season = CASE WHEN aa.status = 'released' THEN m.season ELSE ?1 END");
  });
});

describe('the shared lens agrees across its three consumers (Task 3)', () => {
  // The same seeded assignment, read through each of the three lenses that now all query
  // through `listAssignments`: the Assets screen's own `listActiveAssignments`, the Members
  // list's holding chips (`listHouseholds`), and the household desk's Assets panel
  // (`getHouseholdDesk`). Each gets its own fake database, since the point under test is that
  // the shared query produces the same asset type, description, and payment standing no matter
  // which consumer reads it, not that one literal SQL call is reused across three unrelated
  // route handlers.
  const SEEDED_ROW = {
    id: 'aa-agree',
    asset_type: 'mooring',
    asset_type_name: 'Mooring',
    membership_id: 'ms-agree',
    household_id: 'hh-agree',
    household_name: 'The Agreeing Household',
    primary_member_name: 'Kaija Agreeing',
    season: 2026,
    description: 'Buoy M-9',
    status: 'active',
    created_at: '2026-01-01 00:00:00',
    payment_id: 'ap-agree',
    paid_at: '2026-02-01 00:00:00',
  };

  it('the Assets screen sees the assignment as paid, ordered by type then household', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM asset_assignments aa': [SEEDED_ROW] } });
    const [row] = await listActiveAssignments(db, 2026);
    expect(row).toMatchObject({ assetType: 'mooring', description: 'Buoy M-9', paymentStanding: 'paid' });
    const assetsCall = calls.find((c) => c.sql.includes('FROM asset_assignments aa'));
    // Guards the constraint that each of the three lenses keeps its own pre-consolidation
    // ordering: the Assets screen groups by asset type then household name.
    expect(assetsCall?.sql).toContain('ORDER BY at.sort_order, h.name');
  });

  it('the Members-list holding chip agrees, binding only the season (no household scope)', async () => {
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM households h': [
          { id: 'hh-agree', name: 'The Agreeing Household', city: null, primary_member_id: null, former_at: null, season: 2026, paid_at: '2026-01-01' },
        ],
        'FROM asset_assignments aa': [SEEDED_ROW],
      },
    });
    const [household] = await listHouseholds(db);
    expect(household.holdings[0]).toMatchObject({ assetTypeName: 'Mooring', description: 'Buoy M-9', paymentStanding: 'paid' });
    const assetsCall = calls.find((c) => c.sql.includes('FROM asset_assignments aa'));
    // Guards the constraint that the Members list reads the whole club in one set-based query,
    // never narrowed to one household, and orders by type then asset name (never household name,
    // which is the Assets screen's own distinct order).
    expect(assetsCall?.sql).toContain('ORDER BY at.sort_order, at.name');
    expect(assetsCall?.args).toEqual([2026, 'active']);
  });

  it('the household desk Assets panel agrees, keeping released rows and scoping to this one household', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM households WHERE id': { id: 'hh-agree', name: 'The Agreeing Household', city: null, primary_member_id: null },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        'FROM asset_assignments aa': [SEEDED_ROW],
      },
    });
    const desk = await getHouseholdDesk(db, 'hh-agree');
    expect(desk?.assets[0]).toMatchObject({ assetType: 'mooring', assetTypeName: 'Mooring', description: 'Buoy M-9', paymentStanding: 'paid' });
    const assetsCall = calls.find((c) => c.sql.includes('FROM asset_assignments aa'));
    // Guards the three constraints the desk alone carries: it asks for BOTH statuses (never
    // narrowed to active-only, which would silently drop its released-history rows), it binds
    // the household id to scope the read to this one household, and it orders by status then
    // season (never the other two lenses' asset-type-first order).
    expect(assetsCall?.sql).toContain('WHERE aa.status IN (?2, ?3)');
    expect(assetsCall?.sql).toContain('ORDER BY aa.status ASC, m.season DESC');
    expect(assetsCall?.args).toEqual([2026, 'active', 'released', 'hh-agree']);
  });
});

describe('getAssignment', () => {
  it('maps a found row, normalizing status', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_assignments WHERE id': { id: 'a-1', status: 'released', asset_type: 'mooring' } } });
    await expect(getAssignment(db, 'a-1')).resolves.toEqual({ id: 'a-1', status: 'released', assetType: 'mooring' });
  });

  it('returns null for no such row', async () => {
    const { db } = fakeD1();
    await expect(getAssignment(db, 'missing')).resolves.toBeNull();
  });
});

describe('listMembershipOptions', () => {
  it('maps each row, filtering to the given season via the bound argument', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM memberships m': [{ membership_id: 'ms-1', household_id: 'hh-1', household_name: 'The Larsens', primary_member_name: 'Kaija Larsen' }],
      },
    });
    await expect(listMembershipOptions(db, 2026)).resolves.toEqual([
      { membershipId: 'ms-1', householdId: 'hh-1', householdName: 'The Larsens', primaryMemberName: 'Kaija Larsen' },
    ]);
    expect(calls[0].args).toEqual([2026]);
  });
});

describe('listMemberOptions', () => {
  it('maps each row, excluding archived members via the WHERE clause', async () => {
    const { db, calls } = fakeD1({
      allResults: { 'FROM members m': [{ member_id: 'mem-1', name: 'Kaija Larsen', email: 'kaija@example.com', household_name: 'The Larsens' }] },
    });
    await expect(listMemberOptions(db)).resolves.toEqual([
      { memberId: 'mem-1', name: 'Kaija Larsen', email: 'kaija@example.com', householdName: 'The Larsens' },
    ]);
    expect(calls[0].sql).toContain('archived_at IS NULL');
  });
});

describe('assignAsset', () => {
  it('inserts one active assignment row', async () => {
    const { db, calls } = fakeD1();
    const id = await assignAsset(db, { assetType: 'mooring', membershipId: 'ms-1', description: 'Buoy M-14' });
    expect(typeof id).toBe('string');
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_assignments'));
    expect(insert?.args).toEqual([id, 'mooring', 'ms-1', 'Buoy M-14', 'active']);
  });
});

describe('releaseAssignment', () => {
  it('updates status to released', async () => {
    const { db, calls } = fakeD1();
    await releaseAssignment(db, 'a-1');
    expect(calls).toEqual([{ sql: "UPDATE asset_assignments SET status = 'released' WHERE id = ?1", args: ['a-1'] }]);
  });
});

describe('recordPayment', () => {
  it('upserts a payment row with paid_at stamped now', async () => {
    const { db, calls } = fakeD1();
    await recordPayment(db, { assignmentId: 'a-1', season: 2026, amount: 300, method: 'check', reference: 'Check #1234' });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_payments'));
    expect(insert?.sql).toContain('ON CONFLICT (assignment_id, season) DO UPDATE');
    expect(insert?.args.slice(1)).toEqual(['a-1', 2026, 300, 'check', 'Check #1234']);
  });
});

describe('listAssetWaitlist', () => {
  it('maps each raw row', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_waitlist aw': [
          {
            id: 'w-1',
            asset_type: 'mooring',
            asset_type_name: 'Mooring',
            member_id: 'mem-1',
            member_name: 'Kaija Larsen',
            member_email: 'kaija@example.com',
            position: 1,
            requested_at: '2026-01-01 00:00:00',
            notes: null,
          },
        ],
      },
    });
    await expect(listAssetWaitlist(db)).resolves.toEqual([
      {
        id: 'w-1',
        assetType: 'mooring',
        assetTypeName: 'Mooring',
        memberId: 'mem-1',
        memberName: 'Kaija Larsen',
        memberEmail: 'kaija@example.com',
        position: 1,
        requestedAt: '2026-01-01 00:00:00',
        notes: null,
      },
    ]);
  });
});

describe('addToWaitlist', () => {
  it('appends to the end of the type-specific queue', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE asset_type': { max_position: 2 } } });
    const id = await addToWaitlist(db, { assetType: 'mooring', memberId: 'mem-1', notes: null });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_waitlist'));
    expect(insert?.args).toEqual([id, 'mooring', 'mem-1', 3, null]);
  });

  it('starts at position 1 when the queue is empty', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE asset_type': null } });
    await addToWaitlist(db, { assetType: 'mooring', memberId: 'mem-1', notes: null });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_waitlist'));
    expect(insert?.args[3]).toBe(1);
  });
});

describe('removeFromWaitlist', () => {
  it('deletes the one row', async () => {
    const { db, calls } = fakeD1();
    await removeFromWaitlist(db, 'w-1');
    expect(calls).toEqual([{ sql: 'DELETE FROM asset_waitlist WHERE id = ?1', args: ['w-1'] }]);
  });
});

describe('getWaitlistEntry', () => {
  it('maps a found row', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' } } });
    await expect(getWaitlistEntry(db, 'w-1')).resolves.toEqual({ id: 'w-1', assetType: 'mooring' });
  });

  it('returns null for no such row', async () => {
    const { db } = fakeD1();
    await expect(getWaitlistEntry(db, 'missing')).resolves.toBeNull();
  });
});

describe('moveToEndOfWaitlist', () => {
  it('sets position past every other entry in the same type', async () => {
    const { db, calls } = fakeD1();
    await moveToEndOfWaitlist(db, 'w-1', 'mooring');
    expect(calls).toEqual([{ sql: expect.stringContaining('UPDATE asset_waitlist SET position'), args: ['w-1', 'mooring'] }]);
  });
});

describe('getWaitlistHead', () => {
  it('picks the lowest-position entry for the given asset type, ignoring other types', async () => {
    // The responder is keyed on the bound asset_type argument, standing in for the real WHERE
    // clause + ORDER BY position ASC LIMIT 1 that a live D1 would apply: a call for 'mooring'
    // must never see the 'rv-parking' queue's own head.
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_waitlist aw': ((args: unknown[]) =>
          args[0] === 'mooring'
            ? { id: 'w-head', asset_type: 'mooring', asset_type_name: 'Mooring', member_id: 'mem-head' }
            : { id: 'w-other', asset_type: 'rv-parking', asset_type_name: 'RV Parking', member_id: 'mem-other' }) as never,
      },
    });
    await expect(getWaitlistHead(db, 'mooring')).resolves.toEqual({
      id: 'w-head',
      assetType: 'mooring',
      assetTypeName: 'Mooring',
      memberId: 'mem-head',
    });
    expect(calls[0].sql).toContain('WHERE aw.asset_type = ?1');
    expect(calls[0].sql).toContain('ORDER BY aw.position ASC');
    expect(calls[0].args).toEqual(['mooring']);
  });

  it('returns null when the type has no waitlist entries', async () => {
    const { db } = fakeD1();
    await expect(getWaitlistHead(db, 'mooring')).resolves.toBeNull();
  });
});

const HEAD_ENTRY: WaitlistHeadEntry = { id: 'w-1', assetType: 'mooring', assetTypeName: 'Mooring', memberId: 'mem-1' };

describe('promoteWaitlistEntry', () => {
  it('creates the assignment, removes the entry, and reports the assignment id plus the email payload', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members m': { membership_id: 'ms-1', household_id: 'hh-1' },
        'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' },
      },
    });
    const result = await promoteWaitlistEntry(db, HEAD_ENTRY, 2026);
    expect(result).toEqual({
      ok: true,
      assignmentId: expect.any(String),
      emailPayload: { memberId: 'mem-1', householdId: 'hh-1', assetTypeName: 'Mooring' },
    });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_assignments'));
    expect(insert?.args).toEqual([(result as { assignmentId: string }).assignmentId, 'mooring', 'ms-1', null, 'active']);
    const remove = calls.find((c) => c.sql.startsWith('DELETE FROM asset_waitlist'));
    expect(remove?.args).toEqual(['w-1']);
  });

  it('binds the member id and current season against memberships, never inventing a membership', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members m': { membership_id: 'ms-1', household_id: 'hh-1' },
        'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' },
      },
    });
    await promoteWaitlistEntry(db, HEAD_ENTRY, 2026);
    const membershipRead = calls.find((c) => c.sql.includes('FROM members m'));
    expect(membershipRead?.sql).toContain('ms.season = ?2');
    expect(membershipRead?.args).toEqual(['mem-1', 2026]);
  });

  it('fails with nothing written when the member has no current-season membership', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM members m': null } });
    const result = await promoteWaitlistEntry(db, HEAD_ENTRY, 2026);
    expect(result).toEqual({ error: expect.stringContaining('current-season membership') });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM asset_waitlist'))).toBe(false);
  });

  it('fails when the waitlist entry no longer exists, writing nothing', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members m': { membership_id: 'ms-1', household_id: 'hh-1' },
        'FROM asset_waitlist WHERE id': null,
      },
    });
    const result = await promoteWaitlistEntry(db, HEAD_ENTRY, 2026);
    expect(result).toEqual({ error: expect.stringContaining('No such waitlist entry') });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM asset_waitlist'))).toBe(false);
  });

  it('succeeds against a type already at or over capacity: capacity is never checked here', async () => {
    // No 'FROM asset_types' fixture at all: if this function queried capacity, the fake would
    // still answer (with a fallback), but the point is it never asks in the first place -- the
    // admin's own promotion call is the deliberate override, not a check to satisfy.
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members m': { membership_id: 'ms-1', household_id: 'hh-1' },
        'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' },
      },
    });
    const result = await promoteWaitlistEntry(db, HEAD_ENTRY, 2026);
    expect(result).toEqual({ ok: true, assignmentId: expect.any(String), emailPayload: expect.any(Object) });
    expect(calls.some((c) => c.sql.includes('asset_types'))).toBe(false);
  });
});
