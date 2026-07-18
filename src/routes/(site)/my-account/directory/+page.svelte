<!-- @component
/my-account/directory: the members-only directory, one row per listed member
($member-portal/lib/directory.ts already excludes a hidden, archived, or lapsed member; a
`partial` member's row carries no contact line). This is a plain interim rendering of the new
per-member row shape (plan T3); the ratified Compact A compact-expand composition is T4's own
build. The search field filters by name only, entirely client-side: the whole list is already in
`data`, and at the club's scale (roughly 210 members) a client-side filter is plenty. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';
  import { formatPhone } from '$member-portal/lib/directory';

  let { data }: { data: PageData } = $props();

  let query = $state('');

  const filteredEntries = $derived.by(() => {
    if (data.entries === null) return [];
    const needle = query.trim().toLowerCase();
    return data.entries.filter((entry) => entry.name.toLowerCase().includes(needle));
  });
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

{#if data.entries === null}
  <p class="mt-l max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">
    The directory isn't available right now. Try again in a few minutes.
  </p>
{:else}
  <div class="mt-l max-w-measure-wide">
    <label for="directory-search" class="fieldset-legend portal-field-label">Search by name</label>
    <input
      id="directory-search"
      type="search"
      class="input mt-2xs w-full"
      placeholder="Search members"
      bind:value={query}
    />
  </div>

  <p class="mt-xs max-w-measure-wide text-step--1 text-muted" aria-live="polite">
    {filteredEntries.length} {filteredEntries.length === 1 ? 'member' : 'members'} shown
  </p>

  {#if data.entries.length === 0}
    <p class="mt-l max-w-measure-wide text-step--1 text-muted">No members are listed in the directory yet.</p>
  {:else if filteredEntries.length === 0}
    <p class="mt-l max-w-measure-wide text-step--1 text-muted">No members match "{query}".</p>
  {:else}
    <ul class="mt-l flex max-w-measure-wide flex-col gap-s" aria-label="Member directory">
      {#each filteredEntries as entry (entry.id)}
        <li class="rounded-box border border-card-border bg-base-100 p-m">
          <h2 class="m-0 flex flex-wrap items-baseline gap-2xs text-step-0 font-semibold text-base-content">
            <span>{entry.name}</span>
            <span class="text-muted">· {entry.household.name}{entry.household.city ? ` · ${entry.household.city}` : ''}</span>
          </h2>
          {#if entry.positions.length > 0 || entry.memberships.length > 0}
            <p class="m-0 mt-3xs flex flex-wrap gap-2xs text-step--1 text-muted">
              {#each entry.positions as position (position.title)}
                <span class="rounded-field bg-primary/10 px-2xs py-4xs text-primary">{position.title}</span>
              {/each}
              {#each entry.memberships as membership (membership.committeeName)}
                <span class="rounded-field border border-card-border px-2xs py-4xs">{membership.title ?? membership.committeeName}</span>
              {/each}
            </p>
          {/if}
          {#if entry.boats.length > 0}
            <p class="m-0 mt-3xs text-step--1 text-muted">
              {entry.boats.map((boat) => `${boat.name ?? boat.model} (${boat.keptOn})`).join(', ')}
            </p>
          {/if}
          {#if entry.contact.email || entry.contact.phone}
            <p class="m-0 mt-3xs flex flex-wrap items-center gap-2xs text-step--1 text-base-content">
              {#if entry.contact.email}
                <a href="mailto:{entry.contact.email}" class="underline-offset-2 hover:text-primary hover:underline">{entry.contact.email}</a>
              {/if}
              {#if entry.contact.email && entry.contact.phone}<span class="text-muted" aria-hidden="true">·</span>{/if}
              {#if entry.contact.phone}
                <a href="tel:{entry.contact.phone}" class="underline-offset-2 hover:text-primary hover:underline">{formatPhone(entry.contact.phone)}</a>
              {/if}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}
