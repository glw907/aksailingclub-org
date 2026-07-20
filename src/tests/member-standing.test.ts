// getMemberStanding/getHouseholdStanding's own transition table (Members pass T2, rewritten from
// the retired current/grace/lapsed design): current through paid_at + 1 year, overdue past that
// boundary (full benefits, no time-based cutoff on read), former only once RECORDED via
// households.former_at (never re-derived from a time window on read), all keyed off a fixed `now`
// via vi.useFakeTimers (offers.test.ts's own convention for boundary-precise date math).
// Synthetic fixtures only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  classifyHouseholdStanding,
  clearManualFormer,
  clearSequenceFormer,
  formerBoundaryFrom,
  getHouseholdStanding,
  getMemberStanding,
  markHouseholdFormer,
  standingWindowFromPaidAt,
} from '$member-auth/lib/standing';

const MEMBER = { id: 'mem-1', household_id: 'hh-1', name: 'Scratch Member' };
const HOUSEHOLD = { name: 'The Scratches' };

/** `paid_at` a fixed distance in the past from `NOW`, in the schema's own SQLite-datetime shape. */
function paidAtDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

describe('classifyHouseholdStanding (the one exported classifier)', () => {
  const NOW = new Date('2027-06-15T12:00:00Z');

  it('answers "none" with no paid row and no former marker', () => {
    expect(classifyHouseholdStanding(null, null, NOW)).toBe('none');
  });

  it('answers "current" before the paid_at + 1 year boundary', () => {
    expect(classifyHouseholdStanding(paidAtDaysAgo(NOW, 30), null, NOW)).toBe('current');
  });

  it('answers "overdue" past the boundary, with no former marker, no matter how many days past', () => {
    expect(classifyHouseholdStanding(paidAtDaysAgo(NOW, 365 + 1), null, NOW)).toBe('overdue');
    expect(classifyHouseholdStanding(paidAtDaysAgo(NOW, 365 + 200), null, NOW)).toBe('overdue');
  });

  it('answers "former" once former_at is recorded, regardless of how far past the boundary paid_at sits', () => {
    expect(classifyHouseholdStanding(paidAtDaysAgo(NOW, 365 + 40), paidAtDaysAgo(NOW, 10), NOW)).toBe('former');
  });

  it('a manual former marker with no paid history at all still answers "former", not "none"', () => {
    expect(classifyHouseholdStanding(null, paidAtDaysAgo(NOW, 5), NOW)).toBe('former');
  });

  it('a newer payment than former_at clears it: reads current/overdue off the new paid_at instead ("payment clears Former")', () => {
    const formerAt = paidAtDaysAgo(NOW, 40);
    const newerPaidAt = paidAtDaysAgo(NOW, 10); // paid AFTER the former marking
    expect(classifyHouseholdStanding(newerPaidAt, formerAt, NOW)).toBe('current');
  });

  it('paid_at exactly equal to former_at still reads "former" (no renewal has actually happened)', () => {
    const same = paidAtDaysAgo(NOW, 40);
    expect(classifyHouseholdStanding(same, same, NOW)).toBe('former');
  });
});

describe('standingWindowFromPaidAt', () => {
  const NOW = new Date('2027-06-15T12:00:00Z');

  it('reads "current" exactly at the paid_at + 1 year instant (inclusive boundary)', () => {
    const paidAt = new Date(NOW);
    paidAt.setUTCFullYear(paidAt.getUTCFullYear() - 1);
    expect(standingWindowFromPaidAt(paidAt.toISOString().slice(0, 19).replace('T', ' '), NOW).status).toBe('current');
  });

  it('reads "overdue" the instant after the boundary', () => {
    const paidAt = new Date(NOW);
    paidAt.setUTCFullYear(paidAt.getUTCFullYear() - 1);
    paidAt.setUTCMilliseconds(paidAt.getUTCMilliseconds() - 1);
    expect(standingWindowFromPaidAt(paidAt.toISOString().slice(0, 19).replace('T', ' '), NOW).status).toBe('overdue');
  });
});

describe('formerBoundaryFrom', () => {
  it('is exactly paid_at + 1 year + 30 days, matching the reminder sequence\'s own 30_after offset', () => {
    const paidAt = '2026-01-01 00:00:00';
    expect(formerBoundaryFrom(paidAt).toISOString()).toBe('2027-01-31T00:00:00.000Z');
  });
});

describe('markHouseholdFormer / clearSequenceFormer / clearManualFormer', () => {
  it('markHouseholdFormer writes former_at/former_source, idempotent (guarded by former_at IS NULL)', async () => {
    const { db, calls } = fakeD1({ runResults: { 'UPDATE households SET former_at': { changes: 1 } } });
    const wrote = await markHouseholdFormer(db, 'hh-1', 'sequence');
    expect(wrote).toBe(true);
    const call = calls.find((c) => c.sql.includes('UPDATE households SET former_at'));
    expect(call?.sql).toContain('former_at IS NULL');
    expect(call?.args).toEqual(['hh-1', 'sequence']);
  });

  it('markHouseholdFormer reports no write when the household is already marked (idempotent re-run)', async () => {
    const { db } = fakeD1({ runResults: { 'UPDATE households SET former_at': { changes: 0 } } });
    expect(await markHouseholdFormer(db, 'hh-1', 'sequence')).toBe(false);
  });

  it('clearSequenceFormer only guards on former_source = sequence, never touching a manual marker', async () => {
    const { db, calls } = fakeD1({ runResults: { 'UPDATE households SET former_at = NULL': { changes: 1 } } });
    const cleared = await clearSequenceFormer(db, 'hh-1');
    expect(cleared).toBe(true);
    const call = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(call?.sql).toContain("former_source = 'sequence'");
  });

  it('clearManualFormer clears regardless of source', async () => {
    const { db, calls } = fakeD1({ runResults: { 'UPDATE households SET former_at = NULL': { changes: 1 } } });
    const cleared = await clearManualFormer(db, 'hh-1');
    expect(cleared).toBe(true);
    const call = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(call?.sql).toBe(
      'UPDATE households SET former_at = NULL, former_source = NULL WHERE id = ?1 AND former_at IS NOT NULL',
    );
  });
});

describe('getMemberStanding', () => {
  const NOW = new Date('2027-06-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for an unknown member id', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM members WHERE id': null } });
    await expect(getMemberStanding(db, 'no-such-member')).resolves.toBeNull();
  });

  it('answers a neutral "no membership on file" state (folded into "former") when the household has never had a paid row', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': null,
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing).toEqual({
      memberId: MEMBER.id,
      memberName: MEMBER.name,
      householdId: MEMBER.household_id,
      householdName: HOUSEHOLD.name,
      status: 'former',
      tier: null,
      season: null,
      expiresOn: null,
      statusLine: 'No membership on file yet.',
    });
  });

  it('reads "current" when now is before the paid_at + 1 year boundary', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAtDaysAgo(NOW, 30) },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('current');
    expect(standing?.tier).toBe('individual');
    expect(standing?.season).toBe(2026);
    expect(standing?.statusLine).toMatch(/^You're current through .*\.$/);
  });

  it('reads "current" exactly at the paid_at + 1 year instant (inclusive boundary)', async () => {
    const paidAt = new Date(NOW);
    paidAt.setUTCFullYear(paidAt.getUTCFullYear() - 1); // paid_at + 1 year === NOW exactly
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'family', season: 2026, paid_at: paidAt.toISOString().slice(0, 19).replace('T', ' ') },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('current');
  });

  it('reads "overdue" the instant after the boundary, with no former marker, and shows the "renew by" nudge', async () => {
    const paidAt = new Date(NOW);
    paidAt.setUTCFullYear(paidAt.getUTCFullYear() - 1);
    paidAt.setUTCMilliseconds(paidAt.getUTCMilliseconds() - 1); // boundary is 1ms before NOW
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAt.toISOString().slice(0, 19).replace('T', ' ') },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('overdue');
    expect(standing?.statusLine).toMatch(/^Your membership lapsed .* · renew by .* to avoid a gap\.$/);
  });

  it('reads "overdue" indefinitely with no former marker, well past what the old 30-day grace window would have allowed (full benefits until Former is recorded)', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'young-adult', season: 2026, paid_at: paidAtDaysAgo(NOW, 365 + 200) },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('overdue');
  });

  it('reads "former" once former_at is recorded, with no "renew by" nudge', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'young-adult', season: 2026, paid_at: paidAtDaysAgo(NOW, 365 + 31) },
        'SELECT former_at, former_source FROM households WHERE id': { former_at: paidAtDaysAgo(NOW, 1), former_source: 'sequence' },
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('former');
    expect(standing?.statusLine).toMatch(/^Your membership lapsed /);
    expect(standing?.statusLine).not.toContain('renew by');
  });

  it('a manual former marker reads "former" the same as a sequence one', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAtDaysAgo(NOW, 40) },
        'SELECT former_at, former_source FROM households WHERE id': { former_at: paidAtDaysAgo(NOW, 1), former_source: 'manual' },
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('former');
  });

  it('a payment newer than former_at clears it, reading current/overdue again off the new paid_at ("payment clears Former")', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        // Renewed 5 days ago -- after the (stale) former_at marking 40 days ago.
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2027, paid_at: paidAtDaysAgo(NOW, 5) },
        'SELECT former_at, former_source FROM households WHERE id': { former_at: paidAtDaysAgo(NOW, 40), former_source: 'sequence' },
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('current');
  });

  it('picks the household\'s most recently PAID row by paid_at, not by season', async () => {
    // The most recent paid_at belongs to season 2025 (a plausible mid-year renewal), even though
    // a later season number could in principle exist unpaid; the query itself only ever
    // considers paid_at IS NOT NULL rows, so this also proves the season column plays no role in
    // the derivation itself (this module's own header).
    const { db } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': { tier: 'family', season: 2025, paid_at: paidAtDaysAgo(NOW, 10) },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.season).toBe(2025);
    expect(standing?.status).toBe('current');
  });

  it('ignores a refunded row: a household whose only grounding row is refunded reads "former" with no membership on file (member-keyed path)', async () => {
    // The real query carries AND refunded_at IS NULL, so a household whose only paid row was
    // refunded has nothing left to ground on -- the fake DB simulates that by answering null, the
    // same shape the "never paid" test uses. The SQL text itself is asserted below to prove the
    // real query would actually filter the refunded row, not merely that this fixture assumes it.
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members WHERE id': MEMBER,
        'SELECT name FROM households WHERE id': HOUSEHOLD,
        'FROM memberships WHERE household_id': null,
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getMemberStanding(db, MEMBER.id);
    expect(standing?.status).toBe('former');
    expect(standing?.statusLine).toBe('No membership on file yet.');

    const membershipQuery = calls.find((c) => c.sql.includes('FROM memberships WHERE household_id'));
    expect(membershipQuery?.sql).toContain('AND refunded_at IS NULL');
  });
});

describe('getHouseholdStanding', () => {
  const HOUSEHOLD_ID = 'hh-1';
  const NOW = new Date('2027-06-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers "none" when the household has never had a non-refunded paid row and no former marker', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM memberships WHERE household_id': null, 'SELECT former_at, former_source FROM households WHERE id': null },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing).toEqual({
      status: 'none',
      lastSeason: null,
      tier: null,
      pricePaid: null,
      paidAt: null,
      formerAt: null,
      formerSource: null,
    });
  });

  it('reads "current" before the paid_at + 1 year boundary, carrying the price snapshot', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM memberships WHERE household_id': { tier: 'family', season: 2026, paid_at: paidAtDaysAgo(NOW, 30), price_paid: 324 },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing).toEqual({
      status: 'current',
      lastSeason: 2026,
      tier: 'family',
      pricePaid: 324,
      paidAt: paidAtDaysAgo(NOW, 30),
      formerAt: null,
      formerSource: null,
    });
  });

  it('reads "overdue" the instant after the boundary, no former marker', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAtDaysAgo(NOW, 365 + 20), price_paid: 250 },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing.status).toBe('overdue');
  });

  it('reads "former" once a marker is recorded, carrying formerAt/formerSource', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAtDaysAgo(NOW, 365 + 31), price_paid: 250 },
        'SELECT former_at, former_source FROM households WHERE id': { former_at: paidAtDaysAgo(NOW, 1), former_source: 'sequence' },
      },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing.status).toBe('former');
    expect(standing.formerAt).toBe(paidAtDaysAgo(NOW, 1));
    expect(standing.formerSource).toBe('sequence');
  });

  it('reads a comped ($0) row honestly, not as "none"', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: paidAtDaysAgo(NOW, 30), price_paid: 0 },
        'SELECT former_at, former_source FROM households WHERE id': null,
      },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing.status).toBe('current');
    expect(standing.pricePaid).toBe(0);
  });

  it('ignores a refunded row via the AND refunded_at IS NULL predicate: a household with only a refunded current-season row reads "none"', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM memberships WHERE household_id': null, 'SELECT former_at, former_source FROM households WHERE id': null },
    });
    const standing = await getHouseholdStanding(db, HOUSEHOLD_ID);
    expect(standing.status).toBe('none');

    const membershipQuery = calls.find((c) => c.sql.includes('FROM memberships WHERE household_id'));
    expect(membershipQuery?.sql).toContain('AND refunded_at IS NULL');
  });
});
