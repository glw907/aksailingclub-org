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

**Reviewer fan-out fix round, Svelte half (docs/plans/2026-08-22-events-admin.md's fix brief,
items 21-33 and 36-47).** The toolbar always renders above whichever body state follows it (the
table or the empty state), so the season selector survives an empty season rather than vanishing
with the rest of the card (item 45). `expandedId` now also syncs from `data.openId` on a change
(guarded against clobbering an officer's own toggle by tracking the last-seen value), so the
`create` action's client-side redirect opens the row it just made. The name cell is a plain
table-cell box again with an inner flex span for the title and a second, wrapping line for its
chips (item 31/36's fix for the "37px cell in an 87px row" defect the coherence read measured);
the roll-forward disclosure is a real one (`aria-expanded`/`aria-controls`, Escape, outside-click,
and focus-leaves-panel all close it, mirroring `ListToolbar`'s own overflow pattern); and a
single page-level `role="status"` region, always present, carries every error not tied to one row
plus a "Saved." announcement after an inline date save, Hide/Show, or Retire/Unretire -- a row-
scoped error (one whose `fail()` payload names that row's own id) renders inside the row's own
panel instead, via `EventRowForm`'s new `error` prop.

**Second coherence read fix round (docs/plans/2026-08-22-events-admin.md's follow-up brief,
items S1-S11 plus the cosmetic list).** The 390 date cell widens to fill its own cell and hides
Chromium's own calendar-picker glyph (S1); the unlabeled range dot is gone, replaced by an
"to <date>"/"+ end date" affordance beside the start input, narrow-only where the default-width
cell already shows the real second input (S2/S3); the Class category chip's dot reads `neutral`,
not the reserved `warning` tone (S4); the toolbar's own count line hides in favor of one this file
renders itself, on the same row as the roll-forward controls (S5); a class row's panel is a single
40px quiet link, not `ExpandableRow`'s own full-width padded band (S7); the `sr-only` Details
header cell is a real (if minimal) column so the header rule reaches the row edge (S8); a per-row
"Saved" confirmation renders beside the date that just changed (S9); the date/row-form inputs'
focus ring matches the button ring instead of a darker one `.input:focus` supplies (S10); and the
Season facet reads "Season: <year>" on every view, not only once it differs from the current
season (S11).
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
    computeAppliedFilters,
    computeCountLine,
    type ListToolbarFilter,
  } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatCivilDate } from '$admin-club/lib/ui';
  import { EVENT_CATEGORY_LABEL, EVENT_CATEGORY_TONE, type EventInstance, type LedgerRow, type RollForwardPlan } from '$admin-club/lib/events-store';
  import EventRowForm from './EventRowForm.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const uid = $props.id();

  let searchQuery = $state('');
  let datesFilter = $state('all');
  let rowsFilter = $state('all');
  let newRowOpen = $state(false);
  // Seeded once from the load's own `?open=` (the `[id]` redirect and the `create` action's own
  // redirect both land here); `lastOpenId` tracks what this component has already reacted to, so
  // the `$effect` below only opens a row the FIRST time a given `openId` shows up (never re-forces
  // it open every time `data` re-renders for an unrelated reason, and never clobbers whichever row
  // the officer has since toggled by hand).
  let expandedId: string | null = $state(untrack(() => data.openId));
  let lastOpenId: string | null = $state(untrack(() => data.openId));

  $effect(() => {
    if (data.openId !== lastOpenId) {
      lastOpenId = data.openId;
      if (data.openId) expandedId = data.openId;
    }
  });

  // The blank "New event" panel closes on a season change (a real navigation, so `data.season`
  // itself is the signal `$state` alone can't catch) or a filter change (the two `onChange`
  // handlers below, a client-side change this effect never sees) -- an abandoned draft should
  // never survive the officer changing what they are even looking at.
  let lastSeason = $state(untrack(() => data.season));
  $effect(() => {
    if (data.season !== lastSeason) {
      lastSeason = data.season;
      newRowOpen = false;
    }
  });


  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  /** The date cell's own "+ end date" quiet link (S2 of the second coherence read's fix brief):
   *  opens the row's panel and asks `EventRowForm` to focus and scroll to its End date field once
   *  it mounts. Keyed by event id, not toggled -- opening a row that is already open (from a
   *  second click somewhere else) still re-requests the focus. */
  let endDateFocusRequest: string | null = $state(null);

  function openEndDateField(row: LedgerRow) {
    expandedId = row.id;
    endDateFocusRequest = row.id;
  }

  /** The inline date save's own row-scoped confirmation (S9 of the second coherence read's fix
   *  brief): the page-level status line already announces "Saved." for AT, but that line sits
   *  above the toolbar, well off-screen from a row an officer is dating deep in a long ledger.
   *  This mirrors the confirmation back beside the very input that changed. One shared `$state`
   *  pair (not a per-row map) is enough: only one row is ever mid-save at a time in practice, and
   *  a second save while the first's clear timer is still pending simply re-points both at the
   *  newer row, which is the correct behavior anyway (whichever save just happened is the one
   *  worth confirming). */
  let savedRowId: string | null = $state(null);
  let savedClearTimer: ReturnType<typeof setTimeout> | undefined;

  function showSaved(rowId: string) {
    savedRowId = rowId;
    clearTimeout(savedClearTimer);
    savedClearTimer = setTimeout(() => {
      savedRowId = null;
    }, 2000);
  }

  /** Pushes a new `?season=`, the Classes screen's own `pushSeason` idiom: a season change is a
   *  real server reload, since each season carries its own eagerly-loaded ledger read. */
  function pushSeason(value: string) {
    const season = Number(value);
    const params = new URLSearchParams();
    if (Number.isFinite(season) && season !== data.currentSeason) params.set('season', String(season));
    void goto(params.toString() ? `?${params}` : '?', { replaceState: true, noScroll: true, invalidateAll: true });
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
    // `display: 'select'`, not `'menu'` (S11 of the second coherence read's fix brief): the
    // `'menu'` display only shows a value once it differs from `defaultValue` (`computeFacetLabel`,
    // `list-toolbar.ts`), so viewing the CURRENT season -- the common case -- read as a bare
    // "Season" with no year at all. A season is never optional (every row belongs to one), so the
    // `'menu'` display's applied-filter treatment (a primary-tinted border and a `x` clear
    // affordance that resets to the default) was also the wrong grammar here: clearing back to
    // "no season" is not a real state, only "a different season" is. A plain `<select>` has
    // neither problem -- it always shows its own selected option's text, with no separate applied
    // state -- so each option's own label carries the "Season: " prefix directly, the only way a
    // native control's visible text (not just its `aria-label`) can read "Season: 2027" while
    // still choosing among bare year values underneath.
    {
      id: 'season',
      label: 'Season',
      display: 'select',
      value: String(data.season),
      // A native `<select>` can only ever show a value that has a matching `<option>`; the load's
      // own `seasons` union guarantees the CURRENT season is always an option (`+page.server.ts`'s
      // own comment), but not necessarily whichever season a hand-edited `?season=` query param
      // names. The same union here, keyed off the SELECTED season instead, keeps that edge case
      // from silently mis-selecting some other year with no visible trace of the one requested.
      options: (data.seasons.includes(data.season) ? data.seasons : [data.season, ...data.seasons].sort((a, b) => b - a)).map(
        (season) => ({ value: String(season), label: `Season: ${season}` }),
      ),
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
      onChange: (value) => {
        datesFilter = value;
        newRowOpen = false;
      },
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
      onChange: (value) => {
        rowsFilter = value;
        newRowOpen = false;
      },
    },
  ]);

  const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric' });

  function parseCivil(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T00:00:00`);
  }

  /** A dated instance's own display text: a bare date, or a range. Two real dates in the same
   *  calendar year collapse to "Jun 12–13, 2027" (item 46's exact copy) rather than spelling the
   *  start out in full; a range crossing a year boundary keeps both full dates, since dropping
   *  either year there would misstate the date. */
  function instanceText(instance: EventInstance | null): string {
    if (!instance || !instance.startDate) return '';
    if (!instance.endDate) return formatCivilDate(instance.startDate);
    const start = parseCivil(instance.startDate);
    const end = parseCivil(instance.endDate);
    if (start.getFullYear() === end.getFullYear()) {
      return `${monthDayFmt.format(start)}–${dayFmt.format(end)}, ${end.getFullYear()}`;
    }
    return `${formatCivilDate(instance.startDate)}–${formatCivilDate(instance.endDate)}`;
  }

  /** The roll-forward confirmation's own skip clause, each part omitted when its count is zero
   *  and the whole line omitted when every count is zero (`docs/2026-08-22-events-admin-design.md`'s
   *  exact copy). */
  function skipLine(plan: RollForwardPlan): string | null {
    const once = plan.skipped.filter((entry) => entry.reason === 'once').length;
    const retired = plan.skipped.filter((entry) => entry.reason === 'retired').length;
    const alreadyRolled = plan.skipped.filter((entry) => entry.reason === 'already-rolled').length;
    const slugTaken = plan.skipped.filter((entry) => entry.reason === 'slug-taken').length;
    const total = once + retired + alreadyRolled + slugTaken;
    if (total === 0) return null;
    const clauses: string[] = [];
    if (once > 0) clauses.push(`${once} once-off`);
    if (retired > 0) clauses.push(`${retired} retired`);
    if (alreadyRolled > 0) clauses.push(`${alreadyRolled} already in ${plan.toSeason}`);
    if (slugTaken > 0) clauses.push(`${slugTaken} name already taken`);
    return `Skips ${total}: ${clauses.join(', ')}.`;
  }

  /** Every `setDate` form's own `use:enhance`: keeps the burst of a dozen date saves off a full
   *  page reload each, matching four other `/admin/club/**` screens' idiom, and shows this row's
   *  own "Saved" confirmation (S9 of the second coherence read's fix brief) on a successful write
   *  -- the page-level status line still announces "Saved." for AT, but it sits above the toolbar,
   *  off-screen from a row an officer is dating deep in a long ledger. Factory, not a single
   *  shared handler: this form's own `rowId` needs to reach `showSaved` above. */
  function keepDateOnScreen(rowId: string): SubmitFunction {
    return () => {
      return async ({ update, result }) => {
        await update({ reset: false });
        if (result.type === 'success') showSaved(rowId);
      };
    };
  }

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

  /** A `fail()` payload naming THIS row's own id renders inside that row's own panel
   *  (`EventRowForm`'s `error` prop) rather than the page-level status line below. */
  function rowError(id: string): string | null {
    if (!form || !('error' in form) || !form.error) return null;
    if (!('id' in form) || form.id !== id) return null;
    return form.error;
  }

  /** The page-level `role="status"` line's own text and tone: an error not tied to any row
   *  currently in view (`rollForward`, `create` -- neither has a row of its own to report inside
   *  yet), or a bare "Saved." after an inline date save, Hide/Show, or Retire/Unretire (every one
   *  of those actions returns the same `{ ok: true }` shape, so one announcement covers all
   *  three). Returns text and tone together, rather than two separately-derived values compared
   *  by string equality, so a "Saved." message can never be mistaken for an error one. */
  function pageStatus(): { text: string; isError: boolean } {
    if (!form) return { text: '', isError: false };
    if ('error' in form && form.error) {
      const attachedToRow = 'id' in form && typeof form.id === 'string' && data.rows.some((row) => row.id === form.id);
      return attachedToRow ? { text: '', isError: false } : { text: form.error, isError: true };
    }
    if ('ok' in form && form.ok) return { text: 'Saved.', isError: false };
    return { text: '', isError: false };
  }
  const pageStatusInfo = $derived(pageStatus());

  // Roll-forward disclosure (item 26): a real one, not a bare `aria-expanded` toggle. Mirrors
  // `ListToolbar`'s own overflow-disclosure pattern (a `svelte:window` pointerdown/keydown pair
  // plus a per-panel `onfocusout`), since that component's own contract is exactly this shape and
  // this screen has no reason to invent a second one.
  let rollPanelOpen = $state(false);
  let rollContainerEl: HTMLDivElement | undefined = $state();
  let rollTriggerEl: HTMLButtonElement | undefined = $state();
  let rollHeadingEl: HTMLHeadingElement | undefined = $state();
  const rollPanelId = `${uid}-roll-panel`;
  const rollHeadingId = `${uid}-roll-heading`;

  function closeRollPanel(returnFocus: boolean) {
    if (!rollPanelOpen) return;
    rollPanelOpen = false;
    if (returnFocus) rollTriggerEl?.focus();
  }

  function toggleRollPanel() {
    rollPanelOpen = !rollPanelOpen;
  }

  $effect(() => {
    if (rollPanelOpen) rollHeadingEl?.focus();
  });

  function onWindowPointerdown(event: PointerEvent) {
    if (rollPanelOpen && rollContainerEl && !rollContainerEl.contains(event.target as Node)) {
      closeRollPanel(false);
    }
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && rollPanelOpen) {
      event.preventDefault();
      closeRollPanel(true);
    }
  }

  function onRollFocusOut(event: FocusEvent) {
    if (!rollPanelOpen) return;
    const next = event.relatedTarget as Node | null;
    if (!next || !rollContainerEl?.contains(next)) closeRollPanel(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} onkeydown={onWindowKeydown} />

<div class="events-page-header">
  <PageHeader eyebrow="Club" title="Events" meta={data.error ? undefined : `Season ${data.season}`} />
</div>

<!-- Present at load either way (item 24): an error not tied to a row (roll-forward, create) and
     the "Saved." confirmation both land here; a row-scoped error renders inside that row's own
     panel instead (`rowError`, above). -->
<p
  class="events-status-line {pageStatusInfo.isError ? 'text-error' : 'text-muted'}"
  class:events-status-line-empty={!pageStatusInfo.text}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>{pageStatusInfo.text}</p>

{#if data.error}
  <p class="px-6 py-10 text-center type-body text-error">{data.error}</p>
{:else}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 overflow-x-auto shadow-[var(--cairn-shadow)]">
    <div class="events-toolbar-band border-b border-[var(--cairn-card-border)] p-6">
      <!-- `count`/`itemLabel` stay real (`ListToolbar`'s own props are type-required, not
           optional -- passing them out is a type error, not a layout choice), but the toolkit's
           own count `<p>` renders hidden below (`.toolkit-toolbar-count`'s own override in this
           file's `<style>`): `ListToolbar`'s count line and its `trailing` snippet are two fixed
           siblings in that component's own `flex-direction: column` band, with no seam to put
           them on one row together (S5 of the second coherence read's fix brief). This route
           builds its own combined count-plus-roll-controls row instead, immediately below,
           reusing `computeCountLine`/`computeAppliedFilters` so its text matches exactly what the
           hidden line would have read. -->
      <ListToolbar
        search={searchQuery}
        onSearch={(value) => (searchQuery = value)}
        searchLabel="Search by event name"
        {filters}
        primaryAction={{ label: 'New event', onClick: () => (newRowOpen = true) }}
        count={filteredRows.length}
        itemLabel={{ one: 'row', many: 'rows' }}
      />
      <div class="events-toolbar-summary">
        <p class="events-toolbar-count-line" role="status" aria-live="polite" aria-atomic="true">
          {computeCountLine(filteredRows.length, { one: 'row', many: 'rows' }, computeAppliedFilters(filters).map((pill) => pill.label))}
        </p>
        <div class="events-rollforward" bind:this={rollContainerEl} onfocusout={onRollFocusOut}>
          {#if data.undatedCount > 0}
            <StatusChip tone="neutral" label={`${data.undatedCount} undated`} size="xs" register="quiet" />
          {/if}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            bind:this={rollTriggerEl}
            aria-expanded={rollPanelOpen}
            aria-controls={rollPanelId}
            onclick={toggleRollPanel}
          >
            Start the next season
          </button>
          {#if data.rollPlan}
            {@const plan = data.rollPlan}
            {@const skip = skipLine(plan)}
            <!-- `hidden`, not an `{#if rollPanelOpen}` gate, keeps this panel's full copy in the
                 rendered markup at all times (a static SSR render can assert on it directly, the
                 design's own render-test shape); `rollPanelOpen`'s `$state` is still the real
                 disclosure the officer drives. -->
            <div id={rollPanelId} class="events-rollforward-panel" hidden={!rollPanelOpen}>
              <h2 id={rollHeadingId} class="type-heading font-bold" tabindex="-1" bind:this={rollHeadingEl}>
                Start the {data.season + 1} season
              </h2>
              {#if plan.create.length === 0}
                <p class="mt-1 type-body text-muted">Nothing left to roll into {data.season + 1}.</p>
              {:else}
                <p class="mt-1 type-body">
                  Creates {plan.create.length} events in {data.season + 1}, undated and hidden until you save a date.
                </p>
              {/if}
              {#if skip}
                <p class="mt-1 type-body text-muted">{skip}</p>
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
                <button type="submit" class="btn btn-primary btn-sm" disabled={plan.create.length === 0}>
                  Start the next season
                </button>
                <button type="button" class="btn btn-sm" onclick={() => closeRollPanel(true)}>Cancel</button>
              </form>
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if data.rows.length === 0 && !newRowOpen}
      <EmptyState
        heading={`No events in season ${data.season} yet`}
        message="Events you add for this season show up here, with the last two seasons' dates beside them."
      >
        {#snippet action()}
          <button type="button" class="btn btn-primary btn-sm" onclick={() => (newRowOpen = true)}>New event</button>
        {/snippet}
      </EmptyState>
    {:else}
      <AdminTable density="sm" zebra rowCount={filteredRows.length + (newRowOpen ? 1 : 0)} emptyColspan={5}>
        {#snippet header()}
          <th class="{HEADER_CELL} events-name-header" scope="col">Event</th>
          <th class="{HEADER_CELL} tabular-nums events-narrow-hide" scope="col">{data.season - 2}</th>
          <th class="{HEADER_CELL} tabular-nums events-narrow-hide" scope="col">{data.season - 1}</th>
          <th class="{HEADER_CELL} tabular-nums" scope="col">{data.season}</th>
          <!-- A REAL (though visually blank) narrow cell, not a `sr-only`-on-the-`<th>` one (S8
               of the second coherence read's fix brief): Tailwind's `sr-only` utility is
               `position: absolute`, which per the table layout spec computes an absolutely
               positioned table-cell to `display: block`, removing it from the header row's own
               column grid entirely. `AdminTable`'s per-`th`/`td` border-bottom rule
               (`cairn-admin.css`'s `.table :where(thead tr :is(td, th), ...)`) then has no 5th
               header cell to draw under, so the rule stops one column short of the trigger
               column's own real width -- the header's dividing line visibly fell short of the row
               edge. `events-details-header`'s own `width: 1px` (`ExpandableRow`'s own trigger-cell
               sizing trick) keeps this column's real footprint minimal while it stays a genuine
               table-cell; the sr-only text moves to an inner span instead, which CAN be
               absolutely positioned with no layout consequence of its own. -->
          <th class="{HEADER_CELL} events-details-header" scope="col"><span class="sr-only">Details</span></th>
        {/snippet}
        {#snippet empty()}
          <p>No events match those filters.</p>
        {/snippet}
        {#if newRowOpen}
          <tr>
            <td colspan="5" class="events-new-row-cell">
              <h2 class="type-heading font-bold events-new-row-heading">New event</h2>
              <EventRowForm season={data.season} heroLibrary={data.heroLibrary} onCancel={() => (newRowOpen = false)} />
            </td>
          </tr>
        {/if}
        {#each filteredRows as row (`${row.kind}:${row.id}`)}
          <ExpandableRow
            expanded={expandedId === row.id}
            onToggle={() => toggleExpanded(row.id)}
            datum={row}
            colspan={5}
            triggerLabel={expandedId === row.id ? `Collapse ${row.title}` : `Expand ${row.title}`}
          >
            {#snippet summary()}
              <td class="events-name-cell">
                <span class="events-name-text">
                  {#if row.kind === 'class'}
                    <span class="events-class-star" aria-hidden="true">&starf;</span><span class="sr-only">Class</span>
                  {/if}
                  <span class="events-name-title">{row.title}</span>
                </span>
                <span class="events-name-chips">
                  <StatusChip tone={EVENT_CATEGORY_TONE[row.category]} label={EVENT_CATEGORY_LABEL[row.category]} size="xs" register="quiet" />
                  <!-- `events-state-chip`, not `StatusChip` (cosmetic item, second coherence
                       read): a category chip's colored dot marks WHAT a row is, so a state marker
                       (Hidden/Retired) carrying the same dot read as a sixth category rather than
                       a status. No dot, and an sr-only "State: " prefix names the distinction for
                       assistive tech too, not only sighted readers. Hidden is omitted while the
                       "Undated only" filter is active: every row in that view is hidden by the
                       publish-on-date rule, so the marker would repeat on every single row rather
                       than adding information. -->
                  {#if row.kind === 'event' && row.current && !row.current.visible && datesFilter !== 'undated'}
                    <span class="events-state-chip"><span class="sr-only">State: </span>Hidden</span>
                  {/if}
                  {#if row.kind === 'event' && row.retiredAt}
                    <span class="events-state-chip"><span class="sr-only">State: </span>Retired</span>
                  {/if}
                </span>
              </td>
              <td class="events-date-cell tabular-nums type-body text-muted events-narrow-hide">{instanceText(row.prior[1])}</td>
              <td class="events-date-cell tabular-nums type-body text-muted events-narrow-hide">{instanceText(row.prior[0])}</td>
              <td class="events-date-cell tabular-nums type-body">
                {#if row.kind === 'event' && row.event}
                  <!-- Stops the date form's own click/keydown from bubbling to `ExpandableRow`'s
                       row-toggle `onclick` on the summary `<tr>`; this file's header comment
                       explains the wider contract. -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div class="events-date-form-wrap" onclick={stopRowToggle} onkeydown={stopRowToggle}>
                    <form method="post" action="?/setDate" use:enhance={keepDateOnScreen(row.event.id)}>
                      <CsrfField />
                      <input type="hidden" name="id" value={row.event.id} />
                      <span class="events-start-date-wrap">
                        <input
                          class="input input-sm events-date-input"
                          type="date"
                          name="startDate"
                          value={row.current?.startDate ?? ''}
                          aria-label={`${row.title} start date, ${data.season}`}
                          onchange={(event) => event.currentTarget.form?.requestSubmit()}
                        />
                        {#if row.current?.endDate}
                          <!-- Narrow width only (S2 of the second coherence read's fix brief): the
                               end-date input itself is CSS-hidden below, so this reads the range's
                               own end date as quiet text where the unlabeled 6px dot used to sit
                               -- readable on its own, not just a decorative cue a screen reader had
                               to be told about separately. At the default width the real,
                               pre-filled end-date input already shows this, so the text stays
                               narrow-only. Third coherence read (item 2): a real button, not inert
                               text -- the narrow width has no visible end-date input to tap, so
                               this note is the only way to reach that field there, and it opens the
                               row's own panel focused on End date exactly like "+ end date" below.
                               `events-saved-active` (this file's narrow media block) hides it while
                               this row's own save confirmation is showing, the same swap the "+ end
                               date" button gets. -->
                          <button
                            type="button"
                            class="events-add-end-date-link events-end-date-note events-narrow-only"
                            class:events-saved-active={savedRowId === row.event.id}
                            onclick={() => openEndDateField(row)}
                          >
                            to {monthDayFmt.format(parseCivil(row.current.endDate))}
                          </button>
                        {:else}
                          <!-- The "+ end date" quiet link (S2 and S3): narrow-only when the row
                               already carries a start date (the real end-date input handles that
                               case at the default width instead, below); visible at every width
                               for a fully undated row, since S3's own fix is exactly "don't show
                               an empty end-date input beside an empty start-date input" -- there is
                               nothing for it to pair with yet at ANY width until a start date
                               exists. `events-saved-active` (item 4): hidden at the narrow width
                               while this row's own save confirmation is showing, so "Saved" has
                               room to render in its place instead of forcing the nowrap date form
                               past the cell's own measured width. -->
                          <button
                            type="button"
                            class="events-add-end-date-link"
                            class:events-narrow-only={row.current?.startDate != null}
                            class:events-saved-active={savedRowId === row.event.id}
                            onclick={() => openEndDateField(row)}
                          >
                            + end date
                          </button>
                        {/if}
                      </span>
                      <!-- Always in the DOM, so its own value posts even while CSS-hidden at a
                           phone width or an undated row: `display: none` never drops a field from
                           its form's own submission, only a genuinely absent or `disabled` one
                           does, so an officer who edits only the start date still round-trips
                           whatever end date this row already carries, unchanged; editing the end
                           date itself then happens in the row's own expanded panel (Start date/End
                           date pair) or through the "+ end date" link above, which opens exactly
                           that panel. `events-end-date-input-hidden` (S3): don't render the empty
                           end-date input at all until a start date exists -- two empty
                           `mm/dd/yyyy` boxes side by side read as "half a form", not a date. -->
                      <input
                        class="input input-sm events-date-input events-end-date-input"
                        class:events-end-date-input-hidden={row.current?.startDate == null}
                        type="date"
                        name="endDate"
                        value={row.current?.endDate ?? ''}
                        aria-label={`${row.title} end date, ${data.season}`}
                        onchange={(event) => event.currentTarget.form?.requestSubmit()}
                      />
                      <!-- S9: the "Saved" confirmation renders beside the very input that changed,
                           `role="status"` present at load (this element, always rendered, empty
                           until `showSaved` fills it) rather than only the page-level line above
                           the toolbar, which sits well off-screen from a row an officer is dating
                           deep in a long ledger. -->
                      <span
                        class="events-row-saved type-meta text-muted"
                        class:events-row-saved-empty={savedRowId !== row.event.id}
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                      >{savedRowId === row.event.id ? 'Saved' : ''}</span>
                    </form>
                  </div>
                {:else}
                  <!-- A class row's own current-season text (never a form -- Task 5's own
                       header comment): allowed to wrap onto a second line at the narrow
                       breakpoint (below) rather than ellipsizing, so a range's own year never
                       silently drops (the second coherence read's own S1 finding). -->
                  <span class="events-current-text">{instanceText(row.current)}</span>
                {/if}
              </td>
            {/snippet}
            {#snippet panel(datum: LedgerRow)}
              {#if datum.kind === 'class'}
                <!-- `ExpandableRow` always forces a full-width, padded `<td>` for a panel (this
                     file's own header comment on that component's contract); a class row has
                     nothing to edit here, so the second coherence read's own fix (item S7) is a
                     single-line quiet link rather than the wide empty band the default panel
                     styling gave it. `events-class-panel` overrides that outer `<td>`'s own
                     padding/background below, `!important` because it must win regardless of
                     which of the two same-specificity compiled rules loads last (`ExpandableRow`'s
                     own scoped `.toolkit-expandable-row-panel td` rule and this one). -->
                <div class="events-class-panel">
                  <a class="events-class-panel-link" href="/admin/club/classes">Open in Classes</a>
                </div>
              {:else}
                <div class="events-panel">
                  {#if datum.event}
                    <EventRowForm
                      event={datum.event}
                      recurrence={datum.recurrence ?? 'annual'}
                      retiredAt={datum.retiredAt}
                      seriesId={datum.seriesId}
                      seriesYearCount={datum.seriesYearCount}
                      season={data.season}
                      heroLibrary={data.heroLibrary}
                      otherSeries={otherSeriesFor(datum)}
                      error={rowError(datum.id)}
                      focusField={endDateFocusRequest === datum.id ? 'endDate' : null}
                      onFocusHandled={() => (endDateFocusRequest = null)}
                    />
                  {:else}
                    <p class="type-body text-muted">No {data.season} instance yet.</p>
                  {/if}
                </div>
              {/if}
            {/snippet}
          </ExpandableRow>
        {/each}
      </AdminTable>
    {/if}
  </div>
{/if}

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: /admin/** loads only
     cairn's precompiled CSS, so an arbitrary grid/truncation utility string would render nothing
     there. Values stay literal, matching every toolkit component's own scoped block. */
  .events-toolbar-band {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* `ListToolbar`'s own count line is real (`count`/`itemLabel` stay honest, type-required
     props), just not shown: this route renders an equivalent one itself, in
     `.events-toolbar-summary` below, on the same row as the roll-forward controls (S5's own
     two-band fix, this file's header comment on the toolbar markup explains why). */
  .events-toolbar-band :global(.toolkit-toolbar-count) {
    display: none;
  }

  .events-toolbar-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .events-toolbar-count-line {
    margin: 0;
    font-size: var(--cairn-type-meta, 0.8125rem);
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
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

  /* The page-level status line (item 24): always in the DOM (a stable `role="status"` target),
     collapsing to nothing when it carries no text so an empty announcement never reserves visible
     height. A `class:` toggle, not `:empty` (the cosmetic item, second coherence read): Svelte's
     own text interpolation leaves an empty (zero-length) Text node in the DOM rather than removing
     the node outright, and `:empty` requires literally no child nodes at all, so the selector
     never matched and this line's own bottom margin rendered on every load regardless of whether
     it carried text. */
  .events-status-line {
    margin: 0 0 0.75rem;
    font-size: var(--cairn-type-meta, 0.8125rem);
    font-weight: 500;
  }
  .events-status-line-empty {
    display: none;
  }

  /* item 31/36: a plain table-cell box again (the coherence-round fix -- see this file's header
     comment). The name and its chips are two stacked lines inside it, `events-name-text` (the
     title, blockified by `display: flex`) then `events-name-chips` (the category chip plus any
     Hidden/Retired marker, wrapping below it rather than crowding the same line as the title).

     Sticky, `left: 0` (item 37's own fallback): a row's real single date input plus the name and
     trigger columns fits a 390px viewport with nothing to scroll (measured), but a row carrying a
     genuine two-date range (both inputs live, never hidden behind a disclosure -- the whole point
     of this column is an officer seeing every date at a glance) cannot also fit two real,
     legible native date inputs in the width left over; when that row forces a horizontal scroll,
     sticky keeps the title in view at every scroll position, mirroring `ExpandableRow`'s own
     sticky trigger-cell fix (its header comment covers the same "single-line enforcement forces a
     scroll" reasoning for that column's other end). The header's own `events-name-header` (below)
     carries the identical treatment so the two rails never drift apart mid-scroll. */
  .events-name-cell {
    vertical-align: middle;
    position: sticky;
    left: 0;
    z-index: 1;
    background-color: var(--color-base-100);
  }

  /* Zebra parity, mirroring `ExpandableRow`'s own trigger-cell fix for the identical reason: a
     sticky cell needs its own opaque background that agrees with whichever zebra stripe its row
     sits on, or the pinned column seams against the striped content scrolling underneath it. */
  :global(.table-zebra tbody tr.toolkit-expandable-row-summary:nth-child(2n)) .events-name-cell {
    background-color: var(--color-base-200);
  }

  .events-name-header {
    position: sticky;
    left: 0;
    z-index: 1;
    background-color: var(--color-base-100);
  }

  /* S8: a real (minimal-width) column, not a `position: absolute` one -- see the header snippet's
     own comment for why that kept the border-bottom rule from reaching this column at all. */
  .events-details-header {
    width: 1px;
  }

  .events-name-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 600;
  }

  .events-name-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The state-marker chip (cosmetic item, second coherence read): no colored dot -- see the
     summary snippet's own comment for why a category chip's dot and a state marker's dot would
     otherwise read as the same vocabulary. Literal values, matching `StatusChip`'s own quiet
     register (`color-mix(in oklab, var(--color-base-content) 14%, var(--color-base-300))`), since
     that component's own scoped classes are not a reachable selector from here. */
  .events-state-chip {
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    padding: 0.0625rem 0.5rem;
    font-size: var(--cairn-type-chip, 0.625rem);
    font-weight: 600;
    background-color: color-mix(in oklab, var(--color-base-content) 14%, var(--color-base-300));
  }

  .events-name-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .events-class-star {
    color: var(--cairn-warning-ink);
  }

  .events-date-cell {
    white-space: nowrap;
  }

  /* item 37/38: `inline-flex`, not `flex` -- a block-level flex container stretches to its own
     parent's (the `<td>`) full content width regardless of how narrow its own children are,
     which was silently defeating every width this file's date inputs were ever given (measured:
     a 5.25rem input still left the wrap itself sitting at 105px). `inline-flex` shrink-wraps to
     the actual content instead, which is what lets the table's own auto-layout size this column
     off the input's real, narrowed width. `flex-wrap: nowrap` then keeps a date cell always one
     line regardless of content (an undated row no longer wraps to an empty second line it does
     not need). Above the narrow breakpoint (below), both date inputs render together as before --
     plenty of room at 1440. */
  .events-date-form-wrap {
    display: inline-flex;
  }

  .events-date-form-wrap form {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.25rem;
  }

  .events-date-form-wrap :global(input[type='date']) {
    width: 8rem;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  /* Matches the button ring (S10 of the second coherence read's fix brief); `EventRowForm.svelte`
     carries the identical override with the identical reasoning in its own comment. */
  .events-date-form-wrap :global(input[type='date']:focus),
  .events-date-form-wrap :global(input[type='date']:focus-within) {
    outline: 2px solid var(--color-primary) !important;
    outline-offset: 2px !important;
    box-shadow: 0 1px var(--color-primary) !important;
  }

  /* Flex-row by default (desktop: the end-date note/link sits beside the start input, roughly
     where the real end-date input would); flips to a column at the narrow breakpoint below, so
     the same markup renders "under the start input" there (S2). */
  .events-start-date-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  /* The end-date note/link default state: visible (desktop), no special treatment needed --
     `events-narrow-only` (below) is what hides one of the two at the default width when the real
     end-date input already covers that case. */
  .events-end-date-note,
  .events-add-end-date-link {
    white-space: nowrap;
  }

  /* A quiet text-button, not a `.btn` (S2/S3): reads as an affordance beside the date, never a
     bordered control competing with the row's own trigger button. Literal values, per the toolkit
     README's own compiled-CSS constraint. */
  .events-add-end-date-link {
    border: none;
    background: none;
    padding: 0;
    color: var(--color-primary);
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
    cursor: pointer;
    font: inherit;
    font-size: var(--cairn-type-meta, 0.8125rem);
  }

  .events-add-end-date-link:hover {
    text-decoration-color: var(--color-primary);
  }

  /* S9: present at load (this file's header comment on the summary snippet explains why), empty
     until `showSaved` fills it. A `class:` toggle, not a `:empty` selector: Svelte's own text
     interpolation leaves an empty (zero-length) Text node in the DOM rather than removing the node
     outright, and `:empty` requires literally no child nodes at all, so it never matches here --
     the same defect this file's page-level status line patches the same way, below. */
  .events-row-saved-empty {
    display: none;
  }

  /* S3: don't render the empty end-date input at all until a start date exists (the desktop half
     of the same rule the narrow breakpoint below already enforces unconditionally). */
  .events-end-date-input-hidden {
    display: none;
  }

  /* Hidden by default (S3): shown only at the narrow breakpoint below, where the real end-date
     input is always hidden and the note/link stand in for it instead. */
  .events-narrow-only {
    display: none;
  }

  /* At a phone width the two read-only prior-season columns AND the name column's own 10rem cap
     (item 31) already consume all but ~124px of a 356px row for the name and trigger columns
     together, leaving no room for a second live date input beside them (`AdminTable`'s own
     horizontal-scroll fallback would strand the trigger off-screen otherwise) -- measured
     directly. So this breakpoint still shows only the start-date input; what changed (the second
     coherence read's own S1/S2 fixes) is how much room that ONE input gets and what replaces the
     dot cue that used to mark a range: the cell measured 116.5px available once the two
     narrow-hidden columns clear, comfortably past the 112px floor a legible `mm/dd/yyyy` value
     plus Chromium's own picker glyph needs (the glyph itself is hidden below, since at 84px it
     overlapped the value's own trailing digits). */
  @media (max-width: 640px) {
    .events-name-text {
      max-width: 10rem;
    }

    /* S1: wraps to a second line instead of ellipsizing a long title (the cosmetic item, second
       coherence read). `-webkit-line-clamp` is Chromium/WebKit-only, matching this admin surface's
       own Chromium-only browser target; a third line still ellipsizes rather than growing the row
       without bound. Third coherence read (item 3): `overflow: hidden`, not `visible` -- a title
       long enough to clamp at two lines still lays out its third line in the box's own flow (the
       clamp only paints an ellipsis over the second line, it does not remove the overflowing
       content), and `overflow: visible` let that third line paint straight through the chip row
       below it (measured: `events-name-text` clientHeight 30 vs. scrollHeight 45). `hidden` crops
       the box at the clamp's own two-line height, which is what makes the ellipsis read as the
       end of the text rather than a cosmetic mark with more text bleeding past it. */
    .events-name-title {
      overflow: hidden;
      white-space: normal;
      text-overflow: clip;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .events-date-form-wrap :global(input[type='date']) {
      width: 7.25rem;
      min-width: 112px;
    }

    /* S1: Chromium's own calendar-picker glyph rendered inside the input's own box at this width,
       overlapping the value's trailing digits (`20‌27` clipped under the icon). Hiding it keeps
       keyboard entry (typing into the mm/dd/yyyy segments) fully intact; only the glyph's own
       click-to-open affordance goes away, and only at this width, where there was no room for it
       beside a legible value in the first place. */
    .events-date-form-wrap :global(input[type='date']::-webkit-calendar-picker-indicator) {
      display: none;
    }

    .events-start-date-wrap {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;
    }

    .events-end-date-input {
      display: none;
    }

    /* Third coherence read (item 4): the narrow width is exactly where the save burst happens (an
       officer dating a long, undated ledger works one row at a time on a phone), so suppressing
       the confirmation there hid it at the one width it mattered most. `events-saved-active` (the
       narrow-only swap below) makes room for it: while a row's own save confirmation is showing,
       its end-date note/link hides so "Saved" replaces it in the same narrow column rather than
       forcing the nowrap date form wider than the cell the header comment above measured.
       `.events-add-end-date-link.events-saved-active`, not the bare class alone (measured): the
       note/link this hides always carries `events-add-end-date-link` too, and a compound two-class
       selector outranks `.events-narrow-only`'s own single-class `display: inline` below
       regardless of which rule the compiler emits last -- a bare single-class rule here tied that
       rule's specificity and lost on source order for the has-a-start-date-but-no-end-date case. */
    .events-add-end-date-link.events-saved-active {
      display: none;
    }

    /* S1: widened (not ellipsized) so a class row's own current-season range keeps its year
       (`Jun 12–13, 2027`) -- `white-space: normal` overrides the inherited `nowrap` this element
       would otherwise take from `AdminTable`'s own per-cell enforcement (a direct declaration on
       this element always wins over an inherited one, regardless of either rule's specificity),
       letting a range that still doesn't fit wrap onto a second line rather than truncate. */
    .events-current-text {
      display: inline-block;
      max-width: 7.25rem;
      white-space: normal;
    }

    .events-narrow-only {
      display: inline;
    }

    .events-narrow-hide {
      display: none;
    }

    /* Third coherence read (item 1): the desktop panel anchors `right: 0` against its own
       trigger's wrapper (`.events-rollforward`, `position: relative`), whose own right edge sits
       wherever the toolbar's flex-wrap put it -- at a phone width that is well inside the
       viewport, not at its right edge, so the panel's fixed 22rem width ran off the LEFT side of
       the screen (measured: x=-80 at 390, clipped at 320 too) with its primary button unreachable.
       `position: fixed`, centered on the viewport rather than anchored to the trigger, sidesteps
       that dependency entirely: the panel becomes its own small modal, sized to the viewport minus
       a consistent margin and capped so it always fits, with `overflow-y: auto` covering a plan
       whose create/skip lists run long enough to exceed the remaining height (the create list
       alone can run to a dozen titles). Scoped to this file's own narrow breakpoint, so the
       desktop anchor-to-trigger placement (`.events-rollforward-panel`'s base rule, above) is
       unchanged at 768/1440. `!important` throughout (matching `.events-class-panel`'s own
       precedent below, same reasoning): the build's CSS optimizer does not preserve this file's
       own source order between an `@media` block and a plain rule targeting the same selector
       (measured -- the compiled stylesheet emits this `@media` rule BEFORE the base rule it is
       meant to override), so without `!important` the base rule's `position: absolute; right: 0`
       silently won at every width regardless of the media query matching. */
    .events-rollforward-panel {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      right: auto !important;
      transform: translate(-50%, -50%) !important;
      width: calc(100vw - 2rem) !important;
      max-width: 22rem !important;
      max-height: calc(100vh - 2rem) !important;
      overflow-y: auto !important;
    }
  }

  .events-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  /* S7: a class row has nothing to edit, so its own panel overrides `ExpandableRow`'s own
     `.toolkit-expandable-row-panel td` rule (padding, `base-300` background, the inset-shadow
     depth cue -- all sized for a real multi-field form) down to a single 40px-tall strip, rather
     than the wide, mostly-empty band that rule gave a one-link panel. `:has()` reaches the `<td>`
     ExpandableRow itself renders (opaque to this component's own scoped selectors, the same
     reason `AdminTable`'s `td`/`th` enforcement needs `:global()`) via the one thing this file DOES
     control, the panel's own content; `!important` because it must win regardless of which of the
     two same-specificity compiled rules loads last, matching the reasoning `ListToolbar`'s own
     compiled-CSS override already carries for the identical problem. */
  :global(tr.toolkit-expandable-row-panel:has(.events-class-panel) td) {
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .events-class-panel {
    display: flex;
    min-height: 40px;
    align-items: center;
    padding: 0 1.5rem;
  }

  .events-class-panel-link {
    border: none;
    background: none;
    padding: 0;
    color: var(--color-primary);
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
    cursor: pointer;
    font: inherit;
    font-size: var(--cairn-type-meta, 0.8125rem);
  }

  .events-class-panel-link:hover {
    text-decoration-color: var(--color-primary);
  }

  /* The blank "New event" row's own cell: `white-space: normal` overrides `AdminTable`'s
     `:global()` single-line-cell enforcement, since this cell holds a whole multi-row form, not
     one line of scannable text. The background/inset-shadow pair mirrors `ExpandableRow`'s own
     panel `<td>` (that component's scoped style, unreachable from here), so the blank form sits
     on the same recessed ground an existing row's own expanded panel does (item 42), rather than
     floating directly on the card surface with no depth cue of its own. */
  .events-new-row-cell {
    white-space: normal;
    padding: 1rem 1.5rem;
    background: var(--color-base-300);
    box-shadow: inset 0 1px 0 var(--cairn-card-border);
  }

  .events-new-row-heading {
    margin: 0 0 0.75rem;
  }

  .events-rollforward {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .events-rollforward-panel {
    position: absolute;
    right: 0;
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

  .events-rollforward-panel h2 {
    outline: none;
  }

  .events-rollforward-list {
    margin: 0.5rem 0;
    padding-left: 0;
    list-style: none;
    font-size: 0.8125rem;
  }

  .events-rollforward-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
  }

</style>
