// The assets route's own actions (Part 2): the club-role gate and the audit wiring, mirroring
// `classes-actions.test.ts`'s established `postEvent` recipe. `assets-store.test.ts` owns the
// data-layer logic; this file only proves the route composes `clubAdminAction` correctly around
// it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import type { AdminActionAuditRecord } from '@glw907/cairn-cms/sveltekit';
import { actions } from '../routes/admin/club/assets/+page.server';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
// 'Instructor' carries no club role; clubAdminAction's gate now reads `editor.role` directly
// (initiative 5 Task 2), not a `club_roles` row.
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

type ActionEvent = Parameters<typeof actions.assign>[0];

function postEvent(
  editor: Editor | null,
  fields: Record<string, string>,
  opts: { db?: unknown; auditSink?: (record: AdminActionAuditRecord) => void; email?: { send: (message: unknown) => Promise<void> } } = {},
) {
  const formData = new FormData();
  formData.set('csrf', CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const url = 'https://x.dev/admin/club/assets';
  const request = new Request(url, { method: 'POST', body: formData });
  return {
    url: new URL(url),
    params: {},
    request,
    cookies: {
      get: (name: string) => (name === CSRF_COOKIE_NAME ? CSRF_TOKEN : undefined),
      set: () => undefined,
      delete: () => undefined,
    },
    platform: { env: { CLUB_DB: opts.db, EMAIL: opts.email } },
    route: { id: new URL(url).pathname },
    setHeaders: () => undefined,
    locals: { cairnEditor: editor, cairnAuditSink: opts.auditSink, cairnAccess: access },
  } as unknown as ActionEvent;
}

describe('assets actions: assign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.assign(postEvent(noRole, { assetType: 'mooring', membershipId: 'ms-1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 when the household is missing, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.assign(postEvent(admin, { assetType: 'mooring', membershipId: '' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'assign', entity: 'assignment' }));
  });

  it('inserts the assignment and audits its id', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.assign(
      postEvent(admin, { assetType: 'mooring', membershipId: 'ms-1', description: 'Buoy M-14' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_assignments'));
    expect(insert?.args).toEqual([insert?.args[0], 'mooring', 'ms-1', 'Buoy M-14', 'active']);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assign', entity: 'assignment', actor: admin.email }),
    );
  });
});

describe('assets actions: release', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails 404 when the assignment does not exist', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_assignments WHERE id': null } });
    const result = await actions.release(postEvent(admin, { assignmentId: 'a-1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
  });

  it('updates status to released and audits the id', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM asset_assignments WHERE id': { id: 'a-1', status: 'active', asset_type: 'mooring' } },
    });
    const sink = vi.fn();
    const result = await actions.release(postEvent(admin, { assignmentId: 'a-1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_assignments SET status'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'release', entity: 'assignment', entityId: 'a-1', actor: admin.email }));
  });
});

describe('assets actions: recordPayment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails 400 on an invalid method', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM asset_assignments WHERE id': { id: 'a-1', status: 'active', asset_type: 'mooring' } },
    });
    const result = await actions.recordPayment(postEvent(admin, { assignmentId: 'a-1', amount: '300', method: 'venmo' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
  });

  it('fails 404 when the assignment does not exist', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_assignments WHERE id': null } });
    const result = await actions.recordPayment(postEvent(admin, { assignmentId: 'a-1', amount: '300', method: 'check' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
  });

  it('records an offline check payment and audits the method', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM asset_assignments WHERE id': { id: 'a-1', status: 'active', asset_type: 'mooring' },
        "'current_season'": { value: '2026' },
      },
    });
    const sink = vi.fn();
    const result = await actions.recordPayment(
      postEvent(admin, { assignmentId: 'a-1', amount: '300', method: 'check', reference: 'Check #1234' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_payments'));
    expect(insert?.args.slice(1)).toEqual(['a-1', 2026, 300, 'check', 'Check #1234']);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      action: 'record-payment',
      entity: 'asset-payment',
      entityId: 'a-1',
      detail: 'method=check',
      actor: admin.email,
    }));
  });
});

describe('assets actions: waitlist', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waitlistAdd refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.waitlistAdd(postEvent(noRole, { assetType: 'mooring', memberId: 'mem-1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('waitlistAdd inserts a row at the end of the type-specific queue', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE asset_type': { max_position: 1 } } });
    const sink = vi.fn();
    const result = await actions.waitlistAdd(postEvent(admin, { assetType: 'mooring', memberId: 'mem-1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO asset_waitlist'));
    expect(insert?.args).toEqual([insert?.args[0], 'mooring', 'mem-1', 2, null]);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'add', entity: 'asset-waitlist' }));
  });

  it('waitlistRemove deletes the one row and audits it', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.waitlistRemove(postEvent(admin, { waitlistId: 'w-1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    // clubAdminAction's role gate no longer queries club_roles (initiative 5 Task 2): it is the
    // only DB call this handler makes.
    expect(calls).toEqual([{ sql: 'DELETE FROM asset_waitlist WHERE id = ?1', args: ['w-1'] }]);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'remove', entity: 'asset-waitlist', entityId: 'w-1', actor: admin.email }));
  });

  it('waitlistMoveToEnd fails 404 for an unknown entry', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE id': null } });
    const result = await actions.waitlistMoveToEnd(postEvent(admin, { waitlistId: 'w-1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
  });

  it('waitlistMoveToEnd re-tails the entry within its own asset type and audits it', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' } } });
    const sink = vi.fn();
    const result = await actions.waitlistMoveToEnd(postEvent(admin, { waitlistId: 'w-1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_waitlist SET position') && c.args.includes('mooring'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'reorder', entity: 'asset-waitlist', entityId: 'w-1', actor: admin.email }));
  });
});

describe('assets actions: waitlistPromote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const PROMOTABLE_DB_FIXTURES = {
    'FROM asset_waitlist aw': { id: 'w-1', asset_type: 'mooring', asset_type_name: 'Mooring', member_id: 'mem-1' },
    "'current_season'": { value: '2026' },
    'FROM members m': { membership_id: 'ms-1', household_id: 'hh-1' },
    'FROM asset_waitlist WHERE id': { id: 'w-1', asset_type: 'mooring' },
    'FROM members WHERE id': { email: 'waiting@example.com' },
  };

  it('refuses an editor with no club role (403), auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: PROMOTABLE_DB_FIXTURES });
    const sink = vi.fn();
    const result = await actions.waitlistPromote(postEvent(noRole, { assetType: 'mooring' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'promote', entity: 'asset-waitlist' }));
  });

  it('fails 400 when assetType is missing, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.waitlistPromote(postEvent(admin, {}, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'promote', entity: 'asset-waitlist' }));
  });

  it('fails 404 when no one is waiting for that asset type, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM asset_waitlist aw': null } });
    const sink = vi.fn();
    const result = await actions.waitlistPromote(postEvent(admin, { assetType: 'mooring' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'promote', entity: 'asset-waitlist' }));
  });

  it('fails 400 when the member has no current-season membership, writing nothing and auditing the rejection', async () => {
    const { db, calls } = fakeD1({
      firstResults: { ...PROMOTABLE_DB_FIXTURES, 'FROM members m': null },
    });
    const sink = vi.fn();
    const result = await actions.waitlistPromote(postEvent(admin, { assetType: 'mooring' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM asset_waitlist'))).toBe(false);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'promote', entity: 'asset-waitlist', entityId: 'w-1' }));
  });

  it('creates the assignment, removes the entry, audits the assignment id, and calls the email helper exactly once', async () => {
    const { db, calls } = fakeD1({ firstResults: PROMOTABLE_DB_FIXTURES });
    const send = vi.fn().mockResolvedValue(undefined);
    const sink = vi.fn();
    const result = await actions.waitlistPromote(postEvent(admin, { assetType: 'mooring' }, { db, auditSink: sink, email: { send } }));
    expect(result).toMatchObject({ ok: true, assignmentId: expect.any(String), emailSent: true });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO asset_assignments'))).toBe(true);
    const remove = calls.find((c) => c.sql.startsWith('DELETE FROM asset_waitlist'));
    expect(remove?.args).toEqual(['w-1']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('waiting@example.com');
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'promote', entity: 'asset-waitlist', entityId: 'w-1', detail: expect.stringContaining('assignment=') }),
    );
  });

  it('succeeds against a type already at or over capacity: capacity is never checked', async () => {
    const { db, calls } = fakeD1({ firstResults: PROMOTABLE_DB_FIXTURES });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await actions.waitlistPromote(postEvent(admin, { assetType: 'mooring' }, { db, email: { send } }));
    expect(result).toMatchObject({ ok: true });
    // No capacity read (`asset_types.capacity`) and no active-count read: promotion never asks,
    // it only ever creates the assignment the admin already chose to make.
    expect(calls.some((c) => c.sql.includes('SELECT capacity'))).toBe(false);
    expect(calls.some((c) => c.sql.includes('COUNT(*)'))).toBe(false);
  });

  it('sends the slot-opened email even though the promotion has already deleted the waitlist row (the ordering defect this pass closes)', async () => {
    const { db, calls } = fakeD1({ firstResults: PROMOTABLE_DB_FIXTURES });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await actions.waitlistPromote(postEvent(admin, { assetType: 'mooring' }, { db, email: { send } }));
    expect(result).toMatchObject({ ok: true, emailSent: true });
    // The email send happens AFTER the delete in the recorded call order, proving the send
    // reached a pre-resolved payload rather than re-looking the (now-gone) row up.
    const deleteIndex = calls.findIndex((c) => c.sql.startsWith('DELETE FROM asset_waitlist'));
    const emailLogIndex = calls.findIndex((c) => c.sql.startsWith('INSERT INTO email_log'));
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(emailLogIndex).toBeGreaterThan(deleteIndex);
  });
});

describe('assets actions: editType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403), auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.editType(
      postEvent(noRole, { id: 'mooring', name: 'Mooring', fee: '300', capacity: '12' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'edit', entity: 'asset-type' }));
  });

  it('updates all three fields and audits the id', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.editType(
      postEvent(admin, { id: 'mooring', name: 'Mooring (renamed)', fee: '350', capacity: '15' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE asset_types'));
    expect(update?.args).toEqual(['Mooring (renamed)', 350, 15, 'mooring']);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'edit', entity: 'asset-type', entityId: 'mooring', actor: admin.email }));
  });

  it('clears capacity to null without error', async () => {
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'boat-parking', name: 'Trailered Boat Parking', fee: '0' }, { db }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE asset_types'));
    expect(update?.args).toEqual(['Trailered Boat Parking', 0, null, 'boat-parking']);
  });

  it('rejects an empty name, auditing the rejected attempt and writing nothing', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.editType(postEvent(admin, { id: 'mooring', name: '', fee: '300' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_types'))).toBe(false);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'edit', entity: 'asset-type', entityId: 'mooring' }));
  });

  it('rejects a negative fee, writing nothing', async () => {
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'mooring', name: 'Mooring', fee: '-5' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_types'))).toBe(false);
  });

  it('rejects a blank fee rather than coercing it to a free type, writing nothing', async () => {
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'mooring', name: 'Mooring', fee: '' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_types'))).toBe(false);
  });

  it('rejects a fractional fee, writing nothing', async () => {
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'mooring', name: 'Mooring', fee: '300.50' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_types'))).toBe(false);
  });

  it('rejects a fractional capacity, writing nothing', async () => {
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'mooring', name: 'Mooring', fee: '300', capacity: '12.5' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(calls.some((c) => c.sql.startsWith('UPDATE asset_types'))).toBe(false);
  });

  it('accepts a capacity below the type\'s current active-assignment count without error', async () => {
    // No guard read exists to fixture against: the write goes straight through, proving capacity
    // is advisory only.
    const { db, calls } = fakeD1();
    const result = await actions.editType(postEvent(admin, { id: 'small-boat-rack', name: 'Small Boat Rack', fee: '100', capacity: '1' }, { db }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE asset_types'));
    expect(update?.args).toEqual(['Small Boat Rack', 100, 1, 'small-boat-rack']);
  });
});
