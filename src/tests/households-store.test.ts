import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { getHouseholdDesk, listHouseholds, resolveMemberHousehold } from '$admin-club/lib/households-store';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('listHouseholds', () => {
  it('maps a multi-member household, sorting the primary member first', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [
          { id: 'hh-larsen', name: 'The Larsens', city: 'Anchorage', primary_member_id: 'mem-erik', season: 2026, paid_at: daysAgo(30) },
        ],
        'FROM members': [
          // Kaija sorts alphabetically before Erik, but Erik is primary: primary-first still wins.
          { id: 'mem-kaija', household_id: 'hh-larsen', name: 'Kaija Larsen', email: 'kaija@example.com', phone: '+19075550101', birthdate: '2010-05-01', archived_at: null },
          { id: 'mem-erik', household_id: 'hh-larsen', name: 'Erik Larsen', email: 'erik@example.com', phone: '+19075550100', birthdate: '1980-01-01', archived_at: null },
        ],
      },
    });

    const rows = await listHouseholds(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'hh-larsen', standing: 'current', lastSeason: 2026 });
    expect(rows[0].members).toEqual([
      { id: 'mem-erik', name: 'Erik Larsen', email: 'erik@example.com', phone: '+19075550100', birthdate: '1980-01-01', archived: false, isPrimary: true, matchedSearch: false },
      { id: 'mem-kaija', name: 'Kaija Larsen', email: 'kaija@example.com', phone: '+19075550101', birthdate: '2010-05-01', archived: false, isPrimary: false, matchedSearch: false },
    ]);
  });

  it('reads none for a household with no grounding row at all', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ id: 'hh-fresh', name: 'Fresh Household', city: null, primary_member_id: null, season: null, paid_at: null }],
        'FROM members': [],
      },
    });

    const [row] = await listHouseholds(db);
    expect(row.standing).toBe('none');
    expect(row.lastSeason).toBeNull();
  });

  it('reads Overdue off elapsed time alone, and Former only once the household is actually recorded so', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [
          // expiry = paid + 365 = 15 days ago; no former_at recorded.
          { id: 'hh-overdue', name: 'Overdue Household', city: null, primary_member_id: null, season: 2025, paid_at: daysAgo(380), former_at: null },
          // expiry = 35 days ago; the sweep already recorded former_at.
          { id: 'hh-former', name: 'Former Household', city: null, primary_member_id: null, season: 2024, paid_at: daysAgo(400), former_at: daysAgo(5) },
        ],
        'FROM members': [],
      },
    });

    const rows = await listHouseholds(db);
    expect(rows.find((r) => r.id === 'hh-overdue')?.standing).toBe('overdue');
    expect(rows.find((r) => r.id === 'hh-former')?.standing).toBe('former');
  });

  it('ignores a refunded row via the grounding query itself (asserted on the SQL text)', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM households h': [], 'FROM members': [] } });
    await listHouseholds(db);
    const groundingCall = calls.find((c) => c.sql.includes('FROM households h'));
    expect(groundingCall?.sql).toContain('mm.refunded_at IS NULL');
  });

  it('reads a household panel data (holdings, enrollments) alongside the row, grouped by household', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ id: 'hh-panel', name: 'Panel House', city: null, primary_member_id: 'mem-panel', season: 2026, paid_at: daysAgo(10) }],
        'FROM members': [{ id: 'mem-panel', household_id: 'hh-panel', name: 'Panel Person', email: null, phone: null, birthdate: null, archived_at: null }],
        'FROM asset_assignments aa': [
          { id: 'aa-1', household_id: 'hh-panel', asset_type_name: 'Mooring', description: 'Buoy M-14', season: 2026, payment_id: 'ap-1', paid_at: '2026-02-01' },
          { id: 'aa-2', household_id: 'hh-panel', asset_type_name: 'RV Parking', description: null, season: 2026, payment_id: null, paid_at: null },
        ],
        'ce.id, m.household_id': [
          { id: 'ce-1', household_id: 'hh-panel', class_name: 'Keelboat 101', season: 2026, member_name: 'Panel Person', fee_paid: 1 },
        ],
      },
    });

    const [row] = await listHouseholds(db);
    expect(row.holdings).toEqual([
      { id: 'aa-1', assetTypeName: 'Mooring', description: 'Buoy M-14', season: 2026, paymentStanding: 'paid' },
      { id: 'aa-2', assetTypeName: 'RV Parking', description: null, season: 2026, paymentStanding: 'not-billed' },
    ]);
    expect(row.enrollments).toEqual([
      { id: 'ce-1', className: 'Keelboat 101', season: 2026, memberName: 'Panel Person', feePaid: true },
    ]);
  });

  describe('search matcher', () => {
    const HOUSEHOLD_FIXTURE = { id: 'hh-mixed', name: 'The Mixed Household', city: null, primary_member_id: 'mem-oliver', season: 2026, paid_at: daysAgo(10) };
    const MEMBERS_FIXTURE = [
      { id: 'mem-oliver', household_id: 'hh-mixed', name: 'Oliver Wright', email: 'oliver@example.com', phone: '+19075550100', birthdate: null, archived_at: null },
      { id: 'mem-jane', household_id: 'hh-mixed', name: 'Jane Wright', email: 'jane@example.com', phone: '+19075550199', birthdate: null, archived_at: null },
    ];

    it('marks the matching member by name, not every household member', async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': [HOUSEHOLD_FIXTURE], 'FROM members': MEMBERS_FIXTURE } });
      const rows = await listHouseholds(db, { search: 'Oliver' });
      expect(rows).toHaveLength(1);
      expect(rows[0].members.find((m) => m.id === 'mem-oliver')?.matchedSearch).toBe(true);
      expect(rows[0].members.find((m) => m.id === 'mem-jane')?.matchedSearch).toBe(false);
    });

    it('matches on member phone regardless of punctuation on either side', async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': [HOUSEHOLD_FIXTURE], 'FROM members': MEMBERS_FIXTURE } });
      const rows = await listHouseholds(db, { search: '907-555-0199' });
      expect(rows).toHaveLength(1);
      expect(rows[0].members.find((m) => m.id === 'mem-jane')?.matchedSearch).toBe(true);
      expect(rows[0].members.find((m) => m.id === 'mem-oliver')?.matchedSearch).toBe(false);
    });

    it('matches on the raw standing key', async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': [HOUSEHOLD_FIXTURE], 'FROM members': MEMBERS_FIXTURE } });
      const rows = await listHouseholds(db, { search: 'current' });
      expect(rows).toHaveLength(1);
    });

    it('matches on the household name with no member flagged', async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': [HOUSEHOLD_FIXTURE], 'FROM members': MEMBERS_FIXTURE } });
      const rows = await listHouseholds(db, { search: 'mixed household' });
      expect(rows).toHaveLength(1);
      expect(rows[0].members.every((m) => !m.matchedSearch)).toBe(true);
    });

    it('drops a household with no name, member, or standing match', async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': [HOUSEHOLD_FIXTURE], 'FROM members': MEMBERS_FIXTURE } });
      const rows = await listHouseholds(db, { search: 'nonexistent' });
      expect(rows).toHaveLength(0);
    });
  });

  describe('standing filter', () => {
    const ROWS = [
      { id: 'hh-current', name: 'Current House', city: null, primary_member_id: null, season: 2026, paid_at: daysAgo(10) },
      { id: 'hh-overdue', name: 'Overdue House', city: null, primary_member_id: null, season: 2025, paid_at: daysAgo(380), former_at: null },
      { id: 'hh-former', name: 'Former House', city: null, primary_member_id: null, season: 2023, paid_at: daysAgo(1000), former_at: daysAgo(5) },
      { id: 'hh-none', name: 'None House', city: null, primary_member_id: null, season: null, paid_at: null },
    ];

    it("'members' (the default) keeps Current and Overdue, hiding Former and never-paid", async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': ROWS, 'FROM members': [] } });
      const rows = await listHouseholds(db, { standing: 'members' });
      expect(rows.map((r) => r.id).sort()).toEqual(['hh-current', 'hh-overdue']);
    });

    it("'current' keeps only current standing", async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': ROWS, 'FROM members': [] } });
      const rows = await listHouseholds(db, { standing: 'current' });
      expect(rows.map((r) => r.id)).toEqual(['hh-current']);
    });

    it("'overdue' keeps only overdue standing", async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': ROWS, 'FROM members': [] } });
      const rows = await listHouseholds(db, { standing: 'overdue' });
      expect(rows.map((r) => r.id)).toEqual(['hh-overdue']);
    });

    it("'former' also keeps a never-paid ('none') household, the coarse admin-facing bucket", async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': ROWS, 'FROM members': [] } });
      const rows = await listHouseholds(db, { standing: 'former' });
      expect(rows.map((r) => r.id).sort()).toEqual(['hh-former', 'hh-none']);
    });

    it("'all' (the default with no options at all) applies no standing filter -- the Money screen's own household-picker need", async () => {
      const { db } = fakeD1({ allResults: { 'FROM households h': ROWS, 'FROM members': [] } });
      const rows = await listHouseholds(db);
      expect(rows).toHaveLength(4);
    });
  });

  describe('holdings filter', () => {
    it("'holding' keeps only households with at least one active asset assignment", async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [
            { id: 'hh-holds', name: 'Holds Assets', city: null, primary_member_id: null, season: null, paid_at: null },
            { id: 'hh-bare', name: 'No Assets', city: null, primary_member_id: null, season: null, paid_at: null },
          ],
          'FROM members': [],
          'FROM asset_assignments aa': [{ id: 'aa-1', household_id: 'hh-holds', asset_type_name: 'Mooring', description: null, season: 2026, payment_id: null, paid_at: null }],
        },
      });
      const rows = await listHouseholds(db, { holdings: 'holding' });
      expect(rows.map((r) => r.id)).toEqual(['hh-holds']);
    });
  });

  describe('role filter', () => {
    it("'instructor' keeps only households with a member in this season's class_instructors", async () => {
      const { db } = fakeD1({
        firstResults: { "'current_season'": { value: '2026' } },
        allResults: {
          'FROM households h': [
            { id: 'hh-teach', name: 'Teaches', city: null, primary_member_id: null, season: null, paid_at: null },
            { id: 'hh-plain', name: 'Plain', city: null, primary_member_id: null, season: null, paid_at: null },
          ],
          'FROM members': [
            { id: 'mem-teach', household_id: 'hh-teach', name: 'Teach Er', email: null, phone: null, birthdate: null, archived_at: null },
            { id: 'mem-plain', household_id: 'hh-plain', name: 'Plain One', email: null, phone: null, birthdate: null, archived_at: null },
          ],
          'FROM class_instructors': [{ member_id: 'mem-teach' }],
        },
      });
      const rows = await listHouseholds(db, { role: 'instructor' });
      expect(rows.map((r) => r.id)).toEqual(['hh-teach']);
    });
  });

  describe('classId filter', () => {
    it('keeps only households with a member enrolled in the given class', async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [
            { id: 'hh-enrolled', name: 'Enrolled', city: null, primary_member_id: null, season: null, paid_at: null },
            { id: 'hh-not', name: 'Not Enrolled', city: null, primary_member_id: null, season: null, paid_at: null },
          ],
          'FROM members': [
            { id: 'mem-enrolled', household_id: 'hh-enrolled', name: 'En Rolled', email: null, phone: null, birthdate: null, archived_at: null },
            { id: 'mem-not', household_id: 'hh-not', name: 'Not Rolled', email: null, phone: null, birthdate: null, archived_at: null },
          ],
          'FROM class_enrollments WHERE class_id': [{ member_id: 'mem-enrolled' }],
        },
      });
      const rows = await listHouseholds(db, { classId: 'cls-1' });
      expect(rows.map((r) => r.id)).toEqual(['hh-enrolled']);
    });

    it("'all' applies no class filter", async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [{ id: 'hh-a', name: 'A', city: null, primary_member_id: null, season: null, paid_at: null }],
          'FROM members': [],
        },
      });
      const rows = await listHouseholds(db, { classId: 'all' });
      expect(rows).toHaveLength(1);
    });
  });

  describe('includeArchived', () => {
    it('hides a household whose every member is archived by default', async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [{ id: 'hh-gone', name: 'Gone Household', city: null, primary_member_id: null, season: null, paid_at: null }],
          'FROM members': [{ id: 'mem-gone', household_id: 'hh-gone', name: 'Gone Member', email: null, phone: null, birthdate: null, archived_at: '2025-01-01' }],
        },
      });
      await expect(listHouseholds(db)).resolves.toEqual([]);
      await expect(listHouseholds(db, { includeArchived: true })).resolves.toHaveLength(1);
    });

    it('never hides a household with zero members, regardless of the flag', async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [{ id: 'hh-empty', name: 'Empty Household', city: null, primary_member_id: null, season: null, paid_at: null }],
          'FROM members': [],
        },
      });
      await expect(listHouseholds(db)).resolves.toHaveLength(1);
    });

    it('keeps a household with a mix of archived and active members', async () => {
      const { db } = fakeD1({
        allResults: {
          'FROM households h': [{ id: 'hh-mix', name: 'Mixed Archive', city: null, primary_member_id: null, season: null, paid_at: null }],
          'FROM members': [
            { id: 'mem-a', household_id: 'hh-mix', name: 'Active One', email: null, phone: null, birthdate: null, archived_at: null },
            { id: 'mem-b', household_id: 'hh-mix', name: 'Archived One', email: null, phone: null, birthdate: null, archived_at: '2025-01-01' },
          ],
        },
      });
      await expect(listHouseholds(db)).resolves.toHaveLength(1);
    });
  });
});

describe('getHouseholdDesk', () => {
  it('returns null for a missing household', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM households WHERE id': null } });
    await expect(getHouseholdDesk(db, 'no-such-household')).resolves.toBeNull();
  });

  it('maps roster, memberships, and assets, marking the primary member', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM households WHERE id': { id: 'hh-1', name: 'The Ones', city: 'Nome', primary_member_id: 'mem-1' },
      },
      allResults: {
        'FROM members WHERE household_id': [
          { id: 'mem-1', name: 'Primary One', email: 'p@example.com', phone: '+19075550100', birthdate: '1980-01-01', directory_visibility: 'visible', archived_at: null },
          { id: 'mem-2', name: 'Second One', email: null, phone: null, birthdate: null, directory_visibility: 'hidden', archived_at: '2025-06-01' },
        ],
        'FROM memberships WHERE household_id': [
          { id: 'ms-1', season: 2026, tier: 'family', price_paid: 500, paid_at: '2026-01-01', stripe_ref: 'cs_test_1', refunded_at: null },
        ],
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', membership_id: 'ms-1', season: 2026, description: 'Buoy M-14', status: 'active' },
        ],
      },
    });

    const desk = await getHouseholdDesk(db, 'hh-1');
    expect(desk).toMatchObject({ id: 'hh-1', name: 'The Ones', city: 'Nome', primaryMemberId: 'mem-1' });
    expect(desk?.roster).toEqual([
      { id: 'mem-1', name: 'Primary One', email: 'p@example.com', phone: '+19075550100', birthdate: '1980-01-01', directoryVisibility: 'visible', archived: false, isPrimary: true },
      { id: 'mem-2', name: 'Second One', email: null, phone: null, birthdate: null, directoryVisibility: 'hidden', archived: true, isPrimary: false },
    ]);
    expect(desk?.memberships).toEqual([
      { id: 'ms-1', season: 2026, tier: 'family', pricePaid: 500, paidAt: '2026-01-01', stripeRef: 'cs_test_1', refundedAt: null },
    ]);
    expect(desk?.assets).toEqual([
      { id: 'aa-1', assetType: 'mooring', assetTypeName: 'Mooring', membershipId: 'ms-1', season: 2026, description: 'Buoy M-14', status: 'active' },
    ]);
  });
});

describe('resolveMemberHousehold', () => {
  it('resolves an existing member to its household id', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM members WHERE id': { household_id: 'hh-1' } } });
    await expect(resolveMemberHousehold(db, 'mem-1')).resolves.toBe('hh-1');
  });

  it('returns null for a member id that does not exist', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM members WHERE id': null } });
    await expect(resolveMemberHousehold(db, 'no-such-member')).resolves.toBeNull();
  });
});
