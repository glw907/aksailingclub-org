// segments.ts's own coverage: every segment at its standing boundaries, the head-of-household
// audience model and its default-recipient fallbacks, the shared-email tie-break, and the picker's
// own ordering. Follows member-standing.test.ts's own fixed-clock convention (vi.useFakeTimers, a
// synthetic NOW) since the membership segments share standing.ts's own classifier and its
// recorded-Former boundary.
//
// `fakeD1` keys on a SQL substring and answers canned rows; it never filters, so the audience
// query's own guards are asserted against its statement text and its canned rows stand for what a
// real database would have returned. The `'is_default_recipient'` key names the audience query and
// `'FROM members WHERE archived_at'` names `membersInHouseholds`, the query only the
// `household:<id>` segment still runs. The two keys are deliberately disjoint substrings: the
// audience statement says `FROM members m`, so a stale `'FROM members WHERE archived_at'` fixture
// would answer `[]` rather than erroring, and a green run against it would prove nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listSegmentOptions, resolveMembershipAudience, resolveSegment, type SegmentKey } from '$admin-club/lib/segments';
import { fakeD1 } from './_fake-d1';

const NOW = new Date('2027-06-15T12:00:00Z');

/** `paid_at`/`former_at` a fixed distance in the past from `NOW`, in the schema's own
 *  SQLite-datetime shape (mirrors `member-standing.test.ts`'s own helper). */
function paidAtDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/** One audience-query row, in the column shape the statement actually selects. `fakeD1` does not
 *  run the default-recipient ranking, so each fixture states the outcome the SQL was proven to
 *  produce for that shape (migration 0038's README records the live-replica proof of every
 *  branch). */
function audienceRow(
  row: { id: string; name: string; household_id: string; email?: string | null; phone?: string | null; is_default_recipient?: 0 | 1 },
) {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    household_id: row.household_id,
    is_default_recipient: row.is_default_recipient ?? 1,
  };
}

describe("resolveSegment: the 'current' segment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('includes current and overdue households, excludes a recorded-Former one, and gives a shared email to the default recipient', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': [
          { household_id: 'hh-current', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-current', former_at: null },
          { household_id: 'hh-overdue', paid_at: paidAtDaysAgo(365 + 20), primary_member_id: null, former_at: null },
          { household_id: 'hh-former', paid_at: paidAtDaysAgo(365 + 40), primary_member_id: null, former_at: paidAtDaysAgo(10) },
          { household_id: 'hh-shared', paid_at: paidAtDaysAgo(10), primary_member_id: 'mem-primary', former_at: null },
        ],
        // hh-former's id is never bound into this call: the household is filtered out before the
        // audience query runs at all (proven below via the bound args).
        is_default_recipient: [
          audienceRow({ id: 'mem-current', name: 'Current Member', email: 'current@example.com', household_id: 'hh-current' }),
          audienceRow({ id: 'mem-overdue', name: 'Overdue Member', email: 'overdue@example.com', household_id: 'hh-overdue' }),
          audienceRow({ id: 'mem-shared-other', name: 'Opted In', email: 'shared@example.com', household_id: 'hh-shared', is_default_recipient: 0 }),
          audienceRow({ id: 'mem-primary', name: 'The Default Recipient', email: 'shared@example.com', household_id: 'hh-shared' }),
        ],
      },
    });

    const segment = await resolveSegment(db, 'current');
    expect(segment.label).toBe('Current households');
    expect(segment.recipients).toEqual(
      expect.arrayContaining([
        { email: 'current@example.com', personName: 'Current Member', memberId: 'mem-current' },
        { email: 'overdue@example.com', personName: 'Overdue Member', memberId: 'mem-overdue' },
        { email: 'shared@example.com', personName: 'The Default Recipient', memberId: 'mem-primary' },
      ]),
    );
    expect(segment.recipients).toHaveLength(3); // the shared email dedupes to the default recipient

    const audienceCall = calls.find((c) => c.sql.includes('is_default_recipient'));
    expect(audienceCall?.sql).toContain('m.archived_at IS NULL');
    expect(audienceCall?.args).not.toContain('hh-former');
  });

  it('a two-member household with no opt-in resolves to ONE recipient, the default one: the whole point of the audience model', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-1', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null }],
        // The second member is absent from the answer because the statement's own final predicate
        // excludes them, not because this fixture chose to leave them out; asserted below.
        is_default_recipient: [audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-1' })],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([{ email: 'head@example.com', personName: 'Head Of House', memberId: 'mem-head' }]);

    // The narrowing lives in the statement: a member is in the audience only by opting in or by
    // being the household's own default recipient.
    const audienceCall = calls.find((c) => c.sql.includes('is_default_recipient'));
    expect(audienceCall?.sql).toContain('WHERE a.club_email_opt_in = 1 OR a.id = d.member_id');
  });

  it('an opted-in second member joins the household default recipient', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-1', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null }],
        is_default_recipient: [
          audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-1' }),
          audienceRow({ id: 'mem-opted', name: 'Opted In', email: 'opted@example.com', household_id: 'hh-1', is_default_recipient: 0 }),
        ],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients.map((r) => r.memberId)).toEqual(['mem-head', 'mem-opted']);
  });

  it("ranks the default recipient in the statement: the household primary first, then the earliest-created member, then id as a stable tie-break", async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-1', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null }],
        is_default_recipient: [audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-1' })],
      },
    });
    await resolveSegment(db, 'current');
    const audienceCall = calls.find((c) => c.sql.includes('is_default_recipient'));
    expect(audienceCall?.sql).toContain('ORDER BY (id = primary_member_id) DESC, created_at ASC, id ASC');
    // Only a member who could actually be reached ranks at all, which is what makes the fallbacks
    // below (archived primary, NULL-email primary) fall back rather than drop the household.
    expect(audienceCall?.sql).toContain("WHERE email IS NOT NULL AND TRIM(email) <> ''");
  });

  it('a household whose primary is archived falls back to its earliest-created emailed member rather than dropping', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-2', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-archived', former_at: null }],
        // `mem-archived` never reaches the ranking: the audience CTE's own `archived_at IS NULL`
        // drops it first, so the earliest-created survivor ranks top.
        is_default_recipient: [audienceRow({ id: 'mem-earliest', name: 'Earliest Member', email: 'earliest@example.com', household_id: 'hh-2' })],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([{ email: 'earliest@example.com', personName: 'Earliest Member', memberId: 'mem-earliest' }]);
    const audienceCall = calls.find((c) => c.sql.includes('is_default_recipient'));
    expect(audienceCall?.sql).toContain('WHERE m.archived_at IS NULL');
  });

  it('a household whose primary has a NULL email falls back to a member who has one', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-3', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-no-email', former_at: null }],
        is_default_recipient: [audienceRow({ id: 'mem-emailed', name: 'Has An Email', email: 'has@example.com', household_id: 'hh-3' })],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([{ email: 'has@example.com', personName: 'Has An Email', memberId: 'mem-emailed' }]);
  });

  it('a household with primary_member_id NULL and one emailed member resolves to that member', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-4', paid_at: paidAtDaysAgo(30), primary_member_id: null, former_at: null }],
        is_default_recipient: [audienceRow({ id: 'mem-only', name: 'Only Member', email: 'only@example.com', household_id: 'hh-4' })],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([{ email: 'only@example.com', personName: 'Only Member', memberId: 'mem-only' }]);
  });

  it('a household with no emailed member at all resolves to nothing, and is not an error', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-5', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-phone', former_at: null }],
        // No default recipient can be ranked, and nobody opted in, so the statement answers
        // nothing for this household. The LEFT JOIN is what keeps that a plain empty result.
        is_default_recipient: [],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([]);
  });

  it('a phone-only opted-in member is in the audience and absent from the email projection', async () => {
    const fixture = {
      allResults: {
        'FROM households h': [{ household_id: 'hh-5', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null }],
        is_default_recipient: [
          audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-5' }),
          audienceRow({ id: 'mem-phone', name: 'Phone Only', email: null, phone: '+19075550005', household_id: 'hh-5', is_default_recipient: 0 }),
        ],
      },
    };

    const audience = await resolveMembershipAudience(fakeD1(fixture).db, 'current');
    expect(audience.map((m) => m.memberId)).toEqual(['mem-head', 'mem-phone']);
    expect(audience.find((m) => m.memberId === 'mem-phone')).toMatchObject({ email: null, phone: '+19075550005', isDefaultRecipient: false });

    const segment = await resolveSegment(fakeD1(fixture).db, 'current');
    expect(segment.recipients.map((r) => r.memberId)).toEqual(['mem-head']);
  });

  it('carries no channel-specific predicate in the audience statement: the email filter belongs to the projection', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-1', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null }],
        is_default_recipient: [audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-1' })],
      },
    });
    await resolveMembershipAudience(db, 'current');
    const audienceCall = calls.find((c) => c.sql.includes('is_default_recipient'));
    // The one email test in the statement ranks the default recipient; it never narrows who the
    // audience is, which is what lets the SMS pass reuse this query unchanged.
    expect(audienceCall?.sql).toContain('SELECT a.id, a.name, a.email, a.phone, a.household_id');
    expect(audienceCall?.sql.match(/email IS NOT NULL/g)).toHaveLength(1);
  });

  it('a household well past the renewal boundary but never recorded Former still reads Overdue (included), since Former is a recorded fact', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [{ household_id: 'hh-stale', paid_at: paidAtDaysAgo(365 + 400), primary_member_id: null, former_at: null }],
        is_default_recipient: [audienceRow({ id: 'mem-stale', name: 'Stale Member', email: 'stale@example.com', household_id: 'hh-stale' })],
      },
    });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([{ email: 'stale@example.com', personName: 'Stale Member', memberId: 'mem-stale' }]);
  });

  it('a household with no non-refunded paid row (never-paid or refunded-only) never grounds, so it never reaches the audience query', async () => {
    const { db, calls } = fakeD1({ allResults: { 'FROM households h': [] } });
    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toEqual([]);
    expect(calls.some((c) => c.sql.includes('is_default_recipient'))).toBe(false);
  });

  it('chunks the audience query at D1s 100-bound-parameter cap: >100 current households still resolves (never throws), with the right total count', async () => {
    const households = Array.from({ length: 110 }, (_, i) => ({
      household_id: `hh-${i}`,
      paid_at: paidAtDaysAgo(10),
      primary_member_id: null,
      former_at: null,
    }));
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h': households,
        // Each chunk call binds a different subset of household ids as its own args; answer one
        // member per bound household id so the merged result covers every household regardless
        // of how many chunk calls the resolver makes.
        is_default_recipient: (args: unknown[]) =>
          args.map((householdId) =>
            audienceRow({
              id: `mem-${householdId as string}`,
              name: `Member ${householdId as string}`,
              email: `${householdId as string}@example.com`,
              household_id: householdId as string,
            }),
          ),
      },
    });

    const segment = await resolveSegment(db, 'current');
    expect(segment.recipients).toHaveLength(110);

    const audienceCalls = calls.filter((c) => c.sql.includes('is_default_recipient'));
    expect(audienceCalls.length).toBeGreaterThan(1);
    for (const call of audienceCalls) expect(call.args.length).toBeLessThanOrEqual(90);
  });
});

describe("resolveSegment: the 'lapsed' segment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('includes only a household recorded Former, excluding current and overdue households', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h': [
          { household_id: 'hh-current', paid_at: paidAtDaysAgo(30), primary_member_id: null, former_at: null },
          { household_id: 'hh-overdue', paid_at: paidAtDaysAgo(365 + 20), primary_member_id: null, former_at: null },
          { household_id: 'hh-former', paid_at: paidAtDaysAgo(365 + 40), primary_member_id: null, former_at: paidAtDaysAgo(10) },
        ],
        is_default_recipient: [audienceRow({ id: 'mem-former', name: 'Former Member', email: 'former@example.com', household_id: 'hh-former' })],
      },
    });
    const segment = await resolveSegment(db, 'lapsed');
    expect(segment.label).toBe('Former households');
    expect(segment.recipients).toEqual([{ email: 'former@example.com', personName: 'Former Member', memberId: 'mem-former' }]);
  });

  it("a former household's opted-in member is excluded from `current` and included in `lapsed`", async () => {
    const grounding = [
      { household_id: 'hh-current', paid_at: paidAtDaysAgo(30), primary_member_id: 'mem-head', former_at: null },
      { household_id: 'hh-former', paid_at: paidAtDaysAgo(365 + 40), primary_member_id: 'mem-ex-head', former_at: paidAtDaysAgo(10) },
    ];
    const optedInFormerMember = audienceRow({
      id: 'mem-ex-opted',
      name: 'Former Opted In',
      email: 'ex-opted@example.com',
      household_id: 'hh-former',
      is_default_recipient: 0,
    });

    const currentRun = fakeD1({
      allResults: {
        'FROM households h': grounding,
        is_default_recipient: [audienceRow({ id: 'mem-head', name: 'Head Of House', email: 'head@example.com', household_id: 'hh-current' })],
      },
    });
    const current = await resolveSegment(currentRun.db, 'current');
    expect(current.recipients.map((r) => r.memberId)).toEqual(['mem-head']);
    expect(currentRun.calls.find((c) => c.sql.includes('is_default_recipient'))?.args).toEqual(['hh-current']);

    const lapsedRun = fakeD1({
      allResults: {
        'FROM households h': grounding,
        is_default_recipient: [
          audienceRow({ id: 'mem-ex-head', name: 'Former Head', email: 'ex-head@example.com', household_id: 'hh-former' }),
          optedInFormerMember,
        ],
      },
    });
    const lapsed = await resolveSegment(lapsedRun.db, 'lapsed');
    expect(lapsed.recipients.map((r) => r.memberId)).toEqual(['mem-ex-head', 'mem-ex-opted']);
    expect(lapsedRun.calls.find((c) => c.sql.includes('is_default_recipient'))?.args).toEqual(['hh-former']);
  });

  it('answers no recipients when no household has ever been recorded Former', async () => {
    const { db } = fakeD1({
      allResults: { 'FROM households h': [{ household_id: 'hh-current', paid_at: paidAtDaysAgo(10), primary_member_id: null, former_at: null }] },
    });
    const segment = await resolveSegment(db, 'lapsed');
    expect(segment.recipients).toEqual([]);
  });

  it('a never-paid or refunded-only household is in NEITHER segment, by the grounding statement itself', async () => {
    // `fakeD1` never filters, so the only honest proof is the statement: the grounding query joins
    // each household to its own most recent paid, non-refunded membership row, which is why a
    // household that has never had one simply produces no grounding row and therefore reaches
    // neither segment. "Lapsed" means "was a member, isn't now", never "never was one".
    for (const key of ['current', 'lapsed'] as const) {
      const { db, calls } = fakeD1({ allResults: { 'FROM households h': [], is_default_recipient: [] } });
      const segment = await resolveSegment(db, key);
      expect(segment.recipients).toEqual([]);
      const groundingCall = calls.find((c) => c.sql.includes('FROM households h'));
      expect(groundingCall?.sql).toContain('mm.paid_at IS NOT NULL AND mm.refunded_at IS NULL');
    }
  });
});

describe("resolveSegment: the 'instructors' segment", () => {
  it('reaches every non-archived, emailed instructor assigned to a current-season class', async () => {
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM class_instructors': [
          { id: 'mem-instr-1', name: 'Instr One', email: 'instr1@example.com' },
          { id: 'mem-instr-2', name: 'Instr Two', email: 'instr2@example.com' },
        ],
      },
    });
    const segment = await resolveSegment(db, 'instructors');
    expect(segment.label).toBe('Instructors');
    expect(segment.recipients).toEqual([
      { email: 'instr1@example.com', personName: 'Instr One', memberId: 'mem-instr-1' },
      { email: 'instr2@example.com', personName: 'Instr Two', memberId: 'mem-instr-2' },
    ]);
    const call = calls.find((c) => c.sql.includes('class_instructors'));
    expect(call?.args).toEqual([2026]);
  });

  it('deduplicates an instructor assigned to two current-season classes', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM class_instructors': [
          { id: 'mem-instr-1', name: 'Instr One', email: 'instr1@example.com' },
          { id: 'mem-instr-1', name: 'Instr One', email: 'instr1@example.com' },
        ],
      },
    });
    const segment = await resolveSegment(db, 'instructors');
    expect(segment.recipients).toHaveLength(1);
  });
});

const RAW_CLASS = {
  id: 'cls-1',
  season: 2026,
  name: 'Keelboat 101',
  slug: 'keelboat-101',
  track: 'youth',
  capacity: 10,
  fee: 100,
  start_date: null,
  end_date: null,
  location: null,
  description: null,
  instructor_notes: null,
  custom_note: null,
  hero_image: null,
  hero_image_alt: null,
  visible: 1,
  drop_in: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe("resolveSegment: the 'class:<id>' segment", () => {
  it('resolves the enrollment roster through the guardian-aware contact resolver (a youth enrollment routes to the household primary)', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': RAW_CLASS,
        "'current_season'": { value: '2026' },
        'FROM members WHERE id': (args: unknown[]) =>
          args[0] === 'mem-parent' ? { name: 'Parent Larsen', email: 'parent@example.com' } : { name: 'Kid Larsen', email: null, household_id: 'hh-larsen' },
        'FROM households WHERE id': { primary_member_id: 'mem-parent' },
      },
      allResults: {
        'FROM class_enrollments': [{ id: 'enr-1', member_id: 'mem-kid', enrolled_at: '2026-01-01', fee_paid: 1, guardian_contact: null, interests: null }],
      },
    });
    const segment = await resolveSegment(db, 'class:cls-1');
    expect(segment.label).toBe('Keelboat 101');
    expect(segment.recipients).toEqual([{ email: 'parent@example.com', personName: 'Parent Larsen', memberId: 'mem-kid' }]);
  });

  it("labels an older-season class with its year, and a class with no enrollments resolves to zero recipients (never an error)", async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM classes WHERE id': { ...RAW_CLASS, season: 2024 }, "'current_season'": { value: '2026' } },
      allResults: { 'FROM class_enrollments': [] },
    });
    const segment = await resolveSegment(db, 'class:cls-1');
    expect(segment.label).toBe('Keelboat 101 (2024)');
    expect(segment.recipients).toEqual([]);
  });

  it('throws for an unknown class id, never a silent empty segment', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM classes WHERE id': null } });
    await expect(resolveSegment(db, 'class:no-such')).rejects.toThrow(/unknown segment/i);
  });
});

describe("resolveSegment: the 'household:<id>' segment", () => {
  it("resolves every non-archived, emailed member, the primary winning a shared-email tie (the Members panel's own Email household action)", async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM households WHERE id': { id: 'hh-larsen', name: 'The Larsens', primary_member_id: 'mem-primary' } },
      allResults: {
        'FROM members WHERE archived_at': [
          { id: 'mem-other', name: 'Not Primary', email: 'shared@example.com', household_id: 'hh-larsen' },
          { id: 'mem-primary', name: 'The Primary', email: 'shared@example.com', household_id: 'hh-larsen' },
        ],
      },
    });
    const segment = await resolveSegment(db, 'household:hh-larsen');
    expect(segment.label).toBe('The Larsens');
    expect(segment.recipients).toEqual([{ email: 'shared@example.com', personName: 'The Primary', memberId: 'mem-primary' }]);
  });

  it('still reaches BOTH members of a two-member household with no opt-ins: the head-of-household audience never narrows this segment', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM households WHERE id': { id: 'hh-larsen', name: 'The Larsens', primary_member_id: 'mem-primary' } },
      allResults: {
        'FROM members WHERE archived_at': [
          { id: 'mem-primary', name: 'Erik Larsen', email: 'erik@example.com', household_id: 'hh-larsen' },
          { id: 'mem-other', name: 'Ada Larsen', email: 'ada@example.com', household_id: 'hh-larsen' },
        ],
      },
    });
    const segment = await resolveSegment(db, 'household:hh-larsen');
    expect(segment.recipients.map((r) => r.memberId)).toEqual(['mem-primary', 'mem-other']);

    // Asserted against the statement, not the canned rows alone: this segment runs
    // `membersInHouseholds` verbatim, which carries no opt-in and no default-recipient predicate.
    // The audience query never runs here at all.
    const membersCall = calls.find((c) => c.sql.includes('FROM members WHERE archived_at'));
    expect(membersCall?.sql).toBe(
      'SELECT id, name, email, household_id FROM members WHERE archived_at IS NULL AND email IS NOT NULL AND household_id IN (?1)',
    );
    expect(calls.some((c) => c.sql.includes('club_email_opt_in'))).toBe(false);
    expect(calls.some((c) => c.sql.includes('is_default_recipient'))).toBe(false);
  });

  it('throws for an unknown household id, never a silent empty segment', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM households WHERE id': null } });
    await expect(resolveSegment(db, 'household:no-such')).rejects.toThrow(/unknown segment/i);
  });
});

describe('resolveSegment: an unrecognized key', () => {
  it('throws rather than returning a silently empty segment', async () => {
    const { db } = fakeD1({});
    await expect(resolveSegment(db, 'bogus' as SegmentKey)).rejects.toThrow(/unknown segment/i);
  });
});

describe('listSegmentOptions', () => {
  it('lists the two membership segments and instructors, then classes-with-enrollments, current season first and an older season labeled with its year', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM classes c': [
          { id: 'cls-new', name: 'Keelboat 101', season: 2026 },
          { id: 'cls-old', name: 'Dinghy Basics', season: 2024 },
        ],
      },
    });
    const options = await listSegmentOptions(db);
    expect(options).toEqual([
      { key: 'current', label: 'Current households' },
      { key: 'lapsed', label: 'Former households' },
      { key: 'instructors', label: 'Instructors' },
      { key: 'class:cls-new', label: 'Keelboat 101' },
      { key: 'class:cls-old', label: 'Dinghy Basics (2024)' },
    ]);
  });

  it("only lists a class that has at least one enrollment (asserted via the query's own EXISTS clause: fakeD1 answers canned rows, it never filters)", async () => {
    const { db, calls } = fakeD1({ firstResults: { "'current_season'": { value: '2026' } }, allResults: { 'FROM classes c': [] } });
    await listSegmentOptions(db);
    const call = calls.find((c) => c.sql.includes('FROM classes c'));
    expect(call?.sql).toContain('EXISTS (SELECT 1 FROM class_enrollments');
  });
});
