// The Club section's Events ledger (events-admin pass, Task 4,
// docs/plans/2026-08-22-events-admin.md, docs/2026-08-22-events-admin-design.md): replaces the
// flat chronological list with a season-scoped read of `listLedger` (Task 2's store), the same
// `?season=` default-to-current-season idiom `classes/+page.server.ts` established. Only two
// actions live here for this task -- `setDate` (the ledger's own inline current-season date
// save, with the publish-on-date rule living in the store) and `rollForward` (the "Start the
// next season" confirmation's submit). The row form's own `save`/`create`/`setVisibility`/
// `retire`/`delete` actions, and the `events/[id]`/`events/new` retirement, are Task 5's job;
// those two routes stay live and reachable in the meantime (a ledger row's panel links to
// `events/[id]` for a full edit until Task 5 replaces it with the in-place form).
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import {
  getEvent,
  listEventSeasons,
  listLedger,
  previewRollForward,
  rollForwardSeason,
  setEventDates,
  type LedgerRow,
  type RollForwardPlan,
} from '$admin-club/lib/events-store';

function parseSeason(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `''`/`undefined`/a non-`YYYY-MM-DD` string all read as invalid; a valid empty string means
 *  "clear the date" (`value: null`), matching `setEventDates`'s own nullable dates. */
const DATE_FIELD = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalDate(entry: FormDataEntryValue | null): { value: string | null } | null {
  if (typeof entry !== 'string') return null;
  if (entry === '') return { value: null };
  return DATE_FIELD.test(entry) ? { value: entry } : null;
}

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  const openId = event.url.searchParams.get('open');
  if (!db) {
    return {
      rows: [] as LedgerRow[],
      season: parseSeason(event.url.searchParams.get('season'), 0),
      currentSeason: 0,
      seasons: [] as number[],
      undatedCount: 0,
      rollPlan: null as RollForwardPlan | null,
      openId,
      error: 'CLUB_DB is not bound.',
    };
  }
  try {
    const currentSeason = await getCurrentSeason(db);
    const season = parseSeason(event.url.searchParams.get('season'), currentSeason);
    const [rows, seasonsRaw, rollPlan] = await Promise.all([
      listLedger(db, season),
      listEventSeasons(db),
      previewRollForward(db, { fromSeason: season, toSeason: season + 1 }),
    ]);
    // The current season is always an offered filter option, even before its first row exists:
    // otherwise a brand-new season vanishes from its own filter the moment the ledger is empty.
    const seasons = seasonsRaw.includes(currentSeason) ? seasonsRaw : [currentSeason, ...seasonsRaw].sort((a, b) => b - a);
    const undatedCount = rows.filter((row) => row.kind === 'event' && row.current !== null && row.current.startDate === null).length;
    return { rows, season, currentSeason, seasons, undatedCount, rollPlan, openId, error: null as string | null };
  } catch (err) {
    // Degrade to an honestly-labeled empty ledger rather than a raw 500, the same failure
    // posture the retired flat-list read used for this same screen.
    console.error('admin/club/events: CLUB_DB read failed', err);
    return {
      rows: [] as LedgerRow[],
      season: parseSeason(event.url.searchParams.get('season'), 0),
      currentSeason: 0,
      seasons: [] as number[],
      undatedCount: 0,
      rollPlan: null as RollForwardPlan | null,
      openId,
      error: 'Could not read the events table.',
    };
  }
};

const DENIED_MESSAGE = 'A club role is required to manage events.';

export const actions: Actions = {
  /** The current-season date cell's own save: refuses an unknown row, a malformed date, or an
   *  end date before the start, otherwise writes through `setEventDates` (whose own `CASE`
   *  carries the publish-on-date rule) and audits a second `'published'` record when the row
   *  crossed from undated to dated in this write. */
  setDate: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const row = id ? await getEvent(ctx.db, id) : null;
      if (!row) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id || undefined, detail: 'rejected: no such event' });
        return fail(404, { error: 'No such event.' });
      }
      const start = parseOptionalDate(form.get('startDate'));
      const end = parseOptionalDate(form.get('endDate'));
      if (start === null || end === null) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: malformed date' });
        return fail(400, { error: 'Enter a date as YYYY-MM-DD.' });
      }
      if (start.value !== null && end.value !== null && end.value < start.value) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: end before start' });
        return fail(400, { error: 'The end date is before the start date.' });
      }
      const wasUndated = row.startDate === null;
      await setEventDates(ctx.db, id, { startDate: start.value, endDate: end.value });
      ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'dates' });
      if (wasUndated && start.value !== null) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'published' });
      }
      return { ok: true };
    },
    { action: 'update', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** "Start the next season": the confirmation panel's own submit. `fromSeason` rides along as
   *  its own hidden field (never re-derived from the request URL) because a relative
   *  `action="?/rollForward"` resolves against the current page URL by REPLACING its whole query
   *  string, so an existing `?season=` param on the page never reaches this handler otherwise. */
  rollForward: clubAdminAction(
    async ({ form, ctx }) => {
      const fromSeasonEntry = form.get('fromSeason');
      const toSeasonEntry = form.get('toSeason');
      const fromSeason = typeof fromSeasonEntry === 'string' ? Number(fromSeasonEntry) : NaN;
      const toSeason = typeof toSeasonEntry === 'string' ? Number(toSeasonEntry) : NaN;
      if (!Number.isFinite(fromSeason) || !Number.isFinite(toSeason) || toSeason !== fromSeason + 1) {
        ctx.audit({ action: 'roll-forward', entity: 'event', detail: 'rejected: invalid target season' });
        return fail(400, { error: 'Invalid season.' });
      }
      const result = await rollForwardSeason(ctx.db, { fromSeason, toSeason });
      ctx.audit({
        action: 'roll-forward',
        entity: 'event',
        entityId: String(toSeason),
        detail: `${result.created} created, ${result.skipped} skipped`,
      });
      redirect(303, `?season=${toSeason}`);
    },
    { action: 'roll-forward', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),
};
