// asset-decision-notify.ts's own coverage (Assets substrate T5a): a unit test per kind, plus
// recipient-fallback and no-EMAIL-binding degradation, mirroring `waiver-notify.test.ts`'s own
// recipe for a notification module with no route in the picture. `sendAssetDecisionEmail` has no
// caller yet (T5b wires it), so every kind here is exercised by a direct call.
import { describe, expect, it, vi } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { assetDecisionSegment, assetSlotOpenedSegment, sendAssetDecisionEmail } from '$member-portal/lib/asset-decision-notify';

const ORIGIN = 'https://dev.aksailingclub.org';

const REQUEST_ROW = { household_id: 'hh-1', requested_by: 'mem-requester', asset_type_name: 'Mooring', fee: 300 };

describe('sendAssetDecisionEmail: assigned', () => {
  it('names the asset and logs the request/decision segment', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN });

    expect(result).toEqual({ ok: true });
    const message = send.mock.calls[0][0];
    expect(message.to).toBe('requester@example.com');
    expect(message.text).toContain('Mooring');
    expect(message.text).toContain(`${ORIGIN}/my-account/confirm?token=`);
    expect(message.text).toContain('next=%2Fmy-account%2Fgear');

    const logWrite = calls.find((c) => c.sql.startsWith('INSERT INTO email_log'));
    expect(logWrite?.args[2]).toBe(assetDecisionSegment('req-1', 'assigned'));
  });
});

describe('sendAssetDecisionEmail: queued', () => {
  it('says the household is on the waitlist and points at its own place in line, with a subject distinct from the assigned kind', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    await sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'queued', requestId: 'req-1', origin: ORIGIN });

    const message = send.mock.calls[0][0];
    expect(message.text).toContain('your household is on the waitlist');
    expect(message.text).not.toContain('The club will reach out');
    expect(message.subject).not.toBe('Your Mooring request is approved');
  });
});

describe('sendAssetDecisionEmail: retention_approved', () => {
  it('names the payment the member must now act on', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    await sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'retention_approved', requestId: 'req-1', origin: ORIGIN });

    const message = send.mock.calls[0][0];
    expect(message.text).toContain('$300');
    expect(message.text).toContain('Pay it at');
  });
});

describe('sendAssetDecisionEmail: denied', () => {
  it('carries the recorded reason verbatim and mints no sign-in link', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await sendAssetDecisionEmail(db, { EMAIL: { send } }, {
      kind: 'denied',
      requestId: 'req-1',
      origin: ORIGIN,
      reason: 'The mooring field is full for this season.',
    });

    expect(result).toEqual({ ok: true });
    const message = send.mock.calls[0][0];
    expect(message.text).toContain('The mooring field is full for this season.');
    expect(message.text).not.toContain(`${ORIGIN}/my-account/confirm?token=`);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO member_tokens'))).toBe(false);
  });
});

describe('sendAssetDecisionEmail: slot_opened', () => {
  it('says what the member will find (a waitlist position, not a claim control), called directly with no lifecycle caller', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_waitlist aw': { member_id: 'mem-waiting', household_id: 'hh-2', asset_type_name: 'RV Parking' },
        'FROM members WHERE id': { email: 'waiting@example.com' },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'slot_opened', waitlistId: 'aw-1', origin: ORIGIN });

    expect(result).toEqual({ ok: true });
    const message = send.mock.calls[0][0];
    expect(message.text).toContain('next=%2Fmy-account%2Fgear');
    expect(message.text).toContain('your place on the waitlist');
    expect(message.text).not.toContain('claim');

    const logWrite = calls.find((c) => c.sql.startsWith('INSERT INTO email_log'));
    expect(logWrite?.args[2]).toBe(assetSlotOpenedSegment('aw-1'));
  });

  it('answers { ok: false } for a waitlist entry that no longer resolves, never throws', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_waitlist aw': null } });
    const send = vi.fn();
    await expect(
      sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'slot_opened', waitlistId: 'aw-gone', origin: ORIGIN }),
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('sendAssetDecisionEmail: recipient fallback', () => {
  it("falls back to the household's managing adult when the requester has no email on file", async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': ((args: unknown[]) => (args[0] === 'mem-requester' ? { email: null } : { email: 'primary@example.com' })) as never,
        'FROM households WHERE id': { id: 'hh-1', name: 'The Household', primary_member_id: 'mem-primary', left_at: null },
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN });

    expect(result).toEqual({ ok: true });
    expect(send.mock.calls[0][0].to).toBe('primary@example.com');
  });

  it('answers { ok: false } when neither the requester nor the managing adult has an email on file', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: null },
        'FROM households WHERE id': { id: 'hh-1', name: 'The Household', primary_member_id: 'mem-primary', left_at: null },
      },
    });
    const send = vi.fn();
    await expect(
      sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN }),
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('sendAssetDecisionEmail: no such request', () => {
  it('answers { ok: false } for a request id that no longer resolves, never throws', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_requests r': null } });
    const send = vi.fn();
    await expect(
      sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'assigned', requestId: 'req-gone', origin: ORIGIN }),
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('sendAssetDecisionEmail: unbound EMAIL binding', () => {
  it('degrades to { ok: false } and never throws', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    await expect(
      sendAssetDecisionEmail(db, {}, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN }),
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
  });

  it('checks the binding before minting a sign-in link, so an unbound deployment writes no unused token', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_requests r': REQUEST_ROW,
        'FROM members WHERE id': { email: 'requester@example.com' },
      },
    });
    await sendAssetDecisionEmail(db, {}, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO member_tokens'))).toBe(false);
  });
});

describe('sendAssetDecisionEmail: an unexpected D1 failure', () => {
  it('is contained to { ok: false } rather than propagating, keeping the "never throws" doc comment true beyond the two named lookups', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM asset_requests r': (() => {
          throw new Error('D1 is unavailable');
        }) as never,
      },
    });
    const send = vi.fn();
    await expect(
      sendAssetDecisionEmail(db, { EMAIL: { send } }, { kind: 'assigned', requestId: 'req-1', origin: ORIGIN }),
    ).resolves.toEqual({ ok: false, error: 'D1 is unavailable' });
    expect(send).not.toHaveBeenCalled();
  });
});
