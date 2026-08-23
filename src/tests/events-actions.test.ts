// The ledger's row-form actions (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`): `save`, `create`, `setVisibility`, `retire`, and `delete`, all
// dispatched off `/admin/club/events` now that `events/new` and `events/[id]`'s own actions are
// retired (the `[id]` route keeps only a redirect-only `load`, covered by
// `events-detail-redirect.test.ts`). Mirrors `events-ledger.test.ts`'s own `postEvent`/CSRF
// fixture recipe.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import type { AdminActionAuditRecord } from '@glw907/cairn-cms/sveltekit';
import { actions } from '../routes/admin/club/events/+page.server';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
// 'Instructor' carries no club role; clubAdminAction's gate reads `editor.role` directly.
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

const VALID_FIELDS = {
  title: 'Board Meeting',
  recurrence: 'annual',
  category: 'governance',
  startDate: '2026-08-11',
};

type ActionEvent = Parameters<typeof actions.save>[0];

/** A fake POST event carrying exactly what `clubAdminAction` and these handlers read: an https
 *  URL, a matching CSRF cookie/field pair, `locals.editor`, and the `CLUB_DB` binding under
 *  `platform.env`. Mirrors `events-ledger.test.ts`'s own `postEvent` recipe. */
function postEvent(
  editor: Editor | null,
  fields: Record<string, string>,
  opts: { db?: unknown; auditSink?: (record: AdminActionAuditRecord) => void } = {},
): ActionEvent {
  const formData = new FormData();
  formData.set('csrf', CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const url = 'https://x.dev/admin/club/events';
  const request = new Request(url, { method: 'POST', body: formData });
  return {
    url: new URL(url),
    request,
    cookies: {
      get: (name: string) => (name === CSRF_COOKIE_NAME ? CSRF_TOKEN : undefined),
      set: () => undefined,
      delete: () => undefined,
    },
    platform: { env: { CLUB_DB: opts.db } },
    route: { id: '/admin/club/events' },
    setHeaders: () => undefined,
    locals: { cairnEditor: editor, cairnAuditSink: opts.auditSink, cairnAccess: access },
  } as unknown as ActionEvent;
}

async function catchThrown(value: unknown): Promise<unknown> {
  try {
    return await value;
  } catch (err) {
    return err;
  }
}

const EXISTING_EVENT = {
  id: 'board-meeting-2026',
  series_id: 'series-board',
  season: 2026,
  title: 'Board Meeting',
  slug: 'board-meeting',
  category: 'governance',
  short_description: null,
  long_description: null,
  start_date: '2026-08-01',
  start_time: null,
  end_date: null,
  end_time: null,
  location: null,
  hero_image: null,
  hero_image_alt: null,
  thumbnail_image: null,
  visible: 1,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

const UNDATED_INVISIBLE_EVENT = { ...EXISTING_EVENT, id: 'regatta-2026', start_date: null, visible: 0 };

describe('save action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.save(postEvent(noRole, { id: 'board-meeting-2026', ...VALID_FIELDS }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 404 on an unknown id, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': null } });
    const sink = vi.fn();
    const result = await actions.save(
      postEvent(admin, { id: 'no-such-event', ...VALID_FIELDS }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'event', detail: 'rejected: no such event' }),
    );
  });

  it('fails 400 on an invalid category, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.save(
      postEvent(admin, { id: 'board-meeting-2026', ...VALID_FIELDS, category: 'not-a-category' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'event', entityId: 'board-meeting-2026' }),
    );
  });

  it('updates the event and the series, and audits the id', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.save(postEvent(admin, { id: 'board-meeting-2026', ...VALID_FIELDS }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE events SET'))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('UPDATE event_series SET'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'event', entityId: 'board-meeting-2026', actor: admin.email }),
    );
  });

  it('moves the event to a different series and audits the link, when linkSeriesId names one', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM events WHERE id': EXISTING_EVENT,
        'FROM event_series WHERE id': { id: 'series-other' },
        'FROM events WHERE series_id = ?1 AND season = ?2': null,
        'FROM events WHERE series_id = ?1 AND id != ?2': { n: 1 },
      },
    });
    const sink = vi.fn();
    const result = await actions.save(
      postEvent(admin, { id: 'board-meeting-2026', ...VALID_FIELDS, linkSeriesId: 'series-other' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes('UPDATE events SET series_id'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'link-series', entity: 'event_series', entityId: 'series-other' }),
    );
  });

  it('surfaces a link refusal as its own fail(400), auditing the rejection', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM events WHERE id': EXISTING_EVENT,
        'FROM event_series WHERE id': null,
      },
    });
    const sink = vi.fn();
    const result = await actions.save(
      postEvent(admin, { id: 'board-meeting-2026', ...VALID_FIELDS, linkSeriesId: 'no-such-series' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe('No such series.');
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'link-series', entity: 'event_series', detail: 'rejected: No such series.' }),
    );
  });
});

describe('create action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.create(postEvent(noRole, { ...VALID_FIELDS, season: '2026' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 on a missing title, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.create(
      postEvent(admin, { ...VALID_FIELDS, title: '', season: '2026' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entity: 'event' }));
  });

  it('fails 400 on a title with no letters or numbers, auditing the rejected attempt before minting an id', async () => {
    const { db, calls } = fakeD1();
    const sink = vi.fn();
    const result = await actions.create(
      postEvent(admin, { ...VALID_FIELDS, title: '!!!', season: '2026' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe('Enter a title with at least one letter or number.');
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entity: 'event' }));
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO event_series'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO events'))).toBe(false);
  });

  it('fails 400 when the name already exists this season, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE season = ?1 AND slug = ?2': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.create(postEvent(admin, { ...VALID_FIELDS, season: '2026' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe('An event with that name already exists this season.');
  });

  it('creates the series and the event, audits both ids, and redirects with ?open= the new id', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM events WHERE season = ?1 AND slug = ?2': null } });
    const sink = vi.fn();
    const caught = await catchThrown(actions.create(postEvent(admin, { ...VALID_FIELDS, season: '2026' }, { db, auditSink: sink })));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('?season=2026&open=board-meeting-2026');
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO event_series'))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO events'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'event_series', entityId: 'series-board-meeting-2026' }),
    );
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity: 'event', entityId: 'board-meeting-2026' }),
    );
  });
});

describe('setVisibility action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.setVisibility(postEvent(noRole, { id: 'board-meeting-2026', show: '0' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 404 on an unknown id, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': null } });
    const sink = vi.fn();
    const result = await actions.setVisibility(
      postEvent(admin, { id: 'no-such-event', show: '0' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: no such event' }));
  });

  it('hides a visible row and audits hide', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.setVisibility(
      postEvent(admin, { id: 'board-meeting-2026', show: '0' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.includes('SET visible = ?1'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'hide', entity: 'event', entityId: 'board-meeting-2026' }));
  });

  it('shows a hidden row and audits show', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': UNDATED_INVISIBLE_EVENT } });
    const sink = vi.fn();
    const result = await actions.setVisibility(
      postEvent(admin, { id: 'regatta-2026', show: '1' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'show', entity: 'event', entityId: 'regatta-2026' }));
  });
});

describe('retire action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.retire(postEvent(noRole, { seriesId: 'series-board', retired: '1' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 404 on an unknown series, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM event_series WHERE id': null } });
    const sink = vi.fn();
    const result = await actions.retire(
      postEvent(admin, { seriesId: 'no-such-series', retired: '1' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retire', entity: 'event_series', detail: 'rejected: no such series' }),
    );
  });

  it('retires a series and audits retire', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM event_series WHERE id': { id: 'series-board' } } });
    const sink = vi.fn();
    const result = await actions.retire(postEvent(admin, { seriesId: 'series-board', retired: '1' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE event_series SET retired_at'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retire', entity: 'event_series', entityId: 'series-board' }),
    );
  });

  it('unretires a series and audits unretire', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM event_series WHERE id': { id: 'series-board' } } });
    const sink = vi.fn();
    const result = await actions.retire(postEvent(admin, { seriesId: 'series-board', retired: '0' }, { db, auditSink: sink }));
    expect(result).toEqual({ ok: true });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unretire', entity: 'event_series', entityId: 'series-board' }),
    );
  });
});

describe('delete action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.delete(postEvent(noRole, { id: 'regatta-2026' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 404 on an unknown id, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': null } });
    const sink = vi.fn();
    const result = await actions.delete(postEvent(admin, { id: 'no-such-event' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: no such event' }));
  });

  it('refuses a published event server-side, auditing the rejection', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.delete(postEvent(admin, { id: 'board-meeting-2026' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe(
      'Only an event that has never been published can be deleted. Hide it instead.',
    );
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: cannot delete a published event' }));
  });

  it('deletes an undated, never-visible event, deletes its now-orphaned series, and audits the id', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM events WHERE id': UNDATED_INVISIBLE_EVENT,
        'FROM events WHERE series_id = ?1 AND id != ?2': { n: 0 },
      },
    });
    const sink = vi.fn();
    const caught = await catchThrown(actions.delete(postEvent(admin, { id: 'regatta-2026' }, { db, auditSink: sink })));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('?season=2026');
    expect(calls.some((c) => c.sql === 'DELETE FROM events WHERE id = ?1')).toBe(true);
    expect(calls.some((c) => c.sql === 'DELETE FROM event_series WHERE id = ?1')).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entity: 'event', entityId: 'regatta-2026', actor: admin.email }),
    );
  });
});
