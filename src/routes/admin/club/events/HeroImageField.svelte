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
needs-alt cue a native select cannot render.

Known limitation: the committed manifest is a build-time read (`src/theme/cairn.config.ts`'s own
`mediaManifest` export), so an asset uploaded through cairn's Library appears in this picker only
after that commit deploys -- there is no live read of the library from an admin route.

**Reviewer fan-out fix round (docs/plans/2026-08-22-events-admin.md's fix brief, item 28, plus
item 43's "Hero photo" label and landscape thumb).** A single `activeIndex` (the selected entry,
falling back to the first filtered one) drives the roving tabindex, rather than a per-option
inline expression; option refs are keyed by the entry's own token instead of its array index, so
a ref never goes stale against the wrong entry once a search re-filters the list. The listbox
itself renders inside a visible `FieldLabel`, both the visible "Hero photo" caption item 43 wants
and the visible label item 28 wants above the listbox in one element. Every thumbnail is a
landscape crop (`var(--radius-box)`, not a near-square "squircle"), and a library entry with no
resolvable URL renders a blank placeholder span rather than an `<img src="">` (a broken-image
icon).
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
  let optionEls: Record<string, HTMLLIElement | undefined> = $state({});

  const filtered = $derived(
    library.filter((entry) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return entry.displayName.toLowerCase().includes(q) || entry.alt.toLowerCase().includes(q);
    }),
  );

  const current = $derived(library.find((entry) => entry.token === heroImage) ?? null);

  /** The roving tab stop: the selected entry's own position in the filtered list, or the first
   *  entry when nothing is selected (or the selected entry is filtered out) -- never negative. */
  const activeIndex = $derived(Math.max(0, filtered.findIndex((entry) => entry.token === heroImage)));

  function select(entry: HeroLibraryEntry) {
    heroImage = entry.token;
    if (!heroImageAlt.trim()) heroImageAlt = entry.alt;
  }

  function clear() {
    heroImage = '';
    heroImageAlt = '';
  }

  function focusOption(index: number) {
    const token = filtered[index]?.token;
    if (token) optionEls[token]?.focus();
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
      {#if current.url}
        <img class="hero-image-thumb" src={current.url} alt="" />
      {:else}
        <span class="hero-image-thumb hero-image-thumb-blank" aria-hidden="true"></span>
      {/if}
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
    <input class="input input-sm" type="search" bind:value={query} placeholder="Search by name or alt text" aria-controls={listboxId} />
  </FieldLabel>

  <p class="hero-image-count type-meta text-muted" role="status">{library.length} photos</p>

  <FieldLabel label="Hero photo">
    <ul id={listboxId} role="listbox" aria-label="Hero photo library" class="hero-image-listbox">
      {#if filtered.length === 0}
        <li class="hero-image-empty type-body text-muted" role="presentation">
          {library.length === 0 ? 'No images in the library yet.' : 'Nothing matches that search.'}
        </li>
      {:else}
        {#each filtered as entry, index (entry.token)}
          <li
            bind:this={optionEls[entry.token]}
            role="option"
            aria-selected={entry.token === heroImage}
            tabindex={index === activeIndex ? 0 : -1}
            class="hero-image-option"
            class:hero-image-option-selected={entry.token === heroImage}
            onclick={() => select(entry)}
            onkeydown={(event) => onOptionKeydown(event, index)}
          >
            {#if entry.url}
              <img class="hero-image-thumb" src={entry.url} alt="" />
            {:else}
              <span class="hero-image-thumb hero-image-thumb-blank" aria-hidden="true"></span>
            {/if}
            <span class="hero-image-option-text">
              <span class="type-body font-medium">{entry.displayName}</span>
              {#if !entry.alt.trim()}<span class="hero-image-needs-alt">Needs alt</span>{/if}
            </span>
          </li>
        {/each}
      {/if}
    </ul>
  </FieldLabel>

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

  .hero-image-count {
    margin: 0;
  }

  /* Landscape, not a near-square "squircle" (item 43): a real photo crop reads as a photo at this
     aspect ratio, where the prior square box (with a radius large relative to its own size) read
     as an icon glyph instead. */
  .hero-image-thumb {
    height: 2rem;
    width: 3.25rem;
    flex: none;
    border-radius: var(--radius-box, 0.5rem);
    border: 1px solid var(--cairn-card-border);
    object-fit: cover;
  }

  /* The no-URL placeholder (item 28): a plain tinted box rather than an `<img src="">`, which
     renders as a broken-image icon in every browser. */
  .hero-image-thumb-blank {
    background: color-mix(in oklab, var(--color-base-content) 8%, transparent);
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
    border-radius: var(--radius-box, 0.5rem);
    /* A hairline that clears the audit's own 3:1 border-contrast floor against both themes'
       page and card grounds, rather than the fixed `--cairn-card-border` token (item 28). */
    border: 1px solid color-mix(in oklab, var(--color-base-content) 30%, transparent);
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
    /* Transparent at rest, so the selected entry's own colored border (below) never shifts this
       row's own padding/content when it toggles on or off. */
    border-left: 2px solid transparent;
  }

  .hero-image-option:hover {
    background-color: color-mix(in oklab, var(--color-base-content) 5%, transparent);
  }

  .hero-image-option-selected {
    background-color: color-mix(in oklab, var(--color-primary) 12%, transparent);
    border-left-color: var(--color-primary);
  }

  /* The visible focus ring: the admin theme already ships a global `:focus-visible` rule
     (`cairn-admin.css`, `outline: 2px solid var(--color-primary); outline-offset: 2px`), but its
     `:where()` selector carries zero specificity, and this rule's own tighter `1px` offset (a
     dense listbox row has less room to spare than the ring's default 2px) needs real specificity
     to win over it, hence a plain rule here rather than relying on the sheet's own default. */
  .hero-image-option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
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
    color: var(--cairn-warning-ink);
  }
</style>
