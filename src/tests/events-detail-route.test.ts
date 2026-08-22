// The events-redesign pass: /events/[id]'s own thin link-preview `load`. Mirrors
// class-signup-route.test.ts's fakeD1 pattern (both routes read CLUB_DB directly), keyed on the
// two SQL substrings `readEventRows` issues (`$theme/events-data.ts`'s EVENTS_QUERY/
// CLASSES_QUERY).
import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { SITE_DESCRIPTION } from '$chassis/content';
import { load } from '../routes/(site)/events/[id]/+page.server';
import Page from '../routes/(site)/events/[id]/+page.svelte';
import type { PageData } from '../routes/(site)/events/[id]/$types';
import { fakeD1 } from './_fake-d1';

type LoadEvent = Parameters<typeof load>[0];
type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

function eventFor(id: string, db: unknown): LoadEvent {
  return { params: { id }, platform: { env: { CLUB_DB: db } } } as unknown as LoadEvent;
}

async function runLoad(id: string, db: unknown): Promise<LoadResult> {
  return (await load(eventFor(id, db))) as LoadResult;
}

const EVENT_ROW = {
  id: 'bnac-uuid',
  title: 'BNAC',
  slug: 'bnac',
  event_type: 'racing',
  start_date: '2026-10-09',
  start_time: null,
  end_date: '2026-10-11',
  end_time: null,
  date_history: null,
  location: 'Big Lake',
  short_description: 'The season closer.',
  long_description: null,
  hero_image: null,
  hero_image_alt: null,
  registration_url: null,
  registration_status: null,
  fee: null,
  track: null,
  drop_in: null,
};

const HIDDEN_EVENT_ROW = { ...EVENT_ROW, id: 'hidden-uuid', slug: 'hidden-event', title: 'Hidden Event' };

function dbWith(eventRows: unknown[], classRows: unknown[] = []) {
  return fakeD1({
    firstResults: { "FROM settings WHERE key = 'current_season'": { value: '2026' } },
    allResults: {
      'FROM events WHERE visible': eventRows,
      'FROM classes WHERE visible': classRows,
    },
  }).db;
}

describe('/events/[id] load', () => {
  it('503s when CLUB_DB is not bound', async () => {
    await expect(load(eventFor('bnac', undefined))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 503,
    );
  });

  it('404s an id matching no visible row', async () => {
    const db = dbWith([EVENT_ROW]);
    await expect(load(eventFor('no-such-event', db))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 404,
    );
  });

  it('404s an invisible row: readEventRows\' own "visible = 1" filter excludes it before this route ever sees it', async () => {
    // fakeD1 stands in for the real query's own WHERE clause: an invisible row's id simply never
    // appears in the rows a real read would return, so this exercises the same 404 path.
    const db = dbWith([EVENT_ROW]); // HIDDEN_EVENT_ROW deliberately absent, standing in for visible = 0
    await expect(load(eventFor(HIDDEN_EVENT_ROW.slug, db))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 404,
    );
  });

  it('returns the title and the /events#id scroll target for a matching event row, keyed by slug', async () => {
    const db = dbWith([EVENT_ROW]);
    const result = await runLoad('bnac', db);
    expect(result.title).toBe('BNAC');
    expect(result.target).toBe('/events#bnac');
  });

  it('routes a class row on its id, not its slug', async () => {
    const classRow = {
      ...EVENT_ROW,
      id: 'class-row-id',
      slug: 'adult-intro',
      title: 'Adult Intro Class',
      event_type: 'class',
      fee: 100,
      registration_url: '/classes/class-row-id/signup',
      registration_status: 'open',
    };
    const db = dbWith([EVENT_ROW], [classRow]);
    const result = await runLoad('class-row-id', db);
    expect(result.title).toBe('Adult Intro Class');
    expect(result.target).toBe('/events#class-row-id');
  });

  it('builds a noindex seo whose canonical points at /events with no fragment', async () => {
    const db = dbWith([EVENT_ROW]);
    const result = await runLoad('bnac', db);
    expect(result.seo.meta).toContainEqual({ name: 'robots', content: 'noindex' });
    expect(result.seo.links.find((link: { rel: string }) => link.rel === 'canonical')?.href).toBe(
      'https://dev.aksailingclub.org/events',
    );
  });

  it("unfurls with the row's own short_description as og:description", async () => {
    const db = dbWith([EVENT_ROW]);
    const result = await runLoad('bnac', db);
    expect(result.seo.meta).toContainEqual({ property: 'og:description', content: 'The season closer.' });
  });

  it('falls back to an excerpt of long_description when short_description is absent', async () => {
    const longRow = {
      ...EVENT_ROW,
      short_description: null,
      long_description:
        'A very long account of the season closer, with more detail than any one-line summary could hold, running well past a hundred and sixty characters so the excerpt actually has to cut it.',
    };
    const db = dbWith([longRow]);
    const result = await runLoad('bnac', db);
    const description = result.seo.meta.find(
      (m: { property?: string }) => m.property === 'og:description',
    )?.content as string;
    expect(description.length).toBeLessThanOrEqual(161); // maxChars 160 plus the ellipsis
    expect(description.startsWith('A very long account')).toBe(true);
  });

  it('falls back to the site description when the row carries no description at all', async () => {
    const bareRow = { ...EVENT_ROW, short_description: null, long_description: null };
    const db = dbWith([bareRow]);
    const result = await runLoad('bnac', db);
    expect(result.seo.meta).toContainEqual({
      property: 'og:description',
      content: SITE_DESCRIPTION,
    });
  });

  it('unfurls with the resolved hero photo as an absolute og:image', async () => {
    const withPhoto = { ...EVENT_ROW, hero_image: 'bnac.jpg', hero_image_alt: 'Boats racing' };
    const db = dbWith([withPhoto]);
    const result = await runLoad('bnac', db);
    expect(result.seo.meta).toContainEqual({
      property: 'og:image',
      content: 'https://dev.aksailingclub.org/media/bnac.29d75df78f196b2e.jpg',
    });
    expect(result.seo.meta).toContainEqual({ name: 'twitter:image:alt', content: 'Boats racing' });
  });

  it('omits og:image for a row with no hero photo', async () => {
    const db = dbWith([EVENT_ROW]);
    const result = await runLoad('bnac', db);
    expect(result.seo.meta.find((m: { property?: string }) => m.property === 'og:image')).toBeUndefined();
  });
});

describe('/events/[id] page', () => {
  it('renders the zero-delay meta refresh to the scroll target', async () => {
    const db = dbWith([EVENT_ROW]);
    const data = await runLoad('bnac', db);
    const { head } = render(Page, { props: { data: data as unknown as PageData } });
    expect(head).toContain('<meta http-equiv="refresh" content="0; url=/events#bnac"/>');
  });

  it('renders a one-line body: the title linking to the scroll target', async () => {
    const db = dbWith([EVENT_ROW]);
    const data = await runLoad('bnac', db);
    const { body } = render(Page, { props: { data: data as unknown as PageData } });
    expect(body).toContain('<a href="/events#bnac">BNAC</a>');
  });
});
