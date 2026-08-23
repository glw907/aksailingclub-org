<!--
@component
The ledger row's full edit, events-admin pass Task 5 (`docs/2026-08-22-events-admin-design.md`):
renders inside `ExpandableRow`'s `panel` snippet for an existing row, and stand-alone (with
`event={null}`) for the "New event" blank panel `+page.svelte` opens above the first ledger row
from client state alone -- no draft row is ever written to the database, so an abandoned new
event leaves nothing behind. Replaces `EventForm.svelte`/`events/[id]`/`events/new`, whose one
field set this component now carries on its own, plus the series-model additions those retired
screens never had: Recurrence, the series-link control, and the hero picker.

Composed entirely from `TextInput`/`SelectInput`/`FieldLabel` (stacked register, the default) --
`EventForm.svelte`'s own recipe. The two description textareas get a scoped `font-family:
inherit` reset: cairn's precompiled admin sheet already resets it at its own `@layer base`, but
Chromium's UA stylesheet sets `textarea { font-family: monospace }` with the same specificity and
wins on source order against a `:where()`-qualified author rule (the identical defect
`asset-requests/+page.svelte`'s own `.deny-reason-textarea` rule already documents and fixes the
same way), so without this reset the two prose fields rendered in the monospace face the toolkit
catalog's own "monospace textareas for prose descriptions" finding calls out.

Footer actions follow the toolkit's action-link discipline (quiet buttons in a row, never a
floating red top-right control): Save; Hide this year/Show; Retire series/Unretire series; and,
only when `canDeleteEvent` allows it, a quiet Delete gated behind an inline confirm. The confirm
autofocuses its own Cancel button, never the destructive Delete submit, so an accidental Enter
never deletes -- the same posture the retired `events/[id]` dialog held.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { FieldLabel, SelectInput, TextInput } from '@glw907/cairn-cms/admin-toolkit';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import HeroImageField, { type HeroLibraryEntry } from './HeroImageField.svelte';
  import {
    EVENT_CATEGORIES,
    EVENT_CATEGORY_LABEL,
    EVENT_RECURRENCES,
    EVENT_RECURRENCE_LABEL,
    canDeleteEvent,
    type EventCategory,
    type EventRecurrence,
    type EventRow,
  } from '$admin-club/lib/events-store';

  let {
    event = null,
    recurrence: initialRecurrence = 'annual',
    retiredAt = null,
    seriesId = null,
    seriesYearCount = 0,
    season,
    heroLibrary,
    otherSeries = [],
    onCancel,
  }: {
    /** `null` for the blank "New event" panel; the row's own current-season `EventRow` otherwise. */
    event?: EventRow | null;
    recurrence?: EventRecurrence;
    retiredAt?: string | null;
    seriesId?: string | null;
    seriesYearCount?: number;
    /** The ledger's currently selected season: the create action's own hidden field, and the
     *  series-link label's own year. */
    season: number;
    heroLibrary: HeroLibraryEntry[];
    /** Every other series' `{ id, title }`, annual-first then title order (`+page.svelte`'s own
     *  sort): the series-link `SelectInput`'s option list. */
    otherSeries?: { id: string; title: string }[];
    /** The blank panel's own Cancel, closing it with nothing written. `undefined` for an existing
     *  row, which has no equivalent "abandon" gesture. */
    onCancel?: () => void;
  } = $props();

  const uid = $props.id();
  const formId = `event-row-form-${uid}`;
  const isCreate = event === null;

  // One-time seeds from the row's own current values, not a live mirror: a post-submit re-render
  // must not clobber whatever the officer is mid-typing (the retired `events/[id]`'s own
  // `untrack` idiom, carried here now that this component owns the state itself).
  let title = $state(untrack(() => event?.title ?? ''));
  let recurrenceValue = $state<EventRecurrence>(untrack(() => initialRecurrence));
  let linkSeriesId = $state('');
  let category = $state<EventCategory>(untrack(() => event?.category ?? 'social'));
  let startDate = $state(untrack(() => event?.startDate ?? ''));
  let endDate = $state(untrack(() => event?.endDate ?? ''));
  let startTime = $state(untrack(() => event?.startTime ?? ''));
  let endTime = $state(untrack(() => event?.endTime ?? ''));
  let location = $state(untrack(() => event?.location ?? ''));
  let shortDescription = $state(untrack(() => event?.shortDescription ?? ''));
  let longDescription = $state(untrack(() => event?.longDescription ?? ''));
  let heroImage = $state(untrack(() => event?.heroImage ?? ''));
  let heroImageAlt = $state(untrack(() => event?.heroImageAlt ?? ''));

  let deleteConfirmOpen = $state(false);
  let cancelButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (deleteConfirmOpen) cancelButton?.focus();
  });

  const categoryOptions = EVENT_CATEGORIES.map((value) => ({ value, label: EVENT_CATEGORY_LABEL[value] }));
  const recurrenceOptions = EVENT_RECURRENCES.map((value) => ({ value, label: EVENT_RECURRENCE_LABEL[value] }));
  const linkSeriesOptions = [
    { value: '', label: 'No change' },
    ...otherSeries.map((series) => ({ value: series.id, label: series.title })),
  ];
</script>

<div class="event-row-form">
  <form id={formId} method="post" action={isCreate ? '?/create' : '?/save'} use:enhance>
    <CsrfField />
    {#if event}
      <input type="hidden" name="id" value={event.id} />
    {:else}
      <input type="hidden" name="season" value={season} />
    {/if}
    <div class="event-row-form-grid">
      <TextInput label="Title" name="title" bind:value={title} />
      <SelectInput label="Recurrence" name="recurrence" bind:value={recurrenceValue} options={recurrenceOptions} />
      {#if seriesYearCount === 1}
        <div class="event-row-form-span2">
          <SelectInput
            label={`This is the ${season} instance of an existing series`}
            name="linkSeriesId"
            bind:value={linkSeriesId}
            options={linkSeriesOptions}
          />
        </div>
      {/if}
      <SelectInput label="Category" name="category" bind:value={category} options={categoryOptions} />
      <FieldLabel label="Start date">
        <input class="input input-sm" type="date" name="startDate" bind:value={startDate} />
      </FieldLabel>
      <FieldLabel label="End date">
        <input class="input input-sm" type="date" name="endDate" bind:value={endDate} />
      </FieldLabel>
      <FieldLabel label="Start time">
        <input class="input input-sm" type="time" name="startTime" bind:value={startTime} />
      </FieldLabel>
      <FieldLabel label="End time">
        <input class="input input-sm" type="time" name="endTime" bind:value={endTime} />
      </FieldLabel>
      <TextInput label="Location" name="location" bind:value={location} />
    </div>

    <div class="event-row-form-prose">
      <FieldLabel label="Short description">
        <textarea class="textarea textarea-sm event-row-form-textarea w-full" name="shortDescription" rows="2" bind:value={shortDescription}
        ></textarea>
      </FieldLabel>
      <FieldLabel label="Long description">
        <textarea class="textarea textarea-sm event-row-form-textarea w-full" name="longDescription" rows="8" bind:value={longDescription}
        ></textarea>
      </FieldLabel>
    </div>

    <div class="event-row-form-hero">
      <HeroImageField library={heroLibrary} bind:heroImage bind:heroImageAlt />
    </div>
  </form>

  <div class="event-row-form-footer">
    <button type="submit" form={formId} class="btn btn-primary btn-sm">Save</button>
    {#if isCreate && onCancel}
      <button type="button" class="btn btn-sm" onclick={onCancel}>Cancel</button>
    {/if}
    {#if event}
      <form method="post" action="?/setVisibility" use:enhance>
        <CsrfField />
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="visible" value={event.visible ? '0' : '1'} />
        <button type="submit" class="btn btn-ghost btn-sm">{event.visible ? 'Hide this year' : 'Show'}</button>
      </form>
      {#if seriesId}
        <form method="post" action="?/retire" use:enhance>
          <CsrfField />
          <input type="hidden" name="seriesId" value={seriesId} />
          <input type="hidden" name="retired" value={retiredAt ? '0' : '1'} />
          <button type="submit" class="btn btn-ghost btn-sm">{retiredAt ? 'Unretire series' : 'Retire series'}</button>
        </form>
      {/if}
      {#if canDeleteEvent(event)}
        {#if deleteConfirmOpen}
          <div class="event-row-form-delete-confirm">
            <p class="type-body">Delete "{event.title}"? It has never been published, so nothing public changes.</p>
            <div class="event-row-form-delete-actions">
              <form method="post" action="?/delete" use:enhance>
                <CsrfField />
                <input type="hidden" name="id" value={event.id} />
                <button type="submit" class="btn btn-error btn-sm">Delete</button>
              </form>
              <!-- svelte-ignore a11y_autofocus -->
              <button bind:this={cancelButton} type="button" class="btn btn-sm" onclick={() => (deleteConfirmOpen = false)}>
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => (deleteConfirmOpen = true)}>Delete</button>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: literal values, no
     arbitrary Tailwind utility string. */
  .event-row-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .event-row-form-grid {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    .event-row-form-grid {
      grid-template-columns: 1fr;
    }
  }

  .event-row-form-span2 {
    grid-column: 1 / -1;
  }

  .event-row-form-prose {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Chromium's UA stylesheet's own `textarea { font-family: monospace }` outranks cairn-admin.css's
     `:where(...) textarea { font: inherit }` on source order despite equal specificity (this
     component's own header comment names the precedent); reset it directly here. */
  .event-row-form-textarea {
    font-family: inherit;
  }

  .event-row-form-hero {
    border-top: 1px solid var(--cairn-card-border);
    padding-top: 1rem;
  }

  .event-row-form-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    border-top: 1px solid var(--cairn-card-border);
    padding-top: 1rem;
  }

  .event-row-form-delete-confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .event-row-form-delete-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
