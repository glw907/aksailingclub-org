<!-- @component
/my-account: the sign-in form when signed out, or the signed-in landing when signed in (the portal
redesign pass, docs/2026-07-16-portal-redesign-design.md: mock D, "C's function in A's body"). The
signed-in composition is the full-bleed member masthead (the standing surface, and the renewal-
window state's own fireweed CTA), the value mirror, a two-column working area (weighted "Needs your
attention" rows / recent receipts against a subordinate reference rail), and the doors row.

The masthead and rail are portal-scoped, licensed one-time components
(`$member-portal/components/`), not sitewide markdown vocabulary. The gear & moorings rail tile is
reference-only: its own verbs (release, request, cancel a request) move to a new `/my-account/gear`
page in a later task (docs/design-benchmark/decisions.md's "the gear door" ruling) and are not
rendered here; this file's own server actions for those verbs are untouched, awaiting that move. -->
<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';
  import { TURNSTILE_SITE_KEY } from '$theme/turnstile';
  import { formatMemberDate } from '$member-auth/lib/format';
  import MemberMasthead from '$member-portal/components/MemberMasthead.svelte';
  import ActionRowCard from '$member-portal/components/ActionRow.svelte';
  import PortalRail from '$member-portal/components/PortalRail.svelte';
  import AllClearMoment from '$member-portal/components/AllClearMoment.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // `load`'s full branch (a real session AND a resolved CLUB_DB binding) sets every field below
  // together, in one `Promise.all` (+page.server.ts's own load); the two early-return branches
  // set none of them. SvelteKit's generated `PageData` flattens the `load` return union into
  // independently-optional fields, losing that correlation, so a plain `data.actionRows !==
  // undefined` check narrows only `actionRows` itself, not its siblings. This type predicate
  // re-asserts the real correlation once, so the template's full-composition branch can read
  // every field directly with no further guards, matching the original template's per-field
  // guard discipline scaled up to a single check.
  type FullPortalData = PageData & {
    householdInfo: NonNullable<PageData['householdInfo']>;
    householdMembers: NonNullable<PageData['householdMembers']>;
    currentSeason: NonNullable<PageData['currentSeason']>;
    assignments: NonNullable<PageData['assignments']>;
    waitlistEntries: NonNullable<PageData['waitlistEntries']>;
    receipts: NonNullable<PageData['receipts']>;
    myClasses: NonNullable<PageData['myClasses']>;
    actionRows: NonNullable<PageData['actionRows']>;
    state: NonNullable<PageData['state']>;
    mirrorSegments: NonNullable<PageData['mirrorSegments']>;
  };
  function isFullPortalData(d: PageData): d is FullPortalData {
    return d.actionRows !== undefined;
  }

  // The masthead's own "Welcome back, {firstName}." (design doc: never the full name).
  const firstName = $derived(data.member?.name.split(' ')[0] ?? '');
  const standingSentence = $derived(data.standing?.statusLine ?? 'No membership on file yet.');

  function formatDollars(dollars: number): string {
    return `$${dollars.toLocaleString('en-US')}`;
  }
</script>

<svelte:head>
  <title>My Account — {siteConfig.siteName}</title>
</svelte:head>

{#snippet renewCta()}
  <form method="POST" action="?/renew" class="mt-m flex flex-col items-start gap-xs">
    <input type="hidden" name="csrf" value={data.csrf} />
    <input type="hidden" name="tier" value={data.standing?.tier ?? 'individual'} />
    <button type="submit" class="asc-cta-btn">Renew for {data.currentSeason} season</button>
  </form>
  {#if form && 'renewStubbed' in form && form.renewStubbed}
    <p class="mt-xs mb-0 text-step--1 text-base-content">
      Online payment isn't available yet; the club will follow up by email with how to pay.
    </p>
  {/if}
  {#if form && 'error' in form && form.error}
    <p class="mt-xs mb-0 text-step--1 text-error">{form.error}</p>
  {/if}
{/snippet}

{#if !data.member}
  <h1 class="m-0 font-display text-step-4 font-semibold leading-tight tracking-tight text-base-content">
    Member sign-in
  </h1>
  <p class="mt-s max-w-measure-wide text-step-0 text-muted">
    Enter the email address the club has on file and we'll send you a sign-in link. No password to
    remember.
  </p>

  {#if form && 'sent' in form && form.sent}
    <div class="mt-l max-w-measure-wide rounded-box border border-success bg-success/10 p-m">
      <p class="m-0 font-semibold text-base-content">Check your inbox.</p>
      <p class="mt-xs mb-0 text-step--1 text-base-content">
        If that address is on file with the club, a sign-in link is on its way. It expires in 15
        minutes.
      </p>
    </div>
  {:else}
    {#if form && 'error' in form && form.error}
      <p class="mt-s max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">
        {form.error}
      </p>
    {/if}
    <form method="POST" action="?/requestLink" class="signin-form mt-l flex flex-col gap-m">
      <input type="hidden" name="csrf" value={data.csrf} />
      <fieldset class="fieldset">
        <legend class="fieldset-legend portal-field-label">Email address</legend>
        <input class="input w-full" type="email" name="email" autocomplete="email" required />
      </fieldset>
      <div class="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY}></div>
      <button type="submit" class="btn btn-primary">Email me a sign-in link</button>
    </form>

    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

    <p class="mt-l max-w-measure-wide text-step--1 text-muted">
      Wrong or old email on file? <a href="/contact" class="text-primary">Contact us</a> and we'll fix
      it.
    </p>
  {/if}
{:else if !isFullPortalData(data)}
  <h1 class="m-0 font-display text-step-4 font-semibold leading-tight tracking-tight text-base-content">
    Hi, {data.member.name}
  </h1>
  <p class="mt-s max-w-measure-wide text-step-0 text-muted">
    We're having trouble loading your account right now. Please try again shortly.
  </p>
  <form method="POST" action="?/signOut" class="mt-l">
    <button type="submit" class="btn btn-sm portal-quiet-action">Sign out</button>
  </form>
{:else}
  <div class="portal-shell">
    <MemberMasthead
      {firstName}
      {standingSentence}
      seasonLabel={`${data.currentSeason} Season`}
      cta={data.state.kind === 'renewal-window' ? renewCta : undefined}
    />

    <div class="portal-body">
      <div class="portal-frame">
        {#if data.mirrorSegments.length > 0}
          <p class="portal-mirror">This season: {data.mirrorSegments.join(' · ')}</p>
        {/if}

        <div class="portal-work">
          <main>
            <h2 class="portal-h2">Needs your attention</h2>
            {#if data.actionRows.length > 0}
              <div class="portal-action-rows">
                {#each data.actionRows as row (row.id)}
                  <ActionRowCard {row} csrf={data.csrf} />
                {/each}
              </div>
            {:else}
              <AllClearMoment anticipationOpensOn={data.state.kind === 'off-season' ? data.state.classRegistrationOpens : null} />
            {/if}

            {#if data.receipts.length > 0}
              <h2 class="portal-h2 portal-h2-spaced">Recent receipts</h2>
              {#each data.receipts as receipt (receipt.id)}
                <div class="portal-receipt-row">
                  <span class="portal-receipt-desc">{receipt.what}</span>
                  <span class="portal-receipt-date">{formatMemberDate(receipt.date)}</span>
                  <span class="portal-receipt-amount">{formatDollars(receipt.amountCents / 100)}</span>
                </div>
              {/each}
            {/if}
          </main>

          <aside>
            <PortalRail
              householdName={data.householdInfo?.name ?? ''}
              householdMemberCount={data.householdMembers.filter((m) => m.archivedAt === null).length}
              assignments={data.assignments}
              waitlistEntries={data.waitlistEntries}
              myClasses={data.myClasses}
            />
          </aside>
        </div>

        <footer class="portal-doors">
          <a href="/my-account/profile">Profile</a>
          <a href="/my-account/household">Household</a>
          <a href="/my-account/gear">Gear</a>
          <a href="/my-account/classes">Classes</a>
          <a href="/my-account/directory">Directory</a>
          <a href="/discord-server">Discord</a>
          <a href="/events">Events</a>
        </footer>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-measure-wide px-m pb-l">
    <form method="POST" action="?/signOut">
      <button type="submit" class="btn btn-sm portal-quiet-action">Sign out</button>
    </form>
  </div>
{/if}

<style>
  /* The sign-in form used the page's own wide reading measure (`max-w-measure-wide`, ~640px+),
     so the fixed-width Turnstile widget (~300px) and the content-sized button sat well short of
     the full-width email input's own right edge, a ragged
     column. A narrower shared measure, matching the Turnstile widget's own natural width, plus
     dropping the button's `self-start` (so it stretches like every other child in this `flex-col`
     stack) brings all three controls' right edges into line. */
  .signin-form {
    max-width: 300px;
  }

  /* The working area's own vertical rhythm and 1280px desktop-width boxing (mock D's own
     `.mockD-body`/`.frame-wide`, portal-directions.html L572-593): deliberately WIDER than the
     masthead's own `--container-measure-wide` inner content (MemberMasthead.svelte's own comment
     explains why) -- Geoff's own steer that the desktop mock uses real desktop width, not the
     shared prose measure. `.portal-shell` itself is the `site.css` `:has()` rule's own full-bleed
     marker (a direct child of `.site-main`), so this block's own horizontal padding is the ONLY
     gutter between its content and the viewport edge, replacing the padding `.site-main` no
     longer supplies once the marker cancels it. */
  .portal-body {
    padding: var(--spacing-l) var(--spacing-l) 0;
  }
  @media (max-width: 700px) {
    .portal-body {
      padding: var(--spacing-m);
    }
  }
  .portal-frame {
    width: min(1280px, 100%);
    margin-inline: auto;
  }

  .portal-mirror {
    margin: 0 0 var(--spacing-l);
    font-size: var(--text-step--1);
    color: var(--color-muted);
  }

  .portal-work {
    display: grid;
    grid-template-columns: 1fr 22rem;
    gap: var(--spacing-l);
    padding-bottom: var(--spacing-l);
    align-items: start;
  }
  @media (max-width: 700px) {
    .portal-work {
      grid-template-columns: 1fr;
    }
  }

  /* The gap between stacked action rows lives here, not as a `+` adjacent-sibling rule inside
     ActionRow.svelte itself: each row is its own component instance, and svelte-check's scoped-CSS
     analysis flags a same-component adjacent-sibling selector as unused when the only sibling
     comes from a parent-level `{#each}`, even though it would match correctly at runtime. */
  .portal-action-rows {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .portal-h2 {
    margin: 0 0 var(--spacing-s);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-step-2);
    line-height: var(--leading-snug);
    color: var(--color-harbor-ink);
  }
  .portal-h2-spaced {
    margin-top: var(--spacing-l);
  }

  /* Flat, quiet receipt rows (mock D's own `.receipt-row`, portal-directions.html L317-339):
     tabular amounts, a fixed-width right column so every dollar figure lines up. */
  .portal-receipt-row {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-s);
    padding: var(--spacing-2xs) 0;
    border-top: 1px solid var(--color-card-border);
    font-size: var(--text-step--1);
  }
  .portal-receipt-row:first-of-type {
    border-top: none;
  }
  .portal-receipt-desc {
    flex: 1 1 auto;
    color: var(--color-harbor-ink);
  }
  .portal-receipt-date {
    flex-shrink: 0;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  .portal-receipt-amount {
    flex-shrink: 0;
    width: 4ch;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-harbor-ink);
  }

  /* The doors row (mock D's own `.doors-row`, portal-directions.html L363-384): the site's real
     en-dash list marker (site.css L203-217), turned sideways into a wrapping horizontal row. */
  .portal-doors {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2xs) var(--spacing-m);
    padding: var(--spacing-m) 0;
    border-top: 1px solid var(--color-card-border);
    font-size: var(--text-step--1);
  }
  .portal-doors a {
    position: relative;
    padding-left: 1.1em;
    color: var(--color-primary);
    text-decoration: none;
  }
  .portal-doors a::before {
    content: '\2013';
    position: absolute;
    left: 0;
    color: color-mix(in oklab, var(--color-muted) 67%, var(--color-harbor-ink) 33%);
  }
  .portal-doors a:hover {
    text-decoration: underline;
  }
  .portal-doors a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
