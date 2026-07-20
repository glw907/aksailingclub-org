// The household desk's own manual Former override (Members pass T3): setFormer/clearFormer, both
// requiring a one-line reason, recorded through the audit sink alongside the acting editor.
// `member-standing.test.ts` owns markHouseholdFormer/clearManualFormer's own data-layer logic;
// this file only proves the route composes `clubAdminAction` correctly around them, mirroring
// `classes-actions.test.ts`'s own established `postEvent` recipe.
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

type ActionEvent = Parameters<typeof actions.setFormer>[0];

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
    locals: { editor, auditSink: opts.auditSink, cairnAccess: access },
  } as unknown as ActionEvent;
}

describe('members desk actions: setFormer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.setFormer(postEvent(noRole, { reason: 'Moved away mid-season' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 when the reason is missing, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setFormer(postEvent(admin, {}, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mark-former', entity: 'household', entityId: 'hh-1', detail: 'rejected: missing reason' }),
    );
  });

  it('marks the household Former and audits the reason alongside the acting editor', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setFormer(postEvent(admin, { reason: 'Moved away mid-season' }, { db, id: 'hh-1', auditSink: sink }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at'));
    expect(update?.args).toEqual(['hh-1', 'manual']);
    expect(sink).toHaveBeenCalledWith({
      action: 'mark-former',
      entity: 'household',
      entityId: 'hh-1',
      detail: 'Moved away mid-season',
      editor: admin.email,
    });
  });
});

describe('members desk actions: clearFormer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.clearFormer(postEvent(noRole, { reason: "They're renewing" }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 when the reason is missing, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.clearFormer(postEvent(admin, {}, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'clear-former', entity: 'household', entityId: 'hh-1', detail: 'rejected: missing reason' }),
    );
  });

  it('clears the household Former marker and audits the reason alongside the acting editor', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.clearFormer(postEvent(admin, { reason: "They're renewing" }, { db, id: 'hh-1', auditSink: sink }));
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(update?.args).toEqual(['hh-1']);
    expect(sink).toHaveBeenCalledWith({
      action: 'clear-former',
      entity: 'household',
      entityId: 'hh-1',
      detail: "They're renewing",
      editor: admin.email,
    });
  });
});
