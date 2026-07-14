import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidationError } from '@sveltejs/kit';
import { handleJoinApply, type JoinApplySubmission } from '$theme/join-apply-form';
import { fakeD1 } from './_fake-d1';

function issueMessages(err: unknown): string[] {
  return (err as { issues: Array<{ message: string }> }).issues.map((issue) => issue.message);
}

const ORIGIN = 'https://dev.aksailingclub.org';

function submission(overrides: Partial<JoinApplySubmission> = {}): JoinApplySubmission {
  return {
    tier: 'individual',
    purchaserName: 'Ada Lovelace',
    purchaserEmail: 'ada@example.com',
    purchaserPhone: '',
    purchaserBirthdate: '',
    members: [],
    picks: [],
    waiverAccepted: true,
    'cf-turnstile-response': '',
    ...overrides,
  };
}

const TIER_PRICE_ROWS = [
  { key: 'tier_price_individual', value: '250' },
  { key: 'tier_price_family', value: '500' },
  { key: 'tier_price_young_adult', value: '100' },
];

function classRow(id: string, fee: number) {
  return {
    id,
    season: 2026,
    name: `Class ${id}`,
    slug: id,
    track: 'adult-teen',
    capacity: 10,
    fee,
    start_date: null,
    end_date: null,
    location: null,
    description: null,
    instructor_notes: null,
    custom_note: null,
    hero_image: null,
    hero_image_alt: null,
    visible: 1 as const,
    drop_in: 0 as const,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
  };
}

describe('handleJoinApply', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses when the turnstile check fails, writing nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ success: false }) }));
    const { db, calls } = fakeD1();

    await expect(
      handleJoinApply(submission(), { CLUB_DB: db, TURNSTILE_SECRET_KEY: 'secret' }, '203.0.113.5', ORIGIN),
    ).rejects.toSatisfy((err: unknown) => isValidationError(err) && issueMessages(err).includes('Spam check failed. Please try again.'));

    expect(calls).toHaveLength(0);
  });

  it('refuses when CLUB_DB is not bound', async () => {
    await expect(handleJoinApply(submission(), undefined, '203.0.113.5', ORIGIN)).rejects.toSatisfy(
      (err: unknown) => isValidationError(err) && issueMessages(err).some((m) => m.includes('not available right now')),
    );
  });

  it('surfaces every validateJoinInput rule violation together, writing nothing', async () => {
    const { db, calls } = fakeD1();
    await expect(handleJoinApply(submission({ waiverAccepted: false }), { CLUB_DB: db }, '203.0.113.5', ORIGIN)).rejects.toSatisfy(
      (err: unknown) => isValidationError(err) && issueMessages(err).includes('You must accept the waiver to join.'),
    );
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });

  it('a fresh solo join batches the write, then creates a join checkout with empty class metadata', async () => {
    const { db, calls } = fakeD1({
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
      firstResults: { "'waiver_text_version'": { value: '2026-01' }, "'current_season'": { value: '2026' } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_1' }), { status: 200 })),
    );

    const result = await handleJoinApply(submission(), { CLUB_DB: db, STRIPE_SECRET_KEY: 'sk_test_1' }, '203.0.113.5', ORIGIN);
    expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test_1' });

    const householdInsert = calls.find((c) => c.sql.startsWith('INSERT INTO households'));
    expect(householdInsert).toBeDefined();
    const membershipInsert = calls.find((c) => c.sql.startsWith('INSERT INTO memberships'));
    expect(membershipInsert?.args).toEqual([expect.any(String), householdInsert?.args[0], 2026, 'individual', 250]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    expect(params.get('metadata[kind]')).toBe('join');
    expect(params.get('metadata[refId]')).toBe(membershipInsert?.args[0]);
    expect(params.get('metadata[enrollment_ids]')).toBe('');
    expect(params.get('metadata[covered_enrollment_ids]')).toBe('');
    expect(params.get('metadata[grant_credits]')).toBe('1');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('25000');
    expect(params.get('line_items[1][price_data][unit_amount]')).toBeNull();
  });

  it('a purchaser email belonging to a household that has paid before pivots to welcome-back, writing nothing', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM members WHERE email': { id: 'member-1', household_id: 'household-1' },
        'paid_at IS NOT NULL': { found: 1 },
      },
    });

    const result = await handleJoinApply(submission(), { CLUB_DB: db }, '203.0.113.5', ORIGIN);
    expect(result).toEqual({ pivot: 'known-email' });
    expect(calls.some((c) => c.sql.startsWith('INSERT') || c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it('a purchaser email belonging to a household with only an unpaid row for the current season reuses that row', async () => {
    const { db, calls } = fakeD1({
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
      firstResults: {
        'FROM members WHERE email': { id: 'member-1', household_id: 'household-1' },
        'paid_at IS NOT NULL': null,
        "'current_season'": { value: '2026' },
        'AND season = ?2 AND paid_at IS NULL': { id: 'membership-1' },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_2' }), { status: 200 })),
    );

    const result = await handleJoinApply(submission({ tier: 'family' }), { CLUB_DB: db, STRIPE_SECRET_KEY: 'sk_test_1' }, '203.0.113.5', ORIGIN);
    expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test_2' });

    expect(calls.some((c) => c.sql.startsWith('INSERT INTO households'))).toBe(false);
    const update = calls.find((c) => c.sql.startsWith('UPDATE memberships'));
    expect(update?.args).toEqual(['family', 500, 'membership-1']);
    const audit = calls.find((c) => c.sql.startsWith('INSERT INTO audit_log'));
    expect(audit?.args).toEqual(['public:join', 'retry', 'membership', 'membership-1', 'tier=family']);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    expect(params.get('metadata[refId]')).toBe('membership-1');
    expect(params.get('metadata[purchaser_member_id]')).toBe('member-1');
  });

  it('delegates the running total to computeJoinPricing: credits cover picks up to the tier grant, further picks add a class-fee line', async () => {
    const { db, calls } = fakeD1({
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
      firstResults: {
        "'waiver_text_version'": { value: '2026-01' },
        "'current_season'": { value: '2026' },
        'FROM classes WHERE id': (args: unknown[]) => {
          const id = args[0] as string;
          if (id === 'intro-sailing') return classRow('intro-sailing', 100);
          if (id === 'youth-sailing') return classRow('youth-sailing', 75);
          return classRow('third-class', 50);
        },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_3' }), { status: 200 })),
    );

    const result = await handleJoinApply(
      submission({
        tier: 'family',
        members: [{ name: 'Bob Lovelace', birthdate: '2012-01-01', email: '' }],
        picks: ['intro-sailing', 'youth-sailing'],
      }),
      { CLUB_DB: db, STRIPE_SECRET_KEY: 'sk_test_1' },
      '203.0.113.5',
      ORIGIN,
    );
    expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test_3' });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    // Family grants two credits; both picks are covered, so only the dues line exists.
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('50000');
    expect(params.get('line_items[1][price_data][unit_amount]')).toBeNull();
    const enrollmentIds = (params.get('metadata[enrollment_ids]') ?? '').split(',').filter(Boolean);
    expect(enrollmentIds).toHaveLength(2);
    expect((params.get('metadata[covered_enrollment_ids]') ?? '').split(',').filter(Boolean)).toHaveLength(2);

    expect(calls.filter((c) => c.sql.startsWith('INSERT INTO class_enrollments'))).toHaveLength(2);
  });
});
