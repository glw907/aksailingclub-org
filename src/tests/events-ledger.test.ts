// The Events ledger route (`/admin/club/events`, events-admin pass Task 4,
// docs/plans/2026-08-22-events-admin.md): the season-scoped load (`listLedger` plus
// `listEventSeasons` and `previewRollForward`, unioned and defaulted the same way
// `classes/+page.server.ts`'s own `parseSeason` idiom works) and the two actions this task adds,
// `setDate` (the inline current-season date save) and `rollForward` (the "Start the next
// season" confirmation's submit). Mirrors `classes-list.test.ts`'s own load-event recipe and
// `events-actions.test.ts`'s own `postEvent`/CSRF fixture recipe for the actions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import type { AdminActionAuditRecord } from '@glw907/cairn-cms/sveltekit';
import { actions, load } from '../routes/admin/club/events/+page.server';
import type { LedgerRow } from '$admin-club/lib/events-store';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';
import { editorWithRole } from './_editor';

type LoadEvent = Parameters<typeof load>[0];
type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

function loadEventFor(db: unknown, search = ''): LoadEvent {
  return {
    route: { id: '/admin/club/events' },
    setHeaders: () => undefined,
    locals: { cairnEditor: editorWithRole('Club manager') },
    platform: { env: { CLUB_DB: db } },
    url: new URL(`https://x.dev/admin/club/events${search}`),
  } as unknown as LoadEvent;
}

async function runLoad(db: unknown, search = ''): Promise<LoadResult> {
  return (await load(loadEventFor(db, search))) as LoadResult;
}

/** A database whose every read throws, standing in for D1 being down mid-request
 *  (`events-detail-route.test.ts`'s own `FAILING_DB` recipe). */
const FAILING_DB = {
  prepare: () => ({
    bind: () => ({
      first: async () => {
        throw new Error('D1 is down');
      },
      all: async () => {
        throw new Error('D1 is down');
      },
      run: async () => {
        throw new Error('D1 is down');
      },
    }),
  }),
  batch: async () => {
    throw new Error('D1 is down');
  },
};

const EMPTY_LEDGER_READS = {
  'FROM events e JOIN event_series s': [],
  'FROM classes WHERE season IN': [],
  'FROM event_series es': [],
};

describe('/admin/club/events load', () => {
  it('degrades to an empty, error-carrying result when CLUB_DB is not bound', async () => {
    const result = await runLoad(undefined);
    expect(result.error).toBe('CLUB_DB is not bound.');
    expect(result.rows).toEqual([]);
    expect(result.seasons).toEqual([]);
    expect(result.rollPlan).toBeNull();
  });

  it('degrades to an empty, error-carrying result on a D1 read failure, never a 500', async () => {
    const result = await runLoad(FAILING_DB);
    expect(result.error).toBe('Could not read the events table.');
    expect(result.rows).toEqual([]);
  });

  it('defaults the season to settings.current_season with no ?season= param', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: { ...EMPTY_LEDGER_READS, 'SELECT DISTINCT season FROM events': [{ season: 2026 }] },
    });
    const result = await runLoad(db);
    expect(result.error).toBeNull();
    expect(result.season).toBe(2026);
    expect(result.currentSeason).toBe(2026);
    expect(result.seasons).toEqual([2026]);
    expect(result.rollPlan).toEqual({ fromSeason: 2026, toSeason: 2027, create: [], skipped: [] });
  });

  it('a ?season= param reaches history, overriding the current-season default', async () => {
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        ...EMPTY_LEDGER_READS,
        'SELECT DISTINCT season FROM events': [{ season: 2026 }, { season: 2025 }],
      },
    });
    const result = await runLoad(db, '?season=2025');
    expect(result.season).toBe(2025);
    expect(result.currentSeason).toBe(2026);
    expect(result.rollPlan).toEqual({ fromSeason: 2025, toSeason: 2026, create: [], skipped: [] });
    const scoped = calls.find((c) => c.sql.includes('FROM events e JOIN event_series s'));
    expect(scoped?.args).toEqual([2025, 2024, 2023]);
  });

  it('always offers the current season, even with zero rows in it yet', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: { ...EMPTY_LEDGER_READS, 'SELECT DISTINCT season FROM events': [{ season: 2025 }] },
    });
    const result = await runLoad(db);
    expect(result.seasons).toEqual([2026, 2025]);
  });

  const EVENT_RAW_BASE = {
    slug: 'board-meeting',
    category: 'governance',
    short_description: null,
    long_description: null,
    start_time: null,
    end_time: null,
    location: null,
    hero_image: null,
    hero_image_alt: null,
    thumbnail_image: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    recurrence: 'annual',
    retired_at: null,
  };

  it('carries the ledger rows and rollPlan through, counting only the undated-and-present rows', async () => {
    const dated = {
      ...EVENT_RAW_BASE,
      id: 'board-meeting-2026',
      series_id: 'series-board',
      season: 2026,
      title: 'Board Meeting',
      series_title: 'Board Meeting',
      start_date: '2026-08-01',
      end_date: null,
      visible: 1,
    };
    const undated = {
      ...EVENT_RAW_BASE,
      id: 'regatta-2026',
      series_id: 'series-regatta',
      season: 2026,
      title: 'Regatta',
      series_title: 'Regatta',
      slug: 'regatta',
      start_date: null,
      end_date: null,
      visible: 0,
    };
    // No current-season row at all: a series that only ran last year still appears (`current`
    // reads null), and never counts toward the undated total.
    const priorOnly = {
      ...EVENT_RAW_BASE,
      id: 'ice-breaker-2025',
      series_id: 'series-ice-breaker',
      season: 2025,
      title: 'Ice Breaker',
      series_title: 'Ice Breaker',
      slug: 'ice-breaker',
      start_date: '2025-01-01',
      end_date: null,
      visible: 1,
    };
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM events e JOIN event_series s': [dated, undated, priorOnly],
        'FROM classes WHERE season IN': [],
        'GROUP BY series_id': [
          { series_id: 'series-board', n: 1 },
          { series_id: 'series-regatta', n: 1 },
          { series_id: 'series-ice-breaker', n: 1 },
        ],
        'FROM event_series es': [],
        'SELECT DISTINCT season FROM events': [{ season: 2026 }, { season: 2025 }],
      },
    });
    const result = await runLoad(db);
    expect(result.rows).toHaveLength(3);
    expect(result.undatedCount).toBe(1);
    const regattaRow = result.rows.find((row: LedgerRow) => row.id === 'regatta-2026');
    expect(regattaRow?.current).toEqual({ id: 'regatta-2026', startDate: null, endDate: null, visible: false });
    const iceBreakerRow = result.rows.find((row: LedgerRow) => row.seriesId === 'series-ice-breaker');
    expect(iceBreakerRow?.current).toBeNull();
  });
});

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

type ActionEvent = Parameters<typeof actions.setDate>[0];

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
    route: { id: new URL(url).pathname },
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

const UNDATED_EVENT = { ...EXISTING_EVENT, id: 'regatta-2026', start_date: null, visible: 0 };

describe('setDate action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.setDate(postEvent(noRole, { id: 'board-meeting-2026', startDate: '2026-08-01', endDate: '' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 404 on a missing id, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.setDate(postEvent(admin, { startDate: '2026-08-01', endDate: '' }, { db, auditSink: sink }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity: 'event', detail: 'rejected: no such event' }),
    );
  });

  it('fails 404 on an unknown id, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': null } });
    const sink = vi.fn();
    const result = await actions.setDate(
      postEvent(admin, { id: 'no-such-event', startDate: '2026-08-01', endDate: '' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'no-such-event', detail: 'rejected: no such event' }),
    );
  });

  it('fails 400 on a malformed date, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.setDate(
      postEvent(admin, { id: 'board-meeting-2026', startDate: 'not-a-date', endDate: '' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe('Enter a date as YYYY-MM-DD.');
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: malformed date' }));
  });

  it('fails 400 when the end date is before the start date, auditing the rejected attempt', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.setDate(
      postEvent(admin, { id: 'board-meeting-2026', startDate: '2026-08-10', endDate: '2026-08-01' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toBe('The end date is before the start date.');
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: end before start' }));
  });

  it('saves the dates and audits once for an already-dated row (no second publish audit)', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    const result = await actions.setDate(
      postEvent(admin, { id: 'board-meeting-2026', startDate: '2026-08-15', endDate: '' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('UPDATE events SET start_date'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'board-meeting-2026', detail: 'dates' }));
    expect(sink).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'published' }));
  });

  it('saves a date on an undated row and audits both dates and published', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': UNDATED_EVENT } });
    const sink = vi.fn();
    const result = await actions.setDate(
      postEvent(admin, { id: 'regatta-2026', startDate: '2026-06-01', endDate: '' }, { db, auditSink: sink }),
    );
    expect(result).toEqual({ ok: true });
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'regatta-2026', detail: 'dates' }));
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'regatta-2026', detail: 'published' }));
  });

  it('clearing a date to empty never audits published', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const sink = vi.fn();
    await actions.setDate(postEvent(admin, { id: 'board-meeting-2026', startDate: '', endDate: '' }, { db, auditSink: sink }));
    expect(sink).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'published' }));
  });
});

describe('rollForward action', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.rollForward(postEvent(noRole, { fromSeason: '2026', toSeason: '2027' }, { db }));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('refuses a toSeason other than fromSeason + 1, auditing the rejected attempt', async () => {
    const { db } = fakeD1();
    const sink = vi.fn();
    const result = await actions.rollForward(
      postEvent(admin, { fromSeason: '2026', toSeason: '2026' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: invalid target season' }));
  });

  it('rolls the plan forward, audits the counts, and redirects to the new season', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM event_series es': [
          { series_id: 'series-board', title: 'Board Meeting', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
        ],
      },
    });
    const sink = vi.fn();
    // `seriesIds` mirrors the recomputed plan's own create set (`+page.svelte`'s own hidden-input
    // render): the handler recomputes the plan fresh and refuses with 409 when the two disagree.
    const caught = await catchThrown(
      actions.rollForward(
        postEvent(admin, { fromSeason: '2026', toSeason: '2027', seriesIds: 'series-board' }, { db, auditSink: sink }),
      ),
    );
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('?season=2027');
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO events'))).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'roll-forward',
        entity: 'event',
        entityId: '2027',
        detail: '1 created, 0 skipped',
      }),
    );
  });

  it('refuses with 409 when the recomputed plan no longer matches the posted seriesIds', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM event_series es': [
          { series_id: 'series-board', title: 'Board Meeting', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
        ],
      },
    });
    const sink = vi.fn();
    const result = await actions.rollForward(
      postEvent(admin, { fromSeason: '2026', toSeason: '2027', seriesIds: 'series-stale' }, { db, auditSink: sink }),
    );
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(409);
    expect((result as { data: { error: string } }).data.error).toBe('The season changed since you opened this. Review it again.');
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ detail: 'rejected: plan changed since preview' }));
  });
});
