// The Club section's Classes list (Classes pass Task 3 rebuild,
// docs/2026-07-21-classes-pass-design.md): season-scoped by default (`settings.current_season`,
// history reachable behind `?season=`), each row carrying its own roster (name, birthdate,
// fee_paid) and waitlist summary (count, next in line, any active offer) eagerly, in one batched
// read -- never a per-class query loop (`classes-store.ts`'s `listRostersBySeason`/
// `listWaitlistSummariesBySeason`). The stale-offer sweep on load stays the same lazy sweep the
// detail page's own load runs, so a past-expiry offer never counts as active here either.
//
// `offerNext` is the list screen's own contextual action: unlike the detail page's `offer` action
// (which takes an explicit `waitlistId`, the admin's own pick), this one always targets the head
// of the class's own queue -- the list's expand panel offers no per-entry picker, only the one
// "Offer next seat" button `canOfferNextSeat` gates. The three guard messages mirror `offerSpot`'s
// own refusals plus the class-wide active-offer check `offerSpot` alone does not make (it only
// blocks a second offer to the SAME waitlist entry, not a second offer on the class as a whole).
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import {
  getClassWithCounts,
  listClassesWithCounts,
  listClassSeasons,
  listRostersBySeason,
  listWaitlist,
  listWaitlistSummariesBySeason,
  type ClassRosterMember,
  type ClassWaitlistSummary,
  type ClassWithCounts,
} from '$admin-club/lib/classes-store';
import { expireStaleOffers, hasActiveOfferForClass, listOutstandingOffers, offerSpot } from '$admin-club/lib/offers';

/** One list row: a class plus what its expand panel renders, both loaded eagerly so the panel
 *  needs no separate fetch (the same "everything the panel needs already rode along" shape the
 *  Members screen's own `HouseholdListRow` established). */
export interface ClassListRow extends ClassWithCounts {
  roster: ClassRosterMember[];
  waitlist: ClassWaitlistSummary;
  /** The class's one active (unresolved, unexpired) offer's expiry, or `null` when none is live:
   *  the panel's own pending-offer marker and the `offerNext` guard both read this. */
  activeOfferExpiresAt: string | null;
}

function parseSeason(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) {
    return {
      classes: [] as ClassListRow[],
      season: parseSeason(event.url.searchParams.get('season'), 0),
      currentSeason: 0,
      seasons: [] as number[],
      error: 'CLUB_DB is not bound.',
    };
  }
  try {
    // The same lazy sweep the per-class detail page's load runs before reading anything else, so
    // a stale, past-expiry offer never counts as active on this list either.
    await expireStaleOffers(db);
    const currentSeason = await getCurrentSeason(db);
    const season = parseSeason(event.url.searchParams.get('season'), currentSeason);
    const [classes, rosters, waitlistSummaries, outstandingOffers, seasonsRaw] = await Promise.all([
      listClassesWithCounts(db, season),
      listRostersBySeason(db, season),
      listWaitlistSummariesBySeason(db, season),
      listOutstandingOffers(db),
      listClassSeasons(db),
    ]);
    const offerByClass = new Map(outstandingOffers.map((offer) => [offer.classId, offer]));
    const rows: ClassListRow[] = classes.map((cls) => ({
      ...cls,
      roster: rosters.get(cls.id) ?? [],
      waitlist: waitlistSummaries.get(cls.id) ?? { count: 0, nextName: null },
      activeOfferExpiresAt: offerByClass.get(cls.id)?.expiresAt ?? null,
    }));
    // The current season is always an offered option, even before its first class exists: a
    // brand-new season otherwise vanishes from its own filter the moment the list is empty.
    const seasons = seasonsRaw.includes(currentSeason) ? seasonsRaw : [currentSeason, ...seasonsRaw].sort((a, b) => b - a);
    return { classes: rows, season, currentSeason, seasons, error: null as string | null };
  } catch (err) {
    console.error('admin/club/classes: CLUB_DB read failed', err);
    return {
      classes: [] as ClassListRow[],
      season: parseSeason(event.url.searchParams.get('season'), 0),
      currentSeason: 0,
      seasons: [] as number[],
      error: 'Could not read the classes table.',
    };
  }
};

const DENIED_MESSAGE = 'A club role is required to manage classes.';

export const actions: Actions = {
  offerNext: clubAdminAction(
    async ({ event, form, ctx }) => {
      const classId = form.get('classId');
      if (typeof classId !== 'string' || !classId.trim()) {
        ctx.audit({ action: 'offer', entity: 'offer', detail: 'rejected: missing classId' });
        return fail(400, { error: 'A class is required.' });
      }
      const cls = await getClassWithCounts(ctx.db, classId);
      if (!cls) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: classId, detail: 'rejected: no such class' });
        return fail(404, { error: 'No such class.' });
      }
      if (cls.isFull) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: classId, detail: 'rejected: class is full' });
        return fail(400, { error: 'This class has no free spot to offer.' });
      }
      if (cls.waitlistCount === 0) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: classId, detail: 'rejected: waitlist empty' });
        return fail(400, { error: 'The waitlist is empty.' });
      }
      if (await hasActiveOfferForClass(ctx.db, classId)) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: classId, detail: 'rejected: offer already active' });
        return fail(400, { error: 'An offer is already active for this class.' });
      }
      const waitlist = await listWaitlist(ctx.db, classId);
      const head = waitlist[0];
      if (!head) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: classId, detail: 'rejected: waitlist empty' });
        return fail(400, { error: 'The waitlist is empty.' });
      }
      // `PUBLIC_ORIGIN` (never a request header) builds the claim link; `EMAIL` may be unbound in
      // some environments, and `offerSpot`'s own `notify` handling degrades gracefully either way
      // (the detail page's own `offer` action documents the same reasoning).
      const platformEnv = event.platform?.env;
      const origin = platformEnv?.PUBLIC_ORIGIN;
      const result = await offerSpot(ctx.db, {
        classId,
        waitlistId: head.id,
        actorEmail: ctx.editor.email,
        notify: platformEnv && origin ? { env: platformEnv, origin } : undefined,
      });
      if ('error' in result) {
        ctx.audit({ action: 'offer', entity: 'offer', entityId: head.id, detail: `rejected: ${result.error}` });
        return fail(400, { error: result.error });
      }
      ctx.audit({ action: 'offer', entity: 'offer', entityId: head.id });
      return { ok: true, offered: { classId, waitlistId: head.id, token: result.token, expiresAt: result.expiresAt } };
    },
    { action: 'offer', entity: 'offer', deniedMessage: DENIED_MESSAGE },
  ),
};
