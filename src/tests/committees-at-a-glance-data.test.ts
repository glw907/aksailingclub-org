// The public At-a-Glance directive's pure "Who" cell derivation (T6b): the chair leads, co-chairs
// follow marked "(co-chair)", exactly the shape the hand-maintained table published.
import { describe, expect, it } from 'vitest';
import { chairCell } from '$theme/committees-at-a-glance-data';

describe('chairCell', () => {
  it('renders a lone chair as the plain name', () => {
    expect(chairCell([{ name: 'Steve Ryan', role: 'chair' }])).toBe('Steve Ryan');
  });

  it('puts the chair first and marks each co-chair, regardless of input order', () => {
    expect(
      chairCell([
        { name: 'Emily Ramirez', role: 'co-chair' },
        { name: 'Jonathan Ramirez', role: 'chair' },
      ]),
    ).toBe('Jonathan Ramirez, Emily Ramirez (co-chair)');
  });

  it('is an empty string for a chair-less committee', () => {
    expect(chairCell([])).toBe('');
  });
});
