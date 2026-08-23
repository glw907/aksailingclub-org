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
    {
      id: 'season',
      label: 'Season',
      display: 'menu',
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
  role="status"
  aria-live="polite"
  aria-atomic="true"
>{pageStatusInfo.text}</p>

{#if data.error}
  <p class="px-6 py-10 text-center type-body text-error">{data.error}</p>
{:else}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 overflow-x-auto shadow-[var(--cairn-shadow)]">
    <div class="events-toolbar-band border-b border-[var(--cairn-card-border)] p-6">
      <ListToolbar
        search={searchQuery}
        onSearch={(value) => (searchQuery = value)}
        searchLabel="Search by event name"
        {filters}
        primaryAction={{ label: 'New event', onClick: () => (newRowOpen = true) }}
        count={filteredRows.length}
        itemLabel={{ one: 'row', many: 'rows' }}
      >
        {#snippet trailing()}
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
        {/snippet}
      </ListToolbar>
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
          <th class="sr-only" scope="col">Details</th>
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
                  {#if row.kind === 'event' && row.current && !row.current.visible}
                    <StatusChip tone="neutral" label="Hidden" size="xs" register="quiet" />
                  {/if}
                  {#if row.kind === 'event' && row.retiredAt}
                    <StatusChip tone="neutral" label="Retired" size="xs" register="quiet" />
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
                    <form method="post" action="?/setDate" use:enhance={keepDateOnScreen}>
                      <CsrfField />
                      <input type="hidden" name="id" value={row.event.id} />
                      <span class="events-start-date-wrap">
                        <input
                          class="input input-sm"
                          type="date"
                          name="startDate"
                          value={row.current?.startDate ?? ''}
                          aria-label={`${row.title} start date, ${data.season}`}
                          onchange={(event) => event.currentTarget.form?.requestSubmit()}
                        />
                        {#if row.current?.endDate}
                          <!-- A phone-width-only cue (item 37, item 38): a real end date exists
                               but its own input is hidden at this width (see below), so the
                               officer still sees the row carries a range at a glance, with the
                               exact date read by the row's own expanded panel or, for a screen
                               reader, this dot's own text. -->
                          <span class="events-range-dot" aria-hidden="true"></span>
                          <span class="sr-only">Also ends {formatCivilDate(row.current.endDate)}.</span>
                        {/if}
                      </span>
                      <!-- Always in the DOM, so its own value posts even while CSS-hidden at a
                           phone width (item 37): `display: none` never drops a field from its
                           form's own submission, only a genuinely absent or `disabled` one does,
                           so an officer who edits only the start date at that width still
                           round-trips whatever end date this row already carries, unchanged;
                           editing the end date itself at that width happens in the row's own
                           expanded panel (item 39's own Start date/End date pair) instead. -->
                      <input
                        class="input input-sm events-end-date-input"
                        type="date"
                        name="endDate"
                        value={row.current?.endDate ?? ''}
                        aria-label={`${row.title} end date, ${data.season}`}
                        onchange={(event) => event.currentTarget.form?.requestSubmit()}
                      />
                    </form>
                  </div>
                {:else}
                  <!-- A class row's own current-season text (never a form -- Task 5's own
                       header comment): capped at the narrow breakpoint (below) so a real
                       multi-day range's full, unwrapped text (`nowrap` is a table-wide
                       enforcement, `AdminTable`'s own contract) never sets the WHOLE column's
                       width off this one row's text, which was silently overriding every width
                       the date-form's own inputs on other rows were given (measured: this text
                       alone was the actual 390px overflow's own cause, not the input width). -->
                  <span class="events-current-text">{instanceText(row.current)}</span>
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
                    error={rowError(datum.id)}
                  />
                {:else}
                  <p class="type-body text-muted">No {data.season} instance yet.</p>
                {/if}
              </div>
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
     collapsing to nothing when it carries no text so an empty announcement never reserves
     visible height. */
  .events-status-line {
    margin: 0 0 0.75rem;
    font-size: var(--cairn-type-meta, 0.8125rem);
    font-weight: 500;
  }
  .events-status-line:empty {
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
  }

  .events-start-date-wrap {
    position: relative;
    display: inline-flex;
  }

  /* The range cue (item 37/38): purely decorative and zero-width (`position: absolute`), so a
     row with a real end date still reads as a range at a glance without the layout cost of a
     second live input -- see the breakpoint below for why that cost does not fit at all. */
  .events-range-dot {
    display: none;
  }

  /* At a phone width the two read-only prior-season columns AND the name column's own 10rem cap
     (item 31) already consume all but ~124px of a 356px row for the name and trigger columns
     together, leaving no room for a second live date input beside them (`AdminTable`'s own
     horizontal-scroll fallback would strand the trigger off-screen otherwise) -- measured
     directly: even a single legible native date input plus that fixed overhead is close to this
     viewport's own budget, and two together never fit regardless of how far either narrows. Two
     fixes close the gap: dropping the prior-season columns from the summary (their data already
     resurfaces as prior-year text in the panel), and showing only the start-date input here, with
     the end date (when this row carries one) reduced to the small dot cue above rather than a
     second input -- editing it at this width happens in the row's own expanded panel (item 39's
     own Start date/End date pair), which has the full page width to work with. */
  @media (max-width: 640px) {
    .events-name-text {
      max-width: 10rem;
    }

    .events-date-form-wrap :global(input[type='date']) {
      width: 5.25rem;
    }

    .events-end-date-input {
      display: none;
    }

    .events-current-text {
      display: inline-block;
      max-width: 5.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .events-range-dot {
      display: block;
      position: absolute;
      top: -1px;
      right: -1px;
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--color-primary);
    }

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

  /* Right-aligns the toolbar's own view-specific slot (item 44: "the toolbar's trailing edge"),
     the closest this screen can get to that placement inside `ListToolbar`'s sealed column
     layout -- `trailing` always renders as its own line below the count line, by that
     component's own contract, so this is a horizontal alignment fix, not a line-count one. */
  .events-toolbar-band :global(.toolkit-toolbar-trailing) {
    align-self: flex-end;
  }
</style>
