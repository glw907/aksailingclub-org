<!-- @component
One season band (docs/2026-08-22-events-redesign-design.md, "An event band"): the two-column
photo-and-text grid the home page's Fleet/Facilities sections already use, one per event or
class, alternating photo side down the page. The band's own sage/white alternation and the
hairline between bands are NOT declared here: `:nth-child` and an adjacent-sibling combinator
across many sibling instances of this same component would be pruned as an unused selector from
this component's own template analysis (a looped component cannot give itself a `.foo + .foo`
rule), so that alternation lives in the parent `+page.svelte`'s own `.ev-season` style instead,
reaching in with `:global()`.

Exactly one action renders per band (never two): `Register` (or `Join the waitlist`) for a class
that takes registration and is not past, the fireweed treatment reserved for the one `primary`
band the page names; `Add to calendar` for every other row that is not past, a closed class
included; nothing at all for a past band.

The band is its own anchor target (`id`, `tabindex="-1"`): following a month-index link or a
shared `/events/[id]` link moves focus here, so the next Tab continues from the band the reader
was sent to rather than from the top of the document. -->
<script lang="ts">
  import type { EventCard } from '$theme/events-data';
  import { ICON_PATHS } from '$theme/markdown/icons';

  interface Props {
    card: EventCard;
    /** The band's position down the whole page, across month boundaries: it drives the photo's
     *  own loading priority, nothing else. */
    index: number;
    /** Alternates the photo to the row's right (the home page's own Fleet/Facilities device). */
    flip: boolean;
    /** The one register button the whole page may render in fireweed; every other action stays
     *  navy (CLAUDE.md: fireweed at most twice a page, this page spends it once). */
    primary?: boolean;
    /** The month running head, shown only on the first band of its month; carries the month's
     *  own anchor id for `EventsIndex`'s in-page links. */
    showMonth?: { name: string; id: string };
  }

  let { card, index, flip, primary = false, showMonth }: Props = $props();

  /** How many bands from the top load their photo at full priority. Three covers the landing
   *  band and its neighbours at every viewport; the rest are deprioritized rather than dropped,
   *  since a reader scrolling the season page will reach them. */
  const EAGER_BANDS = 3;

  type Action = 'register' | 'waitlist' | 'calendar' | 'none';

  // The design contract's own action rule: a class with open registration that isn't a drop-in
  // gets Register; waitlisted gets the waitlist link; a past row gets no action at all; every
  // other row, a closed class included, falls back to the per-event .ics download. The
  // registration arms also require a real `registrationUrl`, so a row whose status says open but
  // whose link is missing degrades to the calendar action instead of rendering a dead link.
  const action: Action = $derived.by(() => {
    if (card.isPast) return 'none';
    if (card.dotKind === 'class' && !card.dropIn && card.registrationUrl) {
      if (card.registrationState === 'open') return 'register';
      if (card.registrationState === 'waitlisted') return 'waitlist';
    }
    return 'calendar';
  });

  /** The facts line as one string. Joined here rather than interleaved with per-item separator
   *  spans in the template: a middot between two spans is decoration a screen reader should not
   *  read, and a plain joined string is also what a copy-paste of the line yields. */
  const factsLine: string = $derived.by(() => {
    const list = [card.dateLabel];
    if (card.time) list.push(card.time);
    if (card.location) list.push(card.location);
    if (card.dotKind === 'class') {
      if (card.fee !== undefined) list.push(card.fee === 0 ? 'Free' : `$${card.fee}`);
      list.push(card.track === 'youth' ? 'Ages 8–12' : 'Adults and teens 13+');
    }
    return list.join(' · ');
  });
</script>

<section
  class="ev-band"
  class:is-flip={flip}
  class:is-past={card.isPast}
  class:no-photo={!card.image}
  id={card.routeId}
  tabindex="-1"
>
  <!-- The month's anchor sits on its own zero-height marker at the band's top edge, not on the
       running head inside the text column: the running head sits partway down a band that is
       taller than the viewport at narrow widths, so a month jump that targeted it would land
       mid-band with the band's own photo scrolled off above. -->
  {#if showMonth}<div class="ev-month-anchor" id={showMonth.id}></div>{/if}
  <div class="ev-inner">
    {#if card.image}
      <div class="ev-photo">
        <img
          src={card.image.url}
          alt={card.image.alt}
          data-crop="3/2"
          loading={index < EAGER_BANDS ? 'eager' : 'lazy'}
          fetchpriority={index < EAGER_BANDS ? undefined : 'low'}
        />
      </div>
    {/if}
    <div class="ev-text">
      {#if showMonth}<p class="ev-month">{showMonth.name}</p>{/if}
      <h2 class="ev-title">
        {#if card.dotKind === 'class'}
          <svg class="ev-star" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.6 5.9 21l1.3-6.8-5-4.7 6.8-.8z" />
          </svg>
          <span class="sr-only">Class or clinic: </span>
        {/if}{card.title}
      </h2>
      <p class="ev-facts">{factsLine}{#if card.isPast} · <span class="sr-only">Status: </span>Past{/if}</p>
      {#if card.longHtml}<div class="ev-body">{@html card.longHtml}</div>{/if}
      {#if action === 'register'}
        <a class={primary ? 'ev-cta' : 'ev-link'} href={card.registrationUrl}>Register <span aria-hidden="true">→</span></a>
      {:else if action === 'waitlist'}
        <a class="ev-link" href={card.registrationUrl}>Join the waitlist <span aria-hidden="true">→</span></a>
      {:else if action === 'calendar'}
        <a class="ev-link" href="/events/{encodeURIComponent(card.routeId)}.ics">
          <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['calendar-dots']} /></svg>
          Add to calendar
        </a>
      {/if}
    </div>
  </div>
</section>

<style>
  /* No `scroll-margin-top` here: `site.css` sets `scroll-padding-top` on the scroll container
     itself (the sticky header's own clearance), which covers every anchor target on the site at
     once, this band included. */
  .ev-band:focus-visible {
    /* The band takes focus programmatically when a jump link lands on it (`tabindex="-1"`). The
       ring is drawn inside the band, since a section this wide would otherwise paint its outline
       off the viewport's own edges. */
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
  .ev-month-anchor {
    height: 0;
  }
  .ev-inner {
    max-width: var(--container-measure-wide);
    margin-inline: auto;
    padding: var(--spacing-l) var(--spacing-m);
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-m);
    align-items: center;
  }
  @media (min-width: 48rem) {
    .ev-inner {
      grid-template-columns: 5fr 7fr;
      gap: var(--spacing-l);
    }
    .ev-band.is-flip .ev-inner {
      grid-template-columns: 7fr 5fr;
    }
    .ev-band.is-flip .ev-photo {
      order: 2;
    }
  }
  .ev-photo img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: var(--radius-box);
  }
  .ev-text {
    min-width: 0;
  }
  .ev-month {
    margin: 0 0 var(--spacing-2xs);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-step--1);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--color-muted);
  }
  .ev-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 650;
    font-size: var(--text-step-2);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    color: var(--color-base-content);
    text-wrap: balance;
    display: flex;
    align-items: baseline;
    gap: 0.45em;
  }
  /* The C7 gold-star taxonomy: a class or clinic's own mark, education being the club's mission
     (CLAUDE.md: gold marks only, never body text). The dot variant of the token, not the plain
     one: this mark is the same 8px-scale glyph the home Season list's own dots are, and the
     plain gold reads washed out at that size (theme.css's own derivation comment). */
  .ev-star {
    width: 0.78em;
    height: 0.78em;
    flex: none;
    color: var(--color-star-gold-dot);
    transform: translateY(-0.02em);
  }
  .ev-facts {
    margin: var(--spacing-2xs) 0 0;
    font-size: var(--text-step--1);
    font-weight: 500;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  .ev-body {
    margin-top: var(--spacing-xs);
    font-size: var(--text-step-0);
    line-height: 1.55;
    color: var(--color-base-content);
  }
  .ev-body :global(p) {
    margin: 0;
  }
  .ev-body :global(p + p) {
    margin-top: 0.6em;
  }
  .ev-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: var(--spacing-xs);
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .ev-link svg {
    width: 16px;
    height: 16px;
    opacity: 0.75;
  }

  /* The page's one fireweed control (CLAUDE.md: at most twice a page, spent once here): the
     same solid-tier CTA recipe the home page's own closing-band button uses (a background
     darken on hover/active, never a filter or transform), reused verbatim rather than a second
     independent pick. */
  .ev-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: var(--spacing-xs);
    padding: 0.55rem 1rem;
    font-weight: 600;
    font-size: var(--text-step--1);
    /* The paired content token for the accent ramp `--color-fireweed` sits on, not a literal
       white: the pair re-skins together if the accent ever moves. */
    color: var(--color-accent-content);
    background: var(--color-fireweed);
    border-radius: var(--radius-field);
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .ev-cta:hover {
    background: color-mix(in oklab, var(--color-fireweed), black 8%);
  }
  .ev-cta:active {
    background: color-mix(in oklab, var(--color-fireweed), black 12%);
    transition: none;
  }
  .ev-cta:focus-visible,
  .ev-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* A past band: photo desaturated, title ink stepped down, no action link (the design
     contract's own "quieted" treatment; the ` · Past` fact is real text, not `::after` content,
     so it reads to a screen reader and stays assertable in a render test). */
  .ev-band.is-past .ev-photo img {
    filter: saturate(0.72);
    opacity: 0.85;
  }
  .ev-band.is-past .ev-title {
    color: color-mix(in oklab, var(--color-base-content) 78%, transparent);
  }

  /* A row with no photo takes the text column's own measure, never an empty photo slot. */
  .ev-band.no-photo .ev-inner {
    grid-template-columns: 1fr;
  }
  .ev-band.no-photo .ev-text {
    max-width: var(--container-measure);
  }
</style>
