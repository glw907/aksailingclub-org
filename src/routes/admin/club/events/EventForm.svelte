<!--
@component
The Events detail/edit fields (Task 5), shared between the create screen (`events/new`) and the
edit screen (`events/[id]`) so the field set has exactly one copy. Composed from the engine's
`admin-toolkit` primitives (`TextInput`/`SelectInput`/`FieldLabel`).

These render stacked, label above control, as of the `0.94.0-rc.1` migration. That is the
ratified mockup's own detail-panel layout, which this file's earlier note called "a future
`admin-fields` addition"; `0.92.0` shipped it as the `register` prop and made `'stacked'` the
default, so the site takes the default rather than passing `register="inline"` to hold the
horizontal label-beside-input rhythm it had been settling for. The date/time fields
compose `FieldLabel` directly around a bare `<input type="date">`/`type="time">`, per that
component's own header comment ("compose it directly around a bare custom control when a site's
own field needs the admin's label rhythm with no bundled primitive to match"): `TextInput`'s
`type` prop only accepts `text`/`search`/`email`/`url` today, not `date`/`time`.
-->
<script lang="ts">
  import { FieldLabel, SelectInput, TextInput } from '@glw907/cairn-cms/admin-toolkit';
  import { EVENT_CATEGORIES, EVENT_CATEGORY_LABEL, type EventCategory } from '$admin-club/lib/events-store';

  let {
    title = $bindable(),
    slug = $bindable(),
    category = $bindable(),
    startDate = $bindable(),
    startTime = $bindable(),
    endDate = $bindable(),
    endTime = $bindable(),
    location = $bindable(),
    shortDescription = $bindable(),
    longDescription = $bindable(),
    visible = $bindable(),
    heroImage = null,
    heroImageAlt = null,
  }: {
    title: string;
    slug: string;
    category: EventCategory;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    shortDescription: string;
    longDescription: string;
    visible: boolean;
    heroImage?: string | null;
    heroImageAlt?: string | null;
  } = $props();

  const categoryOptions = EVENT_CATEGORIES.map((value) => ({ value, label: EVENT_CATEGORY_LABEL[value] }));
</script>

<div class="grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
  <TextInput label="Title" name="title" bind:value={title} />
  <TextInput label="Slug" name="slug" bind:value={slug} />
  <SelectInput label="Category" name="category" bind:value={category} options={categoryOptions} />
  <label class="flex items-center gap-1.5 type-body">
    <input type="checkbox" class="checkbox checkbox-sm" name="visible" bind:checked={visible} />
    Visible on the public calendar
  </label>
  <FieldLabel label="Start date">
    <input class="input input-sm" type="date" name="startDate" bind:value={startDate} />
  </FieldLabel>
  <FieldLabel label="Start time">
    <input class="input input-sm" type="time" name="startTime" bind:value={startTime} />
  </FieldLabel>
  <FieldLabel label="End date">
    <input class="input input-sm" type="date" name="endDate" bind:value={endDate} />
  </FieldLabel>
  <FieldLabel label="End time">
    <input class="input input-sm" type="time" name="endTime" bind:value={endTime} />
  </FieldLabel>
  <TextInput label="Location" name="location" bind:value={location} />
</div>

<div class="grid gap-4 border-t border-[var(--cairn-card-border)] p-6">
  <FieldLabel label="Short description">
    <textarea class="textarea textarea-sm w-full" name="shortDescription" rows="2" bind:value={shortDescription}
    ></textarea>
  </FieldLabel>
  <FieldLabel label="Long description">
    <textarea class="textarea textarea-sm w-full" name="longDescription" rows="8" bind:value={longDescription}
    ></textarea>
  </FieldLabel>
</div>

{#if heroImage}
  <!-- Read-only this pass: the media-library picker reuse seam (design suite Part B) is not
       wired for a custom /admin/club screen yet, so the hero image only displays what the ops
       import carried. Replacing or clearing it needs the picker seam, a later pass's work. -->
  <div class="flex flex-wrap items-center gap-2 border-t border-[var(--cairn-card-border)] p-6 type-body">
    <span class="font-medium text-muted">Hero image (read-only):</span>
    <span>{heroImage}</span>
    {#if heroImageAlt}<span class="text-muted">&middot; {heroImageAlt}</span>{/if}
  </div>
{/if}
