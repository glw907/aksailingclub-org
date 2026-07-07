<!-- @component
/admin/club/asset-requests: the request review inbox, the signup queue's own pattern (list/
list-row + the destructive-confirm dialog for Deny). approveNew/approveRetention split by the
request's own kind — a 'new' request gets one Approve button (assign-or-queue, no dialog, the
acknowledging no-op); a 'retention' request's Approve opens the pay task instead of assigning
outright (the merit gate), so its own button reads "Approve (opens pay task)". -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { CsrfField, OfficeList } from '@glw907/cairn-cms/components';
  import { HEADER_CELL, formatClubTimestamp } from '$admin-club/lib/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let dialogs: Record<string, HTMLDialogElement> = {};

  const subtitle = $derived(
    data.requests.length === 0 ? 'Nothing pending.' : `${data.requests.length} ${data.requests.length === 1 ? 'request' : 'requests'} awaiting a decision.`,
  );
</script>

<div class="stats stats-vertical lg:stats-horizontal mb-6 w-full rounded-box border border-[var(--cairn-card-border)] bg-base-100 shadow-[var(--cairn-shadow)]">
  <div class="stat">
    <div class={HEADER_CELL}>Pending</div>
    <div class="stat-value text-xl text-warning">{data.requests.length}</div>
    <div class="stat-desc">Asset requests</div>
  </div>
</div>

<OfficeList eyebrow="Club" title="Asset requests" {subtitle}>
  {#if form?.error}
    <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 text-sm font-medium text-error" role="alert">{form.error}</p>
  {/if}
  <ul class="list">
    {#each data.requests as row (row.id)}
      <li class="list-row items-start">
        <div class="list-col-grow">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold">{row.assetTypeName}</span>
            <span class="text-sm text-muted">&middot; {row.householdName}</span>
            <span class="badge badge-ghost badge-sm font-medium">{row.kind === 'retention' ? 'Retention' : 'New'}</span>
          </div>
          <p class="mt-1 text-sm text-muted">Requested by {row.requesterName} &middot; {formatClubTimestamp(row.createdAt)}</p>
          {#if row.note}<p class="mt-1 text-sm text-muted">"{row.note}"</p>{/if}
          {#if row.priorHolding}<p class="mt-1.5 text-xs font-medium text-base-content">{row.priorHolding}</p>{/if}
        </div>

        {#if row.kind === 'new'}
          <form method="post" action="?/approveNew">
            <input type="hidden" name="id" value={row.id} />
            <CsrfField />
            <div class="join">
              <button type="submit" class="btn btn-sm join-item">Approve</button>
              <button type="button" class="btn btn-sm btn-ghost join-item" onclick={() => dialogs[row.id]?.showModal()}>Deny</button>
            </div>
          </form>
        {:else}
          <form method="post" action="?/approveRetention">
            <input type="hidden" name="id" value={row.id} />
            <CsrfField />
            <div class="join">
              <button type="submit" class="btn btn-sm join-item">Approve (opens pay task &mdash; ${row.fee})</button>
              <button type="button" class="btn btn-sm btn-ghost join-item" onclick={() => dialogs[row.id]?.showModal()}>Deny</button>
            </div>
          </form>
        {/if}

        <dialog bind:this={dialogs[row.id]} class="modal" oncancel={(event) => event.preventDefault()}>
          <div class="modal-box">
            <h2 class="text-lg font-bold">Deny {row.householdName}'s request</h2>
            <p class="py-2 text-sm text-muted">This clears the case from the queue; letting the household know is a manual step today.</p>
            <form method="dialog">
              <input type="hidden" name="id" value={row.id} />
              <CsrfField />
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Reason</legend>
                <textarea name="reason" class="textarea w-full" rows="3" required placeholder="Why this was denied"></textarea>
              </fieldset>
              <div class="modal-action">
                <!-- svelte-ignore a11y_autofocus -->
                <button type="submit" class="btn" autofocus formnovalidate>Cancel</button>
                <button type="submit" class="btn btn-error" formmethod="post" formaction="?/deny">Deny request</button>
              </div>
            </form>
          </div>
        </dialog>
      </li>
    {:else}
      <li class="list-row">
        <p class="w-full py-4 text-center text-sm text-muted">Nothing pending right now.</p>
      </li>
    {/each}
  </ul>
</OfficeList>
