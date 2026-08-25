import { describe, expect, it } from 'vitest';
import { displayDescription } from '$lib/assets-format';

describe('displayDescription', () => {
  it('title-cases a single all-caps token', () => {
    expect(displayDescription('TRAILER')).toBe('Trailer');
  });

  it('title-cases every all-caps token in a multi-word description', () => {
    expect(displayDescription('BAT BOAT')).toBe('Bat Boat');
  });

  it('leaves a short all-caps token (under 3 characters) untouched', () => {
    expect(displayDescription('LASER II')).toBe('Laser II');
  });

  it('leaves a digit token untouched alongside a recased word', () => {
    expect(displayDescription('BUCC 2')).toBe('Bucc 2');
  });

  it('leaves an already mixed-case description untouched', () => {
    expect(displayDescription('New paint job Blue Sailboat')).toBe('New paint job Blue Sailboat');
  });

  it('passes null through unchanged', () => {
    expect(displayDescription(null)).toBeNull();
  });

  it('passes an empty string through unchanged', () => {
    expect(displayDescription('')).toBe('');
  });
});
