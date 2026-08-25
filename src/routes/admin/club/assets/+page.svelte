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
a row carrying its own kind of trailing actions (an assignment row always carries Record payment
and Release, regardless of payment standing; a waitlist row always carries a different two, Move
to end and Remove) -- the plain flex-wrap row reflows correctly regardless of how many trailing
controls a given row happens to carry.

Waitlist promotion is reachable from two places, deliberately not a third: the by-asset view's own
type header (whenever that type currently carries any waitlist entries, independent of any release)
and the release-confirm dialog (when the assignment being released belongs to a type that currently
has a queue, so freeing the slot and filling it from the queue are one visit). Both post the same
`?/waitlistPromote` action and never touch capacity, matching the store's own promotion contract.

**Register re-entry (`docs/2026-08-24-assets-register-design.md`, Task 2).** Every payment-standing
chip and the waitlist type chip now render through `StatusChip`, wrapped in the shared
`$theme/admin-chip-registers.css` tinted-ground registers (Paid quiet, Outstanding warning, Not
billed the hairline outline). Each by-asset type group is an explicit disclosure, default open, no
collapse persisted across a reload: the toggle is a real `<button>` (not `<summary>`, which cannot
also host the Promote form and Edit button its own header carries without breaking the
interactive-content model). The Assign form and the waitlist-add form both moved off the bottom of
their own view into top-anchored `<dialog>` elements, launched from a quiet button in that view's
own list header, matching this file's existing release/payment/edit-type dialog idiom.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData, PageData } from './$types';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import {
    EmptyState,
    FieldLabel,
    OfficeList,
    SelectInput,
    StatusChip,
    TextInput,
    type StatusChipRegister,
    type StatusChipTone,
  } from '@glw907/cairn-cms/admin-toolkit';
  import { displayDescription } from '$admin-club/lib/assets-format';
  import { formatCivilDate, formatDollars } from '$admin-club/lib/ui';
  import {
    PAYMENT_METHODS,
    type AssetPaymentStanding,
    type AssetTypeRow,
    type AssetWaitlistDisplayRow,
    type AssignmentDisplayRow,
    type PaymentMethod,
  } from '$admin-club/lib/assets-store';
  // The register re-entry's shared chip stylesheet (assets-register Task 1): a per-page
  // side-effect import, this screen's the FIRST consumer (see that file's own header comment).
  import '$theme/admin-chip-registers.css';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const uid = $props.id();

  type View = 'by-asset' | 'by-person' | 'waitlist';
  let view = $state<View>('by-asset');

  const VIEW_TABS: { id: View; label: string }[] = [
    { id: 'by-asset', label: 'By asset' },
    { id: 'by-person', label: 'By person' },
    { id: 'waitlist', label: 'Waitlist' },
  ];

  // The same tone vocabulary the Members screen's own holdings panel uses for this identical
  // `AssetPaymentStanding` derivation (`households-store.ts`'s shared type), so a payment standing
  // reads identically wherever an admin encounters it rather than drifting screen to screen. The
  // `register`/`wrapperClass` pair rides the events-admin settle round's tinted-ground grammar
  // (`$theme/admin-chip-registers.css`): Paid recedes on the quiet tint, Outstanding carries the
  // warning tint, Not billed reads as the transient hairline outline.
  const HOLDING_STATUS: Record<AssetPaymentStanding, { label: string; tone: StatusChipTone; register: StatusChipRegister; wrapperClass: string }> = {
    paid: { label: 'Paid', tone: 'neutral', register: 'quiet', wrapperClass: 'asc-admin-chip-quiet' },
    outstanding: { label: 'Outstanding', tone: 'warning', register: 'quiet', wrapperClass: 'asc-admin-chip-warning' },
    'not-billed': { label: 'Not billed', tone: 'neutral', register: 'bounded', wrapperClass: 'asc-admin-chip-outline' },
  };

  // Per-type disclosure state (probe verdict, 2026-08-24): default open (an id absent from this
  // set), no persistence across a reload. A `Set`, not a per-type boolean map, since most types
  // never collapse in a session and this keeps the common case's memory footprint at zero.
  let collapsedTypes = $state<Set<string>>(new Set());
  function toggleTypeOpen(id: string) {
    const next = new Set(collapsedTypes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedTypes = next;
  }

  // Asset type ids are otherwise a free-form column with no format constraint enforced today; a
  // future id containing whitespace would otherwise land straight inside the panel/aria-controls
  // IDREF pair below and break it. One collapse, applied at the single source both ids share.
  function idSlug(value: string): string {
    return value.replace(/\s+/g, '-');
  }

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

  // -- assign dialog (probe verdict, 2026-08-24: top-anchored, not a form six viewports down) --
  let assignDialog: HTMLDialogElement | undefined = $state();
  const assetTypeOptions = $derived(data.assetTypes.map((t) => ({ value: t.id, label: `${t.name} (${formatDollars(t.fee)})` })));
  let assignAssetType = $state(untrack(() => data.assetTypes[0]?.id ?? ''));
  let householdQuery = $state('');
  let assignMembershipId = $state('');
  let assignDescription = $state('');
  let assignError: string | null = $state(null);
  let assignErrorEl: HTMLParagraphElement | undefined = $state();
  function openAssignDialog() {
    assignError = null;
    assignDialog?.showModal();
  }
  function resetAssignFields() {
    assignAssetType = data.assetTypes[0]?.id ?? '';
    householdQuery = '';
    assignMembershipId = '';
    assignDescription = '';
  }
  /** Keeps a rejected assign (e.g. a stale household) inside the still-open dialog with whatever
   *  the admin already typed, instead of the plain-POST default: a full page reload that closes
   *  the dialog and wipes every typed field. `fail(400, { error })` is `?/assign`'s only failure
   *  shape (`+page.server.ts`), so `result.data.error` is read directly rather than re-deriving it. */
  const assignEnhance: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        assignError = (result.data as { error?: string } | undefined)?.error ?? 'Something went wrong.';
        await tick();
        assignErrorEl?.focus();
        return;
      }
      assignError = null;
      await update({ reset: false });
      resetAssignFields();
      assignDialog?.close();
    };
  };
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

  // -- waitlist add dialog (probe verdict, 2026-08-24: top-anchored, same reasoning as assign) --
  let waitlistDialog: HTMLDialogElement | undefined = $state();
  let waitlistAssetType = $state(untrack(() => data.assetTypes[0]?.id ?? ''));
  let memberQuery = $state('');
  let waitlistMemberId = $state('');
  let waitlistNotes = $state('');
  let waitlistError: string | null = $state(null);
  let waitlistErrorEl: HTMLParagraphElement | undefined = $state();
  function openWaitlistDialog() {
    waitlistError = null;
    waitlistDialog?.showModal();
  }
  function resetWaitlistFields() {
    waitlistAssetType = data.assetTypes[0]?.id ?? '';
    memberQuery = '';
    waitlistMemberId = '';
    waitlistNotes = '';
  }
  /** Same keep-open-with-typed-input fix as `assignEnhance` above, for `?/waitlistAdd`'s identical
   *  `fail(400, { error })` shape. */
  const waitlistEnhance: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        waitlistError = (result.data as { error?: string } | undefined)?.error ?? 'Something went wrong.';
        await tick();
        waitlistErrorEl?.focus();
        return;
      }
      waitlistError = null;
      await update({ reset: false });
      resetWaitlistFields();
      waitlistDialog?.close();
    };
  };
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

<!-- The trailing half of a `.holding-row`, identical in the by-asset and by-person views (only
     their identity blocks differ): the payment-standing chip in its register wrapper, then the two
     verbs an assignment carries. Declared outside `<OfficeList>` so it stays a template snippet
     rather than an implicit prop passed to that component. -->
{#snippet assignmentActions(row: AssignmentDisplayRow)}
  {@const standing = HOLDING_STATUS[row.paymentStanding]}
  <div class="holding-row-actions">
    <span class={standing.wrapperClass}>
      <StatusChip tone={standing.tone} register={standing.register} label={standing.label} size="xs" />
    </span>
    <button type="button" class="btn btn-ghost btn-xs" onclick={() => openPaymentDialog(row)}>Record payment</button>
    <button type="button" class="btn btn-ghost btn-xs text-error" onclick={() => openReleaseDialog(row)}>Release</button>
  </div>
{/snippet}

<OfficeList eyebrow="Club" title="Assets" {subtitle}>
  {#snippet action()}
    <!-- Plain pressed buttons, not the full APG tabs pattern (no roving tabindex, no arrow-key
         navigation between them, and each one drives independent page content rather than a
         single tabpanel) -- `aria-pressed` states honestly what these three actually are. -->
    <div class="join" aria-label="Assets view">
      {#each VIEW_TABS as tab (tab.id)}
        <button
          type="button"
          aria-pressed={view === tab.id}
          class="view-tab join-item btn btn-sm {view === tab.id ? 'btn-active' : ''}"
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
    <div class="assets-list-header border-b border-[var(--cairn-card-border)] px-6 py-3">
      <button type="button" class="btn btn-sm" onclick={openAssignDialog}>Assign an asset</button>
    </div>
    {#if byAssetGroups.length === 0}
      <EmptyState
        heading="No asset types yet"
        message="Asset types are configured in the club database; once one exists, its assignments show up here."
      />
    {:else}
      {#each byAssetGroups as group (group.type.id)}
        {@const panelId = `${uid}-type-panel-${idSlug(group.type.id)}`}
        {@const panelToggleId = `${panelId}-toggle`}
        {@const isOpen = !collapsedTypes.has(group.type.id)}
        {@const overCapacity = group.type.capacity != null && group.rows.length > group.type.capacity}
        {@const queue = waitlistByType.get(group.type.id) ?? []}
        <div class="border-b border-[var(--cairn-card-border)] p-6">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <h2 class="asset-type-heading type-body font-semibold">
              <!-- The explicit disclosure-button pattern (probe verdict, 2026-08-24), not
                   `<details>/<summary>`: `<summary>` is an implicit button, and this header also
                   needs its OWN interactive controls (Promote, Edit) -- nesting a real button
                   inside a `<summary>` breaks both the interactive-content model and keyboard
                   activation. The heading wraps only the toggle (name, count/capacity, fee); the
                   Promote form and Edit button below are the toggle's siblings, never its
                   children, matching the WAI-ARIA accordion header pattern. -->
              <button
                type="button"
                id={panelToggleId}
                class="asset-type-toggle type-body font-semibold"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onclick={() => toggleTypeOpen(group.type.id)}
              >
                <span class="asset-type-chevron" aria-hidden="true">&#9656;</span>
                {group.type.name}
                <span class="count-qualifier font-normal text-muted">
                  <span class:count-warning={overCapacity}>{group.rows.length}</span>{group.type.capacity != null
                    ? `/${group.type.capacity}`
                    : ''} assigned &middot; {formatDollars(group.type.fee)}
                </span>
              </button>
            </h2>
            <div class="type-header-actions flex items-center gap-2">
              {#if queue.length > 0}
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
          <div id={panelId} role="region" aria-labelledby={panelToggleId} hidden={!isOpen}>
            <ul class="holding-list">
              {#each group.rows as row (row.id)}
                {@const desc = displayDescription(row.description)}
                <li class="holding-row">
                  <div class="min-w-0">
                    <p class="type-body font-medium">
                      {row.householdName}
                      {#if row.primaryMemberName && row.primaryMemberName !== row.householdName}<span class="text-muted"> &middot; {row.primaryMemberName}</span>{/if}
                    </p>
                    {#if desc}<p class="type-meta text-muted">{desc}</p>{/if}
                  </div>
                  {@render assignmentActions(row)}
                </li>
              {:else}
                <li class="py-6 text-center type-body text-muted">No one holds this asset right now.</li>
              {/each}
            </ul>
          </div>
        </div>
      {/each}
    {/if}
  {:else if view === 'by-person'}
    {#if byPersonGroups.length === 0}
      <EmptyState
        heading="No household holds an asset right now."
        message="Assignments you make in the By asset view show up here, grouped by household."
      />
    {:else}
      {#each byPersonGroups as group (group.householdId)}
        <div class="border-b border-[var(--cairn-card-border)] p-6">
          <h2 class="mb-3 type-body font-semibold">
            {group.householdName}
            {#if group.primaryMemberName && group.primaryMemberName !== group.householdName}<span class="count-qualifier font-normal text-muted">{group.primaryMemberName}</span>{/if}
          </h2>
          <ul class="holding-list">
            {#each group.rows as row (row.id)}
              {@const desc = displayDescription(row.description)}
              <li class="holding-row">
                <div class="min-w-0">
                  <p class="type-body font-medium">{row.assetTypeName}</p>
                  {#if desc}<p class="type-meta text-muted">{desc}</p>{/if}
                </div>
                {@render assignmentActions(row)}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    {/if}
  {:else}
    <div class="assets-list-header border-b border-[var(--cairn-card-border)] px-6 py-3">
      <button type="button" class="btn btn-sm" onclick={openWaitlistDialog}>Add to waitlist</button>
    </div>
    {#if data.waitlist.length === 0}
      <EmptyState
        heading="No one is waiting for an asset right now."
        message="Members join a waitlist once a type reaches capacity; entries appear here in order."
      />
    {:else}
      <div class="p-6">
        <ul class="holding-list">
          {#each data.waitlist as entry (entry.id)}
            <li class="holding-row">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="asc-admin-chip-quiet">
                    <StatusChip tone="neutral" register="quiet" label={entry.assetTypeName} legend={entry.assetTypeName} size="xs" />
                  </span>
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
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</OfficeList>

<dialog bind:this={releaseDialog} class="assets-dialog modal" aria-labelledby={`${uid}-release-dialog-title`}>
  <div class="modal-box">
    <h2 id={`${uid}-release-dialog-title`} class="type-heading font-bold">Release {releaseTargetLabel}?</h2>
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

<dialog bind:this={paymentDialog} class="assets-dialog modal" aria-labelledby={`${uid}-payment-dialog-title`}>
  <div class="modal-box">
    <h2 id={`${uid}-payment-dialog-title`} class="type-heading font-bold">Record a payment</h2>
    <p class="py-2 type-body text-muted">{paymentTargetLabel}</p>
    <form method="post" action="?/recordPayment" class="flex flex-col gap-3">
      <CsrfField />
      <input type="hidden" name="assignmentId" value={paymentTargetId} />
      <FieldLabel label="Amount (USD)">
        <input class="input input-sm" type="number" min="1" step="1" name="amount" bind:value={paymentAmount} />
      </FieldLabel>
      <SelectInput label="Method" name="method" bind:value={paymentMethod} options={paymentMethodOptions} />
      <TextInput label="Reference" name="reference" placeholder="Check #1234" bind:value={paymentReference} />
      <div class="modal-action">
        <button type="button" class="btn btn-sm" onclick={() => paymentDialog?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Record payment</button>
      </div>
    </form>
  </div>
</dialog>

<dialog bind:this={assignDialog} class="assets-dialog modal" aria-labelledby={`${uid}-assign-dialog-title`}>
  <div class="modal-box">
    <h2 id={`${uid}-assign-dialog-title`} class="type-heading font-bold">Assign an asset</h2>
    {#if assignError}
      <p bind:this={assignErrorEl} tabindex="-1" class="mt-2 type-body font-medium text-error" role="alert">{assignError}</p>
    {/if}
    <form method="post" action="?/assign" class="flex flex-col gap-3" use:enhance={assignEnhance}>
      <CsrfField />
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Asset type</span>
        <select class="select select-sm" name="assetType" bind:value={assignAssetType}>
          {#each assetTypeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Search household</span>
        <input class="input input-sm" type="search" name="householdQuery" placeholder="Name" bind:value={householdQuery} />
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Household</span>
        <select class="select select-sm" name="membershipId" bind:value={assignMembershipId}>
          {#each membershipOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Description</span>
        <input class="input input-sm" name="description" placeholder="Buoy M-14" bind:value={assignDescription} />
      </label>
      <div class="modal-action">
        <button type="button" class="btn btn-sm" onclick={() => assignDialog?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Assign</button>
      </div>
    </form>
  </div>
</dialog>

<dialog bind:this={waitlistDialog} class="assets-dialog modal" aria-labelledby={`${uid}-waitlist-add-dialog-title`}>
  <div class="modal-box">
    <h2 id={`${uid}-waitlist-add-dialog-title`} class="type-heading font-bold">Add to the waitlist</h2>
    {#if waitlistError}
      <p bind:this={waitlistErrorEl} tabindex="-1" class="mt-2 type-body font-medium text-error" role="alert">{waitlistError}</p>
    {/if}
    <form method="post" action="?/waitlistAdd" class="flex flex-col gap-3" use:enhance={waitlistEnhance}>
      <CsrfField />
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Asset type</span>
        <select class="select select-sm" name="assetType" bind:value={waitlistAssetType}>
          {#each assetTypeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Search member</span>
        <input class="input input-sm" type="search" name="memberQuery" placeholder="Name or email" bind:value={memberQuery} />
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Member</span>
        <select class="select select-sm" name="memberId" bind:value={waitlistMemberId}>
          {#each memberSelectOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Notes</span>
        <input class="input input-sm" name="notes" bind:value={waitlistNotes} />
      </label>
      <div class="modal-action">
        <button type="button" class="btn btn-sm" onclick={() => waitlistDialog?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Add to waitlist</button>
      </div>
    </form>
  </div>
</dialog>

<dialog bind:this={editTypeDialog} class="assets-dialog modal" aria-labelledby="edit-type-dialog-title">
  <div class="modal-box">
    <h2 id="edit-type-dialog-title" class="type-heading font-bold">Edit {editTypeDialogTitle}</h2>
    <form method="post" action="?/editType" class="flex flex-col gap-3">
      <CsrfField />
      <input type="hidden" name="id" value={editTypeId} />
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Name</span>
        <input class="input input-sm" name="name" bind:value={editTypeName} />
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Fee (USD)</span>
        <input class="input input-sm" type="number" min="0" step="1" name="fee" bind:value={editTypeFee} />
      </label>
      <label class="flex flex-col gap-label">
        <span class="type-body font-medium">Capacity</span>
        <input class="input input-sm" type="number" min="1" step="1" name="capacity" placeholder="No limit" bind:value={editTypeCapacity} />
      </label>
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

  /* Inside the disclosure toggle button (below), the button's own `inline-flex` `gap` already
     spaces every child evenly (chevron, name, this qualifier); the base rule's `margin-left`
     would stack on top of that gap and read as extra space only before this one item. */
  .asset-type-toggle .count-qualifier {
    margin-left: 0;
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
     edge, which is the 390px defect this rebuild replaces.

     Vertical padding tightens from the register re-entry's own prior 94px-row scale toward the
     events ledger's row scale (probe verdict, 2026-08-24): `--cairn-gap-control` (0.5rem) is the
     exact value `table-sm`'s own compiled `padding-block` uses, so this row's rhythm matches the
     events ledger's rather than approximating it. `margin-inline`/`padding-inline` bleed the row
     out to its own container's edge (each view's own `p-6` ancestor, 1.5rem) and back in, so the
     zebra stripe below reaches the card's real edge rather than sitting indented inside it. */
  .holding-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--cairn-gap-group);
    padding-block: var(--cairn-gap-control);
    margin-inline: -1.5rem;
    padding-inline: 1.5rem;
  }

  .holding-row:not(:first-child) {
    border-top: 1px solid var(--cairn-card-border);
  }

  /* Alternating stripes, the events ledger's own `table-zebra` register re-expressed for this
     page's `<ul>`/`<li>` rows (no `<table>` here, this file's own header comment explains why):
     `$theme/admin-chip-registers.css`'s tint percentages were tuned against this exact ground. */
  .holding-row:nth-child(even) {
    background-color: var(--color-base-200);
  }

  /* The edge-padding trim, qualified to an UNSTRIPED edge row only (`:nth-child(odd)`, the exact
     inverse of the stripe rule above): on an even-count group the last row lands on an even index,
     which the stripe rule above already fills top-to-bottom with `--cairn-gap-control`. Trimming
     that row's `padding-bottom` to 0 the way an unstriped edge row gets trimmed left its own fill
     asymmetric -- 0.5rem of tint above the text, none below -- a visible defect inside a filled
     band that the plain untinted case never showed. Leaving a striped edge row at its full
     padding-block on both sides keeps its fill symmetric; an unstriped edge row (odd index) is
     untouched, so the row rhythm everywhere else is unchanged. */
  .holding-row:first-child:nth-child(odd) {
    padding-top: 0;
  }

  .holding-row:last-child:nth-child(odd) {
    padding-bottom: 0;
  }

  .holding-row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cairn-gap-control);
  }

  /* Each by-asset type header is `flex flex-wrap` with the name+meta `<h2>` first and this
     actions block second. At 390 the two no longer fit one line and the actions block wraps to
     its own line, where it's the sole item -- `justify-content: space-between`'s single-item
     behavior (no second item to distribute against) places it at the row's START, not its end,
     so a type with no waitlist meta line to share (a short actions block) landed hard against
     the card's LEFT edge while a type whose waitlist form happens to span nearly the full row
     width read as right-aligned only by coincidence of its own content's length. `margin-left:
     auto` pins this block to the row's end on every line it lands on, shared or alone, rather
     than chasing a per-content wrap point. */
  .type-header-actions {
    margin-left: auto;
  }

  /* The launcher row for the Assign/Add-to-waitlist dialogs (probe verdict, 2026-08-24): a
     quiet button, top-anchored above the list it acts on rather than a form six viewports down.
     Each dialog's own submit is the sole filled primary on its surface. */
  .assets-list-header {
    display: flex;
    justify-content: flex-end;
  }

  /* The per-type disclosure toggle: a plain reset button (no daisyUI `.btn`, which would read as
     a boxed control rather than the heading it stands in for), wrapped by a real `<h2>` so the
     accordion still carries a heading in the accessible tree -- the explicit disclosure-button
     pattern this page's markup comment explains, since `<summary>` cannot also host the Promote
     form and Edit button beside it. */
  .asset-type-heading {
    margin: 0;
    min-width: 0;
  }

  .asset-type-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    /* A floor under the button's own box, not its line-height (which stays whatever the inherited
       `type-body` resolves to): the reset button otherwise measured 20px tall, under the 24px
       minimum target size a `role="button"`-shaped control needs. `align-items: center` on the
       parent `<h2>`'s sibling row keeps the taller box vertically centered rather than stretching
       the row itself. */
    min-height: 1.5rem;
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .asset-type-chevron {
    display: inline-block;
    font-size: 0.625rem;
    color: var(--color-muted);
  }

  @media (prefers-reduced-motion: no-preference) {
    .asset-type-chevron {
      transition: transform 0.15s ease;
    }
  }

  .asset-type-toggle[aria-expanded='true'] .asset-type-chevron {
    transform: rotate(90deg);
  }

  /* The over-capacity count (probe verdict, 2026-08-24): warning-toned ink on the COUNT only,
     not the whole "N/M assigned" qualifier -- `--cairn-warning-ink` is the same token the events
     ledger's own `.events-class-star` reaches for. */
  .count-warning {
    color: var(--cairn-warning-ink);
  }

  /* cairn-admin.css caps `.input`, `.select`, and `.textarea` at `width: clamp(3rem, 20rem,
     100%)` (20rem preferred), so every field on this screen -- the Assign grid, the Waitlist-add
     grid, the Edit-type dialog, and the Record-payment dialog alike -- stopped at 320px
     regardless of its own container's width, leaving a visible empty gutter beside the filled
     submit button, which aligns to the container's real edge. `:global` is needed because the
     Record-payment dialog's Method/Reference fields render through the packaged `SelectInput`/
     `TextInput` components, a separate component instance a scoped selector can't reach; this
     rule still ships only inside this route's own code-split stylesheet, so its reach stays this
     page. */
  :global(.input),
  :global(.select),
  :global(.textarea) {
    width: 100%;
  }

  /* The view switcher's selected segment used `btn-active`, which mixes 7% black into
     `--color-base-200` -- a fix that reads clearly in light (base-200 is near-white, so darkening
     it registers) but nearly vanishes in `cairn-admin-dark` (base-200 is already near-black, so
     the same relative mix barely moves its absolute lightness). Mixing toward
     `--color-base-content` instead of always toward black makes the shift track the theme: content
     is dark in light mode (still darkens, matching the previous read) and light in dark mode
     (lightens, giving the same kind of highlight `btn-active` gives in light). No accent hue is
     introduced, so the screen keeps its one filled action (the `Assign` submit). */
  .view-tab[aria-pressed='true'] {
    --btn-bg: color-mix(in oklab, var(--color-base-content) 16%, var(--color-base-200));
    border-color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
  }

  /* Chrome's UA stylesheet sets `dialog { border: solid }` (medium width, `currentColor`), which
     neither daisyUI's `.modal` nor `cairn-admin.css` resets; a `<dialog>` positions itself over
     the full viewport before the `::backdrop`/`.modal-box` layout takes over, so that UA border
     paints a 3px frame around the whole screen the instant any dialog here opens. */
  .assets-dialog {
    border: none;
  }
</style>
