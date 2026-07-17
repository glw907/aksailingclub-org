<!-- @component
The member portal landing's own page signature (the portal redesign design doc's own "the member
masthead," docs/design-benchmark/portal-mock-d/portal-directions.html lines 1034-1043): the
full-bleed sage band carrying the eyebrow, the "Welcome back" greeting, the standing sentence, the
season chip, and (only in the renewal-window state) the page's one fireweed action. Portal-scoped
and licensed one-time by the design doc ("not sitewide vocabulary"), so its own furniture (eyebrow,
chip) is reproduced here rather than reached for from a shared registry.

The band's full-bleed background relies entirely on its caller: `site.css`'s
`.site-main:has(> .portal-shell)` rule cancels `.site-main`'s own max-width/margin/padding for the
whole signed-in landing, so this component's own `<section>` background can span the true viewport
width. Only `.member-masthead-inner` reads at the site's own container measure (mock D's own
`.mockA-band-inner`, ported verbatim), matching every other band's inner-content convention. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    firstName,
    standingSentence,
    seasonLabel,
    cta,
  }: {
    firstName: string;
    standingSentence: string;
    seasonLabel: string;
    /** The renewal-window state's own "Renew for {season}" form, rendered only in that one state
     *  (the design doc's "the only fireweed on the page, ever"); omitted entirely otherwise. */
    cta?: Snippet;
  } = $props();
</script>

<section class="member-masthead" id="renew">
  <div class="member-masthead-inner">
    <p class="member-masthead-eyebrow">Member Home</p>
    <h1 class="member-masthead-greeting">Welcome back, {firstName}.</h1>
    <p class="member-masthead-standing">{standingSentence}</p>
    <span class="member-masthead-chip">{seasonLabel}</span>
    {#if cta}
      <div class="member-masthead-cta">{@render cta()}</div>
    {/if}
  </div>
</section>

<style>
  /* Ported from mock D's own `.mockA-band` (portal-directions.html L389-392): the lightest sage
     tint, generous vertical padding, no horizontal padding of its own (the inner content carries
     that, so the band's colored ground still bleeds to the true viewport edge). */
  .member-masthead {
    background: var(--color-sage);
    padding: var(--spacing-2xl) var(--spacing-l);
  }
  @media (max-width: 700px) {
    .member-masthead {
      padding: var(--spacing-l) var(--spacing-m);
    }
  }

  /* `--container-measure-wide`, not the wider 1280px the working area below reads at (mock D's own
     asymmetry, ported deliberately: the masthead reuses mock A's plain band-inner measure, while
     the working area gets Geoff's own wider desktop-width steer, see +page.svelte's own comment). */
  .member-masthead-inner {
    max-width: var(--container-measure-wide);
    margin: 0 auto;
  }

  /* Eyebrow register, reproduced from asc-components.css's `.asc-related-eyebrow` recipe (that
     class is `.prose`-scoped, unreachable from this bespoke, non-prose band). */
  .member-masthead-eyebrow {
    margin: 0 0 var(--spacing-2xs);
    font-size: var(--text-step--2);
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .member-masthead-greeting {
    margin: 0 0 var(--spacing-2xs);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-step-5);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    color: var(--color-harbor-ink);
  }

  .member-masthead-standing {
    margin: 0 0 var(--spacing-s);
    font-size: var(--text-step-1);
    color: var(--color-muted);
  }

  /* Reproduced from asc-components.css's `.asc-availability-chip` recipe: deliberately uncolored
     (no semantic-palette token), an outline chip in muted ink. */
  .member-masthead-chip {
    display: inline-block;
    flex-shrink: 0;
    padding: 0.1rem 0.5rem;
    border: 1px solid color-mix(in oklab, var(--color-muted) 35%, transparent);
    border-radius: var(--radius-selector);
    background: transparent;
    color: var(--color-muted);
    font-size: var(--text-step--2);
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .member-masthead-cta {
    margin-top: var(--spacing-m);
  }
</style>
