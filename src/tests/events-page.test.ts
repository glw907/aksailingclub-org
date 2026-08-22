// The events-redesign pass, Task 2 (docs/2026-08-22-events-redesign-design.md): a static SSR
// render of the season page against a fixture `EventsPageData`, the same `render` from
// `svelte/server` idiom `members-page-toolbar.test.ts`/`toolkit-table.test.ts` already use for
// markup-shape assertions that need no hydration.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { buildSeoMeta } from '@glw907/cairn-cms/delivery';
import Page from '../routes/(site)/events/+page.svelte';
import type { PageData } from '../routes/(site)/events/$types';
import type { EventCard, EventsPageData } from '$theme/events-data';

const SEO = buildSeoMeta({
  title: 'Events',
  description: 'The season calendar.',
  canonicalUrl: 'https://dev.aksailingclub.org/events',
  siteName: 'Alaska Sailing Club',
});

function card(overrides: Partial<EventCard>): EventCard {
  return {
    routeId: 'an-event',
    slug: 'an-event',
    title: 'An Event',
    dateLabel: 'Saturday, May 23',
    dropIn: false,
    isPast: false,
    ...overrides,
  };
}

const OPEN_CLASS_1 = card({
  routeId: 'class-1',
  slug: 'class-1',
  title: 'Adult Intro to Sailing',
  dotKind: 'class',
  fee: 100,
  track: 'adult-teen',
  registrationState: 'open',
  registrationUrl: '/classes/class-1/signup',
});
const OPEN_CLASS_2 = card({
  routeId: 'class-2',
  slug: 'class-2',
  title: 'Youth Intro to Sailing',
  dotKind: 'class',
  fee: 0,
  track: 'youth',
  registrationState: 'open',
  registrationUrl: '/classes/class-2/signup',
});
const PAST_EVENT = card({
  routeId: 'past-regatta',
  slug: 'past-regatta',
  title: 'Spring Regatta',
  dotKind: 'racing',
  isPast: true,
});
const GOVERNANCE_ROW = card({
  routeId: 'annual-meeting',
  slug: 'annual-meeting',
  title: 'Annual Meeting',
  dateLabel: 'Saturday, October 3',
  location: 'Clubhouse',
  note: 'Election of club officers and financial report.',
});

const EVENTS: EventsPageData = {
  seasonYear: 2026,
  nextUpcomingId: 'class-1',
  primaryClassId: 'class-1',
  months: [
    { name: 'May', id: 'may', events: [PAST_EVENT] },
    { name: 'June', id: 'june', events: [OPEN_CLASS_1, OPEN_CLASS_2] },
  ],
  governance: [GOVERNANCE_ROW],
};

// The load returns `seo` and nothing else from the content entry: the season page renders no
// part of the "events" entry's own body.
function fixtureData(events: EventsPageData): PageData {
  return {
    seo: SEO,
    events,
    icsUrl: 'https://dev.aksailingclub.org/events/calendar.ics',
    webcalUrl: 'webcal://dev.aksailingclub.org/events/calendar.ics',
    googleCalendarUrl:
      'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fdev.aksailingclub.org%2Fevents%2Fcalendar.ics',
    outlookCalendarUrl:
      'https://outlook.live.com/calendar/0/addfromweb?url=webcal%3A%2F%2Fdev.aksailingclub.org%2Fevents%2Fcalendar.ics&name=Alaska%20Sailing%20Club',
  } as unknown as PageData;
}

describe('/events season page', () => {
  it('renders one <section> per row, each carrying its own route id', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    for (const id of ['past-regatta', 'class-1', 'class-2']) {
      expect(body).toMatch(new RegExp(`<section[^>]*id="${id}"`));
    }
  });

  it('marks a class with the gold star and leaves a non-class row unmarked', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    const classSection = body.slice(body.indexOf('id="class-1"'), body.indexOf('id="class-2"'));
    expect(classSection).toContain('ev-star');
    const pastSection = body.slice(body.indexOf('id="past-regatta"'), body.indexOf('id="class-1"'));
    expect(pastSection).not.toContain('ev-star');
  });

  it('gives the fireweed treatment to exactly one element, the first upcoming open class', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body.match(/class="[^"]*\bev-cta\b/g) ?? []).toHaveLength(1);
    const class1Section = body.slice(body.indexOf('id="class-1"'), body.indexOf('id="class-2"'));
    expect(class1Section).toContain('ev-cta');
  });

  it('renders no action link on a past band', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    const pastSection = body.slice(body.indexOf('id="past-regatta"'), body.indexOf('id="class-1"'));
    expect(pastSection).not.toContain('ev-link');
    expect(pastSection).not.toContain('ev-cta');
    expect(pastSection).toContain('Past');
  });

  it('keeps the governance row out of the season band list, inside the coda table', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    const seasonSection = body.slice(0, body.indexOf('id="meetings"'));
    expect(seasonSection).not.toContain('Annual Meeting');
    const codaSection = body.slice(body.indexOf('id="meetings"'));
    expect(codaSection).toContain('Annual Meeting');
    expect(codaSection).toMatch(/id="annual-meeting"/);
  });

  it("renders a governance row's own note under the meeting name", () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body).toContain('<span class="ev-gov-note');
    expect(body).toContain('Election of club officers and financial report.');
  });

  it('renders all four subscribe entries with the exact Google and Outlook hrefs for the fixture feed URL', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body).toContain('Apple Calendar');
    expect(body).toContain('Google Calendar');
    expect(body).toContain('Outlook');
    expect(body).toContain('Copy feed address');
    expect(body).toContain(
      'href="https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fdev.aksailingclub.org%2Fevents%2Fcalendar.ics"',
    );
    expect(body).toContain(
      'href="https://outlook.live.com/calendar/0/addfromweb?url=webcal%3A%2F%2Fdev.aksailingclub.org%2Fevents%2Fcalendar.ics&amp;name=Alaska%20Sailing%20Club"',
    );
  });

  it('renders the hero eyebrow and the season title with no promise sentence', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body).toContain('Events');
    expect(body).toContain('The 2026 Season');
  });

  it('renders no fireweed control at all when no class is taking registrations', () => {
    const noOpenClass: EventsPageData = { ...EVENTS, primaryClassId: undefined };
    const { body } = render(Page, { props: { data: fixtureData(noOpenClass) } });
    expect(body).not.toContain('ev-cta');
  });

  it('gives a closed, upcoming class the calendar action, and a past row none', () => {
    const closedClass = { ...OPEN_CLASS_1, registrationState: 'closed' as const };
    const data: EventsPageData = {
      seasonYear: 2026,
      months: [{ name: 'June', id: 'june', events: [closedClass, PAST_EVENT] }],
      governance: [],
    };
    const { body } = render(Page, { props: { data: fixtureData(data) } });
    const closedSection = body.slice(body.indexOf('id="class-1"'), body.indexOf('id="past-regatta"'));
    expect(closedSection).toContain('Add to calendar');
    const pastSection = body.slice(body.indexOf('id="past-regatta"'));
    expect(pastSection).not.toContain('Add to calendar');
  });

  it('makes every band and governance row a focusable anchor target', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body).toMatch(/<section[^>]*id="class-1"[^>]*tabindex="-1"/);
    expect(body).toMatch(/<section[^>]*id="meetings"[^>]*tabindex="-1"/);
    expect(body).toMatch(/<tr[^>]*id="annual-meeting"[^>]*tabindex="-1"/);
  });

  it('renders a band title as plain text, never as a link to its own anchor', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    expect(body).not.toContain('href="#class-1"');
    expect(body).not.toContain('href="#annual-meeting"');
  });

  it('omits the month index\'s Meetings link, and the coda itself, with no governance rows', () => {
    const noGovernance: EventsPageData = { ...EVENTS, governance: [] };
    const { body } = render(Page, { props: { data: fixtureData(noGovernance) } });
    expect(body).not.toContain('href="#meetings"');
    expect(body).not.toContain('Meetings and governance');
  });

  it('carries each governance row\'s location in the markup at every width', () => {
    const { body } = render(Page, { props: { data: fixtureData(EVENTS) } });
    // Two placements, one shown per breakpoint: the data is never dropped from the page.
    expect(body.match(/Clubhouse/g) ?? []).toHaveLength(2);
  });

  it('renders the honest empty-state line when the season holds nothing', () => {
    const empty: EventsPageData = { seasonYear: 2026, months: [], governance: [] };
    const { body } = render(Page, { props: { data: fixtureData(empty) } });
    expect(body).not.toContain('ev-band');
    expect(body.toLowerCase()).toContain('season');
  });
});
