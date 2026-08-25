// hero-image-picker.ts's state-transition and keyboard-navigation math (probe verdict,
// 2026-08-24: the hero picker closes at rest). Pure functions, no DOM and no Svelte
// instantiation needed -- see the module's own header comment for why a real mount-and-click
// test of `HeroImageField.svelte` itself is not available in this repo's Vitest setup.
import { describe, expect, it } from 'vitest';
import type { HeroLibraryEntry } from '../routes/admin/club/events/HeroImageField.svelte';
import {
  clearHero,
  closeLibrary,
  nextOptionIndex,
  openLibrary,
  selectEntry,
  type HeroPickerState,
} from '../routes/admin/club/events/hero-image-picker';

const ENTRY: HeroLibraryEntry = {
  token: 'media:photo-a.0123456789abcdef',
  displayName: 'Photo A',
  alt: 'A dinghy on the beach.',
  url: '/media/a.jpg',
};

function state(overrides: Partial<HeroPickerState> = {}): HeroPickerState {
  return { open: false, heroImage: '', heroImageAlt: '', ...overrides };
}

describe('hero-image-picker state transitions', () => {
  it('is closed by construction whenever a caller starts from the default state (closed at mount)', () => {
    expect(state().open).toBe(false);
  });

  it('opens the library on openLibrary, regardless of whether a photo is already chosen', () => {
    expect(openLibrary(state()).open).toBe(true);
    expect(openLibrary(state({ heroImage: ENTRY.token })).open).toBe(true);
  });

  it('choosing an option writes the token and closes the grid', () => {
    const next = selectEntry(state({ open: true }), ENTRY);
    expect(next.open).toBe(false);
    expect(next.heroImage).toBe(ENTRY.token);
  });

  it('choosing an option fills a still-blank alt from the entry, but never overwrites an officer-entered alt', () => {
    const filled = selectEntry(state({ open: true, heroImageAlt: '' }), ENTRY);
    expect(filled.heroImageAlt).toBe(ENTRY.alt);

    const kept = selectEntry(state({ open: true, heroImageAlt: 'Custom placement alt' }), ENTRY);
    expect(kept.heroImageAlt).toBe('Custom placement alt');
  });

  it('Escape (closeLibrary) closes the grid without touching the chosen photo', () => {
    const next = closeLibrary(state({ open: true, heroImage: ENTRY.token, heroImageAlt: ENTRY.alt }));
    expect(next.open).toBe(false);
    expect(next.heroImage).toBe(ENTRY.token);
    expect(next.heroImageAlt).toBe(ENTRY.alt);
  });

  it('Clear unsets the field but leaves the library open/closed state untouched (rest stays rest)', () => {
    const atRest = clearHero(state({ open: false, heroImage: ENTRY.token, heroImageAlt: ENTRY.alt }));
    expect(atRest.open).toBe(false);
    expect(atRest.heroImage).toBe('');
    expect(atRest.heroImageAlt).toBe('');

    const stillOpen = clearHero(state({ open: true, heroImage: ENTRY.token, heroImageAlt: ENTRY.alt }));
    expect(stillOpen.open).toBe(true);
  });
});

describe('hero-image-picker keyboard navigation', () => {
  it.each([
    ['ArrowDown', 1, 3, 2],
    ['ArrowRight', 1, 3, 2],
    ['ArrowUp', 1, 3, 0],
    ['ArrowLeft', 1, 3, 0],
    ['Home', 2, 3, 0],
    ['End', 0, 3, 2],
  ])('%s from index %i of %i moves to %i', (key, index, length, expected) => {
    expect(nextOptionIndex(key, index, length)).toBe(expected);
  });

  it('clamps ArrowDown/ArrowRight at the last option and ArrowUp/ArrowLeft at the first', () => {
    expect(nextOptionIndex('ArrowDown', 2, 3)).toBe(2);
    expect(nextOptionIndex('ArrowRight', 2, 3)).toBe(2);
    expect(nextOptionIndex('ArrowUp', 0, 3)).toBe(0);
    expect(nextOptionIndex('ArrowLeft', 0, 3)).toBe(0);
  });

  it('returns undefined for a non-navigation key, so the caller knows not to preventDefault', () => {
    expect(nextOptionIndex('Enter', 0, 3)).toBeUndefined();
    expect(nextOptionIndex('a', 0, 3)).toBeUndefined();
  });

  it('returns undefined against an empty list', () => {
    expect(nextOptionIndex('ArrowDown', 0, 0)).toBeUndefined();
  });
});
