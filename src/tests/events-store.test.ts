import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  EVENT_CATEGORY_TONE,
  EVENT_RECURRENCE_LABEL,
  canDeleteEvent,
  createEvent,
  createSeries,
  deleteEvent,
  findEventBySeasonSlug,
  getEvent,
  linkEventToSeries,
  listEventSeasons,
  listEvents,
  retireSeries,
  setEventDates,
  setEventVisibility,
  setSeriesTitleAndRecurrence,
  updateEvent,
  type EventRow,
  type EventWrite,
} from '$admin-club/lib/events-store';

const RAW_ROW = {
  id: 'commodores-cup-regatta',
  series_id: 'series-commodores-cup-regatta',
  season: 2026,
  title: "Commodore's Cup Regatta",
  slug: 'commodores-cup-regatta',
  category: 'racing',
  short_description: 'The marquee regatta.',
  long_description: 'Three fleets race the outer buoys.',
  start_date: '2026-07-18',
  start_time: '10:00',
  end_date: null,
  end_time: null,
  location: 'Outer buoys course',
  hero_image: 'media:regatta-start.abcdef0123456789',
  hero_image_alt: 'Boats rounding the first mark.',
  thumbnail_image: null,
  visible: 1 as const,
  created_at: '2026-06-01 00:00:00',
  updated_at: '2026-06-01 00:00:00',
};

const WRITE: EventWrite = {
  title: 'Board Meeting',
  slug: 'board-meeting-2026-08',
  category: 'governance',
  shortDescription: null,
  longDescription: null,
  startDate: '2026-08-11',
  startTime: '18:00',
  endDate: null,
  endTime: null,
  location: 'Clubhouse',
  heroImage: null,
  heroImageAlt: null,
};

describe('static vocabularies', () => {
  it('EVENT_CATEGORY_TONE maps every category to its ratified tone', () => {
    expect(EVENT_CATEGORY_TONE).toEqual({
      racing: 'info',
      class: 'warning',
      operations: 'neutral',
      social: 'neutral',
      governance: 'neutral',
    });
  });

  it('EVENT_RECURRENCE_LABEL carries the two recurrence labels', () => {
    expect(EVENT_RECURRENCE_LABEL).toEqual({ annual: 'Annual', once: 'Once-off' });
  });
});

describe('listEvents', () => {
  it('maps each raw row to the camelCased shape, preserving the query order', async () => {
    const secondRow = { ...RAW_ROW, id: 'work-party', title: 'Work Party', category: 'operations' };
    const { db, calls } = fakeD1({ allResults: { 'FROM events': [RAW_ROW, secondRow] } });

    await expect(listEvents(db)).resolves.toEqual([
      expect.objectContaining({ id: 'commodores-cup-regatta', category: 'racing', visible: true, season: 2026 }),
      expect.objectContaining({ id: 'work-party', category: 'operations' }),
    ]);
    expect(calls[0].sql).toContain('ORDER BY start_date IS NULL, start_date ASC');
  });
});

describe('getEvent', () => {
  it('maps the found row, including seriesId and season', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM events WHERE id = ?1': RAW_ROW } });
    await expect(getEvent(db, 'commodores-cup-regatta')).resolves.toEqual(
      expect.objectContaining({
        title: "Commodore's Cup Regatta",
        seriesId: 'series-commodores-cup-regatta',
        season: 2026,
        heroImage: 'media:regatta-start.abcdef0123456789',
      }),
    );
  });

  it('returns null for a missing id', async () => {
    const { db } = fakeD1();
    await expect(getEvent(db, 'no-such-event')).resolves.toBeNull();
  });
});

describe('findEventBySeasonSlug', () => {
  it('binds the season and slug, since uniqueness is now per-season', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM events WHERE season = ?1 AND slug = ?2': RAW_ROW } });
    await expect(findEventBySeasonSlug(db, 2026, 'commodores-cup-regatta')).resolves.toEqual(
      expect.objectContaining({ id: 'commodores-cup-regatta' }),
    );
    expect(calls[0].args).toEqual([2026, 'commodores-cup-regatta']);
  });

  it('returns null when no row matches', async () => {
    const { db } = fakeD1();
    await expect(findEventBySeasonSlug(db, 2027, 'no-such-slug')).resolves.toBeNull();
  });
});

describe('listEventSeasons', () => {
  it('returns the distinct seasons, most recent first', async () => {
    const { db, calls } = fakeD1({ allResults: { 'SELECT DISTINCT season FROM events': [{ season: 2026 }, { season: 2025 }] } });
    await expect(listEventSeasons(db)).resolves.toEqual([2026, 2025]);
    expect(calls[0].sql).toContain('ORDER BY season DESC');
  });

  it('unions with classes so a season holding only classes still appears in the filter', async () => {
    const { db, calls } = fakeD1({ allResults: { 'SELECT DISTINCT season FROM events': [{ season: 2026 }, { season: 2024 }] } });
    await listEventSeasons(db);
    expect(calls[0].sql).toContain('SELECT DISTINCT season FROM events');
    expect(calls[0].sql).toContain('UNION');
    expect(calls[0].sql).toContain('SELECT DISTINCT season FROM classes');
  });
});

describe('createSeries', () => {
  it('inserts the id, title, and recurrence', async () => {
    const { db, calls } = fakeD1();
    await createSeries(db, { id: 'series-board-meeting', title: 'Board Meeting', recurrence: 'annual' });
    expect(calls).toEqual([
      { sql: 'INSERT INTO event_series (id, title, recurrence) VALUES (?1, ?2, ?3)', args: ['series-board-meeting', 'Board Meeting', 'annual'] },
    ]);
  });
});

describe('createEvent', () => {
  it('binds visible 1 for a dated write, including the series/season and hero fields', async () => {
    const { db, calls } = fakeD1();
    await createEvent(db, { id: 'board-meeting-2026-08', season: 2026, seriesId: 'series-board-meeting', write: WRITE });
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('INSERT INTO events');
    expect(calls[0].sql).toContain('hero_image');
    expect(calls[0].args).toEqual([
      'board-meeting-2026-08',
      'series-board-meeting',
      2026,
      'Board Meeting',
      'board-meeting-2026-08',
      'governance',
      null,
      null,
      '2026-08-11',
      '18:00',
      null,
      null,
      'Clubhouse',
      null,
      null,
      1,
    ]);
  });

  it('binds visible 0 for an undated write', async () => {
    const { db, calls } = fakeD1();
    await createEvent(db, {
      id: 'board-meeting-2026-08',
      season: 2026,
      seriesId: 'series-board-meeting',
      write: { ...WRITE, startDate: null },
    });
    expect(calls[0].args.at(-1)).toBe(0);
  });
});

describe('updateEvent', () => {
  it('carries the publish-on-date CASE and binds hero fields, never a visible column directly', async () => {
    const { db, calls } = fakeD1();
    await updateEvent(db, 'board-meeting-2026-08', WRITE);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('UPDATE events SET');
    expect(calls[0].sql).toContain('hero_image = ?11, hero_image_alt = ?12');
    expect(calls[0].sql).toContain('visible = CASE WHEN ?6 IS NOT NULL AND start_date IS NULL THEN 1 ELSE visible END');
    expect(calls[0].args.at(-1)).toBe('board-meeting-2026-08');
    expect(calls[0].args[5]).toBe('2026-08-11'); // the start_date bind, reused by the CASE (?6)
  });
});

describe('setEventDates', () => {
  it('carries the identical publish-on-date CASE as updateEvent', async () => {
    const { db, calls } = fakeD1();
    await setEventDates(db, 'board-meeting-2026-08', { startDate: '2026-08-11', endDate: null });
    expect(calls[0].sql).toContain('visible = CASE WHEN ?1 IS NOT NULL AND start_date IS NULL THEN 1 ELSE visible END');
    expect(calls[0].args).toEqual(['2026-08-11', null, 'board-meeting-2026-08']);
  });
});

describe('setEventVisibility', () => {
  it('binds 0 for Hide', async () => {
    const { db, calls } = fakeD1();
    await setEventVisibility(db, 'board-meeting-2026-08', false);
    expect(calls[0].args).toEqual([0, 'board-meeting-2026-08']);
  });

  it('binds 1 for Show', async () => {
    const { db, calls } = fakeD1();
    await setEventVisibility(db, 'board-meeting-2026-08', true);
    expect(calls[0].args).toEqual([1, 'board-meeting-2026-08']);
  });
});

describe('setSeriesTitleAndRecurrence', () => {
  it('writes the series title and recurrence', async () => {
    const { db, calls } = fakeD1();
    await setSeriesTitleAndRecurrence(db, 'series-board-meeting', { title: 'Board Meeting', recurrence: 'once' });
    expect(calls[0].sql).toContain('UPDATE event_series SET title = ?1, recurrence = ?2');
    expect(calls[0].args).toEqual(['Board Meeting', 'once', 'series-board-meeting']);
  });
});

describe('retireSeries', () => {
  it('binds 1 to retire', async () => {
    const { db, calls } = fakeD1();
    await retireSeries(db, 'series-board-meeting', true);
    expect(calls[0].sql).toContain('retired_at = CASE WHEN ?1 = 1 THEN');
    expect(calls[0].args).toEqual([1, 'series-board-meeting']);
  });

  it('binds 0 to unretire', async () => {
    const { db, calls } = fakeD1();
    await retireSeries(db, 'series-board-meeting', false);
    expect(calls[0].args).toEqual([0, 'series-board-meeting']);
  });
});

describe('linkEventToSeries', () => {
  const movingEvent = { ...RAW_ROW, id: 'regatta-2027', series_id: 'series-old', season: 2027 };

  it('moves the event onto the target series when the old series keeps other rows', async () => {
    // The move's own conflict guard is folded into the UPDATE's WHERE clause now (item 7), so a
    // successful move is driven by runResults: changes 1 means the guard did not fire.
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM events WHERE id = ?1': movingEvent,
        'FROM event_series WHERE id = ?1': { id: 'series-new' },
      },
      runResults: {
        'UPDATE events SET series_id': { changes: 1 },
        'DELETE FROM event_series': { changes: 0 }, // the old series still holds other rows
      },
    });
    await expect(linkEventToSeries(db, 'regatta-2027', 'series-new')).resolves.toEqual({ removedSeriesId: null });
    expect(calls.some((c) => c.sql.startsWith('UPDATE events SET series_id'))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM event_series'))).toBe(true); // it runs; its own guard just no-ops
  });

  it('deletes the now-orphaned former series and reports its id', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM events WHERE id = ?1': movingEvent,
        'FROM event_series WHERE id = ?1': { id: 'series-new' },
      },
      runResults: {
        'UPDATE events SET series_id': { changes: 1 },
        'DELETE FROM event_series': { changes: 1 },
      },
    });
    await expect(linkEventToSeries(db, 'regatta-2027', 'series-new')).resolves.toEqual({ removedSeriesId: 'series-old' });
    expect(calls.some((c) => c.sql === 'DELETE FROM event_series WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1)')).toBe(
      true,
    );
  });

  it('refuses when the target series does not exist', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM events WHERE id = ?1': movingEvent, 'FROM event_series WHERE id = ?1': null },
    });
    await expect(linkEventToSeries(db, 'regatta-2027', 'no-such-series')).resolves.toEqual({ error: 'No such series.' });
  });

  it("refuses when the target series already has a row in the moving event's season", async () => {
    // The conflict guard folded into the UPDATE's own WHERE NOT EXISTS means it matches zero
    // rows when the target already holds a row for this season; changes: 0 is what tells the two
    // refusal branches apart, since "no such series" already short-circuited before the batch.
    const { db } = fakeD1({
      firstResults: {
        'FROM events WHERE id = ?1': movingEvent,
        'FROM event_series WHERE id = ?1': { id: 'series-new' },
      },
      runResults: {
        'UPDATE events SET series_id': { changes: 0 },
      },
    });
    await expect(linkEventToSeries(db, 'regatta-2027', 'series-new')).resolves.toEqual({
      error: 'That series already has an event in this season.',
    });
  });
});

describe('canDeleteEvent', () => {
  const base: EventRow = {
    id: 'x',
    seriesId: 'series-x',
    season: 2026,
    title: 'X',
    slug: 'x',
    category: 'social',
    shortDescription: null,
    longDescription: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    location: null,
    heroImage: null,
    heroImageAlt: null,
    thumbnailImage: null,
    visible: false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  };

  it('is true for an undated, invisible row (never published)', () => {
    expect(canDeleteEvent(base)).toBe(true);
  });

  it('is false for a visible, undated row', () => {
    expect(canDeleteEvent({ ...base, visible: true })).toBe(false);
  });

  it('is false for an invisible, dated row (hidden after being published)', () => {
    expect(canDeleteEvent({ ...base, startDate: '2026-08-11' })).toBe(false);
  });

  it('is false for a visible, dated row', () => {
    expect(canDeleteEvent({ ...base, visible: true, startDate: '2026-08-11' })).toBe(false);
  });
});

describe('deleteEvent', () => {
  it('reads back deleted: false with no writes when the eligibility read finds nothing (unknown id or ineligible row)', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'SELECT series_id FROM events WHERE id = ?1 AND visible = 0': null } });
    await expect(deleteEvent(db, 'board-meeting-2026-08')).resolves.toEqual({ deleted: false, removedSeriesId: null });
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
  });

  it('deletes an eligible row and reports no orphaned series when siblings remain', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'SELECT series_id FROM events WHERE id = ?1 AND visible = 0': { series_id: 'series-board' } },
      runResults: { 'DELETE FROM event_series': { changes: 0 } },
    });
    await expect(deleteEvent(db, 'board-meeting-2026-08')).resolves.toEqual({ deleted: true, removedSeriesId: null });
    expect(calls).toContainEqual({
      sql: 'DELETE FROM events WHERE id = ?1 AND visible = 0 AND start_date IS NULL',
      args: ['board-meeting-2026-08'],
    });
    expect(calls).toContainEqual({
      sql: 'DELETE FROM event_series WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1)',
      args: ['series-board'],
    });
  });

  it('deletes an eligible row and reports the now-orphaned series', async () => {
    const { db } = fakeD1({
      firstResults: { 'SELECT series_id FROM events WHERE id = ?1 AND visible = 0': { series_id: 'series-board' } },
      runResults: { 'DELETE FROM event_series': { changes: 1 } },
    });
    await expect(deleteEvent(db, 'board-meeting-2026-08')).resolves.toEqual({ deleted: true, removedSeriesId: 'series-board' });
  });
});
