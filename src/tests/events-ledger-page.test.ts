// The Events ledger route's markup (events-admin pass Tasks 4-5,
// docs/2026-08-22-events-admin-design.md): guarded at the render level since the admin surface
// carries no Playwright e2e coverage (`e2e/admin-login.spec.ts`'s own header). Mirrors
// `members-page-toolbar.test.ts`'s own `render` idiom -- a static SSR render is enough to check
// markup shape, since none of these claims need hydration or interaction. The roll-forward
// confirmation panel renders its full copy into the SSR markup whenever a plan exists, visibility
// toggled only by the `hidden` attribute (bound to the page's own `$state` disclosure), which is
// what lets a static render assert on its exact copy without simulating a click. Task 5's own
// additions (below the Task 4 tests) expand an event row's panel via `openId` and assert on
// `EventRowForm`'s rendered field set, since that component only renders while its row is
// expanded.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../routes/admin/club/events/+page.svelte';
import type { PageData } from '../routes/admin/club/events/$types';
import { formatCivilDate } from '$admin-club/lib/ui';
import type { EventInstance, EventRow, LedgerRow } from '$admin-club/lib/events-store';

const SHELL = { public: true, siteName: 'ASC', theme: 'cairn-admin' };

function instance(overrides: Partial<EventInstance> = {}): EventInstance {
  return { id: 'x', startDate: null, endDate: null, visible: false, ...overrides };
}

function eventRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  const current = overrides.current !== undefined ? overrides.current : instance({ id: 'board-meeting-2026', startDate: '2026-08-01', visible: true });
  const event: EventRow | null =
    overrides.event !== undefined
      ? overrides.event
      : current
        ? {
            id: current.id,
            seriesId: 'series-board',
            season: 2026,
            title: 'Board Meeting',
            slug: 'board-meeting',
            category: 'governance',
            shortDescription: null,
            longDescription: null,
            startDate: current.startDate,
            startTime: null,
            endDate: current.endDate,
            endTime: null,
            location: null,
            heroImage: null,
            heroImageAlt: null,
            thumbnailImage: null,
            visible: current.visible,
            createdAt: '2026-01-01 00:00:00',
            updatedAt: '2026-01-01 00:00:00',
          }
        : null;
  return {
    kind: 'event',
    id: 'board-meeting-2026',
    seriesId: 'series-board',
    title: 'Board Meeting',
    category: 'governance',
    recurrence: 'annual',
    retiredAt: null,
    current,
    prior: [
      instance({ id: 'board-meeting-2025', startDate: '2025-08-03', visible: true }),
      instance({ id: 'board-meeting-2024', startDate: '2024-08-05', visible: true }),
    ],
    sortKey: '08-01',
    seriesYearCount: 3,
    event,
    ...overrides,
  };
}

function classRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    kind: 'class',
    id: 'youth-racing-clinic-2026',
    seriesId: null,
    title: 'Youth Racing Clinic',
    category: 'class',
    recurrence: null,
    retiredAt: null,
    current: instance({ id: 'youth-racing-clinic-2026', startDate: '2026-07-01', visible: true }),
    prior: [null, null],
    sortKey: '07-01',
    seriesYearCount: 0,
    event: null,
    ...overrides,
  };
}

function baseData(overrides: Partial<PageData> = {}): PageData {
  return {
    shell: SHELL,
    rows: [eventRow()],
    season: 2026,
    currentSeason: 2026,
    seasons: [2026, 2025],
    undatedCount: 0,
    rollPlan: { fromSeason: 2026, toSeason: 2027, create: [], skipped: [] },
    openId: null,
    heroLibrary: [],
    error: null,
    ...overrides,
  } as PageData;
}

describe('/admin/club/events ledger markup', () => {
  it('renders the three season column headers in order', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    // `<th ...>2024</th>` rather than a bare `>2024<` substring: the season filter's own
    // `<option value="2026">2026</option>` would otherwise match first and misorder the check.
    const i2024 = body.indexOf('>2024</th>');
    const i2025 = body.indexOf('>2025</th>');
    const i2026 = body.indexOf('>2026</th>');
    expect(i2024).toBeGreaterThan(-1);
    expect(i2025).toBeGreaterThan(i2024);
    expect(i2026).toBeGreaterThan(i2025);
  });

  it('renders a prior-season cell as read-only text and the current-season cell as a date input', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    expect(body).toContain(formatCivilDate('2025-08-03'));
    expect(body).toContain('type="date"');
    expect(body).toContain('value="2026-08-01"');
  });

  it('an empty prior-season cell renders nothing, not a dash, for a season the series did not run', () => {
    // The range separator `instanceText` uses for a dated instance is an en dash (`–`), not an
    // em dash, so the real regression to guard against is any dash at all in an empty cell, not
    // specifically the wrong dash character.
    const row = eventRow({ prior: [null, instance({ id: 'x', startDate: null, visible: false })] });
    const { body } = render(Page, { props: { data: baseData({ rows: [row] }), form: null } });
    const emptyCellMatch = body.match(/<td class="events-date-cell[^"]*events-narrow-hide[^"]*">([\s\S]*?)<\/td>/);
    expect(emptyCellMatch).not.toBeNull();
    const emptyCellContent = emptyCellMatch![1].trim();
    expect(emptyCellContent).toBe('');
    expect(emptyCellContent).not.toContain('–');
    expect(emptyCellContent).not.toContain('—');
    expect(emptyCellContent).not.toContain('&mdash;');
  });

  it('the count line reads exactly "5 undated" for a five-undated fixture', () => {
    const { body } = render(Page, { props: { data: baseData({ undatedCount: 5 }), form: null } });
    expect(body).toContain('5 undated');
  });

  it('the count line reads exactly "1 undated" for a one-undated fixture', () => {
    const { body } = render(Page, { props: { data: baseData({ undatedCount: 1 }), form: null } });
    expect(body).toContain('1 undated');
    expect(body).not.toContain('1 undateds');
  });

  it('a class row carries the star, the Class chip, and a link to /admin/club/classes', () => {
    const row = classRow();
    // The panel (and its link) render only while the row is expanded; `openId` seeds that state.
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('events-class-star');
    expect(body).toContain('>Class<');
    expect(body).toContain('href="/admin/club/classes"');
  });

  it('renders no badge-info / badge-neutral / bg-warning literal anywhere', () => {
    const { body } = render(Page, {
      props: { data: baseData({ rows: [eventRow(), classRow()] }), form: null },
    });
    expect(body).not.toContain('badge-info');
    expect(body).not.toContain('badge-neutral');
    expect(body).not.toContain('bg-warning');
  });

  it('renders no "Visibility" or "Edited by" header', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    expect(body).not.toContain('Visibility');
    expect(body).not.toContain('Edited by');
  });

  it("the roll-forward confirmation's exact copy for a plan of 12 create / 3 skipped", () => {
    const plan = {
      fromSeason: 2026,
      toSeason: 2027,
      create: Array.from({ length: 12 }, (_, i) => ({ seriesId: `series-${i}`, title: `Event ${i}` })),
      skipped: [
        { seriesId: 's-once-1', title: 'Once A', reason: 'once' as const },
        { seriesId: 's-once-2', title: 'Once B', reason: 'once' as const },
        { seriesId: 's-retired-1', title: 'Retired A', reason: 'retired' as const },
      ],
    };
    const { body } = render(Page, { props: { data: baseData({ rollPlan: plan }), form: null } });
    expect(body).toContain('Start the 2027 season');
    expect(body).toContain('Creates 12 events in 2027, undated and hidden until you save a date.');
    expect(body).toContain('Skips 3: 2 once-off, 1 retired.');
    expect(body).toContain('Start the next season');
    expect(body).toContain('Cancel');
    for (const entry of plan.create) expect(body).toContain(entry.title);
  });

  it('omits the skip line entirely when nothing is skipped', () => {
    const plan = { fromSeason: 2026, toSeason: 2027, create: [{ seriesId: 's-1', title: 'Event A' }], skipped: [] };
    const { body } = render(Page, { props: { data: baseData({ rollPlan: plan }), form: null } });
    expect(body).not.toContain('Skips');
  });

  it("the empty state's heading names the selected season", () => {
    const { body } = render(Page, { props: { data: baseData({ rows: [], season: 2027 }), form: null } });
    expect(body).toContain('No events in season 2027 yet');
  });
});

describe('EventRowForm panel (events-admin Task 5)', () => {
  it("renders the panel's own field set for an expanded event row", () => {
    const row = eventRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('Title');
    expect(body).toContain('Recurrence');
    expect(body).toContain('Category');
    expect(body).toContain('Start date');
    expect(body).toContain('End date');
    expect(body).toContain('Start time');
    expect(body).toContain('End time');
    expect(body).toContain('Location');
    expect(body).toContain('Short description');
    expect(body).toContain('Long description');
    expect(body).toContain('Alt text');
  });

  it('renders no name="visible" anywhere: visibility is Hide/Show only, never a checkbox', () => {
    const row = eventRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).not.toContain('name="visible"');
  });

  it('renders no name="slug": the slug stays derived, never a field', () => {
    const row = eventRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).not.toContain('name="slug"');
  });

  it('"Hide this year" renders for a visible row', () => {
    const row = eventRow({ current: instance({ id: 'board-meeting-2026', startDate: '2026-08-01', visible: true }) });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('Hide this year');
    expect(body).not.toContain('>Show<');
  });

  it('"Show" renders for a hidden row', () => {
    const row = eventRow({ current: instance({ id: 'board-meeting-2026', startDate: '2026-08-01', visible: false }) });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('>Show<');
  });

  it('"Retire series" renders for an unretired series', () => {
    const row = eventRow({ retiredAt: null });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('Retire series');
  });

  it('"Unretire series" renders for a retired series', () => {
    const row = eventRow({ retiredAt: '2026-01-01 00:00:00' });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('Unretire series');
  });

  it('Delete renders only for an undated, never-visible row', () => {
    const undatedInvisible = eventRow({
      current: instance({ id: 'regatta-2026', startDate: null, endDate: null, visible: false }),
    });
    const { body } = render(Page, { props: { data: baseData({ rows: [undatedInvisible], openId: undatedInvisible.id }), form: null } });
    expect(body).toContain('>Delete<');
  });

  it('Delete is absent for a published row', () => {
    const published = eventRow({
      current: instance({ id: 'board-meeting-2026', startDate: '2026-08-01', endDate: null, visible: true }),
    });
    const { body } = render(Page, { props: { data: baseData({ rows: [published], openId: published.id }), form: null } });
    expect(body).not.toContain('>Delete<');
  });

  it('the series link control renders with its exact label when seriesYearCount is 1', () => {
    const row = eventRow({ seriesYearCount: 1 });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id, season: 2026 }), form: null } });
    expect(body).toContain('This is the 2026 instance of an existing series');
  });

  it('the series link control is absent when seriesYearCount is 2', () => {
    const row = eventRow({ seriesYearCount: 2 });
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).not.toContain('instance of an existing series');
  });

  it("the hero field emits heroImage and heroImageAlt inputs", () => {
    const row = eventRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('name="heroImage"');
    expect(body).toContain('name="heroImageAlt"');
  });
});
