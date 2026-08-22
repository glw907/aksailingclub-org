<!-- @component
The season page's month index (docs/2026-08-22-events-redesign-design.md, "Page structure",
item 3): one line of in-page links, one per month that carries at least one row plus a trailing
"Meetings" link to the governance coda. NN/g's scrolling-page research is the reason this exists
at all: a page this long needs a visible index of in-page links up top. Never sticky, at any
width. The trailing "Meetings" link renders only when the governance coda it targets does. -->
<script lang="ts">
  import type { MonthGroup } from '$theme/events-data';

  interface Props {
    months: MonthGroup[];
    /** Whether the governance coda renders at all. The "Meetings" link is the one entry here
     *  that does not come from `months`, so it has to be told: the coda stands down when the club
     *  has no governance rows, and a link to a section that is not on the page is a dead jump. */
    hasGovernance: boolean;
  }

  let { months, hasGovernance }: Props = $props();
</script>

<nav class="ev-index" aria-label="Jump to a month">
  {#each months as month (month.id)}
    <a href="#{month.id}">{month.name}</a>
  {/each}
  {#if hasGovernance}<a href="#meetings">Meetings</a>{/if}
</nav>

<style>
  /* One line of in-page links, a step below body; the gold hover mark is the same "waypoint"
     role star-gold carries on the home Season list (CLAUDE.md: gold marks only, never body
     text). Not sticky, at any width (the design contract's own instruction). */
  .ev-index {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem var(--spacing-s);
    margin-top: var(--spacing-m);
    padding: var(--spacing-xs) 0;
    border-top: var(--border) solid var(--color-card-border);
    font-family: var(--font-display);
    font-size: var(--text-step--1);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .ev-index a {
    color: var(--color-primary);
    text-decoration: none;
    padding-bottom: 2px;
    border-bottom: 2px solid transparent;
  }
  .ev-index a:hover {
    border-bottom-color: var(--color-star-gold);
  }
  .ev-index a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
