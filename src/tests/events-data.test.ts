import { describe, it, expect } from 'vitest';
import { buildEventsPage, readEventRows, toEventCard, type EventDetailRow } from '$theme/events-data';
import type { MediaRef } from '@glw907/cairn-cms/media';
import { fakeD1 } from './_fake-d1';

const TODAY = new Date(2026, 5, 15); // June 15, 2026, local midnight

const NO_IMAGE = (_ref: MediaRef) => undefined;
const IDENTITY_MARKDOWN = async (md: string) => `<p>${md}</p>`;

function row(overrides: Partial<EventDetailRow>): EventDetailRow {
  return {
    id: 'an-event-id',
    title: 'An event',
    slug: 'an-event',
    event_type: 'racing',
    start_date: null,
    start_time: null,
    end_date: null,
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
    track: null,
    drop_in: null,
    ...overrides,
  };
}

describe('toEventCard: dateLabel', () => {
  it('formats a single day with its weekday', async () => {
    const card = await toEventCard(
      row({ start_date: '2026-05-23' }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.dateLabel).toBe('Saturday, May 23');
  });

  it('formats a range within one month without repeating the month name', async () => {
    const card = await toEventCard(
      row({ start_date: '2026-09-05', end_date: '2026-09-07' }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.dateLabel).toBe('September 5–7');
  });

  it('formats a range crossing months with both months spelled out', async () => {
    const card = await toEventCard(
      row({ start_date: '2026-09-28', end_date: '2026-10-02' }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.dateLabel).toBe('September 28 – October 2');
  });

  it('reads "Date to be announced" for a genuinely undated row', async () => {
    const card = await toEventCard(row({}), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.dateLabel).toBe('Date to be announced');
  });
});

describe('toEventCard: isPast', () => {
  it('is true once the end date falls before today', async () => {
    const card = await toEventCard(
      row({ start_date: '2026-06-01', end_date: '2026-06-10' }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.isPast).toBe(true);
  });

  it('is false while the end date is still today or later', async () => {
    const card = await toEventCard(
      row({ start_date: '2026-06-10', end_date: '2026-06-20' }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.isPast).toBe(false);
  });

  it('falls back to start_date when there is no end_date', async () => {
    const past = await toEventCard(row({ start_date: '2026-06-01' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(past.isPast).toBe(true);

    const upcoming = await toEventCard(row({ start_date: '2026-06-20' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(upcoming.isPast).toBe(false);
  });

  it('is false for a genuinely undated row: no evidence it has already happened', async () => {
    const card = await toEventCard(row({}), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.isPast).toBe(false);
  });
});

describe('toEventCard: time', () => {
  it('formats an afternoon hour with no minutes', async () => {
    const card = await toEventCard(row({ start_time: '13:00' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.time).toBe('1 p.m.');
  });

  it('formats a morning time with minutes', async () => {
    const card = await toEventCard(row({ start_time: '10:30' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.time).toBe('10:30 a.m.');
  });

  it('is undefined when the row has no start time', async () => {
    const card = await toEventCard(row({}), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.time).toBeUndefined();
  });
});

describe('toEventCard: class fields', () => {
  it('carries fee, track, and dropIn true for a drop-in class', async () => {
    const card = await toEventCard(
      row({ event_type: 'class', fee: 100, track: 'youth', drop_in: 1 }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.fee).toBe(100);
    expect(card.track).toBe('youth');
    expect(card.dropIn).toBe(true);
  });

  it('reads dropIn false for a scheduled (non-drop-in) class', async () => {
    const card = await toEventCard(
      row({ event_type: 'class', track: 'adult-teen', drop_in: 0 }),
      TODAY,
      NO_IMAGE,
      IDENTITY_MARKDOWN,
    );
    expect(card.dropIn).toBe(false);
  });

  it('reads dropIn false and leaves fee/track undefined for a plain event', async () => {
    const card = await toEventCard(row({ event_type: 'racing', fee: null }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(card.dropIn).toBe(false);
    expect(card.fee).toBeUndefined();
    expect(card.track).toBeUndefined();
  });

  it('maps the registration_status SQL CASE to the season page\'s own vocabulary', async () => {
    const open = await toEventCard(row({ event_type: 'class', registration_status: 'open' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(open.registrationState).toBe('open');

    const full = await toEventCard(row({ event_type: 'class', registration_status: 'full' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(full.registrationState).toBe('waitlisted');

    const closed = await toEventCard(row({ event_type: 'class', registration_status: 'closed' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(closed.registrationState).toBe('closed');

    const plainEvent = await toEventCard(row({ event_type: 'racing' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(plainEvent.registrationState).toBeUndefined();
  });
});

describe('toEventCard: longHtml, photo, and dotKind', () => {
  it('renders long_description through the injected markdown renderer only when present', async () => {
    const withBody = await toEventCard(row({ long_description: 'Bring gloves.' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(withBody.longHtml).toBe('<p>Bring gloves.</p>');

    const withoutBody = await toEventCard(row({}), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(withoutBody.longHtml).toBeUndefined();
  });

  it('resolves a real photo when the resolver has one, and falls back to none when it does not', async () => {
    const withPhoto = await toEventCard(
      row({ hero_image: 'bnac.jpg', hero_image_alt: 'Racing' }),
      TODAY,
      () => '/media/bnac.29d75df78f196b2e.jpg',
      IDENTITY_MARKDOWN,
    );
    expect(withPhoto.image).toEqual({ url: '/media/bnac.29d75df78f196b2e.jpg', alt: 'Racing' });

    const withoutPhoto = await toEventCard(row({ hero_image: 'unmigrated.jpg' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(withoutPhoto.image).toBeUndefined();
  });

  it("tags each card with the Season list's C7 dot kind, reused verbatim from season-data.ts", async () => {
    const byType = async (event_type: string) => (await toEventCard(row({ event_type }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN)).dotKind;
    expect(await byType('racing')).toBe('racing');
    expect(await byType('class')).toBe('class');
    expect(await byType('social')).toBe('social');
    expect(await byType('operations')).toBe('business');
    expect(await byType('governance')).toBe('business');
  });

  it("routes a class on its own id, not its (season-scoped, non-unique) slug", async () => {
    const eventCard = await toEventCard(row({ id: 'event-row-id', slug: 'bnac', event_type: 'racing' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(eventCard.routeId).toBe('bnac');

    const classCard = await toEventCard(row({ id: 'class-row-id', slug: 'adult-intro', event_type: 'class' }), TODAY, NO_IMAGE, IDENTITY_MARKDOWN);
    expect(classCard.routeId).toBe('class-row-id');
  });
});

describe('buildEventsPage', () => {
  it('pulls a governance row out of the chronology entirely, regardless of date', async () => {
    const data = await buildEventsPage(
      [row({ title: 'June Meeting', slug: 'june-meeting', event_type: 'governance', start_date: '2026-06-10' })],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.months).toEqual([]);
    expect(data.governance).toHaveLength(1);
    expect(data.governance[0].title).toBe('June Meeting');
  });

  it('groups rows by calendar month and orders the months chronologically', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'July event', slug: 'july-event', start_date: '2026-07-10' }),
        row({ title: 'May event', slug: 'may-event', start_date: '2026-05-10' }),
        row({ title: 'BNAC', slug: 'bnac', start_date: '2026-10-09' }),
      ],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.months.map((m) => m.name)).toEqual(['May', 'July', 'October']);
    expect(data.months.map((m) => m.id)).toEqual(['may', 'july', 'october']);
  });

  it('sorts a genuinely undated row into a trailing "Later" bucket', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Dated', slug: 'dated', start_date: '2026-06-01' }),
        row({ title: 'Undated', slug: 'undated' }),
      ],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.months.map((m) => m.name)).toEqual(['June', 'Later']);
    expect(data.months.at(-1)?.events[0].title).toBe('Undated');
  });

  it('sets nextUpcomingId to the first non-past, non-governance row', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Past', slug: 'past', id: 'past-id', start_date: '2026-06-01' }),
        row({ title: 'Meeting', slug: 'meeting', event_type: 'governance', start_date: '2026-06-05' }),
        row({ title: 'Upcoming', slug: 'upcoming', id: 'upcoming-id', start_date: '2026-06-20' }),
      ],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.nextUpcomingId).toBe('upcoming');
  });

  it('leaves nextUpcomingId undefined when every row is past', async () => {
    const data = await buildEventsPage(
      [row({ title: 'Past', slug: 'past', start_date: '2026-05-01' })],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.nextUpcomingId).toBeUndefined();
  });

  it('never picks an undated row as nextUpcomingId, even with no dated row left to beat it', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Past', slug: 'past', start_date: '2026-05-01' }),
        row({ title: 'Undated', slug: 'undated' }),
      ],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.nextUpcomingId).toBeUndefined();
  });

  it('reads seasonYear from settings.current_season when set', async () => {
    const data = await buildEventsPage(
      [row({ title: 'X', slug: 'x', start_date: '2019-06-01' })],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.seasonYear).toBe(2026);
  });

  it('falls back to the year of the first dated row when currentSeason is unset', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Undated', slug: 'undated' }),
        row({ title: 'X', slug: 'x', start_date: '2027-06-01' }),
      ],
      { today: TODAY, currentSeason: null, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.seasonYear).toBe(2027);
  });

  it('falls back to the CHRONOLOGICALLY earliest dated row, not the first in read order', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Later in read order, later in the season', slug: 'later', start_date: '2027-08-01' }),
        row({ title: 'Earlier chronologically', slug: 'earlier', start_date: '2026-04-01' }),
      ],
      { today: TODAY, currentSeason: null, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    expect(data.seasonYear).toBe(2026);
  });

  it('flags dropIn true and false across a mixed set of classes', async () => {
    const data = await buildEventsPage(
      [
        row({ title: 'Drop-in Clinic', slug: 'drop-in', event_type: 'class', start_date: '2026-06-01', drop_in: 1 }),
        row({ title: 'Scheduled Class', slug: 'scheduled', event_type: 'class', start_date: '2026-06-02', drop_in: 0 }),
      ],
      { today: TODAY, currentSeason: 2026, resolveMedia: NO_IMAGE, renderMarkdown: IDENTITY_MARKDOWN },
    );
    const byTitle = Object.fromEntries(data.months[0].events.map((e) => [e.title, e.dropIn]));
    expect(byTitle['Drop-in Clinic']).toBe(true);
    expect(byTitle['Scheduled Class']).toBe(false);
  });
});

describe('readEventRows', () => {
  // A class row minted across three seasons under the same name (the MembershipWorks import's own
  // shape: a template class re-minted every rollover), keyed to the season the fake classes query
  // is bound with.
  const CLASS_ROWS_BY_SEASON: Record<number, EventDetailRow[]> = {
    2024: [row({ id: 'class-2024', title: 'Adult Intro', slug: 'adult-intro', event_type: 'class', start_date: '2024-06-12' })],
    2025: [row({ id: 'class-2025', title: 'Adult Intro', slug: 'adult-intro', event_type: 'class', start_date: '2025-06-12' })],
    2026: [row({ id: 'class-2026', title: 'Adult Intro', slug: 'adult-intro', event_type: 'class', start_date: '2026-06-12' })],
  };
  const EVENT_ROWS = [row({ id: 'bnac', title: 'BNAC', slug: 'bnac', event_type: 'racing', start_date: '2026-05-24' })];

  it('filters historical class instances out, keeping only the current season row', async () => {
    const { db } = fakeD1({
      firstResults: { "FROM settings WHERE key = 'current_season'": { value: '2026' } },
      allResults: {
        'FROM events WHERE': EVENT_ROWS,
        'FROM classes WHERE': (args) => CLASS_ROWS_BY_SEASON[args[0] as number] ?? [],
      },
    });
    const rows = await readEventRows(db);
    const adultIntro = rows.filter((r) => r.title === 'Adult Intro');
    expect(adultIntro).toHaveLength(1);
    expect(adultIntro[0].id).toBe('class-2026');
  });

  it('returns no class rows (but still returns events) when current_season is unset', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM events WHERE': EVENT_ROWS,
        'FROM classes WHERE': (args) => CLASS_ROWS_BY_SEASON[args[0] as number] ?? [],
      },
    });
    const rows = await readEventRows(db);
    expect(rows.some((r) => r.event_type === 'class')).toBe(false);
    expect(rows.some((r) => r.title === 'BNAC')).toBe(true);
  });
});
