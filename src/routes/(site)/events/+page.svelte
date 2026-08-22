<!-- @component
The events-redesign pass (docs/2026-08-22-events-redesign-design.md): one long, anchorable
season page, replacing the prior spine listing. Top to bottom: the light hero (no promise
sentence), the calendar-subscribe bar, the month index, the season bands (one per event or
class, alternating photo side), and the governance coda. The page carries its own full-bleed
marker (`.events-shell`, `site.css`'s `:has()` exception, the same mechanism the home page and
the member portal landing already use) since the alternating bands are the page's whole
composition, not decoration wrapped around prose. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { browser } from '$app/environment';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';
  import EventsSubscribeBar from '$theme/components/EventsSubscribeBar.svelte';
  import EventsIndex from '$theme/components/EventsIndex.svelte';
  import EventBand from '$theme/components/EventBand.svelte';
  import EventsGovernance from '$theme/components/EventsGovernance.svelte';

  let { data }: { data: PageData } = $props();

  /** Every season row, position-indexed, so photo-side alternation and the hairline banding read
   *  across month boundaries exactly as the probe's own flat `.ev-season` list does; only the
   *  first row of each month carries the running head. */
  const bands = $derived(
    data.events.months.flatMap((month) =>
      month.events.map((card, indexInMonth) => ({
        card,
        showMonth: indexInMonth === 0 ? { name: month.name, id: month.id } : undefined,
      })),
    ),
  );

  const hasSeason = $derived(bands.length > 0 || data.events.governance.length > 0);

  // On load, when the URL carries no fragment of its own, land the reader on the next upcoming
  // band instead of the page's top (the design contract's own "opens at the next upcoming
  // event"). `behavior: 'instant'` keeps the first paint and the landing position in agreement;
  // a smooth scroll here would visibly jump after paint instead.
  $effect(() => {
    if (!browser) return;
    if (window.location.hash || !data.events.nextUpcomingId) return;
    document.getElementById(data.events.nextUpcomingId)?.scrollIntoView({ behavior: 'instant' });
  });
</script>

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<div class="events-shell">
  <div class="ev-measure">
    <header class="events-hero not-prose">
      <p class="events-hero-eyebrow">Events</p>
      <h1 class="events-hero-title">The {data.events.seasonYear} Season</h1>
    </header>

    <EventsSubscribeBar
      webcalUrl={data.webcalUrl}
      googleCalendarUrl={data.googleCalendarUrl}
      outlookCalendarUrl={data.outlookCalendarUrl}
      icsUrl={data.icsUrl}
    />

    {#if hasSeason}
      <EventsIndex months={data.events.months} />
    {/if}
  </div>

  {#if hasSeason}
    <div class="ev-season">
      {#each bands as { card, showMonth }, i (card.routeId)}
        <EventBand
          {card}
          flip={i % 2 === 1}
          {showMonth}
          primary={card.routeId === data.events.nextUpcomingId && card.registrationState === 'open' && !card.dropIn}
        />
      {/each}
    </div>
    <EventsGovernance rows={data.events.governance} />
  {:else}
    <div class="ev-measure">
      <p class="ev-empty">The season calendar is quiet for now. Check back soon, or ask in <a href="/discord-server/">#racing or #general</a> on Discord.</p>
    </div>
  {/if}
</div>

<style>
  .events-hero-eyebrow {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    font-size: var(--text-step--1);
    color: var(--color-muted);
  }
  .events-hero-title {
    margin: var(--spacing-2xs) 0 0;
    font-family: var(--font-display);
    font-weight: 650;
    font-style: italic;
    font-size: clamp(2.4rem, 2.1rem + 1.6vw, 3.4rem);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    color: var(--color-base-content);
    text-wrap: balance;
  }
  .events-hero {
    margin-bottom: var(--spacing-m);
  }

  .ev-measure {
    max-width: var(--container-measure-wide);
    margin-inline: auto;
    padding: var(--spacing-l) var(--spacing-m) 0;
  }

  .ev-season {
    margin-top: var(--spacing-l);
  }
  /* The band alternation and the hairline between bands: declared here, not inside EventBand
     itself, since `:nth-child` and an adjacent-sibling combinator across many sibling instances
     of the SAME component would be pruned as an unused selector from that component's own
     template analysis (a looped component cannot give itself a `.foo + .foo` rule). `:global()`
     reaches into the child component's own rendered markup from this parent scope. */
  .ev-season :global(.ev-band:nth-child(odd)) {
    background: var(--color-base-200);
  }
  .ev-season :global(.ev-band:nth-child(odd) + .ev-band:nth-child(even)),
  .ev-season :global(.ev-band:nth-child(even) + .ev-band:nth-child(odd)) {
    border-top: var(--border) solid var(--color-card-border);
  }

  .ev-empty {
    padding-block: var(--spacing-xl);
    color: var(--color-muted);
  }
</style>
