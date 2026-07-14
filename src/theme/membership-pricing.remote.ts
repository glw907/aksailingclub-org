// The `membership-pricing` island's own read (Task 3): a query, not a form, since the island only
// reads (matching `class-schedule.remote.ts`'s own reasoning). Degrades to `null` on any D1
// failure or missing binding, which the component reads as its own generic fallback text.
import * as v from 'valibot';
import { query, getRequestEvent } from '$app/server';
import { getTierPrices } from '$admin-club/lib/club-settings';
import { formatTierPrice } from './membership-pricing-data';

const TIERS = ['individual', 'family', 'young-adult'] as const;

export const getTierPriceText = query(v.picklist(TIERS), async (tier) => {
  const db = getRequestEvent().platform?.env.CLUB_DB;
  if (!db) return null;
  try {
    const prices = await getTierPrices(db);
    return formatTierPrice(prices, tier);
  } catch {
    return null;
  }
});
