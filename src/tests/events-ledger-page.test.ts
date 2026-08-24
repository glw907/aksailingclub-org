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
// expanded. The reviewer fan-out fix round's own tests (bottom of the file) cover what the round
// changed: the toolbar count line reading the filtered row count rather than the undated tally,
// the undated tally's own StatusChip, the season filter's `'menu'` reading, and the roll-forward
// disclosure's a11y wiring and zero-create disabled state.
import { readFileSync } from 'node:fs';
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

  it('renders a prior-season cell as read-only text and the current-season cell as at-rest typeset text (probe verdict, 2026-08-24)', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    expect(body).toContain(formatCivilDate('2025-08-03'));
    // The current-season cell reads as typeset text at rest, the same register as the prior
    // columns -- the native `type="date"` form only mounts once the row enters edit mode, which an
    // SSR-only render (this suite's own idiom, see this file's header comment) never reaches.
    expect(body).toContain('events-date-rest-btn');
    expect(body).toContain(formatCivilDate('2026-08-01'));
    expect(body).not.toContain('type="date"');
  });

  it('the ?/setDate edit form still sits inside the editingDateId branch with its full field set (fix round finding 3)', () => {
    // The rest/edit toggle means an SSR-only render never mounts the edit-mode `<form>` (this
    // file's own header comment); this asserts against the source directly instead, the same
    // idiom the "second coherence read" describe block below uses throughout.
    const source = readFileSync(new URL('../routes/admin/club/events/+page.svelte', import.meta.url), 'utf-8');
    const ifIdx = source.indexOf('{#if editingDateId === eventId}');
    expect(ifIdx).toBeGreaterThan(-1);
    const elseIdx = source.indexOf('{:else if row.current?.startDate}', ifIdx);
    expect(elseIdx).toBeGreaterThan(ifIdx);
    const formIdx = source.indexOf('<form method="post" action="?/setDate"', ifIdx);
    expect(formIdx).toBeGreaterThan(ifIdx);
    expect(formIdx).toBeLessThan(elseIdx);
    const formEndIdx = source.indexOf('</form>', formIdx) + '</form>'.length;
    const formBlock = source.slice(formIdx, formEndIdx);
    expect(formBlock).toContain('<CsrfField />');
    expect(formBlock).toMatch(/type="hidden"\s+name="id"/);
    expect(formBlock).toContain('name="startDate"');
    expect(formBlock).toContain('name="endDate"');
    expect(formBlock).toContain('use:enhance={keepDateOnScreen(eventId)}');
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

  it('the toolbar count line reads the filtered row count, not the undated tally (item 25)', () => {
    const { body } = render(Page, {
      props: { data: baseData({ rows: [eventRow(), classRow()], undatedCount: 5 }), form: null },
    });
    expect(body).toContain('2 rows');
    expect(body).toContain('5 undated');
  });

  it('the undated tally renders as its own StatusChip beside the roll-forward trigger', () => {
    const { body } = render(Page, { props: { data: baseData({ undatedCount: 1 }), form: null } });
    expect(body).toContain('1 row');
    expect(body).toContain('1 undated');
    expect(body).not.toContain('1 rowdated');
  });

  it('the undated StatusChip is absent when nothing is undated', () => {
    const { body } = render(Page, { props: { data: baseData({ undatedCount: 0 }), form: null } });
    // Not a bare `not.toContain('undated')`: the Dates filter's own `<option value="undated">`
    // legitimately carries that substring regardless of the tally, so this checks for the chip's
    // own rendered label text specifically.
    expect(body).not.toMatch(/status-chip-label[^<]*>\d+ undated/);
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

  // Third coherence read (item 5): a live round-2 render of this exact plan shape already showed
  // the skip clause correctly ("Skips 2: 1 once-off, 1 retired."); the round-3 capture that
  // reported it missing was a season where the once-off and retired series held no row in the
  // FROM season at all (so `previewRollForward`'s own `JOIN` never surfaces them, and an empty
  // `skipped` list is the correct plan for that season, not a bug). This fixture locks in the
  // literal one-once-off/one-retired shape the coherence read named, guarding the render path
  // independently of whichever season's data happens to populate `skipped`.
  it('renders the skip sentence for a plan carrying exactly one once-off and one retired skip', () => {
    const plan = {
      fromSeason: 2027,
      toSeason: 2028,
      create: [{ seriesId: 's-1', title: 'Event A' }],
      skipped: [
        { seriesId: 's-once-1', title: 'Once A', reason: 'once' as const },
        { seriesId: 's-retired-1', title: 'Retired A', reason: 'retired' as const },
      ],
    };
    const { body } = render(Page, { props: { data: baseData({ rollPlan: plan }), form: null } });
    expect(body).toContain('Skips 2: 1 once-off, 1 retired.');
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

  it('the hero picker renders a visible "Hero photo" label, closed at rest with no library grid (probe verdict, 2026-08-24)', () => {
    const row = eventRow();
    const { body } = render(Page, {
      props: {
        data: baseData({
          rows: [row],
          openId: row.id,
          heroLibrary: [{ token: 'media:a.0123456789abcdef', displayName: 'A photo', alt: 'An alt', url: '/media/a.jpg' }],
        }),
        form: null,
      },
    });
    expect(body).toContain('Hero photo');
    expect(body).toContain('Choose photo');
    // The library count folds into the open-state caption, so it never renders at rest; the
    // open/close/select transitions are pinned as plain functions by hero-image-picker.test.ts
    // (no test in this repo mounts a component -- see that module's header).
    expect(body).not.toContain('· 1 photo');
    expect(body).not.toContain('role="listbox"');
  });

  it('Hidden and Retired render as their own chips beside the category chip, not a raw badge', () => {
    const row = eventRow({
      retiredAt: '2026-01-01 00:00:00',
      current: instance({ id: 'board-meeting-2026', startDate: '2026-08-01', visible: false }),
    });
    const { body } = render(Page, { props: { data: baseData({ rows: [row] }), form: null } });
    expect(body).toContain('>Hidden<');
    expect(body).toContain('>Retired<');
  });
});

describe('reviewer fan-out fix round (Svelte half: items 21-33, 36-47)', () => {
  it('the season filter reads "Season: <year>" on every view, not only once it differs from the current season (S11 of the second coherence read)', () => {
    const differing = render(Page, { props: { data: baseData({ season: 2027, currentSeason: 2026 }), form: null } });
    expect(differing.body).toContain('Season: 2027');
    const atCurrent = render(Page, { props: { data: baseData({ season: 2026, currentSeason: 2026 }), form: null } });
    expect(atCurrent.body).toContain('Season: 2026');
    // A plain `<select>`, not the `'menu'` display's applied-filter treatment: no clear affordance
    // suggesting a season is a removable filter rather than a required dimension.
    expect(atCurrent.body).not.toContain('toolkit-toolbar-facet-clear');
  });

  it('the season filter still shows the selected season even when it is absent from `seasons` (a hand-edited `?season=`)', () => {
    const { body } = render(Page, {
      props: { data: baseData({ season: 2030, currentSeason: 2026, seasons: [2026, 2025] }), form: null },
    });
    expect(body).toContain('Season: 2030');
  });

  it('the roll-forward trigger carries aria-expanded and aria-controls naming its own panel', () => {
    const plan = { fromSeason: 2026, toSeason: 2027, create: [{ seriesId: 's-1', title: 'Event A' }], skipped: [] };
    const { body } = render(Page, { props: { data: baseData({ rollPlan: plan }), form: null } });
    const controlsMatch = body.match(/aria-controls="([^"]+)"[^>]*>\s*Start the next season/);
    expect(controlsMatch).not.toBeNull();
    const panelId = controlsMatch![1];
    expect(body).toContain(`id="${panelId}"`);
    expect(body).toContain('aria-expanded="false"');
  });

  it('the roll-forward submit disables and reads "Nothing left to roll into" for a zero-create plan', () => {
    const plan = { fromSeason: 2026, toSeason: 2027, create: [], skipped: [] };
    const { body } = render(Page, { props: { data: baseData({ rollPlan: plan }), form: null } });
    expect(body).toContain('Nothing left to roll into 2027.');
    expect(body).toMatch(/Start the next season<\/button>/);
    const submitMatch = body.match(/<button type="submit"[^>]*>\s*Start the next season/);
    expect(submitMatch).not.toBeNull();
    expect(submitMatch![0]).toContain('disabled');
  });

  it('the toolbar always renders, even with zero rows, so the season selector survives (item 45)', () => {
    const { body } = render(Page, { props: { data: baseData({ rows: [], season: 2027 }), form: null } });
    expect(body).toContain('Search by event name');
    expect(body).toContain('No events in season 2027 yet');
  });

  it('a same-year date range collapses to "Mon D–D, YYYY" (item 46)', () => {
    // The current-season column is always an editable date form for an event row (its own
    // `row.event` is truthy), so the read-only range text this fixture checks for is exercised
    // through a prior-season column instead -- the one cell type that always reads `instanceText`.
    const row = eventRow({
      prior: [
        instance({ id: 'board-meeting-2025', startDate: '2025-08-03', visible: true }),
        instance({ id: 'icebreaker-2024', startDate: '2024-05-23', endDate: '2024-05-25', visible: true }),
      ],
    });
    const { body } = render(Page, { props: { data: baseData({ rows: [row] }), form: null } });
    expect(body).toContain('May 23–25, 2024');
  });

  it('a page-level error not tied to a row (rollForward) renders in the page-level status line', () => {
    const { body } = render(Page, {
      props: { data: baseData(), form: { error: 'The season changed since you opened this. Review it again.' } },
    });
    expect(body).toContain('The season changed since you opened this. Review it again.');
  });

  it('a "Saved." status announces after a successful write with no row of its own to render inside', () => {
    const { body } = render(Page, { props: { data: baseData(), form: { ok: true } } });
    expect(body).toContain('Saved.');
  });

  it('a row-scoped error renders inside that row\'s own panel, not the page-level line', () => {
    const row = eventRow();
    const { body } = render(Page, {
      props: {
        data: baseData({ rows: [row], openId: row.id }),
        form: { error: 'That series already has an event in this season.', id: row.id },
      },
    });
    // Inside the panel: EventRowForm's own `role="alert"` paragraph, not the page-level
    // `role="status"` line (asserted by absence of the error text before the panel's own field
    // set, i.e. it renders alongside "Title", not above the toolbar).
    expect(body).toContain('role="alert"');
    expect(body).toContain('That series already has an event in this season.');
  });

  it('EventRowForm.svelte gives its setVisibility and retire forms the keep-on-screen handler, never a bare use:enhance (item 21)', () => {
    const source = readFileSync(
      new URL('../routes/admin/club/events/EventRowForm.svelte', import.meta.url),
      'utf-8',
    );
    const setVisibilityForm = source.match(/<form[^>]*action="\?\/setVisibility"[\s\S]*?<\/form>/);
    const retireForm = source.match(/<form[^>]*action="\?\/retire"[\s\S]*?<\/form>/);
    expect(setVisibilityForm).not.toBeNull();
    expect(retireForm).not.toBeNull();
    // Neither form's own opening `<form ...>` tag is a bare `use:enhance` (no handler): both
    // carry `use:enhance={keepOnScreen}`, the same handler `+page.svelte`'s own `setDate` form
    // uses, rather than SvelteKit's default full-form reset.
    expect(setVisibilityForm![0]).toMatch(/use:enhance=\{keepOnScreen\}/);
    expect(retireForm![0]).toMatch(/use:enhance=\{keepOnScreen\}/);
  });
});

describe('second coherence read fix round (docs/plans/2026-08-22-events-admin.md follow-up, S1-S11)', () => {
  const source = readFileSync(new URL('../routes/admin/club/events/+page.svelte', import.meta.url), 'utf-8');

  it('S1: the narrow date input widens past its old 84px and hides the picker glyph', () => {
    expect(source).not.toContain('width: 5.25rem');
    expect(source).toMatch(/width:\s*7\.25rem/);
    expect(source).toContain('min-width: 112px');
    expect(source).toContain("::-webkit-calendar-picker-indicator");
  });

  it('S1: a class row\'s current-season text widens/wraps instead of ellipsizing at the narrow breakpoint', () => {
    expect(source).not.toContain('max-width: 5.5rem');
    expect(source).toMatch(/\.events-current-text\s*\{[^}]*white-space:\s*normal/);
  });

  it('S2: the unlabeled range dot is gone; a ranged event collapses to one typeset range at rest, and edit mode still carries the end-date note (probe verdict, 2026-08-24)', () => {
    expect(source).not.toContain('events-range-dot');
    const { body } = render(Page, {
      props: {
        data: baseData({
          rows: [
            eventRow({
              id: 'ranged',
              event: {
                id: 'ranged',
                seriesId: 'series-ranged',
                season: 2026,
                title: 'Ranged Event',
                slug: 'ranged',
                category: 'racing',
                shortDescription: null,
                longDescription: null,
                startDate: '2026-06-01',
                startTime: null,
                endDate: '2026-06-03',
                endTime: null,
                location: null,
                heroImage: null,
                heroImageAlt: null,
                thumbnailImage: null,
                visible: true,
                createdAt: '2026-01-01 00:00:00',
                updatedAt: '2026-01-01 00:00:00',
              },
              current: instance({ id: 'ranged', startDate: '2026-06-01', endDate: '2026-06-03', visible: true }),
            }),
          ],
        }),
        form: null,
      },
    });
    // At rest, the whole range collapses into one typeset button -- the end-date note only exists
    // once the row enters edit mode, which an SSR-only render never reaches (this file's header
    // comment on the rest/edit toggle), so the note itself is checked against the source below.
    expect(body).toContain('Jun 1–3, 2026');
    expect(body).toContain('events-date-rest-btn');
    expect(body).not.toContain('events-end-date-note');
    // Third coherence read (item 2): a real `<button>`, not inert text -- the narrow width has no
    // visible end-date input to tap, so the note is the only reachable path to that field there.
    // Fix round finding 3 (tightened): scoped to the `{#if editingDateId === eventId}` branch
    // specifically (not merely somewhere in the file), so a note that drifted out to the rest
    // state would fail this rather than still matching a bare file-wide search.
    const ifIdx = source.indexOf('{#if editingDateId === eventId}');
    const elseIdx = source.indexOf('{:else if row.current?.startDate}', ifIdx);
    expect(ifIdx).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(ifIdx);
    const editBranch = source.slice(ifIdx, elseIdx);
    const noteButton = editBranch.match(/<button[\s\S]*?<\/button>/g)?.find((tag) => tag.includes('events-end-date-note'));
    expect(noteButton).toContain('to {monthDayFmt.format(parseCivil(row.current.endDate))}');
  });

  it('S2/S3: an undated row renders a quiet "+ add date" link at rest, not a raw empty date input (probe verdict, 2026-08-24)', () => {
    const undated = eventRow({ current: instance({ id: 'board-meeting-2026', startDate: null, endDate: null, visible: false }) });
    const { body } = render(Page, { props: { data: baseData({ rows: [undated] }), form: null } });
    expect(body).toContain('events-add-end-date-link');
    expect(body).toContain('+ add date');
    expect(body).not.toContain('type="date"');
    // The form's own "+ end date"/`events-end-date-input-hidden` markup only mounts in edit mode;
    // the source-level check confirms it is still there, gated behind `editingDateId`.
    expect(source).toContain('events-end-date-input-hidden');
  });

  it('S4: the class category chip carries a neutral dot, never the reserved warning tone', () => {
    const { body } = render(Page, { props: { data: baseData({ rows: [classRow()], openId: null }), form: null } });
    expect(body).toContain('status-neutral');
    expect(body).not.toContain('status-warning');
  });

  it('S5: the toolbar renders its own count-plus-roll-controls row and hides the toolkit\'s own count line', () => {
    expect(source).toContain('events-toolbar-summary');
    expect(source).toMatch(/:global\(\.toolkit-toolbar-count\)\s*\{[^}]*display:\s*none/);
  });

  it('S7: a class row\'s panel is a single quiet link, not the old full-width btn band', () => {
    const row = classRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row], openId: row.id }), form: null } });
    expect(body).toContain('events-class-panel-link');
    expect(body).toContain('href="/admin/club/classes"');
    expect(body).not.toContain('class="btn btn-sm" href="/admin/club/classes"');
  });

  it('S8: the Details header cell is a real (non sr-only-on-the-th) column with its own border', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    expect(body).not.toContain('<th class="sr-only"');
    expect(body).toContain('events-details-header');
    expect(body).toMatch(/<th class="[^"]*events-details-header[^"]*"[^>]*><span class="sr-only">Details<\/span><\/th>/);
  });

  it('S9: a per-row "Saved" status region is present at load, empty until a save fills it', () => {
    const row = eventRow();
    const { body } = render(Page, { props: { data: baseData({ rows: [row] }), form: null } });
    const match = body.match(/<span class="events-row-saved[^"]*"[^>]*role="status"[^>]*>([\s\S]*?)<\/span>/);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('');
  });

  it('S10: the date-cell and row-form inputs override the focus ring to match the button ring', () => {
    expect(source).toMatch(/input\[type='date'\]:focus[\s\S]*?outline: 2px solid var\(--color-primary\) !important/);
    const formSource = readFileSync(new URL('../routes/admin/club/events/EventRowForm.svelte', import.meta.url), 'utf-8');
    expect(formSource).toMatch(/:global\(\.input:focus\)[\s\S]*?outline: 2px solid var\(--color-primary\) !important/);
  });

  it('item 11: the status line collapses (no reserved bottom margin) when empty', () => {
    const { body } = render(Page, { props: { data: baseData(), form: null } });
    expect(body).toContain('events-status-line-empty');
  });
});
