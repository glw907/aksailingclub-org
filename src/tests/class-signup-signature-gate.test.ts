import { afterEach, describe, expect, it, vi } from 'vitest';

// The public class door's own signature gate (fix round, mirroring `member-portal-classes.test.ts`'s
// own `registerForClass` gate test): a single published all-members release, since the real content
// corpus is all `status: 'draft'` today and the "unsigned member pivots to the signing moment" case
// needs a fixture. Kept as its own file (matching `member-portal-classes.test.ts`'s own precedent)
// rather than folded into `class-signup-form.test.ts`, since `vi.mock('$chassis/content', ...)`
// applies to every test in the file it's declared in and that file's own tests all rely on the real,
// all-draft corpus reading as a pass-through.
const PUBLISHED_RELEASE = {
  concept: 'documents',
  id: 'general-release-v1',
  slug: 'general-release-v1',
  permalink: '',
  title: 'Release of Liability',
  tags: [],
  excerpt: '',
  wordCount: 0,
  draft: false,
  fields: {},
  frontmatter: { title: 'Release of Liability', document: 'general-release', version: 1, kind: 'release', audience: 'all-members', season: 2026, status: 'published' },
  body: 'The signable text.',
};
vi.mock('$chassis/content', () => ({
  documents: { all: () => [{ id: PUBLISHED_RELEASE.id }], byId: () => PUBLISHED_RELEASE },
}));

const { fakeD1 } = await import('./_fake-d1');
const { handleClassSignup } = await import('$theme/class-signup-form');

const CLASS_ROW = {
  id: 'fleet-tune-up-weekend',
  season: 2026,
  name: 'Fleet Tune-Up Weekend',
  slug: 'fleet-tune-up-weekend',
  track: 'adult-teen',
  capacity: 10,
  fee: 100,
  start_date: null,
  end_date: null,
  location: null,
  description: null,
  instructor_notes: null,
  visible: 1 as const,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

const RECENT_PAID_AT = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const INPUT = {
  classId: CLASS_ROW.id,
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  phone: '',
  interests: '',
  'cf-turnstile-response': '',
};

/** A free-capacity class DB, standing-eligible member, and pinned to the mocked corpus's own
 *  season (2026) so `loadPublishedDocuments` actually resolves the published release regardless
 *  of the wall-clock year. `householdFixtures` supplies the member's own household so
 *  `loadHouseholdRequirements` can build the `adults` list `hasSignedCurrentRelease` reads. */
function eligibleMemberDb(householdFixtures: { household: unknown; members: unknown[]; signatures?: unknown[] }) {
  return fakeD1({
    firstResults: {
      'FROM classes WHERE id': CLASS_ROW,
      'FROM class_enrollments WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 5 }),
      'FROM class_waitlist WHERE class_id': { n: 0 },
      'FROM members WHERE email': { id: 'member-1', household_id: 'household-1' },
      'FROM members WHERE id': { id: 'member-1', household_id: 'household-1', name: 'Jamie Rivera' },
      "'current_season'": { value: '2026' },
      'FROM memberships WHERE household_id': { tier: 'individual', season: 2026, paid_at: RECENT_PAID_AT },
      'FROM households WHERE id': householdFixtures.household,
    },
    allResults: {
      'FROM members WHERE household_id = ?1 ORDER BY name': householdFixtures.members,
      'FROM waiver_acceptances': householdFixtures.signatures ?? [],
    },
  });
}

describe('handleClassSignup (the class-door signature gate, fix round)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pivots to the sign-in-link flow (never enrolling) when the member's own current-season general release is unsigned", async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, calls } = eligibleMemberDb({
      household: { id: 'household-1', name: 'Rivera Household', primary_member_id: 'member-1', left_at: null },
      members: [{ id: 'member-1', name: 'Jamie Rivera', email: 'jamie@example.com', phone: null, birthdate: '1980-01-01', directory_visibility: 'visible', archived_at: null }],
    });

    const result = await handleClassSignup(INPUT, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ pivot: 'sign', email: INPUT.email });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO class_enrollments'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO class_waitlist'))).toBe(false);
  });

  it('proceeds straight to enrollment once the release is already on file', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db } = eligibleMemberDb({
      household: { id: 'household-1', name: 'Rivera Household', primary_member_id: 'member-1', left_at: null },
      members: [{ id: 'member-1', name: 'Jamie Rivera', email: 'jamie@example.com', phone: null, birthdate: '1980-01-01', directory_visibility: 'visible', archived_at: null }],
      signatures: [{ document_id: 'general-release', season: 2026, member_id: 'member-1', minor_member_id: null, signed_at: '2026-02-01 00:00:00' }],
    });

    const result = await handleClassSignup(INPUT, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
  });
});
