<!-- @component
/my-account/renew: the renewal door (T2c of the portal redesign pass, decisions.md's own "the
renewal door" ruling). The masthead's fireweed CTA links here instead of posting a hidden tier
field, so the household sees its current tier and price plainly, and the other tiers at their real
settings prices, before committing to a purchase. Handles every standing shape the masthead can
send it (current-but-in-window, overdue, former, no-membership-on-file) by reading straight off
`standing.statusLine`/`standing.tier`, the same plain-words, no-alarm-color sentence the masthead
itself shows -- no separate per-status copy branches to keep in sync.

The submit button stays NAVY, not fireweed: the redesign's own binding constraint reserves
fireweed for the masthead's renewal-window link alone ("nowhere else, ever"), so the actual
money-committing step here reads the same as every other portal payment action
(`ActionRow.svelte`'s own "money actions on this landing render NAVY" precedent). -->
<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';
  import type { MembershipTier } from '$member-auth/lib/standing';
  import { formatMemberCents } from '$member-auth/lib/format';
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { cubicOut } from 'svelte/easing';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // `load`'s full branch (a real session AND a resolved CLUB_DB binding) sets `standing`,
  // `currentSeason`, `tiers`, and `heldAssets` together; the db-missing branch sets none of them.
  // The generated `PageData` union loses that correlation per field (this repo's own established
  // lesson, see `/my-account/+page.svelte`'s own `isFullPortalData`), so one type predicate
  // re-asserts it here.
  type FullRenewData = PageData & {
    standing: NonNullable<PageData['standing']>;
    currentSeason: NonNullable<PageData['currentSeason']>;
    renewalSeason: NonNullable<PageData['renewalSeason']>;
    tiers: NonNullable<PageData['tiers']>;
    heldAssets: NonNullable<PageData['heldAssets']>;
  };
  function isFullRenewData(d: PageData): d is FullRenewData {
    return d.tiers !== null;
  }

  let selectedTier = $state<MembershipTier>(untrack(() => data.standing?.tier ?? 'individual'));

  /** Tier prices are stored in DOLLARS (`settings.tier_price_*`), while the portal's one
   *  member-facing money formatter takes cents, so the price crosses to cents here rather than
   *  growing a second formatter. The live prices are all whole today (250/500/100), but
   *  `setTierPrice` accepts any number: a bare `dollars.toLocaleString()` would print a $247.50
   *  tier as "$247.5" on the one screen where a member commits to a price. */
  function formatTierPrice(dollars: number): string {
    return formatMemberCents(Math.round(dollars * 100));
  }

  /** The retention control's own request -> requested toggle (owner review, 2026-07-30): the
   *  asset type currently mid-submit, so its control shows a busy label and refuses a second
   *  click while the request is in flight -- the double-click window a review flagged, and the
   *  same "the control flips on server success, not on click" rule `?/retainAsset` itself already
   *  guarantees (it never lies about a write it hasn't made). */
  let submittingAssetType = $state<string | null>(null);

  /** `use:enhance` for one held-asset row's `?/retainAsset` form: keeps the plain POST working
   *  with JavaScript off (SvelteKit's own enhance-degrades-to-plain-submit contract), and with it
   *  on, `update()` re-runs `load` so `asset.alreadyRequested` flips only once the server has
   *  actually recorded the request -- never client-side state that gets ahead of the write. */
  function retainEnhance(assetType: string) {
    submittingAssetType = assetType;
    return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      submittingAssetType = null;
    };
  }

  function reducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** The request/requested crossfade (owner review, 2026-07-30): both states fill
   *  `.retain-control`'s own fixed box absolutely (see the style block), so this only ever
   *  animates opacity and a small vertical drift, never width or layout. Honors
   *  `prefers-reduced-motion` with a zero-duration instant swap, matching `/my-account/sign`'s
   *  own `reducedMotion()` guard. */
  function retainSwap(_node: HTMLElement) {
    if (reducedMotion()) return { duration: 0 };
    return {
      duration: 180,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * 4}px);`,
    };
  }
</script>

<svelte:head>
  <title>Renew · My Account · {siteConfig.siteName}</title>
</svelte:head>

<a href="/my-account" class="portal-back-link">&larr; My account</a>

<h1 class="portal-page-title">Renew your membership</h1>
<p class="mt-s max-w-measure-wide text-step-0 text-muted">
  {data.standing?.statusLine ?? 'No membership on file yet.'}
</p>

{#if !isFullRenewData(data)}
  <p class="mt-s max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">
    This isn't available right now. Please try again shortly.
  </p>
{:else}
  <form method="POST" action="?/renew" class="mt-l max-w-measure-wide">
    <input type="hidden" name="csrf" value={data.csrf} />

    <fieldset class="fieldset">
      <legend class="fieldset-legend portal-field-label">Membership tier</legend>
      <div class="renew-tiers">
        {#each data.tiers as option (option.tier)}
          <label class="renew-tier-row" class:renew-tier-row-selected={selectedTier === option.tier}>
            <input
              type="radio"
              class="radio"
              name="tier"
              value={option.tier}
              checked={selectedTier === option.tier}
              onchange={() => (selectedTier = option.tier)}
            />
            <span class="renew-tier-text">
              <span class="renew-tier-name">
                {option.label}
                {#if data.standing.tier === option.tier}<span class="asc-availability-chip">Current plan</span>{/if}
              </span>
              <span class="renew-tier-price">{formatTierPrice(option.priceDollars)} / season</span>
            </span>
          </label>
        {/each}
      </div>
    </fieldset>

    <button type="submit" class="btn btn-primary mt-m">Renew for {data.renewalSeason} season</button>

    {#if form && 'renewStubbed' in form && form.renewStubbed}
      <p class="mt-xs mb-0 text-step--1 text-base-content">
        Online payment isn't available yet; the club will follow up by email with how to pay.
      </p>
    {/if}
    {#if form && 'error' in form && form.error}
      <p class="mt-xs mb-0 text-step--1 text-error">{form.error}</p>
    {/if}
  </form>

  {#if data.heldAssets.length > 0}
    <!-- The retention step (design spec ruling 3): a household holding gear or moorings today is
         asked, per asset, whether it wants that same asset for {data.renewalSeason} -- a "yes"
         posts `?/retainAsset`; a "no" is simply not clicking, which creates nothing. Reuses
         `/my-account/household`'s own bordered-row list idiom, not a new component. -->
    <section class="mt-l max-w-measure-wide">
      <h2 class="m-0 text-step-1 font-semibold text-base-content">Your gear and moorings</h2>
      <p class="mt-2xs mb-0 text-step--1 text-muted">Request the same asset again for {data.renewalSeason}, or leave it for now.</p>

      {#if form && 'retained' in form && form.retained}
        <p class="mt-xs mb-0 text-step--1 text-base-content">Your request is in. The club will review it and follow up.</p>
      {/if}
      {#if form && 'retainError' in form && form.retainError}
        <p class="mt-xs mb-0 max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">{form.retainError}</p>
      {/if}

      <ul class="mt-xs flex flex-col gap-xs">
        {#each data.heldAssets as asset (asset.assetType)}
          <li class="rounded-box border border-card-border bg-base-100 p-s text-step--1">
            <div class="flex flex-wrap items-center justify-between gap-xs">
              <span class="renew-tier-text">
                <span class="renew-tier-name">{asset.assetTypeName}</span>
                <span class="renew-tier-price">{formatTierPrice(asset.feeDollars)} / season</span>
              </span>

              <!-- The fixed-width control slot (owner review): both states fill this same box
                   absolutely (see `.retain-control` below), so the row never reflows when its
                   state changes, whether that change is the request->requested crossfade or the
                   plain-POST reload a JS-off visit gets instead. -->
              <div class="retain-control">
                {#if asset.alreadyRequested}
                  <span class="retain-action retain-action-done" in:retainSwap out:retainSwap>
                    Requested
                    <span class="sr-only"> {asset.assetTypeName.toLowerCase()} for {data.renewalSeason}</span>
                  </span>
                {:else}
                  <form method="POST" action="?/retainAsset" use:enhance={() => retainEnhance(asset.assetType)} in:retainSwap out:retainSwap>
                    <input type="hidden" name="csrf" value={data.csrf} />
                    <input type="hidden" name="assetType" value={asset.assetType} />
                    <button
                      type="submit"
                      class="btn btn-sm portal-quiet-action portal-touch-btn retain-action"
                      disabled={submittingAssetType === asset.assetType}
                      aria-busy={submittingAssetType === asset.assetType}
                    >
                      {submittingAssetType === asset.assetType ? 'Requesting…' : 'Request'}
                      <span class="sr-only"> {asset.assetTypeName.toLowerCase()} again for {data.renewalSeason}</span>
                    </button>
                  </form>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  /* One bordered row per tier, radio-first (the label's own `for`-less click target is the whole
     row via the wrapping `<label>`): a real 44px+ tap target throughout, since this is a money
     screen and mobile is co-primary. Selection reads through a primary-tinted border and a faint
     wash rather than color alone (a screen reader and a color-blind member both still have the
     radio's own checked state). */
  .renew-tiers {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xs);
  }
  .renew-tier-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    min-height: 2.75rem;
    padding: var(--spacing-s) var(--spacing-m);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-box);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .renew-tier-row:hover {
    border-color: color-mix(in oklab, var(--color-primary) 40%, var(--color-card-border));
  }
  .renew-tier-row-selected {
    border-color: var(--color-primary);
    background: color-mix(in oklab, var(--color-primary) 6%, var(--color-base-100));
  }
  .renew-tier-text {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-2xs) var(--spacing-s);
  }
  .renew-tier-name {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2xs);
    font-weight: 600;
    color: var(--color-base-content);
  }
  .renew-tier-price {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    color: var(--color-muted);
  }

  /* The retention step's own request/requested control (owner review, 2026-07-30): a fixed-size
     slot both states fill absolutely, so swapping between them never changes the slot's own
     width or height -- the earlier button-vanishes-then-a-chip-appears pattern this replaces did
     reflow the row, which is exactly what the review flagged. `height` matches
     `.portal-touch-btn`'s own 44px floor so the control clears the portal's touch-target rule in
     either state. */
  .retain-control {
    position: relative;
    flex-shrink: 0;
    width: 8rem;
    height: 2.75rem;
  }
  .retain-control form {
    position: absolute;
    inset: 0;
  }
  .retain-action {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-3xs);
    border-radius: var(--radius-field);
    font-weight: 600;
  }

  /* The done state (the toggle the owner asked for): a real span, not a button, so it reads as
     inert rather than a second control -- but sized and shaped identically to the `.retain-action`
     button it replaces, plus its own tinted-success chrome, so it reads unmistakably as "sent"
     rather than as the button having quietly gone missing. */
  .retain-action-done {
    position: absolute;
    inset: 0;
    border: 1px solid color-mix(in oklab, var(--color-success) 35%, transparent);
    background: color-mix(in oklab, var(--color-success) 10%, var(--color-base-100));
    color: var(--color-success);
  }
  .retain-action-done::before {
    content: '✓';
  }

  /* Dark mode: a plain `.btn` (`.portal-quiet-action` only touches text color) renders border and
     fill at the same lightness as the asc-dark page ground, an invisible edge (agent memory:
     daisyui-plain-btn-dark-contrast) -- caught here by actually rendering the "Request" button in
     asc-dark, not assumed. Both the system-dark and explicit-toggle paths (matching
     `asc-components.css`'s own established two-selector idiom for this exact gap): the ancestor
     half of each selector is outside this component, so it needs `:global()` the way
     `DonateForm.svelte`'s own dark-mode fix already does. */
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme])) .retain-control form .retain-action {
      border-color: var(--color-card-border);
    }
  }
  :global([data-theme='asc-dark']) .retain-control form .retain-action {
    border-color: var(--color-card-border);
  }
</style>
