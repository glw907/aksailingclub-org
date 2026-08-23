// The retired `events/[id]` detail route (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`): its `load` now only redirects to the ledger, with the row's own
// season selected and its panel opened. `308` (Permanent Redirect), since this is a URL that has
// permanently moved, not a post/redirect/get response to a write.
import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';
import { load } from '../routes/admin/club/events/[id]/+page.server';
import { editorWithRole } from './_editor';
import { fakeD1 } from './_fake-d1';

type LoadEvent = Parameters<typeof load>[0];

function loadEventFor(id: string, db: unknown): LoadEvent {
  return {
    params: { id },
    route: { id: '/admin/club/events/[id]' },
    setHeaders: () => undefined,
    locals: { cairnEditor: editorWithRole('Club manager') },
    platform: { env: { CLUB_DB: db } },
    url: new URL(`https://x.dev/admin/club/events/${id}`),
  } as unknown as LoadEvent;
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

describe('/admin/club/events/[id] redirect', () => {
  it('redirects a known id to the ledger with its season selected and its row opened', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': EXISTING_EVENT } });
    const caught = await catchThrown(load(loadEventFor('board-meeting-2026', db)));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).status).toBe(308);
    expect((caught as Redirect).location).toBe('/admin/club/events?season=2026&open=board-meeting-2026');
  });

  it('redirects an unknown id to the bare ledger', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id': null } });
    const caught = await catchThrown(load(loadEventFor('no-such-event', db)));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).status).toBe(308);
    expect((caught as Redirect).location).toBe('/admin/club/events');
  });

  it('redirects to the bare ledger when CLUB_DB is not bound', async () => {
    const caught = await catchThrown(load(loadEventFor('board-meeting-2026', undefined)));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).status).toBe(308);
    expect((caught as Redirect).location).toBe('/admin/club/events');
  });
});
