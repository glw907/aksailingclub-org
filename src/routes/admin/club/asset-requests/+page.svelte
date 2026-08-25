<!-- @component
/admin/club/asset-requests: the request review inbox. Every pending row shows the asset type, the
household, its kind ('new' vs 'retention'), the requester and timestamp, an optional note, and a
plain-words prior-holding line when the household has held this type before -- the evidence a
reviewer needs beside the decision, all read off `listPendingAssetRequests`
(`$member-portal/lib/assets`). A 'new' request's Approve assigns straight into a free slot or
queues onto the waitlist (no dialog, an acknowledging no-op either way); a 'retention' request's
Approve opens the pay task instead of assigning outright (the merit gate), so its own button names
the fee. Deny is shared across both kinds and requires a reason, matching every other admin
review queue's convention (`committees/+page.svelte`'s own approve/decline pair).

Rebuilt from the pre-Assets-substrate draft: dropped the separate `stats` band restating the same
pending count the header's own subtitle already states (two elements naming one fact is the
assembled tell this pass exists to remove, and its `stats-vertical`/`text-warning` classes were
already dead, never compiling into `cairn-admin.css`); the count line itself now runs through
`itemNoun` rather than a hand-rolled singular/plural ternary. The zero-pending state -- production's
own state today -- is the toolkit's `EmptyState` rather than an ad hoc `<li>`: this screen has no
filtering, so its only empty state is ever the whole-concept one `EmptyState` is built for, never a
filtered-to-zero case. Each row's Approve/Deny trigger carries a visually-hidden per-row name
(distinct-accessible-names finding from the Assets substrate pass): the same three or four words
render on every pending row, so a screen reader's own "list of buttons" view needs the household and
asset type to tell them apart, the same way the Renewal screen's per-row controls do. The Deny
dialog no longer blocks `Escape`: every sibling confirm dialog on this admin (`committees/+page.svelte`'s
edit dialogs included) closes on it, and this one diverging read as an inconsistency with no
documented reason, not a deliberate house rule.

**Register re-entry (`docs/2026-08-24-assets-register-design.md`, Task 3).** The New/Retention
kind badge moves off the hand-rolled `badge cairn-chip-quiet` span onto `StatusChip`, wrapped in
the shared `$theme/admin-chip-registers.css` quiet register, matching the Assets screen's own
Task 2 re-entry. Pending rows alternate the events ledger's own stripe once more than one request
is waiting. `AdminRequestRow` carries no raw free-text description of its own (`priorHolding` is
a fully composed sentence, never a stored description substring), so `displayDescription` has
nothing to wire on this screen today; it is consumed instead by the Assets screen and the
member-detail household desk (see that helper's own header comment).

`.asset-request-row` overrides daisyUI's own `.list-row` grid below `sm` (the grader-prompt read
this rebuild ran caught it): that component's default two-column grid gives its SECOND column the
`1fr` growth track and its first only `minmax(0, auto)`, so a wide retention button ("Approve (opens
pay task -- $150)") pushed the content column toward its own zero-width minimum on a 390px capture,
and `word-break: break-word` let the asset type name wrap one character per line instead of
overflowing where `viewport-overflow` would have caught it. Below `sm` the row now stacks into a
single column (content, then the action form, full width each); at `sm` and up it returns to the
original two-column arrangement with the content column now explicitly the one that grows. This is
the unlayered-scoped-style-beats-any-`@layer`-rule idiom this admin already uses elsewhere: a plain
Svelte `<style>` rule targeting the same class needs no `!important` and no specificity fight
against daisyUI's own `@layer`-wrapped declaration. -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import { EmptyState, OfficeList, StatusChip, itemNoun } from '@glw907/cairn-cms/admin-toolkit';
  import { formatClubTimestamp, formatDollars } from '$admin-club/lib/ui';
  // The register re-entry's shared chip stylesheet (assets-register Task 1), following the
  // Assets screen's own per-page side-effect import (Task 2).
  import '$theme/admin-chip-registers.css';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let dialogs: Record<string, HTMLDialogElement> = {};

  const subtitle = $derived(`${itemNoun(data.requests.length, { one: 'request', many: 'requests' })} awaiting a decision.`);
</script>

<OfficeList eyebrow="Club" title="Asset requests" {subtitle}>
  {#if form?.error}
    <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">{form.error}</p>
  {/if}

  {#if data.requests.length === 0}
    <EmptyState
      heading="Nothing pending"
      message="A member's new or retention asset request lands here for review, with any prior holding history beside it."
    />
  {:else}
    <ul class="list asset-request-list">
      {#each data.requests as row (row.id)}
        <li class="list-row asset-request-row">
          <div>
            <div class="asset-request-identity">
              <span class="font-semibold">{row.assetTypeName}</span>
              <span class="type-body text-muted ml-2">&middot; {row.householdName}</span>
              <span class="ml-2">
                <span class="asc-admin-chip-quiet">
                  <StatusChip tone="neutral" register="quiet" label={row.kind === 'retention' ? 'Retention' : 'New'} size="xs" />
                </span>
              </span>
            </div>
            <p class="mt-1 type-body text-muted">Requested by {row.requesterName} &middot; {formatClubTimestamp(row.createdAt)}</p>
            {#if row.note}<p class="mt-1 type-body text-muted">"{row.note}"</p>{/if}
            {#if row.priorHolding}<p class="mt-1.5 type-meta text-muted">{row.priorHolding}</p>{/if}
          </div>

          <form method="post" action={row.kind === 'new' ? '?/approveNew' : '?/approveRetention'}>
            <input type="hidden" name="id" value={row.id} />
            <CsrfField />
            <div class="join">
              <button type="submit" class="btn btn-sm join-item">
                {#if row.kind === 'new'}
                  Approve<span class="sr-only"> {row.assetTypeName} for {row.householdName}</span>
                {:else}
                  Approve (opens pay task &mdash; {formatDollars(row.fee)})<span class="sr-only"> for {row.householdName}</span>
                {/if}
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost join-item"
                onclick={() => dialogs[row.id]?.showModal()}
              >
                Deny<span class="sr-only"> {row.assetTypeName} request for {row.householdName}</span>
              </button>
            </div>
          </form>

          <dialog bind:this={dialogs[row.id]} class="asset-request-dialog modal" aria-labelledby={`deny-dialog-title-${row.id}`}>
            <div class="modal-box">
              <h2 id={`deny-dialog-title-${row.id}`} class="type-heading font-bold">Deny {row.householdName}'s request</h2>
              <p class="py-2 type-body text-muted">This clears the case from the queue. The household automatically receives the reason below by email.</p>
              <form method="dialog">
                <input type="hidden" name="id" value={row.id} />
                <CsrfField />
                <fieldset class="fieldset deny-reason-fieldset">
                  <legend class="fieldset-legend">Reason</legend>
                  <textarea name="reason" class="textarea deny-reason-textarea w-full" rows="3" required placeholder="Why this was denied"></textarea>
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
      {/each}
    </ul>
  {/if}
</OfficeList>

<style>
  /* Below `sm`, a single column: content, then the action form, each full width. Overriding
     daisyUI's own `.list-row` grid (`--list-grid-cols`) rather than fighting it -- see the
     @component comment above for why the default two-column grid breaks at this width. */
  .asset-request-row {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-flow: row;
    align-items: start;
  }

  /* daisyUI pins every `.list-row` child to `grid-row-start: 1` unconditionally (its own
     single-row-of-columns contract), which fights the stacked layout above by forcing an
     implicit second column into existence for whichever child can't fit in row 1's one
     explicit column. Releasing that pin below `sm` is what actually makes the stack real. */
  .asset-request-row > div,
  .asset-request-row > form {
    grid-row-start: auto;
  }

  @media (min-width: 40rem) {
    .asset-request-row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-auto-flow: column;
    }

    .asset-request-row > div,
    .asset-request-row > form {
      grid-row-start: 1;
    }
  }

  /* Alternating stripes, the events ledger's own `table-zebra` register re-expressed for this
     screen's `<ul>`/`<li>` rows, matching the Assets screen's own Task 2 re-entry
     (`assets/+page.svelte`'s `.holding-row:nth-child(even)`). No inline margin bleed is needed
     here the way that page needs one: `.list-row`'s own compiled padding is the row's whole box,
     with no padded ancestor between the `<ul>` and `OfficeList`'s card shell for the stripe to
     bleed past. */
  .asset-request-row:nth-child(even) {
    background-color: var(--color-base-200);
  }

  /* Neither this admin's build nor the browser's own UA styles reset a bare `<ul>`'s
     bullet-reserved indent, so `.list` keeps the browser default 40px `padding-inline-start`
     even though no bullet ever renders (the row's own `list-row` padding already carries the
     card's inner margin). That reads as a wide empty left gutter pushing every row's content
     to the right while the right edge runs out normally. */
  .asset-request-list {
    padding-inline-start: 0;
  }

  /* Subject (asset type) and the kind chip stay in normal inline text flow rather than a
     `flex flex-wrap` row: a flex row wraps whichever child doesn't fit as one rigid unit, which
     at 390px stranded the kind chip alone below the household name for a short subject, and
     dropped the whole "-- household" span to its own line (leading with the bare separator) for
     a long one -- two different orphaned shapes from the same mechanism. Plain inline flow lets
     the browser reflow at any word boundary instead, the same wrapping every other line in this
     card already gets for free. */
  .asset-request-identity {
    display: block;
  }

  /* Neither the browser's own `fieldset`/`textarea` defaults nor this admin's packaged CSS
     resets them: Chromium's UA stylesheet sets `textarea { font-family: monospace; resize: both }`
     and `fieldset { border: 2px groove ... }` unconditionally, so both render with no author
     styling at all -- the Reason field was the only unstyled native control in this dialog. */
  .deny-reason-fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }

  .deny-reason-textarea {
    font-family: inherit;
    resize: vertical;
  }

  /* Same missing reset, one level up. Chromium's UA stylesheet sets `dialog { border: solid }`,
     which resolves to 3px of `currentColor`, and a modal `<dialog>` sizes itself to the whole
     viewport, so the border paints a hard near-black rectangle around the entire screen whenever
     this dialog opens. Measured at 3px solid oklch(0.26 0.014 75) on a 1440x900 box. Neither
     daisyUI's `.modal` nor the packaged admin stylesheet clears it. */
  .asset-request-dialog {
    border: none;
  }
</style>
