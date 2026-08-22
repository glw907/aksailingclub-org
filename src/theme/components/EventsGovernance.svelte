<!-- @component
The season page's governance coda (docs/2026-08-22-events-redesign-design.md, "The governance
coda"): every `category = 'governance'` row (the Annual Meeting, board and committee meetings),
in a plain three-column hairline table, the same quiet register the member portal's own
committees section already uses. No photos, no bands: this is a reference list, not a season
event. Every row with `category = 'governance'` lands here regardless of its date, so it leaves
the chronology entirely (unlike a past event, which stays in place, quieted). -->
<script lang="ts">
  import type { EventCard } from '$theme/events-data';

  let { rows }: { rows: EventCard[] } = $props();
</script>

<section class="ev-gov" id="meetings" aria-labelledby="h-meetings">
  <div class="ev-gov-inner">
    <h2 class="ev-gov-title" id="h-meetings">Meetings and governance</h2>
    <table class="ev-gov-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Meeting</th>
          <th>Where</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.routeId)}
          <tr id={row.routeId}>
            <td>{row.dateLabel}</td>
            <td><a href="#{row.routeId}">{row.title}</a></td>
            <td>{row.location ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .ev-gov {
    border-top: var(--border) solid var(--color-card-border);
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
  .ev-gov-table td a {
    color: var(--color-base-content);
    font-weight: 600;
    text-decoration: none;
  }
  .ev-gov-table td a:hover {
    text-decoration: underline;
    text-decoration-color: var(--color-star-gold);
    text-underline-offset: 4px;
  }
  .ev-gov-table td a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  @media (max-width: 48rem) {
    .ev-gov-table th:last-child,
    .ev-gov-table td:last-child {
      display: none;
    }
  }
</style>
