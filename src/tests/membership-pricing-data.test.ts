import { describe, expect, it } from 'vitest';
import { formatTierPrice } from '$theme/membership-pricing-data';

const PRICES = { individual: 250, family: 500, 'young-adult': 100 };

describe('formatTierPrice', () => {
  it('formats a tier price the same way ui.ts formats every other dollar figure', () => {
    expect(formatTierPrice(PRICES, 'individual')).toBe('$250');
    expect(formatTierPrice(PRICES, 'family')).toBe('$500');
    expect(formatTierPrice(PRICES, 'young-adult')).toBe('$100');
  });

  it('falls back to the empty-dash display for a tier missing from the prices map', () => {
    const partial = { individual: 250 } as unknown as typeof PRICES;
    expect(formatTierPrice(partial, 'family')).toBe('—');
  });
});
