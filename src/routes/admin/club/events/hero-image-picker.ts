// The hero picker's own state-transition and keyboard-navigation math (probe verdict, 2026-08-24:
// the picker closes at rest, the library opens on demand as a photos-first grid), pulled out of
// `HeroImageField.svelte` so this pass can pin it with a plain unit test. This repo's Vitest
// setup (`environment: 'node'` plus vitest's SSR transform of `.svelte` files) has no client
// `mount()`, so a real mount-and-click test of the component's own open/close/select interaction
// is not available; these are the plain functions its event handlers call, tested directly with
// no DOM and no Svelte instantiation.
import type { HeroLibraryEntry } from './HeroImageField.svelte';

export interface HeroPickerState {
  open: boolean;
  heroImage: string;
  heroImageAlt: string;
}

/** Choosing an option: writes the token, fills a still-blank alt from the entry's own, and always
 *  closes the grid back to rest. */
export function selectEntry(state: HeroPickerState, entry: HeroLibraryEntry): HeroPickerState {
  return {
    open: false,
    heroImage: entry.token,
    heroImageAlt: state.heroImageAlt.trim() ? state.heroImageAlt : entry.alt,
  };
}

/** `Clear`: unsets the field but leaves `open` untouched -- rest stays rest. */
export function clearHero(state: HeroPickerState): HeroPickerState {
  return { ...state, heroImage: '', heroImageAlt: '' };
}

export function openLibrary(state: HeroPickerState): HeroPickerState {
  return { ...state, open: true };
}

/** Escape, from the search box or from an option, both call this. */
export function closeLibrary(state: HeroPickerState): HeroPickerState {
  return { ...state, open: false };
}

/** The grid's keyboard operation: ArrowUp/ArrowLeft and ArrowDown/ArrowRight both move by one
 *  (real 2D grid navigation, moving a visual row at a time, is out of scope for this pass), Home/
 *  End jump to the ends, and any other key returns `undefined` so the caller knows it was not a
 *  navigation key. Clamped to `[0, length - 1]`, so a caller never has to re-check the bound. */
export function nextOptionIndex(key: string, index: number, length: number): number | undefined {
  if (length === 0) return undefined;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(index + 1, length - 1);
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return undefined;
  }
}
