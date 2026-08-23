<!--
@component
The row form's hero-photo picker (events-admin pass, Task 5): a site-local listbox over the
committed media library, built directly against `readCommittedManifest`/`publicMediaResolver`
rather than cairn's own `MediaPicker`/`MediaInsertPopover`. Neither of those ships an import path
a site can legally reach (`dist/components/index.d.ts` re-exports neither, and
`package.json`'s `exports` map carries no `./components/*` wildcard) -- the seam is filed as this
pass's first cairn harvest finding (`docs/2026-08-22-events-admin-harvest-findings.md`). The
route's own `load` supplies `library`, the projected `mediaManifest` filtered to `image/*` and
sorted by display name, so this component stays a plain array-in, token-out control with no
manifest read of its own.

Two named fields (`heroImage`, `heroImageAlt`) are this component's whole write surface, so the
row form's own `<form action="?/save">` picks them up like any other field with no two-way
plumbing back through the page: `heroImage` is a genuine hidden input, since its value comes from
clicking a listbox row rather than typing, and `heroImageAlt` is a real, visible `TextInput` (the
alt text is worth letting an officer override per placement, even when the library entry already
carries one). A real listbox (`role="listbox"`/`role="option"`, roving tabindex, arrow/Home/End/
Enter keyboard operation), not a styled `<select>`, since the row needs a thumbnail and a
needs-alt cue a native select cannot render; the visible focus ring rides this component's own
scoped `<style>` (`:focus-visible`), the compiled-CSS constraint's usual reason a literal rule
lives here rather than a Tailwind ring utility.

Known limitation: the committed manifest is a build-time read (`src/theme/cairn.config.ts`'s own
`mediaManifest` export), so an asset uploaded through cairn's Library appears in this picker only
after that commit deploys -- there is no live read of the library from an admin route.
-->
<script module lang="ts">
  /** One library entry, projected by the route's `load` from `mediaManifest`. */
  export interface HeroLibraryEntry {
    /** The `media:slug.hash` token this entry writes into `heroImage` when chosen. */
    token: string;
    displayName: string;
    alt: string;
    /** The resolved delivery URL for the thumbnail; empty when the resolver could not place it. */
    url: string;
  }
</script>

<script lang="ts">
  import { FieldLabel, TextInput } from '@glw907/cairn-cms/admin-toolkit';

  /** Both bindables stay plain strings, empty meaning "unset": `TextInput`'s own `value` prop is
   *  typed `string`, not `string | null`, so a nullable prop here would need a coercion at every
   *  call site rather than once, here, at the boundary with the store's own `string | null`
   *  columns (the row form does that `?? ''` conversion when it seeds these from `EventRow`). */
  let {
    library,
    heroImage = $bindable(''),
    heroImageAlt = $bindable(''),
  }: {
    library: HeroLibraryEntry[];
    heroImage?: string;
    heroImageAlt?: string;
  } = $props();

  const uid = $props.id();
  const listboxId = `hero-image-listbox-${uid}`;

  let query = $state('');
  let optionEls: (HTMLLIElement | undefined)[] = $state([]);

  const filtered = $derived(
    library.filter((entry) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return entry.displayName.toLowerCase().includes(q) || entry.alt.toLowerCase().includes(q);
    }),
  );

  const current = $derived(library.find((entry) => entry.token === heroImage) ?? null);

  function select(entry: HeroLibraryEntry) {
    heroImage = entry.token;
    if (!heroImageAlt.trim()) heroImageAlt = entry.alt;
  }

  function clear() {
    heroImage = '';
    heroImageAlt = '';
  }

  function focusOption(index: number) {
    optionEls[index]?.focus();
  }

  function onOptionKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(filtered.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(filtered[index]);
    }
  }
</script>

<div class="hero-image-field">
  <input type="hidden" name="heroImage" value={heroImage} />

  <div class="hero-image-current">
    {#if current}
      <img class="hero-image-thumb" src={current.url} alt="" />
      <span class="type-body">
        <span class="font-medium">{current.displayName}</span>
        {#if heroImageAlt}<span class="text-muted"> &middot; {heroImageAlt}</span>{/if}
      </span>
      <button type="button" class="btn btn-ghost btn-xs" onclick={clear}>Clear</button>
    {:else}
      <span class="type-body text-muted">No hero photo chosen.</span>
    {/if}
  </div>

  <FieldLabel label="Search photos">
    <input class="input input-sm" type="search" bind:value={query} placeholder="Search by name or alt text" />
  </FieldLabel>

  <ul id={listboxId} role="listbox" aria-label="Hero photo library" class="hero-image-listbox">
    {#if filtered.length === 0}
      <li class="hero-image-empty type-body text-muted">
        {library.length === 0 ? 'No images in the library yet.' : 'Nothing matches that search.'}
      </li>
    {:else}
      {#each filtered as entry, index (entry.token)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          bind:this={optionEls[index]}
          role="option"
          aria-selected={entry.token === heroImage}
          tabindex={entry.token === heroImage || (!heroImage && index === 0) ? 0 : -1}
          class="hero-image-option"
          class:hero-image-option-selected={entry.token === heroImage}
          onclick={() => select(entry)}
          onkeydown={(event) => onOptionKeydown(event, index)}
        >
          <img class="hero-image-thumb" src={entry.url} alt="" />
          <span class="hero-image-option-text">
            <span class="type-body font-medium">{entry.displayName}</span>
            {#if !entry.alt.trim()}<span class="hero-image-needs-alt">Needs alt</span>{/if}
          </span>
        </li>
      {/each}
    {/if}
  </ul>

  <TextInput label="Alt text" name="heroImageAlt" bind:value={heroImageAlt} />
</div>

<style>
  /* Layout only, per the toolkit README's own compiled-CSS constraint: literal values, no
     arbitrary Tailwind utility. */
  .hero-image-field {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .hero-image-current {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .hero-image-thumb {
    height: 2.5rem;
    width: 2.5rem;
    flex: none;
    border-radius: var(--radius-box, 0.5rem);
    border: 1px solid var(--cairn-card-border);
    object-fit: cover;
  }

  .hero-image-listbox {
    display: flex;
    max-height: 14rem;
    flex-direction: column;
    gap: 0.125rem;
    overflow: auto;
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    border: 1px solid var(--cairn-card-border);
    border-radius: var(--radius-box, 0.5rem);
  }

  .hero-image-empty {
    padding: 0.75rem;
  }

  .hero-image-option {
    display: flex;
    cursor: pointer;
    align-items: center;
    gap: 0.5rem;
    border-radius: var(--radius-field, 0.25rem);
    padding: 0.375rem 0.5rem;
  }

  .hero-image-option:hover {
    background-color: color-mix(in oklab, var(--color-base-content) 5%, transparent);
  }

  .hero-image-option-selected {
    background-color: color-mix(in oklab, var(--color-primary) 12%, transparent);
  }

  /* The visible focus ring: this component's own listbox items are the one place a plain
     `:focus-visible` rule can live, per the compiled-CSS constraint's usual reasoning. */
  .hero-image-option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .hero-image-option-text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.125rem;
  }

  .hero-image-needs-alt {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-warning);
  }
</style>
