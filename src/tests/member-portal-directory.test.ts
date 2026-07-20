// listDirectory's own listing rule (plan T3, renamed vocabulary Members pass T2): non-archived,
// non-hidden, Current-or-Overdue members (standing sourced from $member-auth/lib/standing's one
// exported classifier, never a directory-local clock), joined with boats (by owner), positions,
// and active non-archived committee memberships. Overdue keeps full benefits, directory listing
// included, until a household is actually recorded Former (`former_at`) -- no time-based cutoff
// on read. A fixed `NOW` (fake timers, member-standing.test.ts's own convention) keeps the
// boundary assertions exact, since listDirectory reads the real clock rather than taking one as a
// parameter.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { formatPhone, listDirectory } from '$member-portal/lib/directory';

const NOW = new Date('2027-06-15T12:00:00Z');

/** `paid_at` (or `former_at`) a fixed distance in the past from `NOW`, in the schema's own
 *  SQLite-datetime shape. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

const BASE_ROW = {
  household_id: 'hh-1',
  household_name: 'The Scratches',
  household_city: 'Anchorage',
  address_line1: '123 Harbor Way',
  address_line2: null,
  state: 'AK',
  postal_code: '99501',
  paid_at: daysAgo(30),
  former_at: null,
};

function fixture(opts: { grounding?: unknown[]; boats?: unknown[]; positions?: unknown[]; memberships?: unknown[] }) {
  return fakeD1({
    allResults: {
      'FROM members m': opts.grounding ?? [],
      'FROM boats': opts.boats ?? [],
      'FROM member_positions': opts.positions ?? [],
      'FROM committee_members cm': opts.memberships ?? [],
    },
  });
}

describe('listDirectory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('excludes hidden and archived members, pending committee rows, and archived committees at the query level', async () => {
    const { db, calls } = fixture({});
    await listDirectory(db);

    const grounding = calls.find((c) => c.sql.includes('FROM members m'));
    expect(grounding?.sql).toContain("directory_visibility != 'hidden'");
    expect(grounding?.sql).toContain('archived_at IS NULL');

    const memberships = calls.find((c) => c.sql.includes('FROM committee_members cm'));
    expect(memberships?.sql).toContain("cm.status = 'active'");
    expect(memberships?.sql).toContain('c.archived_at IS NULL');
  });

  it('shows a visible member with email, phone, and the household address', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-1', member_name: 'Vera Visible', email: 'vera@example.com', phone: '+19075550100', directory_visibility: 'visible' },
      ],
    });
    const [entry] = await listDirectory(db);
    expect(entry.contact).toEqual({
      email: 'vera@example.com',
      phone: '+19075550100',
      address: { line1: '123 Harbor Way', line2: null, city: 'Anchorage', state: 'AK', postalCode: '99501' },
    });
  });

  it("nulls email, phone, AND the address for a 'partial' member, while still showing household city", async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-2', member_name: 'Pat Partial', email: 'pat@example.com', phone: '+19075550101', directory_visibility: 'partial' },
      ],
    });
    const [entry] = await listDirectory(db);
    expect(entry.contact).toEqual({ email: null, phone: null, address: null });
    expect(entry.household).toEqual({ name: 'The Scratches', city: 'Anchorage' });
  });

  it('excludes a member whose household has never had a paid row (folds into "none", like getHouseholdStanding)', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-3', member_name: 'Never Paid', email: null, phone: null, directory_visibility: 'visible', paid_at: null },
      ],
    });
    await expect(listDirectory(db)).resolves.toEqual([]);
  });

  it('includes an Overdue member well past the one-year boundary, as long as former_at is not recorded (full benefits until Former)', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-4', member_name: 'Odell Overdue', email: null, phone: null, directory_visibility: 'visible', paid_at: daysAgo(365 + 200) },
      ],
    });
    await expect(listDirectory(db)).resolves.toHaveLength(1);
  });

  it('excludes a member whose household is recorded Former, regardless of source', async () => {
    const { db: sequenceDb } = fixture({
      grounding: [
        {
          ...BASE_ROW,
          member_id: 'mem-5',
          member_name: 'Frankie Former',
          email: null,
          phone: null,
          directory_visibility: 'visible',
          paid_at: daysAgo(365 + 40),
          former_at: daysAgo(1),
        },
      ],
    });
    await expect(listDirectory(sequenceDb)).resolves.toEqual([]);

    const { db: manualDb } = fixture({
      grounding: [
        {
          ...BASE_ROW,
          member_id: 'mem-5',
          member_name: 'Frankie Former',
          email: null,
          phone: null,
          directory_visibility: 'visible',
          paid_at: daysAgo(10),
          former_at: daysAgo(5),
        },
      ],
    });
    await expect(listDirectory(manualDb)).resolves.toEqual([]);
  });

  it('a payment newer than former_at clears it: the member is listed again ("payment clears Former")', async () => {
    const { db } = fixture({
      grounding: [
        {
          ...BASE_ROW,
          member_id: 'mem-6',
          member_name: 'Renata Renewed',
          email: null,
          phone: null,
          directory_visibility: 'visible',
          paid_at: daysAgo(5), // renewed after the former_at marking below
          former_at: daysAgo(40),
        },
      ],
    });
    await expect(listDirectory(db)).resolves.toHaveLength(1);
  });

  it('attributes a boat to its owning member only, never a household-mate', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-owner', member_name: 'Owen Owner', email: null, phone: null, directory_visibility: 'partial' },
        { ...BASE_ROW, member_id: 'mem-mate', member_name: 'Hally Housemate', email: null, phone: null, directory_visibility: 'partial' },
      ],
      boats: [{ member_id: 'mem-owner', name: 'Dionysus', model: 'Laser', kept_on: 'trailer' }],
    });
    const entries = await listDirectory(db);
    const owner = entries.find((e) => e.id === 'mem-owner');
    const mate = entries.find((e) => e.id === 'mem-mate');
    expect(owner?.boats).toEqual([{ name: 'Dionysus', model: 'Laser', keptOn: 'trailer' }]);
    expect(owner?.secondary).toBe('Dionysus');
    expect(mate?.boats).toEqual([]);
    expect(mate?.secondary).toBe('Anchorage');
  });

  it('derives a chair title and a co-chair title from role plus committee name, and leaves a plain membership title null', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-chair', member_name: 'Cara Chair', email: null, phone: null, directory_visibility: 'partial' },
      ],
      memberships: [
        { member_id: 'mem-chair', role: 'chair', committee_name: 'Fleet' },
        { member_id: 'mem-chair', role: 'co-chair', committee_name: 'Membership & Events' },
        { member_id: 'mem-chair', role: 'member', committee_name: 'Program' },
      ],
    });
    const [entry] = await listDirectory(db);
    expect(entry.memberships).toEqual([
      { committeeName: 'Fleet', role: 'chair', title: 'Fleet Chair' },
      { committeeName: 'Membership & Events', role: 'co-chair', title: 'Membership & Events Co-Chair' },
      { committeeName: 'Program', role: 'member', title: null },
    ]);
  });

  it('carries positions (kind, title, sortOrder) for any listed member regardless of visibility', async () => {
    const { db } = fixture({
      grounding: [
        { ...BASE_ROW, member_id: 'mem-officer', member_name: 'Ollie Officer', email: null, phone: null, directory_visibility: 'partial' },
      ],
      positions: [{ member_id: 'mem-officer', kind: 'officer', title: 'Commodore', sort_order: 0 }],
    });
    const [entry] = await listDirectory(db);
    expect(entry.positions).toEqual([{ kind: 'officer', title: 'Commodore', sortOrder: 0 }]);
  });
});

describe('formatPhone', () => {
  it('formats a +1 E.164 number for human reading', () => {
    expect(formatPhone('+19075550142')).toBe('+1 (907) 555-0142');
  });

  it('falls back to the raw string for anything that is not a +1 number', () => {
    expect(formatPhone('+447911123456')).toBe('+447911123456');
    expect(formatPhone('not a phone number')).toBe('not a phone number');
  });
});
