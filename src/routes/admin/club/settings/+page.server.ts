// The Club section's Settings screen (initiative 5 Task 3, superseding Task 4/pass 2.2's role
// management): the waitlist offer window, the three membership tier prices, the class
// registration-opens gate (migration 0018_class_lifecycle), and the season rollover. Role
// management retired with `club-roles.ts`: cairn's own ManageEditors screen
// (`/admin/editors`), reading the vocabulary declared in `cairn.config.ts`, is the one place a
// seat is granted or revoked now. The parent layout guard (../+layout.server.ts) admits any club
// role into this section, so an admin can still see every current value; every WRITE here is
// owner-only through `clubAdminAction`'s `ownerOnly` option (Task 6's rider 1, now checking the
// engine's verified `ctx.editor.capability` rather than a `club_roles` row), since changing a
// price or rolling the season over is a different trust level than the day-to-day admin work the
// rest of Club allows.
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import {
  getClassRegistrationOpens,
  getOfferWindowHours,
  getTierPrices,
  setClassRegistrationOpens,
  setOfferWindowHours,
  setTierPrice,
} from '$admin-club/lib/club-settings';
import type { MembershipTier } from '$admin-club/lib/member-types';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getRolloverPreview, runSeasonRollover, SeasonMismatchError, type RolloverPreview } from '$admin-club/lib/rollover';

export const load: PageServerLoad = async (event) => {
  const editor = requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) {
    return {
      offerWindowHours: null,
      tierPrices: null,
      classRegistrationOpens: null,
      rollover: null as RolloverPreview | null,
      isOwner: false,
      error: 'CLUB_DB is not bound.',
    };
  }
  const [offerWindowHours, tierPrices, classRegistrationOpens, rollover] = await Promise.all([
    getOfferWindowHours(db),
    getTierPrices(db),
    getClassRegistrationOpens(db),
    getRolloverPreview(db),
  ]);
  return {
    offerWindowHours,
    tierPrices,
    classRegistrationOpens,
    rollover,
    isOwner: editor.capability === 'owner',
    error: null as string | null,
  };
};

const TIER_FIELD: Record<MembershipTier, string> = {
  individual: 'individual',
  family: 'family',
  'young-adult': 'youngAdult',
};

/** Parse one tier's submitted price as a positive whole-dollar integer, or an error string
 *  naming which tier failed (so the action can report exactly one bad field, not a generic
 *  refusal). */
function parseTierPrice(form: FormData, tier: MembershipTier): number | { error: string } {
  const raw = form.get(TIER_FIELD[tier]);
  const dollars = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(dollars) || dollars <= 0) {
    return { error: `Enter a whole-dollar price for the ${tier} tier.` };
  }
  return dollars;
}

/** A real type predicate (unlike a bare `typeof v === 'object'` inline check), since TypeScript's
 *  `in` operator narrowing refuses a union that includes a primitive like `number`. */
function isTierPriceError(value: number | { error: string }): value is { error: string } {
  return typeof value === 'object';
}

export const actions: Actions = {
  updateOfferWindow: clubAdminAction(
    async ({ form, ctx }) => {
      const raw = form.get('offerWindowHours');
      const hours = typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isInteger(hours) || hours <= 0) {
        ctx.audit({ action: 'update-offer-window', entity: 'setting', detail: 'rejected: invalid hours' });
        return fail(400, { error: 'Enter a whole number of hours greater than zero.' });
      }
      await setOfferWindowHours(ctx.db, hours, ctx.editor.email);
      ctx.audit({
        action: 'update-offer-window',
        entity: 'setting',
        entityId: 'offer_window_hours',
        detail: String(hours),
      });
      return { ok: true };
    },
    { ownerOnly: true, action: 'update-offer-window', entity: 'setting', deniedMessage: 'Only a club owner can change this setting.' },
  ),

  updateClassRegistrationOpens: clubAdminAction(
    async ({ form, ctx }) => {
      const raw = form.get('classRegistrationOpens');
      const opensIso = typeof raw === 'string' ? raw.trim() : '';
      try {
        await setClassRegistrationOpens(ctx.db, opensIso, ctx.editor.email);
      } catch (err) {
        if (err instanceof Error) {
          ctx.audit({ action: 'update-class-registration-opens', entity: 'setting', detail: `rejected: ${err.message}` });
          return fail(400, { error: 'Enter a valid date (YYYY-MM-DD) or leave it blank to disable the gate.' });
        }
        throw err;
      }
      ctx.audit({
        action: 'update-class-registration-opens',
        entity: 'setting',
        entityId: 'class_registration_opens',
        detail: opensIso || 'cleared',
      });
      return { ok: true };
    },
    {
      ownerOnly: true,
      action: 'update-class-registration-opens',
      entity: 'setting',
      deniedMessage: 'Only a club owner can change this setting.',
    },
  ),

  updateTierPrices: clubAdminAction(
    async ({ form, ctx }) => {
      const individual = parseTierPrice(form, 'individual');
      if (isTierPriceError(individual)) {
        ctx.audit({ action: 'update-tier-prices', entity: 'setting', detail: `rejected: ${individual.error}` });
        return fail(400, { error: individual.error });
      }
      const family = parseTierPrice(form, 'family');
      if (isTierPriceError(family)) {
        ctx.audit({ action: 'update-tier-prices', entity: 'setting', detail: `rejected: ${family.error}` });
        return fail(400, { error: family.error });
      }
      const youngAdult = parseTierPrice(form, 'young-adult');
      if (isTierPriceError(youngAdult)) {
        ctx.audit({ action: 'update-tier-prices', entity: 'setting', detail: `rejected: ${youngAdult.error}` });
        return fail(400, { error: youngAdult.error });
      }
      await Promise.all([
        setTierPrice(ctx.db, 'individual', individual, ctx.editor.email),
        setTierPrice(ctx.db, 'family', family, ctx.editor.email),
        setTierPrice(ctx.db, 'young-adult', youngAdult, ctx.editor.email),
      ]);
      ctx.audit({
        action: 'update-tier-prices',
        entity: 'setting',
        detail: `individual=${individual}, family=${family}, young-adult=${youngAdult}`,
      });
      return { ok: true };
    },
    { ownerOnly: true, action: 'update-tier-prices', entity: 'setting', deniedMessage: 'Only a club owner can change tier prices.' },
  ),

  rollover: clubAdminAction(
    async ({ form, ctx }) => {
      const typedYear = form.get('typedYear');
      if (typeof typedYear !== 'string' || !typedYear.trim()) {
        ctx.audit({ action: 'season-rollover', entity: 'season', detail: 'rejected: no year typed' });
        return fail(400, { error: 'Type the new season year to confirm.' });
      }
      try {
        const result = await runSeasonRollover(ctx.db, { typedYear, confirmedBy: ctx.editor.email });
        // No separate ctx.audit call here: runSeasonRollover's own db.batch already wrote the
        // authoritative, atomic audit_log row (rollover.ts's own header on why that write can't
        // ride the engine's fire-and-forget auditSink). adminAction still requires at least one
        // ctx.audit emit per handler (its own unconditional contract), so this records a lighter,
        // structurally-required companion entry rather than skip the requirement.
        ctx.audit({ action: 'season-rollover', entity: 'season', entityId: String(result.nextSeason) });
        return { ok: true, rollover: result };
      } catch (err) {
        if (err instanceof SeasonMismatchError) {
          ctx.audit({ action: 'season-rollover', entity: 'season', detail: `rejected: ${err.message}` });
          return fail(400, { error: err.message });
        }
        throw err;
      }
    },
    { ownerOnly: true, action: 'season-rollover', entity: 'season', deniedMessage: 'Only a club owner can roll the season over.' },
  ),
};
