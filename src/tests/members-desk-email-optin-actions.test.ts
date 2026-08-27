// The household desk's own opt-in control (Email + Announce pass, Task 4): `setEmailOptIn`
// writes `members.club_email_opt_in` through Task 1's shared `setClubEmailOptIn` writer, the
// admin half of the audience model's one opt-in surface (the portal's own Notifications toggle
// on `/my-account/profile` is the other). Mirrors `members-desk-former-actions.test.ts`'s own
// `postEvent` recipe, which itself follows `committees-actions.test.ts`'s injected-audit-sink
// shape.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import type { AdminActionAuditRecord } from '@glw907/cairn-cms/sveltekit';
import { actions } from '../routes/admin/club/members/[id]/+page.server';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
// 'Instructor' carries no club role; clubAdminAction's gate reads `editor.role` directly.
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

type ActionEvent = Parameters<typeof actions.setEmailOptIn>[0];

function postEvent(
  editor: Editor | null,
  fields: Record<string, string>,
  opts: { db?: unknown; id?: string; auditSink?: (record: AdminActionAuditRecord) => void } = {},
) {
  const formData = new FormData();
  formData.set('csrf', CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const url = 'https://x.dev/admin/club/members/hh-1';
  const request = new Request(url, { method: 'POST', body: formData });
  return {
    url: new URL(url),
    params: { id: opts.id ?? 'hh-1' },
    request,
    cookies: {
      get: (name: string) => (name === CSRF_COOKIE_NAME ? CSRF_TOKEN : undefined),
      set: () => undefined,
      delete: () => undefined,
    },
    platform: { env: { CLUB_DB: opts.db } },
    route: { id: new URL(url).pathname },
    setHeaders: () => undefined,
    locals: { cairnEditor: editor, cairnAuditSink: opts.auditSink, cairnAccess: access },
  } as unknown as ActionEvent;
}

describe('members desk actions: setEmailOptIn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.setEmailOptIn(postEvent(noRole, { memberId: 'mem-1', optedIn: '1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 when memberId is missing, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setEmailOptIn(postEvent(admin, { optedIn: '1' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email-opt-in', entity: 'member', detail: 'rejected: missing memberId or bad optedIn value' }),
    );
  });

  it('fails 400 when optedIn is not exactly 0 or 1, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setEmailOptIn(postEvent(admin, { memberId: 'mem-1', optedIn: 'yes' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email-opt-in', entity: 'member', detail: 'rejected: missing memberId or bad optedIn value' }),
    );
  });

  it('opts a member in and audits the write, with no audit INSERT for fakeD1 to see', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setEmailOptIn(postEvent(admin, { memberId: 'mem-1', optedIn: '1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members SET club_email_opt_in'));
    expect(update?.args).toEqual([1, 'mem-1']);
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email-opt-in', entity: 'member', entityId: 'mem-1', detail: 'opted-in', actor: admin.email }),
    );
  });

  it('opts a member out and audits the write', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setEmailOptIn(postEvent(admin, { memberId: 'mem-1', optedIn: '0' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members SET club_email_opt_in'));
    expect(update?.args).toEqual([0, 'mem-1']);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email-opt-in', entity: 'member', entityId: 'mem-1', detail: 'opted-out', actor: admin.email }),
    );
  });
});
