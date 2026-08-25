import { describe, expect, it, vi } from 'vitest';
import { fakeD1 } from './_fake-d1';
import type { EmailBindingEnv } from '$admin-club/lib/club-email';
import {
  approveNewRequest,
  approveRetentionRequest,
  cancelAssetRequest,
  createAssetRequest,
  denyAssetRequest,
  getPayableAssignmentFee,
  getPriorHoldingSummary,
  listHouseholdAssignments,
  listHouseholdRequests,
  listHouseholdWaitlistEntries,
  listPendingAssetRequests,
  payForApprovedRequest,
  releaseHouseholdAssignment,
} from '$member-portal/lib/assets';

const ORIGIN = 'https://dev.aksailingclub.org';

/** No `EMAIL` binding: every decision test below except the "decision emails" suite itself uses
 *  this, so the notify-best-effort call inside each decision function degrades harmlessly (T5a's
 *  own {@link sendAssetDecisionEmail} answers `{ ok: false }` with nothing wired to look up) and
 *  never disturbs these tests' own pre-existing assertions. */
const NO_EMAIL: EmailBindingEnv = {};

describe('listHouseholdAssignments', () => {
  it('derives paymentStanding from the joined payment row, not a stored flag', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: 'Buoy M-14', type_fee: 300, payment_id: 'pay-1', paid_at: '2026-01-01 00:00:00', fee_amount: 300 },
          { id: 'aa-2', asset_type: 'rv-parking', asset_type_name: 'RV Parking', description: null, type_fee: 150, payment_id: 'pay-2', paid_at: null, fee_amount: 150 },
          { id: 'aa-3', asset_type: 'boat-parking', asset_type_name: 'Boat Parking', description: null, type_fee: 100, payment_id: null, paid_at: null, fee_amount: null },
        ],
      },
    });
    const rows = await listHouseholdAssignments(db, 'hh-1', 2026);
    expect(rows.map((r) => r.paymentStanding)).toEqual(['paid', 'outstanding', 'not-billed']);
  });

  it('carries the outstanding fee in cents only for an outstanding assignment', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, type_fee: 300, payment_id: 'pay-1', paid_at: '2026-01-01 00:00:00', fee_amount: 300 },
          { id: 'aa-2', asset_type: 'rv-parking', asset_type_name: 'RV Parking', description: null, type_fee: 150, payment_id: 'pay-2', paid_at: null, fee_amount: 150 },
          { id: 'aa-3', asset_type: 'boat-parking', asset_type_name: 'Boat Parking', description: null, type_fee: 100, payment_id: null, paid_at: null, fee_amount: null },
        ],
      },
    });
    const rows = await listHouseholdAssignments(db, 'hh-1', 2026);
    expect(rows.map((r) => r.feeCents)).toEqual([null, 15000, null]);
  });

  // This task's own addition: the type's own standing season fee (`asset_types.fee`, whole
  // dollars) rides along on every row regardless of billing state -- distinct from `feeCents`
  // above, which is the outstanding PAYMENT amount and is `null` for two of these three rows.
  it("carries the asset type's own standing season fee on every row, billed or not", async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_assignments aa': [
          { id: 'aa-1', asset_type: 'mooring', asset_type_name: 'Mooring', description: null, type_fee: 300, payment_id: 'pay-1', paid_at: '2026-01-01 00:00:00', fee_amount: 300 },
          { id: 'aa-2', asset_type: 'rv-parking', asset_type_name: 'RV Parking', description: null, type_fee: 150, payment_id: 'pay-2', paid_at: null, fee_amount: 150 },
          { id: 'aa-3', asset_type: 'boat-parking', asset_type_name: 'Boat Parking', description: null, type_fee: 100, payment_id: null, paid_at: null, fee_amount: null },
        ],
      },
    });
    const rows = await listHouseholdAssignments(db, 'hh-1', 2026);
    expect(rows.map((r) => r.feeDollars)).toEqual([300, 150, 100]);
  });
});

describe('listHouseholdWaitlistEntries', () => {
  it('maps position and the queue\'s own total length', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_waitlist aw': [{ id: 'aw-1', asset_type: 'mooring', asset_type_name: 'Mooring', position: 3, queue_length: 7 }],
      },
    });
    await expect(listHouseholdWaitlistEntries(db, 'hh-1')).resolves.toEqual([
      { id: 'aw-1', assetType: 'mooring', assetTypeName: 'Mooring', position: 3, queueLength: 7 },
    ]);
  });
});

describe('listHouseholdRequests', () => {
  it('maps every stage', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_requests r JOIN asset_types at': [
          { id: 'req-1', asset_type: 'mooring', asset_type_name: 'Mooring', kind: 'retention', status: 'approved_awaiting_payment', note: null, deny_reason: null, fee: 300, created_at: '2026-01-01 00:00:00' },
        ],
      },
    });
    await expect(listHouseholdRequests(db, 'hh-1')).resolves.toEqual([
      { id: 'req-1', assetType: 'mooring', assetTypeName: 'Mooring', kind: 'retention', status: 'approved_awaiting_payment', note: null, denyReason: null, fee: 300, createdAt: '2026-01-01 00:00:00' },
    ]);
  });
});

describe('createAssetRequest', () => {
  it('inserts a pending request', async () => {
    const { db, calls } = fakeD1();
    const result = await createAssetRequest(db, { assetType: 'mooring', householdId: 'hh-1', requestedBy: 'mem-1', kind: 'new', note: 'Need a spot' });
    expect(result).toEqual({ id: expect.any(String) });
    if ('error' in result) throw new Error('expected success');
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_requests'));
    expect(insert?.args).toEqual([result.id, 'mooring', 'hh-1', 'mem-1', 'new', 'Need a spot']);
  });

  // 0037_asset_request_unique's own partial unique index closes the double-click race the
  // app-level guards (requestAsset's own lack of one, retainAsset's SELECT-then-insert) cannot:
  // two concurrent inserts can both pass a pre-check before either lands. Simulated the same way
  // `member-portal-profile.test.ts`'s own UNIQUE(email) test does, since `fakeD1` never executes
  // real SQL and so cannot itself enforce a partial index -- a household with a pending request
  // already on file for this asset type is exactly what the real index would reject.
  it('turns a UNIQUE(household_id, asset_type) collision into a plain-words refusal, not a 500', async () => {
    const { db } = fakeD1();
    db.prepare = (sql: string) => {
      const stmt = {
        sql,
        bind: () => stmt,
        run: () => Promise.reject(new Error('UNIQUE constraint failed: asset_requests.household_id, asset_requests.asset_type: SQLITE_CONSTRAINT')),
        first: async () => null,
        all: async () => ({ results: [], success: true, meta: {} }),
      };
      return stmt as unknown as ReturnType<typeof db.prepare>;
    };
    const result = await createAssetRequest(db, { assetType: 'mooring', householdId: 'hh-1', requestedBy: 'mem-1', kind: 'new', note: null });
    expect(result).toEqual({ error: expect.stringContaining('already have a pending request') });
  });

  // Pins isUniqueViolation's own branch: a non-UNIQUE constraint failure (shaped like a real D1
  // FOREIGN KEY rejection) must fall through to the generic refusal, never the duplicate-request
  // message a mis-mapped substring match could produce.
  it('turns a non-UNIQUE rejection into the generic refusal, not the duplicate-request message', async () => {
    const { db } = fakeD1();
    db.prepare = (sql: string) => {
      const stmt = {
        sql,
        bind: () => stmt,
        run: () => Promise.reject(new Error('FOREIGN KEY constraint failed: SQLITE_CONSTRAINT')),
        first: async () => null,
        all: async () => ({ results: [], success: true, meta: {} }),
      };
      return stmt as unknown as ReturnType<typeof db.prepare>;
    };
    const result = await createAssetRequest(db, { assetType: 'mooring', householdId: 'hh-1', requestedBy: 'mem-1', kind: 'new', note: null });
    expect(result).toEqual({ error: 'Something went wrong recording your request. Please try again.' });
  });
});

describe('cancelAssetRequest', () => {
  it('cancels only a pending request belonging to the household', async () => {
    const { db, calls } = fakeD1({ runResults: { "SET status = 'cancelled'": { changes: 1 } } });
    const result = await cancelAssetRequest(db, 'req-1', 'hh-1', 'mem-1');
    expect(result).toEqual({ ok: true });
    expect(calls[0].args).toEqual(['mem-1', 'req-1', 'hh-1']);
  });

  it('refuses when nothing matched (wrong household, or past pending)', async () => {
    const { db } = fakeD1({ runResults: { "SET status = 'cancelled'": { changes: 0 } } });
    const result = await cancelAssetRequest(db, 'req-1', 'hh-1', 'mem-1');
    expect(result).toEqual({ error: expect.stringContaining('can no longer be cancelled') });
  });
});

describe('releaseHouseholdAssignment', () => {
  it('refuses an assignment that is not the household\'s own', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_assignments aa JOIN memberships m': null } });
    const result = await releaseHouseholdAssignment(db, 'aa-1', 'hh-1');
    expect(result).toEqual({ error: 'No such assignment.' });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it('releases an owned, active assignment', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_assignments aa JOIN memberships m': { id: 'aa-1' } } });
    const result = await releaseHouseholdAssignment(db, 'aa-1', 'hh-1');
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes("SET status = 'released'"))).toBe(true);
  });
});

describe('getPriorHoldingSummary', () => {
  it('answers null for a household that has never held this type', async () => {
    const { db } = fakeD1({ allResults: { 'FROM asset_assignments aa JOIN memberships m': [] } });
    await expect(getPriorHoldingSummary(db, 'hh-1', 'mooring')).resolves.toBeNull();
  });

  it('reports a clean paid-every-season history', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_assignments aa JOIN memberships m': [
          { created_at: '2023-04-01 00:00:00', unpaid_seasons: 0, billed_seasons: 1 },
          { created_at: '2024-04-01 00:00:00', unpaid_seasons: 0, billed_seasons: 1 },
          { created_at: '2026-04-01 00:00:00', unpaid_seasons: 0, billed_seasons: 1 },
        ],
      },
    });
    await expect(getPriorHoldingSummary(db, 'hh-1', 'mooring')).resolves.toBe('Held this type 2023 through 2026, paid each season.');
  });

  it('reports mixed history honestly, never asserting "paid each season" when it is not true', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_assignments aa JOIN memberships m': [{ created_at: '2026-04-01 00:00:00', unpaid_seasons: 1, billed_seasons: 1 }],
      },
    });
    await expect(getPriorHoldingSummary(db, 'hh-1', 'mooring')).resolves.toBe('Held this type 2026; payment history is mixed.');
  });
});

describe('approveNewRequest', () => {
  const REQUEST_ROW = { asset_type: 'mooring', household_id: 'hh-1', requested_by: 'mem-1', kind: 'new' as const };

  it('refuses a non-pending or unknown request', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_requests WHERE id': null } });
    await expect(approveNewRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN)).resolves.toEqual({ error: expect.stringContaining('No such pending') });
  });

  it('refuses a retention-kind request (needs the retention approval action)', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_requests WHERE id': { ...REQUEST_ROW, kind: 'retention' } } });
    await expect(approveNewRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN)).resolves.toEqual({ error: expect.stringContaining('retention approval') });
  });

  it('assigns directly when the type has a free slot', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': REQUEST_ROW,
        'FROM asset_types WHERE id': { capacity: 10 },
        'FROM asset_assignments WHERE asset_type': { n: 3 },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
      },
    });
    const result = await approveNewRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN);
    expect(result).toEqual({ ok: true, outcome: 'assigned' });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(true);
    expect(calls.some((c) => c.sql.includes("SET status = 'assigned'"))).toBe(true);
  });

  it('queues when the type has no free slot', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': REQUEST_ROW,
        'FROM asset_types WHERE id': { capacity: 3 },
        'FROM asset_assignments WHERE asset_type': { n: 3 },
      },
    });
    const result = await approveNewRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN);
    expect(result).toEqual({ ok: true, outcome: 'queued' });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_waitlist'))).toBe(true);
    expect(calls.some((c) => c.sql.includes("SET status = 'queued'"))).toBe(true);
  });

  it('treats a null capacity (uncapped type) as always having a free slot', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': REQUEST_ROW,
        'FROM asset_types WHERE id': { capacity: null },
        'FROM asset_assignments WHERE asset_type': { n: 999 },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
      },
    });
    await expect(approveNewRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN)).resolves.toEqual({ ok: true, outcome: 'assigned' });
  });
});

describe('approveRetentionRequest', () => {
  it('opens the pay task without assigning outright (the merit gate)', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_requests WHERE id': { kind: 'retention' } } });
    const result = await approveRetentionRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN);
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes("SET status = 'approved_awaiting_payment'"))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(false);
  });

  it('refuses a new-kind request', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_requests WHERE id': { kind: 'new' } } });
    await expect(approveRetentionRequest(db, 'req-1', 'admin@example.com', NO_EMAIL, ORIGIN)).resolves.toEqual({ error: expect.stringContaining('new-request approval') });
  });
});

describe('denyAssetRequest', () => {
  it('requires the request to still be pending', async () => {
    const { db } = fakeD1({ runResults: { "SET status = 'denied'": { changes: 0 } } });
    await expect(denyAssetRequest(db, 'req-1', 'Not eligible', 'admin@example.com', NO_EMAIL, ORIGIN)).resolves.toEqual({ error: 'No such pending request.' });
  });

  it('denies with the reason recorded', async () => {
    const { db, calls } = fakeD1({ runResults: { "SET status = 'denied'": { changes: 1 } } });
    const result = await denyAssetRequest(db, 'req-1', 'Not eligible', 'admin@example.com', NO_EMAIL, ORIGIN);
    expect(result).toEqual({ ok: true });
    expect(calls[0].args).toEqual(['Not eligible', 'admin@example.com', 'req-1']);
  });
});

describe('payForApprovedRequest (the honest payment stub)', () => {
  it('refuses a request not in approved_awaiting_payment for this household', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_requests WHERE id': null } });
    await expect(payForApprovedRequest(db, 'req-1', 'hh-1')).resolves.toEqual({ error: expect.stringContaining('No such request') });
  });

  it('creates the real assignment and an OUTSTANDING payment row (never claims money moved)', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': { asset_type: 'mooring', household_id: 'hh-1' },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
        'FROM asset_types WHERE id': { fee: 300 },
      },
    });
    const result = await payForApprovedRequest(db, 'req-1', 'hh-1');
    expect(result).toEqual({ ok: true, assignmentId: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(true);
    const paymentInsert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_payments'));
    expect(paymentInsert?.args).toEqual([expect.any(String), expect.any(String), expect.any(Number), 300]);
    expect(paymentInsert?.sql).not.toContain('paid_at');
    expect(calls.some((c) => c.sql.includes("SET status = 'assigned'"))).toBe(true);
  });
});

describe('getPayableAssignmentFee', () => {
  it('refuses when the assignment carries no outstanding row for the season (already paid, not the household\'s own, or never billed)', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_assignments aa': null } });
    await expect(getPayableAssignmentFee(db, 'aa-1', 'hh-1', 2026)).resolves.toEqual({ error: expect.stringContaining('No outstanding fee') });
  });

  it('answers the outstanding fee in cents, converted from the stored dollar amount, plus the asset type id', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM asset_assignments aa': { asset_type: 'mooring', asset_type_name: 'Mooring', amount: 150 } },
    });
    await expect(getPayableAssignmentFee(db, 'aa-1', 'hh-1', 2026)).resolves.toEqual({ amountCents: 15000, assetType: 'mooring', assetTypeName: 'Mooring' });
    expect(calls[0].args).toEqual(['aa-1', 'hh-1', 2026]);
  });
});

describe('listPendingAssetRequests (the admin review inbox)', () => {
  it('joins each row to its prior-holding summary', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM asset_requests r': [
          { id: 'req-1', asset_type_name: 'Mooring', asset_type: 'mooring', household_name: 'The Scratches', household_id: 'hh-1', requester_name: 'Primary Scratch', kind: 'retention', note: null, created_at: '2026-01-01 00:00:00', fee: 300 },
        ],
        'FROM asset_assignments aa JOIN memberships m': [{ created_at: '2025-04-01 00:00:00', unpaid_seasons: 0, billed_seasons: 1 }],
      },
    });
    const rows = await listPendingAssetRequests(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].priorHolding).toBe('Held this type 2025, paid each season.');
  });
});

// The decision-email wiring (Assets substrate T5b): every firstResults fixture below carries
// BOTH the deciding function's own lookup keys (`FROM asset_requests WHERE id`, etc.) and
// `sendAssetDecisionEmail`'s own re-lookup keys (`FROM asset_requests r`, `FROM members WHERE
// id`), since a decision send re-reads the request fresh rather than threading its data through
// from the caller (asset-decision-notify.ts's own header explains why).
describe('decision emails (Assets substrate T5b)', () => {
  const DECISION_LOOKUP = { household_id: 'hh-1', requested_by: 'mem-1', asset_type_name: 'Mooring', fee: 300 };
  const RECIPIENT = { 'FROM asset_requests r': DECISION_LOOKUP, 'FROM members WHERE id': { email: 'household@example.com' } };

  it('approving a new request into a free slot sends the assigned kind', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': { asset_type: 'mooring', household_id: 'hh-1', requested_by: 'mem-1', kind: 'new' as const },
        'FROM asset_types WHERE id': { capacity: 10 },
        'FROM asset_assignments WHERE asset_type': { n: 3 },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
        ...RECIPIENT,
      },
    });
    const result = await approveNewRequest(db, 'req-1', 'admin@example.com', { EMAIL: { send } }, ORIGIN);
    expect(result).toEqual({ ok: true, outcome: 'assigned' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('household@example.com');
    expect(send.mock.calls[0][0].text).toContain("it's now assigned to you");
  });

  it('approving into a full type sends the queued kind', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': { asset_type: 'mooring', household_id: 'hh-1', requested_by: 'mem-1', kind: 'new' as const },
        'FROM asset_types WHERE id': { capacity: 3 },
        'FROM asset_assignments WHERE asset_type': { n: 3 },
        ...RECIPIENT,
      },
    });
    const result = await approveNewRequest(db, 'req-1', 'admin@example.com', { EMAIL: { send } }, ORIGIN);
    expect(result).toEqual({ ok: true, outcome: 'queued' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain('your household is on the waitlist');
  });

  it('approving a retention request sends the retention kind', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': { kind: 'retention' as const },
        ...RECIPIENT,
      },
    });
    const result = await approveRetentionRequest(db, 'req-1', 'admin@example.com', { EMAIL: { send } }, ORIGIN);
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain('$300');
  });

  it('denying sends the denied kind with the reason present in the body', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      runResults: { "SET status = 'denied'": { changes: 1 } },
      firstResults: RECIPIENT,
    });
    const result = await denyAssetRequest(db, 'req-1', 'Not eligible this season', 'admin@example.com', { EMAIL: { send } }, ORIGIN);
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain('Not eligible this season');
  });

  it('an unbound EMAIL binding leaves the approve and deny results unchanged', async () => {
    const { db: approveDb } = fakeD1({
      firstResults: {
        'FROM asset_requests WHERE id': { asset_type: 'mooring', household_id: 'hh-1', requested_by: 'mem-1', kind: 'new' as const },
        'FROM asset_types WHERE id': { capacity: 10 },
        'FROM asset_assignments WHERE asset_type': { n: 3 },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
        ...RECIPIENT,
      },
    });
    await expect(approveNewRequest(approveDb, 'req-1', 'admin@example.com', {}, ORIGIN)).resolves.toEqual({ ok: true, outcome: 'assigned' });

    const { db: denyDb } = fakeD1({ runResults: { "SET status = 'denied'": { changes: 1 } }, firstResults: RECIPIENT });
    await expect(denyAssetRequest(denyDb, 'req-1', 'Not eligible', 'admin@example.com', {}, ORIGIN)).resolves.toEqual({ ok: true });
  });
});
