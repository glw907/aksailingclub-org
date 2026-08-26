<!--
@component
The Announce screen's list: recently published posts, newest first, each row linking to its own
announce form (`[id]`). The "Announced" column reads `announcements` (migrations/asc-club/0017)
through the load's own `latestAnnouncementByPost` reduction, so a post that has never been
announced shows a hairline-outline chip rather than an empty cell that could read as a loading
state.

**Ordering (Email + Announce pass, Task 9).** The load's own `orderByPublished` sorts every post
by its manifest `publishedAt` stamp when one exists, falling back to its `date`, BEFORE slicing
to the recent window -- so a backdated `date` next to a genuinely later `publishedAt` still sorts
by when the post actually went live.

**Announced chip pair (Task 9; probe verdict 3).** The chip marks state only (`Announced` quiet,
`Not announced` hairline outline); an announced row keeps the timestamp, email count, and Discord
channel as muted detail text beside the chip. Rides `$theme/admin-chip-registers.css`'s tinted-
ground registers (the assets-register pass's stylesheet), each inside its own marker span.
-->
<script lang="ts">
  import type { PageData } from './$types';
  import { EmptyState, OfficeList, StatusChip, computeCountLine } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatCivilDate, formatClubTimestamp } from '$admin-club/lib/ui';
  // The register re-entry's shared chip stylesheet (assets-register Task 1): a per-page
  // side-effect import, this screen's marker spans below key off it.
  import '$theme/admin-chip-registers.css';

  let { data }: { data: PageData } = $props();

  const subtitle = $derived(data.error ?? `The ${data.posts.length} most recently published posts, newest first.`);

  const countLine = $derived(computeCountLine(data.posts.length, { one: 'post', many: 'posts' }, []));

  /** The muted detail text beside the "Announced" chip: the timestamp plus `email to N` and
   *  `#channel` when either applies. The chip itself now supplies the leading "Announced" word.
   *
   *  **Channel casing (close round item 24).** `#{discordChannel}` renders the raw lowercase
   *  channel id ("#general"), not `ANNOUNCE_CHANNEL_LABEL`'s Title Case display label
   *  ("General") -- the same lowercase form the announce form's own confirmation and
   *  "Already announced" banners already use, so a channel reads identically wherever it
   *  appears on this screen. */
  function announcedDetail(row: PageData['posts'][number]): string {
    if (!row.announced) return '';
    const when = formatClubTimestamp(row.announced.createdAt);
    const parts: string[] = [];
    if (row.announced.emailCount > 0) parts.push(`email to ${row.announced.emailCount}`);
    if (row.announced.discordChannel) parts.push(`#${row.announced.discordChannel}`);
    return parts.length > 0 ? `${when} (${parts.join(', ')})` : when;
  }
</script>

<OfficeList eyebrow="Club" title="Announce" {subtitle}>
  <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body text-muted" role="status" aria-live="polite" aria-atomic="true">
    {countLine}
  </p>
  {#if data.posts.length === 0}
    <EmptyState heading="No published posts yet" message="Once a post publishes, it shows up here to announce." />
  {:else}
    <table class="table announce-table">
      <caption class="sr-only">Recently published posts, newest first</caption>
      <thead>
        <tr>
          <th class="{HEADER_CELL} w-28">Date</th>
          <th class={HEADER_CELL}>Title</th>
          <th class={HEADER_CELL}>Announced</th>
        </tr>
      </thead>
      <tbody>
        {#each data.posts as row (row.id)}
          <tr class="transition-colors hover:bg-base-200/60">
            <td class="whitespace-nowrap type-body tabular-nums text-muted">{formatCivilDate(row.date ?? null, 'Undated')}</td>
            <td>
              <a class="font-semibold hover:text-primary hover:underline" href={`/admin/club/announce/${row.id}`}>
                {row.title}
              </a>
            </td>
            <td class="type-body text-muted">
              {#if row.announced}
                <span class="asc-admin-chip-quiet">
                  <StatusChip tone="neutral" register="quiet" label="Announced" size="xs" />
                </span>
                <span>{announcedDetail(row)}</span>
              {:else}
                <span class="asc-admin-chip-outline">
                  <StatusChip tone="neutral" register="bounded" label="Not announced" size="xs" />
                </span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</OfficeList>

<style>
  /* `/admin/**` renders against the precompiled `cairn-admin.css`; every rule below is either
     plain CSS (a custom-property color, never scanned as a Tailwind utility) or a class already
     verified compiled elsewhere in this route family (assets/+page.svelte's own header explains
     the constraint this file inherits). */

  .announce-table tbody tr:nth-child(even) {
    background-color: var(--color-base-200);
  }

  /* `focus-within:bg-base-200/60` never compiles into the precompiled admin stylesheet (only
     the `hover:` variant of this exact utility does, verified against `cairn-admin.css`), so a
     keyboard user tabbing to the row's own link gets no equivalent to the mouse-hover row tint
     (design-probe's parity rule) without this plain-CSS mirror of the compiled hover rule. */
  .announce-table tbody tr:focus-within {
    background-color: var(--color-base-200);
  }
  @supports (color: color-mix(in lab, red, red)) {
    .announce-table tbody tr:focus-within {
      background-color: color-mix(in oklab, var(--color-base-200) 60%, transparent);
    }
  }
</style>
