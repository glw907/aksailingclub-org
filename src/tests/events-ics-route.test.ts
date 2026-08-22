// The events-redesign pass: /events/[id].ics's own `GET`, the per-event add-to-calendar endpoint.
// Same fakeD1 pattern as events-detail-route.test.ts, keyed on the same two batched statements.
import { describe, expect, it, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { GET } from '../routes/(site)/events/[id].ics/+server';
import { fakeD1 } from './_fake-d1';

type RequestEvent = Parameters<typeof GET>[0];

function requestFor(id: string, db: unknown, setHeaders: (h: Record<string, string>) => void = () => {}): RequestEvent {
  return { params: { id }, platform: { env: { CLUB_DB: db } }, setHeaders } as unknown as RequestEvent;
}

const DATED_ROW = {
  id: 'bnac-uuid',
  title: 'BNAC',
  slug: 'bnac',
  event_type: 'racing',
  start_date: '2026-10-09',
  start_time: null,
  end_date: '2026-10-11',
  end_time: null,
  date_history: null,
  location: null,
  short_description: null,
  long_description: null,
  hero_image: null,
  hero_image_alt: null,
  registration_url: null,
  registration_status: null,
  fee: null,
};

const TBD_ROW = { ...DATED_ROW, id: 'tbd-uuid', slug: 'tbd-event', title: 'TBD Event', start_date: null, end_date: null };

/** Keyed on the two targeted single-row statements `readEventRow` batches. */
function dbWith(eventRows: unknown[]) {
  return fakeD1({
    firstResults: { "FROM settings WHERE key = 'current_season'": { value: '2026' } },
    allResults: {
      'FROM events WHERE slug = ?1': eventRows,
      'FROM classes WHERE id = ?1': [],
    },
  }).db;
}

/** A database whose every read throws, standing in for D1 being down mid-request. */
const FAILING_DB = {
  prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 is down'); } }) }),
  batch: async () => { throw new Error('D1 is down'); },
} as unknown as D1Database;

describe('/events/[id].ics GET', () => {
  it('503s when CLUB_DB is not bound', async () => {
    await expect(GET(requestFor('bnac', undefined))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 503,
    );
  });

  it('404s an unknown id', async () => {
    const db = dbWith([]);
    await expect(GET(requestFor('no-such-event', db))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 404,
    );
  });

  it('503s a failed read rather than 404ing it, so a calendar client keeps the subscription', async () => {
    const setHeaders = vi.fn();
    await expect(GET(requestFor('bnac', FAILING_DB, setHeaders))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 503,
    );
    expect(setHeaders).toHaveBeenCalledWith({ 'retry-after': '60' });
  });

  it('percent-encodes the id in the attachment filename', async () => {
    const oddRow = { ...DATED_ROW, slug: 'bnac "2026"', title: 'BNAC 2026' };
    const db = dbWith([oddRow]);
    const response = await GET(requestFor('bnac "2026"', db));
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="bnac%20%222026%22.ics"');
  });

  it('404s a genuinely TBD row (no start_date to schedule against)', async () => {
    const db = dbWith([TBD_ROW]);
    await expect(GET(requestFor('tbd-event', db))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 404,
    );
  });

  it('serves exactly one VEVENT as a calendar attachment', async () => {
    const db = dbWith([DATED_ROW]);
    const response = await GET(requestFor('bnac', db));
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="bnac.ics"');
    const body = await response.text();
    expect(body).toContain('UID:bnac@aksailingclub.org');
    expect(body.indexOf('BEGIN:VEVENT', body.indexOf('BEGIN:VEVENT') + 1)).toBe(-1);
  });
});
