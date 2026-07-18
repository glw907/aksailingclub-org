<!-- @component
/my-account/directory: the members-only directory in the ratified Compact A composition (plan T4).
Each listed member is a compact resting row (name, one filled top-title chip with a quiet "+N", a
secondary datum that is the member's boats when they own any else the household city, and, for a
visible member, phone and email affordances) that EXPANDS in place to the full person-first entry
on a quiet sage wash (household line, every position and derived chair title as filled chips, plain
committee membership as the quieter outline marker, boats with their berth, and contact per the
member's visibility). A row with nothing behind it shows no caret and never expands. The one search
box and the three browse chips filter client-side (the whole list is in page data at club scale);
a search or chip that narrows the list to three or fewer results auto-expands the matches.
$member-portal/lib/directory.ts already excludes a hidden, archived, or lapsed member and nulls a
partial member's contact. The pure row derivations live in ./directory-view.ts. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';
  import { formatPhone, type DirectoryEntry } from '$member-portal/lib/directory';
  import {
    boatLines,
    boatSummary,
    hasExpansion,
    matchesChip,
    matchesQuery,
    resolveTitles,
    shouldAutoExpand,
    type DirectoryChip,
  } from './directory-view';

  let { data }: { data: PageData } = $props();

  /** The three browse chips, in their resting order. */
  const CHIPS: { id: DirectoryChip; label: string }[] = [
    { id: 'board', label: 'Board & chairs' },
    { id: 'instructors', label: 'Instructors' },
    { id: 'mooring', label: 'On a mooring' },
  ];

  let query = $state('');
  let activeChips = $state(new Set<DirectoryChip>());
  /** Rows the reader has expanded by hand. Auto-expand (a narrow result set) forces a row open on
   *  top of this set; it never writes to it, so clearing the search returns to the hand-set state. */
  let expandedIds = $state(new Set<string>());
  /** Tracks the mobile handoff so the boat summary can abbreviate its model on a narrow screen.
   *  Defaults to the desktop reading on the server; the effect below corrects it once mounted. */
  let narrow = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => (narrow = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  const isFiltering = $derived(query.trim() !== '' || activeChips.size > 0);

  const filteredEntries = $derived.by(() => {
    if (data.entries === null) return [];
    return data.entries.filter(
      (entry) => matchesQuery(entry, query) && [...activeChips].every((chip) => matchesChip(entry, chip)),
    );
  });

  const autoExpand = $derived(shouldAutoExpand(filteredEntries.length, isFiltering));

  function toggleChip(chip: DirectoryChip) {
    const next = new Set(activeChips);
    if (next.has(chip)) next.delete(chip);
    else next.add(chip);
    activeChips = next;
  }

  function toggleRow(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  function isOpen(entry: DirectoryEntry): boolean {
    return hasExpansion(entry) && (autoExpand || expandedIds.has(entry.id));
  }

  /** The compact row's secondary datum: the boat summary when the member owns boats (width-aware),
   *  else the household city. */
  function secondaryOf(entry: DirectoryEntry): string {
    return boatSummary(entry.boats, { abbreviate: narrow }) ?? entry.household.city ?? entry.secondary ?? '';
  }

  /** "Anchorage, AK 99501" from an address's own parts, skipping whatever is missing. */
  function cityStateLine(address: NonNullable<DirectoryEntry['contact']['address']>): string {
    const cityState = [address.city, address.state].filter(Boolean).join(', ');
    return [cityState, address.postalCode].filter(Boolean).join(' ');
  }
</script>

<svelte:head>
  <title>Member Directory — My Account — {siteConfig.siteName}</title>
</svelte:head>

<a href="/my-account" class="portal-back-link">&larr; My account</a>

<h1 class="portal-page-title">Member directory</h1>
<p class="mt-s max-w-measure-wide text-step-0 text-muted">
  Fellow members who've chosen to be listed. Change your own listing, or your household's, from
  <a href="/my-account/profile" class="text-primary underline-offset-2 hover:underline">Profile</a>.
</p>

{#snippet restingMain(entry: DirectoryEntry, titles: ReturnType<typeof resolveTitles>)}
  <span class="dir-main-text">
    <span class="dir-name">{entry.name}</span>
    {#if titles.top}
      <span class="dir-title-chip">
        {titles.top}{#if titles.extra > 0}<span class="dir-title-more">+{titles.extra}</span>{/if}
      </span>
    {/if}
    <span class="dir-secondary">{secondaryOf(entry)}</span>
  </span>
{/snippet}

{#if data.entries === null}
  <p class="mt-l max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">
    The directory isn't available right now. Try again in a few minutes.
  </p>
{:else}
  <div class="directory">
    <div class="dir-search">
      <label for="directory-search" class="portal-field-label">Search</label>
      <input
        id="directory-search"
        type="search"
        class="input mt-2xs w-full"
        placeholder="Name, boat, committee, or title"
        bind:value={query}
      />
    </div>

    <div class="dir-chips" role="group" aria-label="Narrow the directory">
      {#each CHIPS as chip (chip.id)}
        <button
          type="button"
          class="dir-chip-btn"
          class:is-active={activeChips.has(chip.id)}
          aria-pressed={activeChips.has(chip.id)}
          onclick={() => toggleChip(chip.id)}
        >
          {chip.label}
        </button>
      {/each}
    </div>

    <p class="dir-count" aria-live="polite">
      {filteredEntries.length} {filteredEntries.length === 1 ? 'member' : 'members'} shown
    </p>

    {#if data.entries.length === 0}
      <p class="dir-empty">No members are listed in the directory yet.</p>
    {:else if filteredEntries.length === 0}
      <p class="dir-empty">No members match your search.</p>
    {:else}
      <ul class="dir-list" aria-label="Member directory">
        {#each filteredEntries as entry (entry.id)}
          {@const titles = resolveTitles(entry)}
          {@const expandable = hasExpansion(entry)}
          {@const open = isOpen(entry)}
          {@const panelId = `directory-panel-${entry.id}`}
          <li class="dir-entry" class:is-open={open}>
            <div class="dir-row">
              {#if expandable}
                <button
                  type="button"
                  class="dir-row-main"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onclick={() => toggleRow(entry.id)}
                >
                  {@render restingMain(entry, titles)}
                  <svg class="dir-caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              {:else}
                <div class="dir-row-main dir-row-main--static">
                  {@render restingMain(entry, titles)}
                </div>
              {/if}

              {#if entry.contact.phone || entry.contact.email}
                <div class="dir-contact-rest">
                  {#if entry.contact.phone}
                    <a href="tel:{entry.contact.phone}" class="dir-phone-text">{formatPhone(entry.contact.phone)}</a>
                    <a href="tel:{entry.contact.phone}" class="dir-icon-link" aria-label="Call {entry.name}">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                      </svg>
                    </a>
                  {/if}
                  {#if entry.contact.email}
                    <a href="mailto:{entry.contact.email}" class="dir-icon-link" aria-label="Email {entry.name}">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-10 6L2 7" />
                      </svg>
                    </a>
                  {/if}
                </div>
              {/if}
            </div>

            {#if expandable}
              <div id={panelId} class="dir-expanded" hidden={!open}>
                {#if (entry.household.name && entry.household.name !== entry.name) || entry.household.city}
                  <p class="dir-household">
                    {#if entry.household.name && entry.household.name !== entry.name}
                      {entry.household.name} household{entry.household.city ? ` · ${entry.household.city}` : ''}
                    {:else}
                      {entry.household.city}
                    {/if}
                  </p>
                {/if}

                {#if entry.positions.length > 0 || entry.memberships.length > 0}
                  <div class="dir-roles">
                    {#each entry.positions as position (position.title)}
                      <span class="dir-role-chip dir-role-chip--filled">{position.title}</span>
                    {/each}
                    {#each entry.memberships as membership (membership.committeeName)}
                      {#if membership.title}
                        <span class="dir-role-chip dir-role-chip--filled">{membership.title}</span>
                      {:else}
                        <span class="dir-role-chip dir-role-chip--outline">{membership.committeeName}</span>
                      {/if}
                    {/each}
                  </div>
                {/if}

                {#if entry.boats.length > 0}
                  <ul class="dir-boats">
                    {#each boatLines(entry.boats) as line, i (i)}
                      <li class="dir-boat">
                        <span class="dir-boat-name">
                          {#if line.count > 1}{line.count} × {/if}{line.label}
                        </span>
                        {#if line.model}<span class="dir-boat-model">{line.model}</span>{/if}
                        {#if line.keptOn === 'mooring'}<span class="asc-availability-chip dir-mooring-chip">On a mooring</span>{/if}
                      </li>
                    {/each}
                  </ul>
                {/if}

                {#if entry.contact.address || entry.contact.email || entry.contact.phone}
                  <div class="dir-contact-full">
                    {#if entry.contact.address}
                      <p class="dir-address">
                        {#if entry.contact.address.line1}{entry.contact.address.line1}<br />{/if}
                        {#if entry.contact.address.line2}{entry.contact.address.line2}<br />{/if}
                        {cityStateLine(entry.contact.address)}
                      </p>
                    {/if}
                    {#if entry.contact.email}
                      <a href="mailto:{entry.contact.email}" class="dir-contact-link">{entry.contact.email}</a>
                    {/if}
                    {#if entry.contact.phone}
                      <a href="tel:{entry.contact.phone}" class="dir-contact-link">{formatPhone(entry.contact.phone)}</a>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  /* A contained reading measure (round-1 verdict: a directory is a scan-and-read task, so it earns
     a measure that keeps a name and its data on one legible line rather than stranding a short name
     against far-right contact on a 1280px row). The directory carries its own header above; this
     wraps the search, chips, count, and list. */
  .directory {
    max-width: 60rem;
  }

  .dir-search {
    margin-top: var(--spacing-l);
  }

  /* Three navy outline pills: navy fill when active, wrapping on a narrow screen, each clearing the
     44px touch-target floor on mobile (this pass's binding mobile constraint). */
  .dir-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2xs);
    margin-top: var(--spacing-s);
  }
  .dir-chip-btn {
    padding: var(--spacing-3xs) var(--spacing-xs);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-selector);
    background: transparent;
    color: var(--color-primary);
    font-size: var(--text-step--1);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }
  .dir-chip-btn:hover {
    background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  }
  .dir-chip-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .dir-chip-btn:active {
    background: color-mix(in oklab, var(--color-primary) 18%, transparent);
  }
  .dir-chip-btn.is-active {
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .dir-count {
    margin: var(--spacing-s) 0 0;
    font-size: var(--text-step--1);
    color: var(--color-muted);
  }
  .dir-empty {
    margin: var(--spacing-l) 0 0;
    font-size: var(--text-step--1);
    color: var(--color-muted);
  }

  /* A hairline-separated list, no card chrome (round-1 verdict: the de-carded direction the portal
     established). */
  .dir-list {
    list-style: none;
    margin: var(--spacing-s) 0 0;
    padding: 0;
  }
  .dir-entry {
    border-top: 1px solid var(--color-card-border);
  }
  .dir-entry:first-child {
    border-top: none;
  }

  .dir-row {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-s);
  }

  /* The compact resting row is itself the expand/collapse control (when there is anything to
     expand); a row with nothing behind it renders the static variant so no caret ever lies. */
  .dir-row-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--spacing-xs);
    padding: var(--spacing-s) 0;
    background: transparent;
    border: none;
    text-align: start;
    cursor: pointer;
    color: inherit;
  }
  .dir-row-main--static {
    cursor: default;
  }
  .dir-row-main:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
    border-radius: var(--radius-field);
  }

  .dir-main-text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--spacing-2xs);
  }
  .dir-name {
    font-size: var(--text-step-1);
    font-weight: 600;
    color: var(--color-base-content);
  }
  .dir-secondary {
    font-size: var(--text-step--1);
    color: var(--color-muted);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The one filled top-title chip (navy tint) with a quiet "+N" for further titles. */
  .dir-title-chip {
    display: inline-flex;
    align-items: baseline;
    gap: var(--spacing-3xs);
    padding: 0.15rem var(--spacing-2xs);
    border-radius: var(--radius-selector);
    background: color-mix(in oklab, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
    font-size: var(--text-step--1);
    font-weight: 600;
  }
  .dir-title-more {
    font-weight: 500;
    opacity: 0.75;
  }

  .dir-caret {
    flex-shrink: 0;
    align-self: center;
    color: var(--color-muted);
    transition: transform 150ms ease;
  }
  .dir-entry.is-open .dir-caret {
    transform: rotate(180deg);
  }

  /* At rest, a visible member's contact: phone as muted tabular text on desktop, and an email icon.
     The 44px call icon replaces the phone text on mobile (see the media query below). */
  .dir-contact-rest {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-2xs);
  }
  .dir-phone-text {
    font-size: var(--text-step--1);
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
    text-decoration: none;
    text-underline-offset: 2px;
  }
  .dir-phone-text:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .dir-phone-text:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-selector);
  }
  .dir-icon-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-muted);
  }
  .dir-icon-link:hover {
    color: var(--color-primary);
  }
  .dir-icon-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-selector);
  }

  /* The expanded entry: a quiet sage wash, no card chrome. */
  .dir-expanded {
    padding: var(--spacing-xs) 0 var(--spacing-m);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .dir-household {
    margin: 0;
    font-size: var(--text-step--1);
    color: var(--color-muted);
  }

  .dir-roles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2xs);
  }
  .dir-role-chip {
    padding: 0.15rem var(--spacing-2xs);
    border-radius: var(--radius-selector);
    font-size: var(--text-step--1);
    font-weight: 600;
  }
  .dir-role-chip--filled {
    background: color-mix(in oklab, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }
  .dir-role-chip--outline {
    border: 1px solid var(--color-card-border);
    color: var(--color-base-content);
    font-weight: 500;
  }

  .dir-boats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3xs);
  }
  .dir-boat {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--spacing-2xs);
    font-size: var(--text-step--1);
    color: var(--color-base-content);
  }
  .dir-boat-name {
    font-weight: 600;
  }
  .dir-boat-model {
    color: var(--color-muted);
  }
  /* Mooring is a boat attribute marked neutrally, never gold (palette contract). Reuses the shared
     neutral availability chip; the local class only relaxes its uppercase tracking for a berth
     marker read in running text. */
  .dir-mooring-chip {
    text-transform: none;
    letter-spacing: normal;
  }

  .dir-contact-full {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3xs);
    font-size: var(--text-step--1);
  }
  .dir-address {
    margin: 0;
    color: var(--color-base-content);
  }
  .dir-contact-link {
    color: var(--color-primary);
    text-decoration: none;
    text-underline-offset: 2px;
  }
  .dir-contact-link:hover {
    text-decoration: underline;
  }
  .dir-contact-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-selector);
  }

  /* Mobile is its own composition (~640px handoff): the phone becomes a 44px call icon beside the
     44px email icon, both thumb-reachable; the row stacks so a long name and its data never force a
     horizontal scroll. */
  @media (max-width: 640px) {
    .dir-row {
      flex-wrap: wrap;
    }
    .dir-phone-text {
      display: none;
    }
    .dir-contact-rest {
      gap: var(--spacing-xs);
    }
    .dir-icon-link {
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
    .dir-contact-link {
      min-height: 2.75rem;
      display: inline-flex;
      align-items: center;
    }
  }
</style>
