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

**Reviewer fan-out fix round (docs/plans/2026-08-22-events-admin.md's fix brief, items 21, 24,
29-30, 39, 41).** Every `use:enhance` in this component now runs the same keep-on-screen handler
`+page.svelte`'s own `setDate` form already uses (`await update({ reset: false })`), so a Hide/
Show or Retire/Unretire round trip never resets this panel out from under whatever the officer is
mid-typing in the fields above it. The grid pairs Start date/End date on one line and Start
time/End time on the next (rather than interleaving a date with a time), a blank "New event"
panel autofocuses its own Title field once mounted, and Delete is a separate, right-aligned
danger zone whose confirm replaces just that zone rather than inlining between Save/Hide/Retire.
An `error` prop (the route's own `rowError(datum.id)`, `+page.svelte`) renders inline against
this panel when a write concerning THIS row was refused, so the officer sees the refusal beside
the field it concerns rather than only at the top of the page.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
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
    error = null,
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
    /** A refused write concerning this row (`+page.svelte`'s own `rowError`), rendered inline at
     *  the top of the form. `null` when nothing was refused, or the refusal concerned a different
     *  row. */
    error?: string | null;
    /** The blank panel's own Cancel, closing it with nothing written. `undefined` for an existing
     *  row, which has no equivalent "abandon" gesture. */
    onCancel?: () => void;
  } = $props();

  const uid = $props.id();
  const formId = `event-row-form-${uid}`;
  const isCreate = $derived(event === null);

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
  let deleteTriggerButton: HTMLButtonElement | undefined = $state();
  let formEl: HTMLFormElement | undefined = $state();
  const deleteQuestionId = `${uid}-delete-question`;

  $effect(() => {
    if (deleteConfirmOpen) cancelButton?.focus();
  });

  // The blank "New event" panel's own Title field takes focus once it mounts: an officer who just
  // clicked "New event" should be able to start typing immediately, with no extra click.
  $effect(() => {
    if (!isCreate) return;
    void (async () => {
      await tick();
      formEl?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
    })();
  });

  function closeDeleteConfirm() {
    deleteConfirmOpen = false;
    void (async () => {
      await tick();
      deleteTriggerButton?.focus();
    })();
  }

  const categoryOptions = EVENT_CATEGORIES.map((value) => ({ value, label: EVENT_CATEGORY_LABEL[value] }));
  const recurrenceOptions = EVENT_RECURRENCES.map((value) => ({ value, label: EVENT_RECURRENCE_LABEL[value] }));
  const linkSeriesOptions = $derived([
    { value: '', label: 'No change' },
    ...otherSeries.map((series) => ({ value: series.id, label: series.title })),
  ]);

  /** The blank "New event" panel's own submit closes itself on a successful create, since that
   *  action redirects to the ledger's own `?open=` for the newly created row rather than
   *  re-rendering this same component: without this, a client-side `use:enhance` navigation
   *  leaves `onCancel`'s panel-open state stranded `true` above whatever row the redirect opens.
   *  A `save` submit has no such state to clear (`onCancel` is `undefined` for an existing row),
   *  so the guard is a no-op there. `{ reset: false }` matches every other form in this component
   *  (below): a round trip must never reset a field back to its own defaultValue out from under
   *  whatever the officer is mid-typing. */
  const handleSubmit: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (isCreate && result.type === 'redirect') onCancel?.();
      await update({ reset: false });
    };
  };

  /** The two small subsidiary forms' own `use:enhance` (Hide/Show, Retire/Unretire): the same
   *  keep-on-screen handler `+page.svelte`'s own `setDate` form already uses, so a toggle round
   *  trip never resets this panel's own fields, above, out from under the officer. */
  const keepOnScreen: SubmitFunction = () => {
    return async ({ update }) => {
      await update({ reset: false });
    };
  };
</script>

<div class="event-row-form">
  {#if error}
    <p class="event-row-form-error type-body font-medium text-error" role="alert">{error}</p>
  {/if}
  <form
    id={formId}
    bind:this={formEl}
    method="post"
    action={isCreate ? '?/create' : '?/save'}
    aria-label={event ? event.title : 'New event'}
    use:enhance={handleSubmit}
  >
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
      <TextInput label="Location" name="location" bind:value={location} />
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
    <div class="event-row-form-actions">
      <button type="submit" form={formId} class="btn btn-primary btn-sm">Save</button>
      {#if isCreate && onCancel}
        <button type="button" class="btn btn-sm" onclick={onCancel}>Cancel</button>
      {/if}
      {#if event}
        <form method="post" action="?/setVisibility" use:enhance={keepOnScreen}>
          <CsrfField />
          <input type="hidden" name="id" value={event.id} />
          <!-- Named `show`, not `visible`: the row's edit form must carry no `name="visible"`
               field anywhere (the design's "no Visible checkbox" ruling extends to the whole
               panel), and this hidden field is the toggle's own target value, not an editable
               visibility control. -->
          <input type="hidden" name="show" value={event.visible ? '0' : '1'} />
          <button type="submit" class="btn btn-ghost btn-sm">{event.visible ? 'Hide this year' : 'Show'}</button>
        </form>
        {#if seriesId}
          <form method="post" action="?/retire" use:enhance={keepOnScreen}>
            <CsrfField />
            <input type="hidden" name="seriesId" value={seriesId} />
            <!-- The fix round's own retire-refusal fix: `retire` is a series-level action with no
                 row id of its own, so it echoes this back on a `fail()` (`+page.server.ts`) to let
                 `rowError` above still find the right row to show the refusal against. -->
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="retired" value={retiredAt ? '0' : '1'} />
            <button type="submit" class="btn btn-ghost btn-sm">{retiredAt ? 'Unretire series' : 'Retire series'}</button>
          </form>
        {/if}
      {/if}
    </div>
    {#if event && canDeleteEvent(event)}
      <div class="event-row-form-danger">
        {#if deleteConfirmOpen}
          <div class="event-row-form-delete-confirm" role="group" aria-labelledby={deleteQuestionId}>
            <p id={deleteQuestionId} class="type-body">
              Delete “{event.title}”? It has never been published, so nothing public changes.
            </p>
            <div class="event-row-form-delete-actions">
              <form method="post" action="?/delete" use:enhance>
                <CsrfField />
                <input type="hidden" name="id" value={event.id} />
                <button type="submit" class="btn btn-error btn-sm">Delete</button>
              </form>
              <button bind:this={cancelButton} type="button" class="btn btn-sm" onclick={closeDeleteConfirm}>Cancel</button>
            </div>
          </div>
        {:else}
          <button
            bind:this={deleteTriggerButton}
            type="button"
            class="btn btn-ghost btn-sm"
            onclick={() => (deleteConfirmOpen = true)}
          >
            Delete
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: literal values, no
     arbitrary Tailwind utility string. `width: 100%` fills the ledger row's `.events-panel`
     container (`+page.svelte`) even under that container's own `align-items: flex-start` --
     needed so the class-row link above this form stays a compact button rather than stretching
     full width. */
  .event-row-form {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 1rem;
  }

  .event-row-form-error {
    margin: 0;
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

  /* item 41: Delete demoted to its own right-hand danger zone, rather than sitting in the same
     flex line as Save/Hide/Retire -- `margin-left: auto` on the zone below pushes it to the
     opposite edge of this shared, wrapping footer row. */
  .event-row-form-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    border-top: 1px solid var(--cairn-card-border);
    padding-top: 1rem;
  }

  .event-row-form-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .event-row-form-danger {
    margin-left: auto;
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
