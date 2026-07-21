<!--
@component
The Club section's Classes list (Classes pass Task 3 rebuild, docs/2026-07-21-classes-pass-design.md):
season-scoped rows (defaulting to the current season, history reachable behind a season filter)
built on the graduated toolkit (`@glw907/cairn-cms/admin-toolkit`) plus this route's own
`ExpandableRow` (`$admin-club/toolkit/ExpandableRow.svelte`) -- `PageHeader` (title, season meta,
New class as the one action), `ListToolbar` (a client-side name search, the season filter, the
count line), `AdminTable`/`ExpandableRow` (compact zebra rows, one expanded class at a time), and
`StatusChip` (a roster row's paid state). Two columns the prior scaffold-era screen carried die
here: Capacity (redundant with the enrolled fraction) and Visibility (an all-same-value chip
column, replaced by a quiet inline "Hidden" marker only a hidden row carries). Any styling beyond a
toolkit component's own contract lives in this file's own scoped `<style>` block, per the toolkit
README's own compiled-CSS constraint.

Search stays client-side (the whole season's rows are already loaded eagerly with the list, unlike
Members' large household set): only the season filter reloads the server, since a different season
is genuinely different data (every row's own roster/waitlist/offer state), not a client-side
re-filter of what already rendered.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { ActionData, PageData } from './$types';
  import type { ClassListRow } from './+page.server';
  import { goto } from '$app/navigation';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import { HEADER_CELL, formatCivilDate, formatClubTimestamp } from '$admin-club/lib/ui';
  import { CLASS_TRACK_LABEL, canOfferNextSeat, type ClassTrack } from '$admin-club/lib/classes-store';
  import {
    ageFromBirthdate,
    AdminTable,
    EmptyState,
    ListToolbar,
    type ListToolbarFilter,
    PageHeader,
    StatusChip,
  } from '@glw907/cairn-cms/admin-toolkit';
  import ExpandableRow from '$admin-club/toolkit/ExpandableRow.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const TRACK_CHIP: Record<ClassTrack, string> = {
    'adult-teen': 'badge-neutral',
    youth: 'border-transparent bg-primary/10 text-primary',
  };

  let searchQuery = $state('');
  // A successful `offerNext` reloads the whole page (no client enhancement on this form, matching
  // every other Club admin action, so `expandedId` below re-seeds from scratch on every submit):
  // opening the class that just received an offer is the only way its one-time claim code ever
  // becomes visible to the admin who just minted it.
  let expandedId: string | null = $state(
    untrack(() => (form && 'offered' in form && form.offered ? form.offered.classId : null)),
  );

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  /** Pushes a new `?season=` (a `goto`, not a form submit, matching the Members screen's own
   *  filter-push idiom): a season change is a real server reload, since each season carries its
   *  own eagerly-loaded roster/waitlist/offer state, never a client-side re-filter. The default
   *  season carries no param at all, so the plain list URL always means "the current season". */
  function pushSeason(value: string) {
    const season = Number(value);
    const params = new URLSearchParams();
    if (Number.isFinite(season) && season !== data.currentSeason) params.set('season', String(season));
    goto(params.toString() ? `?${params}` : '?', { replaceState: true, noScroll: true, invalidateAll: true });
  }

  const filteredClasses = $derived(
    searchQuery.trim()
      ? data.classes.filter((row) => row.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : data.classes,
  );

  const filters: ListToolbarFilter[] = $derived([
    {
      id: 'season',
      label: 'Season',
      value: String(data.season),
      defaultValue: String(data.currentSeason),
      options: data.seasons.map((season) => ({ value: String(season), label: String(season) })),
      onChange: pushSeason,
    },
  ]);
</script>

<span class="sr-only" role="status">{filteredClasses.length} classes</span>

<PageHeader eyebrow="Club" title="Classes" meta={`Season ${data.season}`}>
  {#snippet action()}
    <a class="btn btn-primary btn-sm" href="/admin/club/classes/new">New class</a>
  {/snippet}
</PageHeader>

{#if data.error}
  <p class="px-6 py-10 text-center text-sm text-error">{data.error}</p>
{:else if data.classes.length === 0}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 shadow-[var(--cairn-shadow)]">
    <EmptyState
      heading={`No classes in season ${data.season} yet`}
      message="Classes you add for this season show up here, with their roster and waitlist one click away."
    >
      {#snippet action()}
        <a class="btn btn-primary btn-sm" href="/admin/club/classes/new">New class</a>
      {/snippet}
    </EmptyState>
  </div>
{:else}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 overflow-x-auto shadow-[var(--cairn-shadow)]">
    {#if form?.error}
      <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 text-sm font-medium text-error" role="alert">
        {form.error}
      </p>
    {/if}
    <div class="classes-toolbar-band border-b border-[var(--cairn-card-border)] p-6">
      <ListToolbar
        search={searchQuery}
        onSearch={(value) => (searchQuery = value)}
        searchLabel="Search by class name"
        {filters}
        count={filteredClasses.length}
        itemLabel={{ one: 'class', many: 'classes' }}
      />
    </div>

    <AdminTable density="sm" zebra rowCount={filteredClasses.length} emptyColspan={6}>
      {#snippet header()}
        <th class={HEADER_CELL}>Class</th>
        <th class={HEADER_CELL}>Track</th>
        <th class={HEADER_CELL}>Dates</th>
        <th class={HEADER_CELL}>Enrolled</th>
        <th class={HEADER_CELL}>Waitlist</th>
        <th class="sr-only">Details</th>
      {/snippet}
      {#snippet empty()}
        <p>No classes match that search.</p>
      {/snippet}
      {#each filteredClasses as row (row.id)}
        <ExpandableRow
          expanded={expandedId === row.id}
          onToggle={() => toggleExpanded(row.id)}
          datum={row}
          colspan={6}
          triggerLabel={expandedId === row.id ? `Collapse ${row.name}` : `Expand ${row.name}`}
        >
          {#snippet summary()}
            <td class="classes-name-cell">
              {row.name}
              {#if !row.visible}<span class="badge badge-ghost badge-sm ml-1 font-medium">Hidden</span>{/if}
            </td>
            <td>
              <span class="badge badge-sm font-medium {TRACK_CHIP[row.track]}">{CLASS_TRACK_LABEL[row.track]}</span>
            </td>
            <td class="text-sm tabular-nums text-muted">
              {formatCivilDate(row.startDate, 'TBD')}{#if row.endDate} &ndash; {formatCivilDate(row.endDate)}{/if}
            </td>
            <td class="text-sm tabular-nums">
              {#if row.dropIn}
                <span class="text-muted">Drop-in</span>
              {:else}
                {row.enrolledCount}/{row.capacity}
              {/if}
            </td>
            <td class="text-sm">
              {#if row.waitlist.count > 0}
                {row.waitlist.count} waiting
                {#if row.activeOfferExpiresAt}<span class="text-muted"> &middot; offer sent</span>{/if}
              {:else}
                <span class="text-muted">&mdash;</span>
              {/if}
            </td>
          {/snippet}
          {#snippet panel(datum: ClassListRow)}
            <div class="classes-panel">
              <section>
                <h2 class={HEADER_CELL}>Roster</h2>
                <ul class="classes-panel-list">
                  {#each datum.roster as member (member.enrollmentId)}
                    <li class="classes-panel-row text-sm">
                      <span>{member.name} &middot; Age {ageFromBirthdate(member.birthdate) ?? '—'}</span>
                      <StatusChip tone={member.feePaid ? 'success' : 'warning'} label={member.feePaid ? 'Paid' : 'Owing'} size="xs" />
                    </li>
                  {:else}
                    <li class="text-sm text-muted">No one is enrolled yet.</li>
                  {/each}
                </ul>
              </section>
              <section>
                <h2 class={HEADER_CELL}>Waitlist</h2>
                {#if datum.waitlist.count > 0}
                  <p class="text-sm">
                    {datum.waitlist.count} {datum.waitlist.count === 1 ? 'person' : 'people'} waiting{#if datum.waitlist.nextName} &middot; next: {datum.waitlist.nextName}{/if}
                  </p>
                  {#if datum.activeOfferExpiresAt}
                    <p class="text-sm text-muted">Offer sent, expires {formatClubTimestamp(datum.activeOfferExpiresAt)}.</p>
                  {/if}
                {:else}
                  <p class="text-sm text-muted">No one is on the waitlist.</p>
                {/if}
              </section>
              {#if form && 'offered' in form && form.offered?.classId === datum.id}
                <section>
                  <label class="flex flex-col gap-1 text-sm" for={`claim-code-${datum.id}`}>
                    Claim code (copy it now; it will not show again)
                    <input id={`claim-code-${datum.id}`} class="input input-sm font-mono" readonly value={form.offered.token} />
                  </label>
                </section>
              {/if}
              <div class="classes-panel-actions">
                <a class="btn btn-sm" href={`/admin/club/classes/${datum.id}`}>Open class</a>
                <a class="btn btn-sm" href={`/admin/club/email/compose?segment=class:${datum.id}`}>Email class</a>
                {#if canOfferNextSeat(datum, Boolean(datum.activeOfferExpiresAt))}
                  <form method="post" action="?/offerNext">
                    <CsrfField />
                    <input type="hidden" name="classId" value={datum.id} />
                    <button type="submit" class="btn btn-sm">Offer next seat</button>
                  </form>
                {/if}
              </div>
            </div>
          {/snippet}
        </ExpandableRow>
      {/each}
    </AdminTable>
  </div>
{/if}

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: `/admin/**` loads only
     cairn's precompiled CSS, so an arbitrary grid/truncation utility string would render nothing
     there. Values stay literal, matching every toolkit component's own scoped block. */
  .classes-toolbar-band {
    display: flex;
    flex-direction: column;
  }

  .classes-name-cell {
    font-weight: 600;
  }

  .classes-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .classes-panel-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }

  .classes-panel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .classes-panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--cairn-card-border);
  }
</style>
