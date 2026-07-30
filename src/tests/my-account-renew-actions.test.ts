// The renewal door's own `?/renew` action (T2c, moved verbatim from `/my-account/+page.server.ts`
// when that route's masthead CTA became a plain link to `/my-account/renew`): the same
// write-then-checkout wiring `my-account-actions.test.ts` already proved for the landing's own
// actions, now exercised against the new route. `member-portal-renewal.test.ts` covers the pure
// mint/reuse logic this action calls; this file covers the wiring: does the right row get
// written, and does the checkout carry the right amount and refId.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';

// A single published all-members document (member-waivers T5b's own household-gate tests): the
// real content corpus is all `status: 'draft'` today (the shipped state, see this route's own
// header), so the "gate blocks the household" path needs a fixture, mirroring
// `household-signature-gate.test.ts`'s own synthetic `doc()` shape. Every OTHER test in this file
// stubs no household members at all, so `deriveHouseholdRequirements` sees an empty adult list and
// reports complete regardless of this fixture -- this mock is harmless to them.
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

const { actions, load } = await import('../routes/(site)/my-account/renew/+page.server');
const { fakeD1 } = await import('./_fake-d1');

/** `load`'s generated return type includes `void` (a SvelteKit `Load` can redirect and return
 *  nothing); every test below supplies a bound `CLUB_DB` and no redirect condition, so the real
 *  object always comes back -- this narrows for the assertions rather than widening `heldAssets`
 *  itself to `unknown`. */
function expectHeldAssets(result: unknown): { assetType: string; assetTypeName: string; alreadyRequested: boolean }[] | null {
  return (result as { heldAssets: { assetType: string; assetTypeName: string; alreadyRequested: boolean }[] | null }).heldAssets;
}

const MEMBER_ROW = { id: 'mem-1', household_id: 'hh-1', name: 'Scratch Member', email: 'scratch@example.com', archived_at: null };
const ACTIVE_ADULT_MEMBER = { id: 'mem-1', name: 'Scratch Member', email: 'scratch@example.com', phone: null, birthdate: '1980-01-01', directory_visibility: 'partial', archived_at: null };

const TIER_PRICE_ROWS = [
  { key: 'tier_price_individual', value: '250' },
  { key: 'tier_price_family', value: '500' },
  { key: 'tier_price_young_adult', value: '100' },
];

function fakeEvent(form: Record<string, string>, db: unknown, stripeKey?: string) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/renew'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    platform: { env: { CLUB_DB: db, ...(stripeKey ? { STRIPE_SECRET_KEY: stripeKey } : {}) } },
  };
}

/** `load`'s own event shape: no `member_sessions` cookie lookup (the member arrives pre-resolved
 *  through `event.parent()`, `+layout.server.ts`'s own job), so this needs less than `fakeEvent`
 *  above -- just a CSRF-cookie jar and the parent's own resolved member. */
function fakeLoadEvent(db: unknown, member: { id: string; householdId: string }) {
  const cookies: Record<string, string> = {};
  return {
    url: new URL('http://localhost/my-account/renew'),
    cookies: { get: (name: string) => cookies[name], set: (name: string, value: string) => (cookies[name] = value) },
    parent: async () => ({ member }),
    platform: { env: { CLUB_DB: db } },
  };
}

async function catchThrown(value: unknown): Promise<unknown> {
  try {
    return await value;
  } catch (err) {
    return err;
  }
}

describe('?/renew', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mints an unpaid membership row for the next unclaimed season, then redirects to a real dues checkout', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
        'AND paid_at IS NOT NULL LIMIT 1': null,
        'AND (paid_at IS NULL OR refunded_at IS NOT NULL) LIMIT 1': null,
      },
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_1' }), { status: 200 })),
    );

    const caught = await catchThrown(actions.renew(fakeEvent({ tier: 'individual' }, db, 'sk_test_1') as never));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('https://checkout.stripe.com/pay/cs_test_1');

    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO memberships'));
    expect(insert?.args).toEqual([expect.any(String), 'hh-1', 2026, 'individual', 250]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    expect(params.get('metadata[kind]')).toBe('dues');
    expect(params.get('metadata[refId]')).toBe(insert?.args[0] as string);
  });

  it('reprices from the current settings value when the member changes tier', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
        'AND paid_at IS NOT NULL LIMIT 1': null,
        'AND (paid_at IS NULL OR refunded_at IS NOT NULL) LIMIT 1': null,
      },
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_1' }), { status: 200 })),
    );

    await catchThrown(actions.renew(fakeEvent({ tier: 'family' }, db, 'sk_test_1') as never));

    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO memberships'));
    expect(insert?.args).toEqual([expect.any(String), 'hh-1', 2026, 'family', 500]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(new URLSearchParams(body).get('line_items[0][price_data][unit_amount]')).toBe('50000');
  });

  it('reuses an abandoned unpaid row for the target season instead of minting a second one', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
        'AND paid_at IS NOT NULL LIMIT 1': null,
        'AND (paid_at IS NULL OR refunded_at IS NOT NULL) LIMIT 1': { id: 'ms-existing' },
      },
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_1' }), { status: 200 })),
    );

    const caught = await catchThrown(actions.renew(fakeEvent({ tier: 'individual' }, db, 'sk_test_1') as never));
    expect(isRedirect(caught)).toBe(true);

    expect(calls.some((c) => c.sql.startsWith('INSERT INTO memberships'))).toBe(false);
    const update = calls.find((c) => c.sql.startsWith('UPDATE memberships'));
    expect(update?.args).toEqual(['individual', 250, 'ms-existing']);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(new URLSearchParams(body).get('metadata[refId]')).toBe('ms-existing');
  });

  it('degrades to a renewStubbed result, never throwing, when STRIPE_SECRET_KEY is not bound', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
        'AND paid_at IS NOT NULL LIMIT 1': null,
        'AND (paid_at IS NULL OR refunded_at IS NOT NULL) LIMIT 1': null,
      },
      allResults: { tier_price_individual: TIER_PRICE_ROWS },
    });
    const result = await actions.renew(fakeEvent({ tier: 'individual' }, db) as never);
    expect(result).toEqual({ renewStubbed: true });
  });

  it('refuses an unrecognized tier before touching the database', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM member_sessions': MEMBER_ROW, 'FROM households WHERE id': { primary_member_id: 'mem-1' } },
    });
    const result = await actions.renew(fakeEvent({ tier: 'platinum' }, db) as never);
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
    expect(calls.some((c) => c.sql.startsWith('INSERT') || c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it("hard-gates on the household-complete signature check (member-waivers T5b): redirects to the signing moment and mints nothing when an adult's own document is outstanding", async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        tier_price_individual: TIER_PRICE_ROWS,
        'FROM members WHERE household_id = ?1 ORDER BY name': [ACTIVE_ADULT_MEMBER],
      },
    });
    const caught = await catchThrown(actions.renew(fakeEvent({ tier: 'individual' }, db) as never));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('/my-account/sign?context=renewal&next=%2Fmy-account%2Frenew');
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO memberships') || c.sql.startsWith('UPDATE memberships'))).toBe(false);
  });
});

// The retention step (design spec ruling 3, task 4): a household holding gear or moorings is
// asked, per asset, whether it wants that same asset for the coming season. A "yes" posts this
// action; a "no" is simply never submitting it, so `createAssetRequest`'s own behavior (tested in
// `member-portal-assets.test.ts`) needs no re-proof here -- only this route's own wiring: which
// asset types it will and won't create a request for, the duplicate guard, and the sign gate.
describe('?/retainAsset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates exactly one pending retention request for an asset the household holds', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
        ],
        'FROM asset_requests r JOIN asset_types at': [],
      },
    });

    const result = await actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never);
    expect(result).toEqual({ retained: true });

    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO asset_requests'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args).toEqual([expect.any(String), 'mooring', 'hh-1', 'mem-1', 'retention', null]);
  });

  it('a "no" (an asset the household holds but never submits) creates nothing for that asset', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
          { id: 'aa-2', asset_type: 'rv-parking', asset_type_name: 'RV Parking', description: null, payment_id: null, paid_at: null, fee_amount: null },
        ],
        'FROM asset_requests r JOIN asset_types at': [],
      },
    });

    // Only 'mooring' is submitted; 'rv-parking' is the "no" the household never clicked.
    await actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never);

    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO asset_requests'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[1]).toBe('mooring');
  });

  it('does not create a duplicate when a pending retention request for the same asset already exists', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
        ],
        'FROM asset_requests r JOIN asset_types at': [
          { id: 'req-1', asset_type: 'mooring', asset_type_name: 'Mooring', kind: 'retention', status: 'pending', note: null, deny_reason: null, fee: 300, created_at: '2026-01-01 00:00:00' },
        ],
      },
    });

    const result = await actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never);
    expect(result).toEqual({ retained: true });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_requests'))).toBe(false);
  });

  it('a household with zero active assignments gets no rows for any submitted asset type', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: { 'FROM asset_assignments aa': [] },
    });

    const result = await actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never);
    expect(result).toEqual(expect.objectContaining({ status: 400, data: { retainError: 'Your household does not hold this asset.' } }));
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_requests'))).toBe(false);
  });

  // Finding 2 (task 4 fold): once an admin approves a retention request its status moves past
  // 'pending' (approved_awaiting_payment, then assigned) before it is truly done, and the
  // duplicate guard must stay closed across that whole span -- otherwise the button reappears and
  // a second click inserts a duplicate pending request for an asset already granted.
  it('does not create a duplicate when the household\'s existing retention request has already moved to approved_awaiting_payment or assigned', async () => {
    for (const status of ['approved_awaiting_payment', 'assigned']) {
      const { db, calls } = fakeD1({
        firstResults: {
          'FROM member_sessions': MEMBER_ROW,
          'FROM households WHERE id': { primary_member_id: 'mem-1' },
          "'current_season'": { value: '2026' },
        },
        allResults: {
          'FROM asset_assignments aa': [
            { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
          ],
          'FROM asset_requests r JOIN asset_types at': [
            { id: 'req-1', asset_type: 'mooring', asset_type_name: 'Mooring', kind: 'retention', status, note: null, deny_reason: null, fee: 300, created_at: '2026-01-01 00:00:00' },
          ],
        },
      });

      const result = await actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never);
      expect(result).toEqual({ retained: true });
      expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_requests'))).toBe(false);
    }
  });

  it('hard-gates on the household-complete signature check the same way ?/renew does: redirects and creates nothing', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-1' },
        "'current_season'": { value: '2026' },
      },
      allResults: {
        'FROM members WHERE household_id = ?1 ORDER BY name': [ACTIVE_ADULT_MEMBER],
      },
    });

    const caught = await catchThrown(actions.retainAsset(fakeEvent({ assetType: 'mooring' }, db) as never));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('/my-account/sign?context=renewal&next=%2Fmy-account%2Frenew');
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_requests'))).toBe(false);
  });
});

// `load`'s own construction of `heldAssets` (task 4 findings 1 and 2, confirmed against live
// data): a household can hold more than one active assignment of the same asset TYPE, and the
// whole downstream request model is type-keyed, so the list must render one row per type, not one
// per assignment. And the "already requested" flag must stay set across every non-terminal
// request status, not just 'pending'.
describe('load', () => {
  const MEMBER = { id: 'mem-1', householdId: 'hh-1' };

  it('deduplicates held assets by type when the household holds more than one active assignment of the same type', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM households WHERE id': { primary_member_id: 'mem-1' }, "'current_season'": { value: '2026' } },
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'boat-parking', asset_type_name: 'Trailered Boat Parking', description: 'Boat 1', payment_id: null, paid_at: null, fee_amount: null },
          { id: 'aa-2', asset_type: 'boat-parking', asset_type_name: 'Trailered Boat Parking', description: 'Boat 2', payment_id: null, paid_at: null, fee_amount: null },
          { id: 'aa-3', asset_type: 'boat-parking', asset_type_name: 'Trailered Boat Parking', description: 'Boat 3', payment_id: null, paid_at: null, fee_amount: null },
        ],
      },
    });

    const result = await load(fakeLoadEvent(db, MEMBER) as never);
    expect(expectHeldAssets(result)).toEqual([{ assetType: 'boat-parking', assetTypeName: 'Trailered Boat Parking', alreadyRequested: false }]);
  });

  it('treats an approved-awaiting-payment or assigned retention request as already requested, not just pending', async () => {
    for (const status of ['pending', 'approved_awaiting_payment', 'assigned']) {
      const { db } = fakeD1({
        firstResults: { 'FROM households WHERE id': { primary_member_id: 'mem-1' }, "'current_season'": { value: '2026' } },
        allResults: {
          'FROM asset_assignments aa': [
            { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
          ],
          'FROM asset_requests r JOIN asset_types at': [
            { id: 'req-1', asset_type: 'mooring', asset_type_name: 'Mooring', kind: 'retention', status, note: null, deny_reason: null, fee: 150, created_at: '2026-01-01 00:00:00' },
          ],
        },
      });

      const result = await load(fakeLoadEvent(db, MEMBER) as never);
      expect(expectHeldAssets(result)).toEqual([{ assetType: 'mooring', assetTypeName: 'Mooring', alreadyRequested: true }]);
    }
  });

  it('does not treat a denied or cancelled retention request as already requested', async () => {
    for (const status of ['denied', 'cancelled']) {
      const { db } = fakeD1({
        firstResults: { 'FROM households WHERE id': { primary_member_id: 'mem-1' }, "'current_season'": { value: '2026' } },
        allResults: {
          'FROM asset_assignments aa': [
            { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, payment_id: null, paid_at: null, fee_amount: null },
          ],
          'FROM asset_requests r JOIN asset_types at': [
            { id: 'req-1', asset_type: 'mooring', asset_type_name: 'Mooring', kind: 'retention', status, note: null, deny_reason: null, fee: 150, created_at: '2026-01-01 00:00:00' },
          ],
        },
      });

      const result = await load(fakeLoadEvent(db, MEMBER) as never);
      expect(expectHeldAssets(result)).toEqual([{ assetType: 'mooring', assetTypeName: 'Mooring', alreadyRequested: false }]);
    }
  });
});
