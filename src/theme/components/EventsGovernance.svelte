<!-- @component
The season page's governance coda (docs/2026-08-22-events-redesign-design.md, "The governance
coda"): every `category = 'governance'` row (the Annual Meeting, board and committee meetings),
in a plain three-column hairline table, the same quiet register the member portal's own
committees section already uses. No photos, no bands: this is a reference list, not a season
event. Every row with `category = 'governance'` lands here regardless of its date, so it leaves
the chronology entirely (unlike a past event, which stays in place, quieted). A row's own `note`
(its `short_description`) prints under the meeting name in a muted, smaller line, when the row
carries one.

Below 48rem the "Where" column stands down and each row's location prints as a muted line under
the meeting name instead. The place a meeting is held is the second thing a reader needs after
its date, so the narrow layout restacks it rather than dropping it: the markup carries both
placements and CSS shows exactly one, since a table cell cannot reflow under its own row.

Renders nothing at all when the club has no governance rows: an empty table with three headings
would read as a broken page rather than an honest absence. -->
<script lang="ts">
  import type { EventCard } from '$theme/events-data';

  let { rows }: { rows: EventCard[] } = $props();
</script>

{#if rows.length > 0}
  <section class="ev-gov" id="meetings" aria-labelledby="h-meetings" tabindex="-1">
    <div class="ev-gov-inner">
      <h2 class="ev-gov-title" id="h-meetings">Meetings and governance</h2>
      <table class="ev-gov-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Meeting</th>
            <th class="ev-gov-where" scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.routeId)}
            <tr id={row.routeId} tabindex="-1">
              <td>{row.dateLabel}</td>
              <td>
                {row.title}
                {#if row.note}<span class="ev-gov-note">{row.note}</span>{/if}
                {#if row.location}<span class="ev-gov-stacked-where">{row.location}</span>{/if}
              </td>
              <td class="ev-gov-where">{row.location ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  .ev-gov {
    border-top: var(--border) solid var(--color-card-border);
  }
  /* The coda takes focus when the month index's "Meetings" link lands on it (`tabindex="-1"`),
     with the ring drawn inside, since a full-bleed section would otherwise paint its outline off
     the viewport's edges. A row does the same for a shared `/events/[id]` link. */
  .ev-gov:focus-visible,
  .ev-gov-table tr:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
  .ev-gov-inner {
    max-width: var(--container-measure-wide);
    margin-inline: auto;
    padding: var(--spacing-xl) var(--spacing-m);
  }
  .ev-gov-title {
    margin: 0 0 var(--spacing-s);
    font-family: var(--font-display);
    font-weight: 650;
    font-size: var(--text-step-2);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
  }
  .ev-gov-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-step-0);
  }
  .ev-gov-table th {
    text-align: left;
    font-family: var(--font-display);
    font-size: var(--text-step--1);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--color-muted);
    padding: 0 var(--spacing-s) var(--spacing-3xs) 0;
    border-bottom: var(--border) solid var(--color-card-border);
  }
  .ev-gov-table td {
    padding: var(--spacing-xs) var(--spacing-s) var(--spacing-xs) 0;
    border-bottom: var(--border) solid var(--color-card-border);
    vertical-align: top;
  }
  .ev-gov-table td:first-child {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
    font-weight: 500;
  }
  .ev-gov-table td:nth-child(2) {
    font-weight: 600;
  }
  .ev-gov-note,
  .ev-gov-stacked-where {
    display: block;
    font-size: var(--text-step--1);
    font-weight: 400;
    color: var(--color-muted);
    margin-top: 0.15em;
  }
  /* Exactly one of the two location placements shows at any width; the data is in the markup at
     every width either way. 47.999rem, not 48rem: the two queries would both match at exactly
     768px and show the location twice. */
  @media (max-width: 47.999rem) {
    .ev-gov-where {
      display: none;
    }
  }
  @media (min-width: 48rem) {
    .ev-gov-stacked-where {
      display: none;
    }
  }
</style>
