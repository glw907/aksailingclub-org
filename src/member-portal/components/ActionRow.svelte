<!-- @component
One weighted "Needs your attention" row (mock D lines 1051-1062): an icon, a title, an optional
dollar amount, and the row's own real action button. Portal-scoped and licensed one-time, per the
design doc. `row.formAction` may point at a route other than this page's own (a live class-waitlist
offer's claim door lives under `/my-account/classes`); SvelteKit form actions resolve by URL path,
so an explicit cross-route action string works the same as this page's own `?/payAssetFee`. Money
actions on this landing render NAVY (`.btn.btn-primary`, which this theme's own tokens already
resolve to flag navy, not fireweed), per the design doc's own "fireweed is NOT spent on the routine
landing" ruling -- the masthead's renewal CTA is the page's one exception. -->
<script lang="ts">
  import type { ActionRow } from '$member-portal/lib/action-rows';

  let { row, csrf }: { row: ActionRow; csrf: string } = $props();

  function formatDollars(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US')}`;
  }
</script>

<div class="portal-action-row">
  <span class="portal-action-icon" aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
      <circle cx="10" cy="10" r="8.2" />
      <line x1="10" y1="6" x2="10" y2="11.2" stroke-linecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  </span>
  <span class="portal-action-title">{row.title}</span>
  {#if row.amountCents !== null}
    <span class="portal-action-amount">{formatDollars(row.amountCents)}</span>
  {/if}
  <form method="POST" action={row.formAction}>
    <input type="hidden" name="csrf" value={csrf} />
    <input type="hidden" name={row.fieldName} value={row.fieldValue} />
    <button type="submit" class="btn btn-primary btn-sm">{row.actionLabel}</button>
  </form>
</div>

<style>
  /* Ported from mock D's own `.action-row` (portal-directions.html L285-314): a hairline card with
     a 3px navy left edge, the one colored-affordance zone in the main column. */
  .portal-action-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    background: var(--color-base-100);
    border: 1px solid var(--color-card-border);
    border-left: 3px solid var(--color-primary);
    border-radius: var(--radius-box);
    padding: var(--spacing-s) var(--spacing-m);
  }
  .portal-action-icon {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-primary);
  }
  .portal-action-icon svg {
    width: 1.35rem;
    height: 1.35rem;
  }
  .portal-action-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--text-step-0);
    font-weight: 600;
    color: var(--color-harbor-ink);
  }
  .portal-action-amount {
    flex-shrink: 0;
    font-size: var(--text-step-0);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-harbor-ink);
  }
</style>
