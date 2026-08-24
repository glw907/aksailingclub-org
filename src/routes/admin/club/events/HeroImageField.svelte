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
clicking a grid option rather than typing, and `heroImageAlt` is a real, visible `TextInput` (the
alt text is worth letting an officer override per placement, even when the library entry already
carries one), visible in both the rest and open states since it edits per-placement alt regardless
of the library. A real listbox (`role="listbox"`/`role="option"`, roving tabindex, arrow/Home/End/
Enter keyboard operation), not a styled `<select>`, since a grid option needs a thumbnail and a
needs-alt cue a native select cannot render.

Known limitation: the committed manifest is a build-time read (`src/theme/cairn.config.ts`'s own
`mediaManifest` export), so an asset uploaded through cairn's Library appears in this picker only
after that commit deploys -- there is no live read of the library from an admin route.

**Events admin probe round (Geoff, 2026-08-24): the picker closes at rest.** The always-open
vertical listbox with oval-rounded thumbs (below) read as busy against the row's own typeset
columns and was rejected. At rest -- the default whenever the row form mounts, and the state
`Clear` returns to -- the picker shows only a large landscape preview beside a caption, the
entry's name and alt, and a `Change photo`/`Choose photo` button; the library itself (search plus
a photos-first thumbnail grid, keeping the same listbox semantics and keyboard operation) opens
only on demand and closes again the moment an option is chosen. Because the trigger button is
destroyed and remounted across that toggle (`{#if open}`/`{:else}`, not a persisting bound ref),
focus returns to it via the same fresh-mount `use:` action idiom this route's own date cell uses
(`+page.svelte`'s `focusIfReturning`), not `tick()` plus a tracked ref. The state transitions
themselves (`select`/`clear`/`openLibrary`/`closeLibrary`, plus the grid's arrow-key math) live in
`hero-image-picker.ts`, a plain, DOM-free module this component's handlers call and then apply
back onto `$state`: this repo's Vitest setup (`environment: 'node'` plus vitest's SSR transform
of `.svelte` files) has no client `mount()`, so a real mount-and-click test of this component's
own open/close/select interaction is not available, and the module is what a test can actually
reach.

**Reviewer fan-out fix round (docs/plans/2026-08-22-events-admin.md's fix brief, item 28, plus
item 43's "Hero photo" label and landscape thumb), still load-bearing after the rest/open split
above.** A single `activeIndex` (the selected entry, falling back to the first filtered one)
drives the roving tabindex, rather than a per-option inline expression; option refs are keyed by
the entry's own token instead of its array index, so a ref never goes stale against the wrong
entry once a search re-filters the list. A library entry with no resolvable URL renders a blank
placeholder span rather than an `<img src="">` (a broken-image icon), in both the rest preview and
a grid thumbnail.
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
  import { FieldLabel, FieldRow, TextInput } from '@glw907/cairn-cms/admin-toolkit';
  import {
    clearHero,
    closeLibrary as closeLibraryState,
    nextOptionIndex,
    openLibrary as openLibraryState,
    selectEntry,
    type HeroPickerState,
  } from './hero-image-picker';

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

  /** The library grid: closed on mount and whenever `Clear`/a chosen option returns the field to
   *  rest, per the probe verdict above. Plain local state, no prop to force it open. */
  let open = $state(false);

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

  /** Applies a `hero-image-picker.ts` state-transition result back onto this component's own
   *  `$state`/`$bindable` fields -- the module functions are pure (state in, state out) so they
   *  stay unit-testable with no DOM, and this is the one place their result lands. */
  function applyState(next: HeroPickerState) {
    open = next.open;
    heroImage = next.heroImage;
    heroImageAlt = next.heroImageAlt;
  }

  function select(entry: HeroLibraryEntry) {
    applyState(selectEntry({ open, heroImage, heroImageAlt }, entry));
    returnFocusPending = true;
  }

  /** Clearing returns the FIELD to unset, but per the probe verdict leaves the library's own
   *  open/closed state untouched -- rest stays rest. The trigger button's own label still flips
   *  (`Change photo` -> `Choose photo`), which destroys and remounts it, so it still rides
   *  `returnFocusPending` below like the open/close toggle does. */
  function clear() {
    applyState(clearHero({ open, heroImage, heroImageAlt }));
    returnFocusPending = true;
  }

  function openLibrary() {
    applyState(openLibraryState({ open, heroImage, heroImageAlt }));
  }

  /** Set wherever the trigger button's own DOM node is about to be destroyed and remounted --
   *  closing the grid (via a chosen option or Escape) and clearing a chosen photo both swap which
   *  branch renders the button. Consumed by `focusIfReturning` below. */
  let returnFocusPending = $state(false);

  function closeLibrary() {
    applyState(closeLibraryState({ open, heroImage, heroImageAlt }));
    returnFocusPending = true;
  }

  /** Focuses the rest-state trigger button (`Change photo`/`Choose photo`) once it remounts:
   *  a fresh node every time the `{#if !open}` branch turns true, so a one-shot focus in the
   *  action body is enough, mirroring `+page.svelte`'s own `focusIfReturning` for the same reason
   *  (no `tick()` or tracked ref, since the node is never the same one twice). */
  function focusIfReturning(node: HTMLButtonElement) {
    if (returnFocusPending) {
      node.focus();
      returnFocusPending = false;
    }
  }

  /** Focuses the search box the moment the library opens: a fresh `<input>` mounts every time the
   *  `{#if open}` branch turns true, so this is the same one-shot idiom as `focusIfReturning`
   *  above, just running unconditionally since opening always wants the search box focused. */
  function focusOnOpen(node: HTMLInputElement) {
    node.focus();
  }

  function focusOption(index: number) {
    const token = filtered[index]?.token;
    if (token) optionEls[token]?.focus();
  }

  function onOptionKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(filtered[index]);
      return;
    }
    if (event.key === 'Escape') {
      // stopPropagation: the ledger page keys its own Escape handling (date-edit mode, the
      // roll-forward panel) off ancestors this cell can sit inside; closing the library must
      // never double as one of those exits.
      event.preventDefault();
      event.stopPropagation();
      closeLibrary();
      return;
    }
    // ArrowLeft/ArrowRight alias +-1 through the filtered list, same as Up/Down (`nextOptionIndex`
    // in hero-image-picker.ts): real 2D grid navigation, moving a visual row at a time, is out of
    // scope for this pass.
    const next = nextOptionIndex(event.key, index, filtered.length);
    if (next !== undefined) {
      event.preventDefault();
      focusOption(next);
    }
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLibrary();
    }
  }
</script>

<div class="hero-image-field">
  <input type="hidden" name="heroImage" value={heroImage} />

  {#if !open}
    <div class="hero-image-rest">
      {#if current}
        {#if current.url}
          <img class="hero-image-preview" src={current.url} alt="" />
        {:else}
          <span class="hero-image-preview hero-image-preview-blank" aria-hidden="true"></span>
        {/if}
        <FieldRow>
          <FieldLabel label="Hero photo">
            <span class="type-body">
              <span class="font-medium">{current.displayName}</span>
              {#if heroImageAlt}<span class="text-muted"> &middot; {heroImageAlt}</span>{/if}
            </span>
          </FieldLabel>
          <button type="button" class="btn btn-sm" onclick={openLibrary} use:focusIfReturning>
            Change photo
          </button>
          <button type="button" class="btn btn-ghost btn-sm" onclick={clear}>Clear</button>
        </FieldRow>
      {:else}
        <FieldRow>
          <FieldLabel label="Hero photo">
            <span class="type-body text-muted">No hero photo chosen.</span>
          </FieldLabel>
          <button type="button" class="btn btn-sm" onclick={openLibrary} use:focusIfReturning>
            Choose photo
          </button>
        </FieldRow>
      {/if}
    </div>
  {:else}
    <FieldLabel label={`Hero photo · ${library.length} ${library.length === 1 ? 'photo' : 'photos'}`}>
      <div class="hero-image-open">
        <!-- Cancel beside the search: Escape already closes, but a mouse needs a visible way
             back out that is not "choose something" (settle-round read, 2026-08-24). Same close
             path as Escape, focus returned to the remounted trigger. -->
        <div class="hero-image-search-row">
          <input
            class="input input-sm"
            type="search"
            bind:value={query}
            placeholder="Search by name or alt text"
            aria-label="Search photos"
            aria-controls={listboxId}
            onkeydown={onSearchKeydown}
            use:focusOnOpen
          />
          <button type="button" class="btn btn-ghost btn-sm" onclick={closeLibrary}>Cancel</button>
        </div>
        <ul id={listboxId} role="listbox" aria-label="Hero photo library" class="hero-image-grid">
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
                class="hero-image-grid-option"
                class:hero-image-grid-option-selected={entry.token === heroImage}
                onclick={() => select(entry)}
                onkeydown={(event) => onOptionKeydown(event, index)}
              >
                {#if entry.url}
                  <img class="hero-image-grid-thumb" src={entry.url} alt="" />
                {:else}
                  <span class="hero-image-grid-thumb hero-image-grid-thumb-blank" aria-hidden="true"></span>
                {/if}
                <span class="hero-image-grid-caption">{entry.displayName}</span>
                <!-- A sibling of the caption, not its child: the caption ellipsizes on one line,
                     and the library's own 19-26-character slug names consume it entirely, so a
                     nested cue would never render. -->
                {#if !entry.alt.trim()}<span class="hero-image-needs-alt">Needs alt</span>{/if}
              </li>
            {/each}
          {/if}
        </ul>
      </div>
    </FieldLabel>
  {/if}

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

  .hero-image-rest {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  /* Landscape, not a near-square "squircle": a real photo crop reads as a photo at this aspect
     ratio, where a square box (with a radius large relative to its own size) reads as an icon
     glyph instead. */
  .hero-image-preview {
    width: 264px;
    aspect-ratio: 3 / 2;
    flex: none;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in oklab, var(--color-base-content) 30%, transparent);
    object-fit: cover;
  }

  /* The no-URL placeholder: a plain tinted box rather than an `<img src="">`, which renders as a
     broken-image icon in every browser. */
  .hero-image-preview-blank {
    background: color-mix(in oklab, var(--color-base-content) 8%, transparent);
  }

  .hero-image-open {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hero-image-search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hero-image-search-row input {
    flex: 1;
    min-width: 0;
  }

  .hero-image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
    gap: 0.625rem;
    max-height: 21rem;
    overflow: auto;
    margin: 0;
    padding: 0.5rem;
    list-style: none;
    border-radius: var(--radius-box, 0.5rem);
    /* A hairline that clears the audit's own 3:1 border-contrast floor against both themes'
       page and card grounds, rather than the fixed `--cairn-card-border` token. */
    border: 1px solid color-mix(in oklab, var(--color-base-content) 30%, transparent);
  }

  .hero-image-empty {
    padding: 0.75rem;
  }

  .hero-image-grid-option {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    gap: 0.375rem;
    border-radius: var(--radius-field, 0.25rem);
    padding: 0.375rem;
    /* Transparent at rest, so the selected entry's own colored border (below) never shifts this
       option's own padding/content when it toggles on or off. */
    border: 2px solid transparent;
  }

  .hero-image-grid-option:hover {
    background-color: color-mix(in oklab, var(--color-base-content) 5%, transparent);
  }

  .hero-image-grid-option-selected {
    background-color: color-mix(in oklab, var(--color-primary) 12%, transparent);
    border-color: var(--color-primary);
  }

  /* The visible focus ring: the admin theme already ships a global `:focus-visible` rule
     (`cairn-admin.css`, `outline: 2px solid var(--color-primary); outline-offset: 2px`), but its
     `:where()` selector carries zero specificity, and this rule's own tighter `1px` offset (a
     dense grid option has less room to spare than the ring's default 2px) needs real specificity
     to win over it, hence a plain rule here rather than relying on the sheet's own default. */
  .hero-image-grid-option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  .hero-image-grid-thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 2;
    border-radius: 0.375rem;
    border: 1px solid var(--cairn-card-border);
    object-fit: cover;
  }

  .hero-image-grid-thumb-blank {
    background: color-mix(in oklab, var(--color-base-content) 8%, transparent);
  }

  .hero-image-grid-caption {
    overflow: hidden;
    font-size: 0.75rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hero-image-needs-alt {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--cairn-warning-ink);
  }
</style>
