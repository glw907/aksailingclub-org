<!--
@component
The Club section's Assets screen: the by-asset and by-person lenses ops proved, re-expressed as
two views over the SAME active-assignment read (`listActiveAssignments`, never a separate query
per lens), plus the single polymorphic waitlist queue with type chips. Assignment CRUD (assign /
release / record a payment, including an offline check or cash payment), waitlist CRUD (add /
remove / move-to-end / promote the head), and the asset-type editor (name / fee / capacity, id
immutable) all post through this route's own `+page.server.ts` actions.

Every row in every view (assignment, held-asset, waitlist entry) shares one composition, a plain
flex row inside a `<ul>` rather than a `<table>`: an identity block on the left, a chips-plus-verbs
block on the right, wrapping onto its own line below the identity block once the two no longer fit
one line (`.holding-row`'s own `flex-wrap`). A `<table>` cannot do this -- a table's own columns
stay fixed width and either force the row's action buttons past the card's edge or crowd them
against the identity text with no reflow, which is exactly the 390px-width defect this rebuild
replaces. `/admin/club/asset-requests`'s own `<ul class="list">` review-inbox rows are the nearest
sibling precedent for leaving `<table>` behind on a small, ungated result set; this file writes its
own flex rows rather than daisyUI's `.list`/`.list-row` grid component because that component's
column count is driven by nth-child position of a `.list-col-grow` marker, which is a poor fit for
a row carrying a variable number of trailing actions (Record payment appears only when a payment
is outstanding-eligible, waitlist rows carry two actions, assignment rows carry two different
ones) -- the plain flex-wrap row reflows correctly regardless of how many trailing controls a given
row happens to carry.

Waitlist promotion is reachable from two places, deliberately not a third: the by-asset view's own
type header (whenever that type currently carries any waitlist entries, independent of any release)
and the release-confirm dialog (when the assignment being released belongs to a type that currently
has a queue, so freeing the slot and filling it from the queue are one visit). Both post the same
`?/waitlistPromote` action and never touch capacity, matching the store's own promotion contract.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { ActionData, PageData } from './$types';
  import { CsrfField, OfficeList } from '@glw907/cairn-cms/components';
  import { FieldLabel, SelectField, TextField } from '@glw907/cairn-cms/admin-fields';
  import { StatusChip, type StatusChipTone } from '@glw907/cairn-cms/admin-toolkit';
  import { formatCivilDate, formatDollars } from '$admin-club/lib/ui';
  import {
    PAYMENT_METHODS,
    type AssetPaymentStanding,
    type AssetTypeRow,
    type AssetWaitlistDisplayRow,
    type AssignmentDisplayRow,
    type PaymentMethod,
  } from '$admin-club/lib/assets-store';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type View = 'by-asset' | 'by-person' | 'waitlist';
  let view = $state<View>('by-asset');

  const VIEW_TABS: { id: View; label: string }[] = [
    { id: 'by-asset', label: 'By asset' },
    { id: 'by-person', label: 'By person' },
    { id: 'waitlist', label: 'Waitlist' },
  ];

  // The same tone vocabulary the Members screen's own holdings panel uses for this identical
  // `AssetPaymentStanding` derivation (`households-store.ts`'s shared type), so a payment standing
  // reads identically wherever an admin encounters it rather than drifting screen to screen.
  const HOLDING_STATUS: Record<AssetPaymentStanding, { label: string; tone: StatusChipTone }> = {
    paid: { label: 'Paid', tone: 'success' },
    outstanding: { label: 'Outstanding', tone: 'warning' },
    'not-billed': { label: 'Not billed', tone: 'neutral' },
  };

  const METHOD_LABEL: Record<PaymentMethod, string> = { card: 'Card', check: 'Check', cash: 'Cash' };

  const byAssetGroups = $derived(
    data.assetTypes.map((type) => ({ type, rows: data.assignments.filter((a) => a.assetType === type.id) })),
  );

  const byPersonGroups = $derived.by(() => {
    const map = new Map<string, { householdId: string; householdName: string; primaryMemberName: string | null; rows: AssignmentDisplayRow[] }>();
    for (const row of data.assignments) {
      if (!map.has(row.householdId)) {
        map.set(row.householdId, { householdId: row.householdId, householdName: row.householdName, primaryMemberName: row.primaryMemberName, rows: [] });
      }
      map.get(row.householdId)!.rows.push(row);
    }
    return [...map.values()].sort((a, b) => a.householdName.localeCompare(b.householdName));
  });

  const feeByType = $derived(new Map(data.assetTypes.map((t) => [t.id, t.fee])));

  // The waitlist's own head-of-queue lens, grouped client-side from the one already-loaded read
  // (`data.waitlist` arrives ordered by type then position, so each group's first entry is that
  // type's head): both promotion entry points below key off this map rather than issuing a second
  // query for "does this type have a queue right now."
  const waitlistByType = $derived.by(() => {
    const map = new Map<string, AssetWaitlistDisplayRow[]>();
    for (const entry of data.waitlist) {
      if (!map.has(entry.assetType)) map.set(entry.assetType, []);
      map.get(entry.assetType)!.push(entry);
    }
    return map;
  });

  // -- assign form --
  const assetTypeOptions = $derived(data.assetTypes.map((t) => ({ value: t.id, label: `${t.name} (${formatDollars(t.fee)})` })));
  let assignAssetType = $state(untrack(() => data.assetTypes[0]?.id ?? ''));
  let householdQuery = $state('');
  let assignMembershipId = $state('');
  let assignDescription = $state('');
  const filteredMemberships = $derived(
    data.membershipOptions.filter((m) => {
      const q = householdQuery.trim().toLowerCase();
      if (!q) return true;
      return m.householdName.toLowerCase().includes(q) || (m.primaryMemberName ?? '').toLowerCase().includes(q);
    }),
  );
  // The already-picked household stays in the option list even once a later keystroke narrows it
  // out of `filteredMemberships`: otherwise a native <select> silently falls back to whatever
  // option happens to render first the instant its own bound value is no longer among its
  // children, swapping the assign form's target household without the editor noticing.
  const membershipOptions = $derived.by(() => {
    const base = filteredMemberships;
    const picked = data.membershipOptions.find((m) => m.membershipId === assignMembershipId);
    const list = picked && !base.includes(picked) ? [picked, ...base] : base;
    return list.map((m) => ({
      value: m.membershipId,
      label: m.primaryMemberName ? `${m.householdName} (${m.primaryMemberName})` : m.householdName,
    }));
  });

  // -- release confirm dialog --
  let releaseDialog: HTMLDialogElement | undefined = $state();
  let releaseTargetId = $state('');
  let releaseTargetLabel = $state('');
  let releaseTargetType = $state('');
  let releaseTargetTypeName = $state('');
  function openReleaseDialog(row: AssignmentDisplayRow) {
    releaseTargetId = row.id;
    releaseTargetLabel = `${row.assetTypeName} — ${row.householdName}`;
    releaseTargetType = row.assetType;
    releaseTargetTypeName = row.assetTypeName;
    releaseDialog?.showModal();
  }
  // The queue for the type being released, read live off `waitlistByType` rather than captured at
  // open time: an admin who leaves the dialog open across an unrelated waitlist change still sees
  // the current head, and this same derivation drives the by-asset header's own promote control.
  const releaseTargetWaitlist = $derived(waitlistByType.get(releaseTargetType) ?? []);

  // -- edit asset type dialog --
  let editTypeDialog: HTMLDialogElement | undefined = $state();
  let editTypeId = $state('');
  let editTypeDialogTitle = $state('');
  let editTypeName = $state('');
  let editTypeFee = $state('');
  let editTypeCapacity = $state('');
  function openEditTypeDialog(type: AssetTypeRow) {
    editTypeId = type.id;
    editTypeDialogTitle = type.name;
    editTypeName = type.name;
    editTypeFee = String(type.fee);
    editTypeCapacity = type.capacity != null ? String(type.capacity) : '';
    editTypeDialog?.showModal();
  }

  // -- record payment dialog --
  let paymentDialog: HTMLDialogElement | undefined = $state();
  let paymentTargetId = $state('');
  let paymentTargetLabel = $state('');
  let paymentAmount = $state('');
  let paymentMethod = $state<PaymentMethod>('card');
  let paymentReference = $state('');
  function openPaymentDialog(row: AssignmentDisplayRow) {
    paymentTargetId = row.id;
    paymentTargetLabel = `${row.assetTypeName} — ${row.householdName}`;
    paymentAmount = String(feeByType.get(row.assetType) ?? '');
    paymentMethod = 'card';
    paymentReference = '';
    paymentDialog?.showModal();
  }
  const paymentMethodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));

  // -- waitlist add form --
  let waitlistAssetType = $state(untrack(() => data.assetTypes[0]?.id ?? ''));
  let memberQuery = $state('');
  let waitlistMemberId = $state('');
  let waitlistNotes = $state('');
  const filteredMembers = $derived(
    data.memberOptions.filter((m) => {
      const q = memberQuery.trim().toLowerCase();
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q) || m.householdName.toLowerCase().includes(q);
    }),
  );
  // Same already-picked-stays-selectable fix `membershipOptions` documents, for the waitlist
  // form's member picker.
  const memberSelectOptions = $derived.by(() => {
    const base = filteredMembers;
    const picked = data.memberOptions.find((m) => m.memberId === waitlistMemberId);
    const list = picked && !base.includes(picked) ? [picked, ...base] : base;
    return list.map((m) => ({ value: m.memberId, label: `${m.name} (${m.householdName})` }));
  });

  const subtitle = $derived(
    data.error ? data.error : `${data.assignments.length} active assignment(s) across ${data.assetTypes.length} asset type(s).`,
  );
</script>

<OfficeList eyebrow="Club" title="Assets" {subtitle}>
  {#snippet action()}
    <div class="join" role="tablist" aria-label="Assets view">
      {#each VIEW_TABS as tab (tab.id)}
        <button
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          class="join-item btn btn-sm {view === tab.id ? 'btn-primary' : ''}"
          onclick={() => (view = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  {/snippet}

  {#if form?.error}
    <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">
      {form.error}
    </p>
  {/if}

  {#if view === 'by-asset'}
    {#each byAssetGroups as group (group.type.id)}
      <div class="border-b border-[var(--cairn-card-border)] p-6">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="type-body font-semibold">
            {group.type.name}
            <span class="count-qualifier font-normal text-muted">
              {group.rows.length}{group.type.capacity != null ? `/${group.type.capacity}` : ''} assigned &middot; {formatDollars(group.type.fee)}
            </span>
          </h2>
          <div class="flex items-center gap-2">
            {#if (waitlistByType.get(group.type.id)?.length ?? 0) > 0}
              {@const queue = waitlistByType.get(group.type.id)!}
              <form method="post" action="?/waitlistPromote" class="flex items-center gap-2">
                <CsrfField />
                <input type="hidden" name="assetType" value={group.type.id} />
                <span class="type-meta text-muted">
                  {queue.length} waiting &middot; next: {queue[0].memberName}
                </span>
                <button type="submit" class="btn btn-ghost btn-xs" aria-label={`Promote the next household waiting for ${group.type.name}`}>
                  Promote
                </button>
              </form>
            {/if}
            <button type="button" class="btn btn-ghost btn-xs" onclick={() => openEditTypeDialog(group.type)} aria-label={`Edit ${group.type.name}`}>
              Edit
            </button>
          </div>
        </div>
        <ul class="holding-list">
          {#each group.rows as row (row.id)}
            {@const standing = HOLDING_STATUS[row.paymentStanding]}
            <li class="holding-row">
              <div class="min-w-0">
                <p class="type-body font-medium">
                  {row.householdName}
                  {#if row.primaryMemberName}<span class="text-muted"> &middot; {row.primaryMemberName}</span>{/if}
                </p>
                {#if row.description}<p class="type-meta text-muted">{row.description}</p>{/if}
              </div>
              <div class="holding-row-actions">
                <StatusChip tone={standing.tone} label={standing.label} size="xs" />
                <button type="button" class="btn btn-ghost btn-xs" onclick={() => openPaymentDialog(row)}>Record payment</button>
                <button type="button" class="btn btn-ghost btn-xs text-error" onclick={() => openReleaseDialog(row)}>Release</button>
              </div>
            </li>
          {:else}
            <li class="py-6 text-center type-body text-muted">No one holds this asset right now.</li>
          {/each}
        </ul>
      </div>
    {/each}

    <form method="post" action="?/assign" class="p-6">
      <h2 class="mb-3 type-body font-semibold">Assign an asset</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <SelectField label="Asset type" name="assetType" bind:value={assignAssetType} options={assetTypeOptions} />
        <TextField label="Search household" name="householdQuery" type="search" placeholder="Name" bind:value={householdQuery} />
        <SelectField label="Household" name="membershipId" bind:value={assignMembershipId} options={membershipOptions} />
        <TextField label="Description" name="description" placeholder="Buoy M-14" bind:value={assignDescription} />
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <CsrfField />
        <button type="submit" class="btn btn-primary btn-sm">Assign</button>
      </div>
    </form>
  {:else if view === 'by-person'}
    {#each byPersonGroups as group (group.householdId)}
      <div class="border-b border-[var(--cairn-card-border)] p-6">
        <h2 class="mb-3 type-body font-semibold">
          {group.householdName}
          {#if group.primaryMemberName}<span class="count-qualifier font-normal text-muted">{group.primaryMemberName}</span>{/if}
        </h2>
        <ul class="holding-list">
          {#each group.rows as row (row.id)}
            {@const standing = HOLDING_STATUS[row.paymentStanding]}
            <li class="holding-row">
              <div class="min-w-0">
                <p class="type-body font-medium">{row.assetTypeName}</p>
                {#if row.description}<p class="type-meta text-muted">{row.description}</p>{/if}
              </div>
              <div class="holding-row-actions">
                <StatusChip tone={standing.tone} label={standing.label} size="xs" />
                <button type="button" class="btn btn-ghost btn-xs" onclick={() => openPaymentDialog(row)}>Record payment</button>
                <button type="button" class="btn btn-ghost btn-xs text-error" onclick={() => openReleaseDialog(row)}>Release</button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <p class="px-6 py-10 text-center type-body text-muted">No household holds an asset right now.</p>
    {/each}
  {:else}
    <div class="p-6">
      <ul class="holding-list">
        {#each data.waitlist as entry (entry.id)}
          <li class="holding-row">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge badge-sm badge-neutral font-medium">{entry.assetTypeName}</span>
                <span class="type-meta tabular-nums text-muted">#{entry.position}</span>
              </div>
              <p class="mt-1 type-body font-medium">
                {entry.memberName}
                {#if entry.memberEmail}<span class="text-muted"> &middot; {entry.memberEmail}</span>{/if}
              </p>
              <p class="type-meta text-muted">Requested {formatCivilDate(entry.requestedAt)}</p>
            </div>
            <div class="holding-row-actions">
              <form method="post" action="?/waitlistMoveToEnd">
                <CsrfField />
                <input type="hidden" name="waitlistId" value={entry.id} />
                <button type="submit" class="btn btn-ghost btn-xs">Move to end</button>
              </form>
              <form method="post" action="?/waitlistRemove">
                <CsrfField />
                <input type="hidden" name="waitlistId" value={entry.id} />
                <button type="submit" class="btn btn-ghost btn-xs text-error">Remove</button>
              </form>
            </div>
          </li>
        {:else}
          <li class="py-10 text-center type-body text-muted">No one is waiting for an asset right now.</li>
        {/each}
      </ul>
    </div>

    <form method="post" action="?/waitlistAdd" class="border-t border-[var(--cairn-card-border)] p-6">
      <h2 class="mb-3 type-body font-semibold">Add to the waitlist</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <SelectField label="Asset type" name="assetType" bind:value={waitlistAssetType} options={assetTypeOptions} />
        <TextField label="Search member" name="memberQuery" type="search" placeholder="Name or email" bind:value={memberQuery} />
        <SelectField label="Member" name="memberId" bind:value={waitlistMemberId} options={memberSelectOptions} />
        <TextField label="Notes" name="notes" bind:value={waitlistNotes} />
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <CsrfField />
        <button type="submit" class="btn btn-primary btn-sm">Add to waitlist</button>
      </div>
    </form>
  {/if}
</OfficeList>

<dialog bind:this={releaseDialog} class="modal" oncancel={(event) => event.preventDefault()}>
  <div class="modal-box">
    <h2 class="type-heading font-bold">Release {releaseTargetLabel}?</h2>
    <p class="py-2 type-body text-muted">The asset returns to the pool. This does not remove its payment history.</p>
    <form method="dialog">
      <CsrfField />
      {#if releaseTargetWaitlist.length > 0}
        <div class="mt-3 flex items-center justify-between gap-3 rounded-box border border-[var(--cairn-card-border)] bg-base-200/60 px-3 py-2">
          <p class="type-body">
            <span class="font-medium">{releaseTargetWaitlist.length}</span> waiting for {releaseTargetTypeName}
            &middot; next up <span class="font-medium">{releaseTargetWaitlist[0].memberName}</span>
          </p>
          <button type="submit" class="btn btn-sm" formmethod="post" formaction="?/waitlistPromote" name="assetType" value={releaseTargetType}>
            Promote next
          </button>
        </div>
      {/if}
      <div class="modal-action">
        <!-- svelte-ignore a11y_autofocus -->
        <button type="submit" class="btn" autofocus formnovalidate>Cancel</button>
        <button type="submit" class="btn btn-error" formmethod="post" formaction="?/release" name="assignmentId" value={releaseTargetId}>
          Release
        </button>
      </div>
    </form>
  </div>
</dialog>

<dialog bind:this={paymentDialog} class="modal">
  <div class="modal-box">
    <h2 class="type-heading font-bold">Record a payment</h2>
    <p class="py-2 type-body text-muted">{paymentTargetLabel}</p>
    <form method="post" action="?/recordPayment" class="flex flex-col gap-3">
      <CsrfField />
      <input type="hidden" name="assignmentId" value={paymentTargetId} />
      <FieldLabel label="Amount (USD)">
        <input class="input input-sm" type="number" min="1" step="1" name="amount" bind:value={paymentAmount} />
      </FieldLabel>
      <SelectField label="Method" name="method" bind:value={paymentMethod} options={paymentMethodOptions} />
      <TextField label="Reference" name="reference" placeholder="Check #1234" bind:value={paymentReference} />
      <div class="modal-action">
        <button type="button" class="btn btn-sm" onclick={() => paymentDialog?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Record payment</button>
      </div>
    </form>
  </div>
</dialog>

<dialog bind:this={editTypeDialog} class="modal" aria-labelledby="edit-type-dialog-title">
  <div class="modal-box">
    <h2 id="edit-type-dialog-title" class="type-heading font-bold">Edit {editTypeDialogTitle}</h2>
    <form method="post" action="?/editType" class="flex flex-col gap-3">
      <CsrfField />
      <input type="hidden" name="id" value={editTypeId} />
      <TextField label="Name" name="name" bind:value={editTypeName} />
      <FieldLabel label="Fee (USD)">
        <input class="input input-sm" type="number" min="0" step="1" name="fee" bind:value={editTypeFee} />
      </FieldLabel>
      <FieldLabel label="Capacity">
        <input class="input input-sm" type="number" min="1" step="1" name="capacity" placeholder="No limit" bind:value={editTypeCapacity} />
      </FieldLabel>
      <p class="type-meta text-muted">Leave capacity blank for no limit.</p>
      <div class="modal-action">
        <button type="button" class="btn btn-sm" onclick={() => editTypeDialog?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
      </div>
    </form>
  </div>
</dialog>

<style>
  /* `/admin/**` renders against the precompiled `cairn-admin.css`, so a utility cairn's own admin
     never uses does not exist here (`.claude/skills/cairn-admin-screens/references/README.md`'s
     own warning about this file's exemplars, and `src/admin-club/toolkit/README.md`'s "compiled-CSS
     constraint"). Every rule below is either a named token-driven role this screen owns outright
     (`.count-qualifier`) or the row composition that replaces the three raw `<table>` elements this
     rebuild retires: `divide-y`, `divide-[...]`, and the `first:pt-0`/`last:pb-0` pair the toolkit's
     own annotated exemplars quote are, verified against this project's own built stylesheet,
     UNCOMPILED here (`npx cairn-audit` flags all four already, in the sibling admin-club screens
     that reach for them) -- so the divider and edge-padding trim below are written by hand instead. */
  .count-qualifier {
    margin-left: var(--cairn-gap-label);
  }

  .holding-list {
    display: flex;
    flex-direction: column;
    /* `.holding-row`'s own `display: flex` already suppresses its `<li>` marker box (a flex
       display value carries no `::marker`), but the empty-state `<li>` in each view keeps the
       UA default `display: list-item` (it needs no flex layout of its own), which would
       otherwise draw a bare bullet with no compiled `list-style: none` reset to stop it --
       Tailwind's Preflight reset lives in this site's OWN build, never in the precompiled
       `cairn-admin.css` this route renders against (see this file's own top-of-style-block
       comment). */
    list-style: none;
  }

  /* The row every view (by-asset, by-person, waitlist) shares: an identity block on the left, a
     chips-plus-verbs block on the right (`.holding-row-actions`), the same two-part register
     `exemplar-detail.md` states for a detail screen's own related-data rows. `flex-wrap` is what a
     `<table>` cannot do -- once the two blocks no longer fit one line, the actions block drops to
     its own full-width line below the identity block instead of forcing the row past the card's
     edge, which is the 390px defect this rebuild replaces. */
  .holding-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--cairn-gap-group);
    padding-block: var(--cairn-gap-group);
  }

  .holding-row:not(:first-child) {
    border-top: 1px solid var(--cairn-card-border);
  }

  .holding-row:first-child {
    padding-top: 0;
  }

  .holding-row:last-child {
    padding-bottom: 0;
  }

  .holding-row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cairn-gap-control);
  }
</style>
