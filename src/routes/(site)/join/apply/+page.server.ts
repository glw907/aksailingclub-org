// The public join door's own `load` (Task 3): the current tier prices, the waiver wording
// version, and every visible current-season class with its live fee and fullness (a full class
// still lists, so a member can still pick it and land on the waitlist, per the design's own
// "Classes (optional)" section). Read live at request time, the same reason the class-signup
// page and the class-schedule island both stay dynamic.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listClassesWithCounts, isPubliclyOpen } from '$admin-club/lib/classes-store';
import { hasActiveOfferForClass } from '$admin-club/lib/offers';
import { getCurrentSeason, getTierPrices, getWaiverTextVersion } from '$admin-club/lib/club-settings';

export const prerender = false;

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.CLUB_DB;
  if (!db) error(503, 'Joining online is not available right now.');

  const [prices, waiverVersion, season, allClasses] = await Promise.all([
    getTierPrices(db),
    getWaiverTextVersion(db),
    getCurrentSeason(db),
    listClassesWithCounts(db),
  ]);

  const seasonClasses = allClasses.filter((cls) => cls.season === season && cls.visible);
  const classes = await Promise.all(
    seasonClasses.map(async (cls) => ({
      id: cls.id,
      name: cls.name,
      fee: cls.fee,
      isFull: !isPubliclyOpen(cls, await hasActiveOfferForClass(db, cls.id)),
    })),
  );

  return { prices, waiverVersion, season, classes };
};
