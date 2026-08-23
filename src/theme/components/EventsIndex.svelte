<!-- @component
The season page's month index (docs/2026-08-22-events-redesign-design.md, "Page structure",
item 3): probe 4's ratified tab row, one per month that carries at least one row plus a trailing
"Meetings" link to the governance coda, attached to the season's own hairline as the header
block's closing bar. NN/g's scrolling-page research is the reason this exists at all: a page
this long needs a visible index of in-page links up top. Never sticky, at any width. The
trailing "Meetings" link renders only when the governance coda it targets does. -->
<script lang="ts">
  import type { MonthGroup } from '$theme/events-data';

  interface Props {
    months: MonthGroup[];
    /** Whether the governance coda renders at all. The "Meetings" link is the one entry here
     *  that does not come from `months`, so it has to be told: the coda stands down when the club
     *  has no governance rows, and a link to a section that is not on the page is a dead jump. */
    hasGovernance: boolean;
    /** The month holding the next-upcoming band, marked as the tab row's current stop: the gold
     *  underline and `aria-current="true"`. Undefined when every dated row is past. */
    currentMonthId?: string;
  }

  let { months, hasGovernance, currentMonthId }: Props = $props();
</script>

<nav class="ev-index" aria-label="Jump to a month">
  {#each months as month (month.id)}
    <a
      href="#{month.id}"
      class:is-current={month.id === currentMonthId}
      aria-current={month.id === currentMonthId ? 'true' : undefined}>{month.name}</a
    >
  {/each}
  {#if hasGovernance}<a href="#meetings">Meetings</a>{/if}
</nav>

<style>
  /* Probe 4/7: the index as the header block's own tab row, its bottom border the hairline the
     first season band sits against. Body size in the display face, navy, the current month on
     the gold active-nav underline; never sticky, at any width (the design contract's own
     instruction). */
  .ev-index {
    display: flex;
    flex-wrap: wrap;
    row-gap: var(--spacing-2xs);
    column-gap: var(--spacing-m);
    margin-top: var(--spacing-m);
    padding: 0;
    border-bottom: var(--border) solid var(--color-card-border);
    font-family: var(--font-display);
    font-size: var(--text-step-0);
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .ev-index a {
    color: var(--color-primary);
    text-decoration: none;
    padding: var(--spacing-xs) 0 var(--spacing-2xs);
    margin-bottom: -1px;
    border-bottom: 3px solid transparent;
  }
  .ev-index a:hover {
    border-bottom-color: color-mix(in oklab, var(--color-star-gold) 55%, transparent);
  }
  .ev-index a.is-current {
    border-bottom-color: var(--color-star-gold);
    color: var(--color-base-content);
  }
  .ev-index a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
