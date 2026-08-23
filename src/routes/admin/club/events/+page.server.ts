// The Club section's Events ledger (events-admin pass: load and `setDate`/`rollForward` from
// Task 4, docs/plans/2026-08-22-events-admin.md; the row form's own `save`/`create`/
// `setVisibility`/`retire`/`delete` actions from Task 5, which also retires `events/[id]` (now a
// redirect-only load, see that route's own `+page.server.ts`) and `events/new` (deleted outright,
// its job now the ledger's own `?/create` action and the blank-panel client state
// `+page.svelte` holds). `events-store.ts` stays untouched by Task 5: `retire` and `delete` each
// need one small existence/orphan check the store's own exported functions do not answer
// (whether an `event_series` row still exists at all, and whether deleting an event leaves its
// series orphaned), so those two live here as route-local D1 reads rather than growing the
// store's public surface for a route-only need.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { mediaToken } from '@glw907/cairn-cms/media';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import { mediaManifest, publicMediaResolver } from '$theme/cairn.config';
import {
  canDeleteEvent,
  createEvent,
  createSeries,
  findEventBySeasonSlug,
  getEvent,
  linkEventToSeries,
  listEventSeasons,
  listLedger,
  previewRollForward,
  retireSeries,
  rollForwardSeason,
  setEventDates,
  setEventVisibility,
  setSeriesTitleAndRecurrence,
  updateEvent,
  type EventRow,
  type LedgerRow,
  type RollForwardPlan,
} from '$admin-club/lib/events-store';
import { parseEventForm } from './event-form-input';
import type { HeroLibraryEntry } from './HeroImageField.svelte';

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

/** The hero picker's projected library (Task 5): every `image/*` entry in the committed
 *  manifest, mapped to the plain `{ token, displayName, alt, url }` shape `HeroImageField` takes,
 *  sorted by display name. Computed once at module scope since `mediaManifest` is a build-time
 *  read, not a per-request one. `alt` is coerced with `?? ''`: `MediaEntry.alt` is typed as a
 *  plain `string`, but a real committed manifest can carry a literal JSON `null` for an entry
 *  whose alt text was never set (verified against this repo's own `media.json`), which crashed
 *  `HeroImageField`'s own `entry.alt.trim()` "needs alt" check on the client. Coercing here, at
 *  the one place the manifest is read, keeps `HeroLibraryEntry.alt: string` an honest contract
 *  for every consumer rather than defending against null in each one. */
const HERO_LIBRARY: HeroLibraryEntry[] = Object.values(mediaManifest)
  .filter((entry) => entry.contentType.startsWith('image/'))
  .map((entry) => ({
    token: mediaToken({ slug: entry.slug, hash: entry.hash }),
    displayName: entry.displayName,
    alt: entry.alt ?? '',
    url: publicMediaResolver({ slug: entry.slug, hash: entry.hash }) ?? '',
  }))
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

/** `title` lowercased, every run of non-alphanumerics collapsed to one hyphen, and any leading or
 *  trailing hyphen trimmed -- the `create` action's own slug derivation (the design's "no slug
 *  field" ruling: an officer never types one). */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Whether an `event_series` row exists at all: `retire`'s own "unknown series" 404 guard. Not a
 *  question `events-store.ts` answers today (`linkEventToSeries` checks it internally but does not
 *  expose the check), and this route is the only caller, so it stays a small local read rather
 *  than growing the store's public surface for a route-only need (see this file's own header). */
async function seriesExists(db: D1Database, seriesId: string): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM event_series WHERE id = ?1').bind(seriesId).first<{ id: string }>();
  return row !== null;
}

/** Delete an event, and in the same `db.batch` delete its series when the delete leaves it
 *  holding no other rows -- the same orphan-cleanup shape `linkEventToSeries` already carries in
 *  `events-store.ts` for a series move. Kept route-local (mirroring the store's own single-row
 *  `DELETE FROM events` statement) rather than a second store export, since the store's own
 *  `deleteEvent` is a single, non-batched statement and this action needs the two writes atomic. */
async function deleteEventAndOrphanSeries(db: D1Database, row: EventRow): Promise<void> {
  const siblingsRemaining = await db
    .prepare('SELECT COUNT(*) AS n FROM events WHERE series_id = ?1 AND id != ?2')
    .bind(row.seriesId, row.id)
    .first<{ n: number }>();
  const orphaned = (siblingsRemaining?.n ?? 0) === 0;
  const statements: D1PreparedStatement[] = [db.prepare('DELETE FROM events WHERE id = ?1').bind(row.id)];
  if (orphaned) statements.push(db.prepare('DELETE FROM event_series WHERE id = ?1').bind(row.seriesId));
  await db.batch(statements);
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
      heroLibrary: HERO_LIBRARY,
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
    return { rows, season, currentSeason, seasons, undatedCount, rollPlan, openId, heroLibrary: HERO_LIBRARY, error: null as string | null };
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
      heroLibrary: HERO_LIBRARY,
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

  /** The row form's own Save: 404s an unknown id, parses, writes the event and its series' own
   *  title/recurrence, and -- only when `linkSeriesId` names a different series -- moves the row
   *  onto it, surfacing that move's own refusal as its own `fail(400)` even though the event and
   *  series writes just above it already committed (the design's own two-phase save: the fields
   *  save regardless, the link is attempted separately). */
  save: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const existing = id ? await getEvent(ctx.db, id) : null;
      if (!existing) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id || undefined, detail: 'rejected: no such event' });
        return fail(404, { error: 'No such event.' });
      }
      const parsed = parseEventForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      await updateEvent(ctx.db, id, { ...parsed.write, slug: existing.slug });
      await setSeriesTitleAndRecurrence(ctx.db, existing.seriesId, { title: parsed.write.title, recurrence: parsed.recurrence });
      ctx.audit({ action: 'update', entity: 'event', entityId: id });

      if (parsed.linkSeriesId && parsed.linkSeriesId !== existing.seriesId) {
        const result = await linkEventToSeries(ctx.db, id, parsed.linkSeriesId);
        if ('error' in result) {
          ctx.audit({ action: 'link-series', entity: 'event_series', entityId: parsed.linkSeriesId, detail: `rejected: ${result.error}` });
          return fail(400, { error: result.error });
        }
        ctx.audit({ action: 'link-series', entity: 'event_series', entityId: parsed.linkSeriesId });
      }
      return { ok: true };
    },
    { action: 'update', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** "New event": derives the slug from the title, refuses a same-season name collision, mints a
   *  fresh series and event id, and lands the officer back on the row it just created. */
  create: clubAdminAction(
    async ({ form, ctx }) => {
      const parsed = parseEventForm(form);
      if ('error' in parsed) {
        ctx.audit({ action: 'create', entity: 'event', detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const seasonEntry = form.get('season');
      const season = typeof seasonEntry === 'string' ? Number(seasonEntry) : NaN;
      if (!Number.isFinite(season)) {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: invalid season' });
        return fail(400, { error: 'Invalid season.' });
      }
      const slug = slugify(parsed.write.title);
      if (await findEventBySeasonSlug(ctx.db, season, slug)) {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: name already exists this season' });
        return fail(400, { error: 'An event with that name already exists this season.' });
      }
      const seriesId = `series-${slug}-${season}`;
      const id = `${slug}-${season}`;
      await createSeries(ctx.db, { id: seriesId, title: parsed.write.title, recurrence: parsed.recurrence });
      await createEvent(ctx.db, { id, season, seriesId, write: { ...parsed.write, slug } });
      ctx.audit({ action: 'create', entity: 'event_series', entityId: seriesId });
      ctx.audit({ action: 'create', entity: 'event', entityId: id });
      redirect(303, `?season=${season}&open=${id}`);
    },
    { action: 'create', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** Hide/Show, the footer's own visibility toggle -- the only other place `visible` is written
   *  besides `setDate`'s publish-on-date rule. */
  setVisibility: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const visible = form.get('show') === '1';
      const row = id ? await getEvent(ctx.db, id) : null;
      if (!row) {
        ctx.audit({
          action: visible ? 'show' : 'hide',
          entity: 'event',
          entityId: id || undefined,
          detail: 'rejected: no such event',
        });
        return fail(404, { error: 'No such event.' });
      }
      await setEventVisibility(ctx.db, id, visible);
      ctx.audit({ action: visible ? 'show' : 'hide', entity: 'event', entityId: id });
      return { ok: true };
    },
    { action: 'update', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** Retire/Unretire a series -- reversible, and refuses an unknown series id 404 rather than
   *  writing a no-op `UPDATE`. */
  retire: clubAdminAction(
    async ({ form, ctx }) => {
      const seriesIdEntry = form.get('seriesId');
      const seriesId = typeof seriesIdEntry === 'string' ? seriesIdEntry : '';
      const retired = form.get('retired') === '1';
      if (!seriesId || !(await seriesExists(ctx.db, seriesId))) {
        ctx.audit({
          action: retired ? 'retire' : 'unretire',
          entity: 'event_series',
          entityId: seriesId || undefined,
          detail: 'rejected: no such series',
        });
        return fail(404, { error: 'No such series.' });
      }
      await retireSeries(ctx.db, seriesId, retired);
      ctx.audit({ action: retired ? 'retire' : 'unretire', entity: 'event_series', entityId: seriesId });
      return { ok: true };
    },
    { action: 'update', entity: 'event_series', deniedMessage: DENIED_MESSAGE },
  ),

  /** Delete: 404s an unknown id, re-checks `canDeleteEvent` server-side (the panel's own gate is
   *  advisory only), deletes the event and its now-orphaned series in one batch, and returns the
   *  officer to the season they were viewing. */
  delete: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const row = id ? await getEvent(ctx.db, id) : null;
      if (!row) {
        ctx.audit({ action: 'delete', entity: 'event', entityId: id || undefined, detail: 'rejected: no such event' });
        return fail(404, { error: 'No such event.' });
      }
      if (!canDeleteEvent(row)) {
        ctx.audit({ action: 'delete', entity: 'event', entityId: id, detail: 'rejected: cannot delete a published event' });
        return fail(400, { error: 'Only an event that has never been published can be deleted. Hide it instead.' });
      }
      await deleteEventAndOrphanSeries(ctx.db, row);
      ctx.audit({ action: 'delete', entity: 'event', entityId: id });
      redirect(303, `?season=${row.season}`);
    },
    { action: 'delete', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),
};
