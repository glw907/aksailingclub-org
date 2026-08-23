<!--
@component
The Club section's Events ledger (events-admin pass, docs/2026-08-22-events-admin-design.md): the
flat chronological list plus separate `[id]` detail page retire in favor of one series ledger,
built entirely on the graduated toolkit (`PageHeader`, `ListToolbar`, `AdminTable`/
`ExpandableRow`, `StatusChip`, `EmptyState`), the same recipe `classes/+page.svelte` follows. One
row per event series shows the last two seasons' dates read-only beside the current season's own
inline-editable date, so an officer dating the season sees every collision at a glance. Class
rows come from the `classes` table for the same three seasons, read-only, with a link out to the
Classes screen -- registration, fee, and `drop_in` stay that screen's own job.

An event row's expanded panel is `EventRowForm.svelte`, the full edit in place (Task 5):
`events/[id]` and `events/new` are both retired, a bookmarked `[id]` link now redirects here with
the row's own season and id, and "New event" opens a blank `EventRowForm` in its own `<tr>` above
the first ledger row from client state alone -- no draft row is ever written to the database, so
an abandoned new event leaves nothing behind.

**The `ExpandableRow` conflict, handled explicitly.** That component's contract puts a row-level
`onclick` on the whole summary `<tr>` and states summary cells should stay non-interactive; the
current-season date cell is the one deliberate exception, wrapped so a click or keydown inside
the date form never bubbles up to toggle the row. Cairn harvest (Task 6): `ExpandableRow` wants
an opt-out for exactly this shape (an inert-cell wrapper snippet, or a documented `data-` escape)
so a consumer doesn't have to re-derive the `stopPropagation` pair by hand.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData, PageData } from './$types';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import {
    AdminTable,
    EmptyState,
    ExpandableRow,
    ListToolbar,
    PageHeader,
    StatusChip,
    type ListToolbarFilter,
  } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatCivilDate } from '$admin-club/lib/ui';
  import { EVENT_CATEGORY_LABEL, EVENT_CATEGORY_TONE, type EventInstance, type LedgerRow, type RollForwardPlan } from '$admin-club/lib/events-store';
  import EventRowForm from './EventRowForm.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let searchQuery = $state('');
  let datesFilter = $state('all');
  let rowsFilter = $state('all');
  let rollPanelOpen = $state(false);
  let newRowOpen = $state(false);
  // Seeded once from the load's own `?open=` (the `[id]` redirect and the `create` action's own
  // redirect both land here); not a live mirror of `data.openId`, the same `untrack` idiom
  // `classes/+page.svelte`'s own `expandedId` seed uses, so a later action's own re-render never
  // clobbers what the officer has toggled.
  let expandedId: string | null = $state(untrack(() => data.openId));

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  /** Pushes a new `?season=`, the Classes screen's own `pushSeason` idiom: a season change is a
   *  real server reload, since each season carries its own eagerly-loaded ledger read. */
  function pushSeason(value: string) {
    const season = Number(value);
    const params = new URLSearchParams();
    if (Number.isFinite(season) && season !== data.currentSeason) params.set('season', String(season));
    goto(params.toString() ? `?${params}` : '?', { replaceState: true, noScroll: true, invalidateAll: true });
  }

  const filteredRows = $derived(
    data.rows.filter((row) => {
      const query = searchQuery.trim().toLowerCase();
      if (query && !row.title.toLowerCase().includes(query)) return false;
      if (datesFilter === 'undated' && !(row.kind === 'event' && row.current !== null && row.current.startDate === null)) {
        return false;
      }
      if (rowsFilter === 'events' && row.kind === 'class') return false;
      return true;
    }),
  );

  const filters: ListToolbarFilter[] = $derived([
    {
      id: 'season',
      label: 'Season',
      display: 'select',
      value: String(data.season),
      defaultValue: String(data.currentSeason),
      options: data.seasons.map((season) => ({ value: String(season), label: String(season) })),
      onChange: pushSeason,
    },
    {
      id: 'dates',
      label: 'Dates',
      display: 'select',
      value: datesFilter,
      options: [
        { value: 'all', label: 'All rows' },
        { value: 'undated', label: 'Undated only' },
      ],
      onChange: (value) => (datesFilter = value),
    },
    {
      id: 'rows',
      label: 'Rows',
      display: 'select',
      value: rowsFilter,
      options: [
        { value: 'all', label: 'Events and classes' },
        { value: 'events', label: 'Events only' },
      ],
      onChange: (value) => (rowsFilter = value),
    },
  ]);

  function instanceText(instance: EventInstance | null): string {
    if (!instance || !instance.startDate) return '';
    const start = formatCivilDate(instance.startDate);
    return instance.endDate ? `${start}–${formatCivilDate(instance.endDate)}` : start;
  }

  /** The roll-forward confirmation's own skip clause, each part omitted when its count is zero
   *  and the whole line omitted when every count is zero (`docs/2026-08-22-events-admin-design.md`'s
   *  exact copy). */
  function skipLine(plan: RollForwardPlan): string | null {
    const once = plan.skipped.filter((entry) => entry.reason === 'once').length;
    const retired = plan.skipped.filter((entry) => entry.reason === 'retired').length;
    const alreadyRolled = plan.skipped.filter((entry) => entry.reason === 'already-rolled').length;
    const total = once + retired + alreadyRolled;
    if (total === 0) return null;
    const clauses: string[] = [];
    if (once > 0) clauses.push(`${once} once-off`);
    if (retired > 0) clauses.push(`${retired} retired`);
    if (alreadyRolled > 0) clauses.push(`${alreadyRolled} already in ${plan.toSeason}`);
    return `Skips ${total}: ${clauses.join(', ')}.`;
  }

  /** Every `setDate` form's own `use:enhance`: keeps the burst of a dozen date saves off a full
   *  page reload each, matching four other `/admin/club/**` screens' idiom. */
  const keepDateOnScreen: SubmitFunction = () => {
    return async ({ update }) => {
      await update({ reset: false });
    };
  };

  function stopRowToggle(event: Event) {
    event.stopPropagation();
  }

  /** The series-link control's own option list for `row`: every OTHER event series the currently
   *  loaded ledger already knows about (this season plus the two priors, `data.rows`'s own
   *  window -- there is no store read for "every series ever", and the control only ever appears
   *  for a single-year series linking onto an established one, which this window already
   *  covers), annual first then title order. */
  function otherSeriesFor(row: LedgerRow): { id: string; title: string }[] {
    const seen = new Map<string, { id: string; title: string; annual: boolean }>();
    for (const candidate of data.rows) {
      if (candidate.kind !== 'event' || candidate.seriesId === null || candidate.seriesId === row.seriesId) continue;
      if (!seen.has(candidate.seriesId)) {
        seen.set(candidate.seriesId, { id: candidate.seriesId, title: candidate.title, annual: candidate.recurrence === 'annual' });
      }
    }
    return [...seen.values()]
      .sort((a, b) => (a.annual === b.annual ? a.title.localeCompare(b.title) : a.annual ? -1 : 1))
      .map(({ id, title }) => ({ id, title }));
  }
</script>

<span class="sr-only" role="status">{data.undatedCount} undated</span>

<div class="events-page-header">
  <PageHeader eyebrow="Club" title="Events" meta={data.error ? undefined : `Season ${data.season}`} />
</div>

{#if data.error}
  <p class="px-6 py-10 text-center type-body text-error">{data.error}</p>
{:else if data.rows.length === 0 && !newRowOpen}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 shadow-[var(--cairn-shadow)]">
    <EmptyState
      heading={`No events in season ${data.season} yet`}
      message="Events you add for this season show up here, with the last two seasons' dates beside them."
    >
      {#snippet action()}
        <button type="button" class="btn btn-primary btn-sm" onclick={() => (newRowOpen = true)}>New event</button>
      {/snippet}
    </EmptyState>
  </div>
{:else}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 overflow-x-auto shadow-[var(--cairn-shadow)]">
    {#if form?.error}
      <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">
        {form.error}
      </p>
    {/if}
    <div class="events-toolbar-band border-b border-[var(--cairn-card-border)] p-6">
      <ListToolbar
        search={searchQuery}
        onSearch={(value) => (searchQuery = value)}
        searchLabel="Search by event name"
        {filters}
        primaryAction={{ label: 'New event', onClick: () => (newRowOpen = true) }}
        count={data.undatedCount}
        itemLabel={{ one: 'undated', many: 'undated' }}
      >
        {#snippet trailing()}
          <div class="events-rollforward">
            <button type="button" class="btn btn-outline btn-sm" onclick={() => (rollPanelOpen = !rollPanelOpen)}>
              Start the next season
            </button>
            {#if data.rollPlan}
              {@const plan = data.rollPlan}
              <!-- `hidden`, not an `{#if rollPanelOpen}` gate, keeps this panel's full copy in the
                   rendered markup at all times (a static SSR render can assert on it directly, the
                   design's own render-test shape); `rollPanelOpen`'s `$state` is still the real
                   disclosure the officer drives. -->
              <div class="events-rollforward-panel" hidden={!rollPanelOpen}>
                <h2 class="type-heading font-bold">Start the {data.season + 1} season</h2>
                <p class="mt-1 type-body">
                  Creates {plan.create.length} events in {data.season + 1}, undated and hidden until you save a date.
                </p>
                {#if skipLine(plan)}
                  <p class="mt-1 type-body text-muted">{skipLine(plan)}</p>
                {/if}
                <ul class="events-rollforward-list">
                  {#each plan.create as entry (entry.seriesId)}<li>{entry.title}</li>{/each}
                </ul>
                <form method="post" action="?/rollForward" class="events-rollforward-actions" use:enhance>
                  <CsrfField />
                  <input type="hidden" name="fromSeason" value={data.season} />
                  <input type="hidden" name="toSeason" value={data.season + 1} />
                  <!-- The exact plan the officer is looking at, so the server can refuse (409) when
                       it no longer matches a freshly recomputed plan at submit time -- the events-
                       store's own `rollForward` action doc explains why. -->
                  {#each plan.create as entry (entry.seriesId)}
                    <input type="hidden" name="seriesIds" value={entry.seriesId} />
                  {/each}
                  <button type="submit" class="btn btn-primary btn-sm">Start the next season</button>
                  <button type="button" class="btn btn-sm" onclick={() => (rollPanelOpen = false)}>Cancel</button>
                </form>
              </div>
            {/if}
          </div>
        {/snippet}
      </ListToolbar>
    </div>

    <AdminTable density="sm" zebra rowCount={filteredRows.length + (newRowOpen ? 1 : 0)} emptyColspan={5}>
      {#snippet header()}
        <th class={HEADER_CELL}>Event</th>
        <th class="{HEADER_CELL} tabular-nums events-narrow-hide">{data.season - 2}</th>
        <th class="{HEADER_CELL} tabular-nums events-narrow-hide">{data.season - 1}</th>
        <th class="{HEADER_CELL} tabular-nums">{data.season}</th>
        <th class="sr-only">Details</th>
      {/snippet}
      {#snippet empty()}
        <p>No events match those filters.</p>
      {/snippet}
      {#if newRowOpen}
        <tr>
          <td colspan="5" class="events-new-row-cell">
            <EventRowForm season={data.season} heroLibrary={data.heroLibrary} onCancel={() => (newRowOpen = false)} />
          </td>
        </tr>
      {/if}
      {#each filteredRows as row (row.id)}
        <ExpandableRow
          expanded={expandedId === row.id}
          onToggle={() => toggleExpanded(row.id)}
          datum={row}
          colspan={5}
          triggerLabel={expandedId === row.id ? `Collapse ${row.title}` : `Expand ${row.title}`}
        >
          {#snippet summary()}
            <td class="events-name-cell">
              {#if row.kind === 'class'}
                <span class="events-class-star" aria-hidden="true">&starf;</span><span class="sr-only">Class</span>
              {/if}
              {row.title}
              <StatusChip tone={EVENT_CATEGORY_TONE[row.category]} label={EVENT_CATEGORY_LABEL[row.category]} size="xs" register="quiet" />
              {#if row.kind === 'event' && row.current && !row.current.visible}
                <span class="badge cairn-chip-quiet badge-sm ml-1.5 font-medium">Hidden</span>
              {/if}
              {#if row.kind === 'event' && row.retiredAt}
                <span class="badge cairn-chip-quiet badge-sm ml-1.5 font-medium">Retired</span>
              {/if}
            </td>
            <td class="events-date-cell tabular-nums type-body text-muted events-narrow-hide">{instanceText(row.prior[1])}</td>
            <td class="events-date-cell tabular-nums type-body text-muted events-narrow-hide">{instanceText(row.prior[0])}</td>
            <td class="events-date-cell tabular-nums type-body">
              {#if row.kind === 'event' && row.event}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="events-date-form-wrap" onclick={stopRowToggle} onkeydown={stopRowToggle}>
                  <form method="post" action="?/setDate" use:enhance={keepDateOnScreen}>
                    <CsrfField />
                    <input type="hidden" name="id" value={row.event.id} />
                    <input
                      class="input input-sm"
                      type="date"
                      name="startDate"
                      value={row.current?.startDate ?? ''}
                      aria-label={`${row.title} start date, ${data.season}`}
                      onchange={(event) => (event.currentTarget as HTMLInputElement).form?.requestSubmit()}
                    />
                    <input
                      class="input input-sm"
                      type="date"
                      name="endDate"
                      value={row.current?.endDate ?? ''}
                      aria-label={`${row.title} end date, ${data.season}`}
                      onchange={(event) => (event.currentTarget as HTMLInputElement).form?.requestSubmit()}
                    />
                  </form>
                </div>
              {:else}
                {instanceText(row.current)}
              {/if}
            </td>
          {/snippet}
          {#snippet panel(datum: LedgerRow)}
            <div class="events-panel">
              {#if datum.kind === 'class'}
                <a class="btn btn-sm" href="/admin/club/classes">Open in Classes</a>
              {:else if datum.event}
                <EventRowForm
                  event={datum.event}
                  recurrence={datum.recurrence ?? 'annual'}
                  retiredAt={datum.retiredAt}
                  seriesId={datum.seriesId}
                  seriesYearCount={datum.seriesYearCount}
                  season={data.season}
                  heroLibrary={data.heroLibrary}
                  otherSeries={otherSeriesFor(datum)}
                />
              {:else}
                <p class="type-body text-muted">No {data.season} instance yet.</p>
              {/if}
            </div>
          {/snippet}
        </ExpandableRow>
      {/each}
    </AdminTable>
  </div>
{/if}

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: /admin/** loads only
     cairn's precompiled CSS, so an arbitrary grid/truncation utility string would render nothing
     there. Values stay literal, matching every toolkit component's own scoped block. */
  .events-toolbar-band {
    display: flex;
    flex-direction: column;
  }

  /* Mirrors `classes/+page.svelte`'s own `PageHeader` margin fix (Members-refinement-round-1's
     A3 finding): `PageHeader.svelte` renders a bare un-reset h1/p, and this route mounts no
     header action of its own (the toolbar's `primaryAction` carries New event instead), so only
     the margin reset applies here. */
  .events-page-header :global(h1.page-h1) {
    margin: 0;
  }

  .events-page-header :global(header p) {
    margin: 0;
    margin-top: 0.25rem;
  }

  .events-name-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .events-class-star {
    color: var(--color-warning);
  }

  .events-date-cell {
    white-space: nowrap;
  }

  .events-date-form-wrap {
    display: flex;
  }

  .events-date-form-wrap form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  /* At a phone width the two read-only prior-season columns push the row (and the trigger cell
     `AdminTable`'s own horizontal-scroll fallback strands off-screen) wider than the viewport;
     they are the row's lower-priority data (both already resurface as prior-year text once the
     row is expanded, the panel's own job), so dropping them from the *summary* is what lets the
     whole row -- current-season date form and trigger included -- fit with nothing to scroll, the
     same fix `classes/+page.svelte`'s own `classes-narrow-hide` applies for the same reason. */
  @media (max-width: 640px) {
    .events-narrow-hide {
      display: none;
    }
  }

  .events-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  /* The blank "New event" row's own cell: `white-space: normal` overrides `AdminTable`'s
     `:global()` single-line-cell enforcement, since this cell holds a whole multi-row form, not
     one line of scannable text. */
  .events-new-row-cell {
    white-space: normal;
    padding: 1rem 1.5rem;
  }

  .events-rollforward {
    position: relative;
  }

  .events-rollforward-panel {
    position: absolute;
    left: 0;
    top: calc(100% + 0.5rem);
    z-index: 10;
    width: 22rem;
    max-width: calc(100vw - 3rem);
    padding: 1rem;
    border-radius: var(--radius-box, 0.5rem);
    border: 1px solid var(--cairn-card-border);
    background: var(--color-base-100);
    box-shadow: var(--cairn-shadow);
  }

  .events-rollforward-list {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
    list-style: disc;
    font-size: 0.8125rem;
  }

  .events-rollforward-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
  }
</style>
