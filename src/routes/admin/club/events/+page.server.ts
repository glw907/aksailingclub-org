// The Club section's Events ledger (events-admin pass: load and `setDate`/`rollForward` from
// Task 4, docs/plans/2026-08-22-events-admin.md; the row form's own `save`/`create`/
// `setVisibility`/`retire`/`delete` actions from Task 5, which also retires `events/[id]` (now a
// redirect-only load, see that route's own `+page.server.ts`) and `events/new` (deleted outright,
// its job now the ledger's own `?/create` action and the blank-panel client state
// `+page.svelte` holds). `events-store.ts` stays untouched by Task 5: `retire` re-checks whether
// an `event_series` row still exists at all, a question the store's own exported functions do not
// answer, so `seriesExists` lives here as a route-local D1 read rather than growing the store's
// public surface for a route-only need.
//
// Reviewer fan-out fix round (docs/plans/2026-08-22-events-admin.md's fix brief): every action's
// write section now runs inside a try/catch that audits `rejected: write failed` and returns a
// generic `fail(500, ...)` rather than letting a D1 exception surface as an unhandled 500 with no
// audit trail. Every `fail()` payload that concerns one row now carries that row's `id` (the
// event id), so the panel can show the error inline against the row it belongs to, rather than
// only at the top of the page.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { mediaToken } from '@glw907/cairn-cms/media';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import { mediaManifest, publicMediaResolver } from '$theme/cairn.config';
import {
  createEvent,
  createSeriesWithEvent,
  deleteEvent,
  findEventBySeasonSlug,
  getEvent,
  linkEventToSeries,
  listEventSeasons,
  listLedger,
  previewRollForward,
  retireSeries,
  rollForwardSeason,
  saveEventAndSeries,
  setEventDates,
  setEventVisibility,
  type LedgerRow,
  type RollForwardPlan,
} from '$admin-club/lib/events-store';
import { DATE_FIELD, parseEventForm } from './event-form-input';
import type { HeroLibraryEntry } from './HeroImageField.svelte';

/** A season must be a plausible four-digit year (the same `2000`-`2100` bound the store's own
 *  `season INTEGER NOT NULL` column carries no CHECK for, per `0036_event_indexes`'s own "no
 *  recreate" decision -- this is the code-side half of that decision for the one place this
 *  route accepts a season from a request rather than from the database). `parseSeason` falls back
 *  silently (a bad `?season=` degrades to the current season, not an error, matching the ledger's
 *  own "always show something" load posture); `rollForward` and `create` refuse outright, since a
 *  bad season there is a real write-path input, not a display filter. */
function parseSeason(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

function isValidSeason(n: number): boolean {
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

/** `''`/`undefined`/a non-`YYYY-MM-DD` string all read as invalid; a valid empty string means
 *  "clear the date" (`value: null`), matching `setEventDates`'s own nullable dates. Reuses
 *  `event-form-input.ts`'s own `DATE_FIELD`, so the date-cell's inline save and the row form's
 *  own date fields accept exactly the same shape. */
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

/** `parseEventForm`'s own hero-token allowlist: every token `HERO_LIBRARY` actually offers, so a
 *  posted `heroImage` naming a token shaped like a real one but absent from the committed
 *  manifest is refused rather than written through unvalidated. */
const HERO_TOKEN_SET: ReadonlySet<string> = new Set(HERO_LIBRARY.map((entry) => entry.token));

/** `title` lowercased, every run of non-alphanumerics collapsed to one hyphen, and any leading or
 *  trailing hyphen trimmed -- the `create` action's own slug derivation (the design's "no slug
 *  field" ruling: an officer never types one). */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Whether an `event_series` row exists at all: `retire`'s own "unknown series" 404 guard, and
 *  `create`'s own "does the deterministic series id already exist" reuse check. Not a question
 *  `events-store.ts` answers today (`linkEventToSeries` checks it internally but does not expose
 *  the check), and this route is the only caller, so it stays a small local read rather than
 *  growing the store's public surface for a route-only need (see this file's own header). */
async function seriesExists(db: D1Database, seriesId: string): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM event_series WHERE id = ?1 LIMIT 1').bind(seriesId).first<{ id: string }>();
  return row !== null;
}

/** Two id lists hold the same members, order and duplicates aside -- `rollForward`'s own
 *  "the plan changed since you opened this" check. */
function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (list: string[]) => [...list].sort();
  const left = sorted(a);
  const right = sorted(b);
  return left.every((id, index) => id === right[index]);
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
    // `heroLibrary` is sent on every load, not only when `openId` is set: the toolbar's "New
    // event" button opens a blank `EventRowForm` from pure client state, with no `?open=` param
    // at all, and that panel needs the picker too -- scoping this to `openId` would silently
    // break the new-event flow. There is no cheaper correct option here regardless: the array
    // itself is a synchronous, build-time derivation (`HERO_LIBRARY`, module scope above), not a
    // per-request read, so the only real cost is its JSON size in the response, which every panel
    // that can open (an existing row OR a blank one) needs anyway.
    //
    // `previewRollForward` runs on every load too, not gated behind a `?roll=1` param: the
    // roll-forward panel's own markup stays in the DOM at all times (`hidden`, not an `{#if}`,
    // per `+page.svelte`'s own comment on that choice) so opening it is instant with no extra
    // round trip, which is the whole point of that design. Gating this read behind a query param
    // would reintroduce the round trip the `hidden`-panel design exists to avoid, in exchange for
    // skipping one small query on every load; the query stays, and this comment records the
    // tradeoff rather than leaving it to be rediscovered as a mystery "why does every load touch
    // event_series" question later.
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
const WRITE_FAILED_MESSAGE = 'The save did not go through. Try again.';

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
        return fail(404, { error: 'No such event.', id });
      }
      const start = parseOptionalDate(form.get('startDate'));
      const end = parseOptionalDate(form.get('endDate'));
      if (start === null || end === null) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: malformed date' });
        return fail(400, { error: 'Enter a date as YYYY-MM-DD.', id });
      }
      if (start.value !== null && end.value !== null && end.value < start.value) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: end before start' });
        return fail(400, { error: 'The end date is before the start date.', id });
      }
      const wasUndated = row.startDate === null;
      try {
        await setEventDates(ctx.db, id, { startDate: start.value, endDate: end.value });
      } catch (err) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE, id });
      }
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
   *  string, so an existing `?season=` param on the page never reaches this handler otherwise.
   *  `toSeason` is derived server-side as `fromSeason + 1` and the posted value is only ever
   *  compared against that derivation, never trusted on its own. `seriesIds` (one hidden input
   *  per previewed `create` entry, `+page.svelte`'s own render) is the plan the officer actually
   *  saw; this handler recomputes the plan fresh and refuses with 409 when the recomputed
   *  `create` set differs from what was posted, since the season could have changed underneath
   *  the officer between opening the panel and submitting it (another editor rolling it forward
   *  first, or a series retiring in another tab). */
  rollForward: clubAdminAction(
    async ({ form, ctx }) => {
      const fromSeasonEntry = form.get('fromSeason');
      const fromSeason = typeof fromSeasonEntry === 'string' ? Number(fromSeasonEntry) : NaN;
      if (!isValidSeason(fromSeason)) {
        ctx.audit({ action: 'roll-forward', entity: 'event', detail: 'rejected: invalid target season' });
        return fail(400, { error: 'Invalid season.' });
      }
      const toSeason = fromSeason + 1;
      const postedToSeasonEntry = form.get('toSeason');
      const postedToSeason = typeof postedToSeasonEntry === 'string' ? Number(postedToSeasonEntry) : NaN;
      if (postedToSeason !== toSeason) {
        ctx.audit({ action: 'roll-forward', entity: 'event', detail: 'rejected: invalid target season' });
        return fail(400, { error: 'Invalid season.' });
      }

      const postedSeriesIds = form.getAll('seriesIds').filter((value): value is string => typeof value === 'string');
      const recomputed = await previewRollForward(ctx.db, { fromSeason, toSeason });
      if (!sameIdSet(postedSeriesIds, recomputed.create.map((entry) => entry.seriesId))) {
        ctx.audit({ action: 'roll-forward', entity: 'event', detail: 'rejected: plan changed since preview' });
        return fail(409, { error: 'The season changed since you opened this. Review it again.' });
      }

      let result: { created: number; skipped: number };
      try {
        result = await rollForwardSeason(ctx.db, { fromSeason, toSeason });
      } catch (err) {
        ctx.audit({ action: 'roll-forward', entity: 'event', detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE });
      }
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

  /** The row form's own Save: 404s an unknown id, parses, and -- when `linkSeriesId` names a
   *  different series -- resolves that move BEFORE any field write, so a refused link leaves
   *  nothing changed (the guard-in-statement form `linkEventToSeries` now carries, `events-store.ts`
   *  item 7, means a refused move's own `UPDATE`/`DELETE` pair no-ops rather than partially
   *  applying). The field save and the series label write then run together through
   *  `saveEventAndSeries`, targeting whichever series the row belongs to AFTER a link (the newly
   *  linked series, not the one just abandoned -- writing the submitted title/recurrence onto a
   *  series about to be orphan-deleted, which the old two-phase flow did, served no one). */
  save: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const existing = id ? await getEvent(ctx.db, id) : null;
      if (!existing) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id || undefined, detail: 'rejected: no such event' });
        return fail(404, { error: 'No such event.', id });
      }
      const parsed = parseEventForm(form, HERO_TOKEN_SET);
      if ('error' in parsed) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error, id });
      }

      let targetSeriesId = existing.seriesId;
      const wantsLink = parsed.linkSeriesId !== null && parsed.linkSeriesId !== existing.seriesId;
      if (wantsLink) {
        let linkResult: Awaited<ReturnType<typeof linkEventToSeries>>;
        try {
          linkResult = await linkEventToSeries(ctx.db, id, parsed.linkSeriesId as string);
        } catch (err) {
          ctx.audit({ action: 'link-series', entity: 'event_series', entityId: parsed.linkSeriesId ?? undefined, detail: 'rejected: write failed' });
          return fail(500, { error: WRITE_FAILED_MESSAGE, id });
        }
        if ('error' in linkResult) {
          ctx.audit({ action: 'link-series', entity: 'event_series', entityId: parsed.linkSeriesId ?? undefined, detail: `rejected: ${linkResult.error}` });
          return fail(400, { error: linkResult.error, id });
        }
        ctx.audit({ action: 'link-series', entity: 'event_series', entityId: parsed.linkSeriesId ?? undefined });
        targetSeriesId = parsed.linkSeriesId as string;
      }

      try {
        await saveEventAndSeries(
          ctx.db,
          id,
          { ...parsed.write, slug: existing.slug },
          { seriesId: targetSeriesId, title: parsed.write.title, recurrence: parsed.recurrence },
        );
      } catch (err) {
        ctx.audit({ action: 'update', entity: 'event', entityId: id, detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE, id });
      }
      ctx.audit({ action: 'update', entity: 'event', entityId: id });
      return { ok: true };
    },
    { action: 'update', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** "New event": derives the slug from the title, refuses a same-season name collision, and
   *  mints a fresh series and event id -- UNLESS the deterministic `series-${slug}-${season}` id
   *  already exists (a series orphaned by an earlier partial failure, back when this ran as two
   *  separate writes rather than one `createSeriesWithEvent` batch), in which case the new event
   *  links onto that existing series instead of inserting a duplicate one. Lands the officer back
   *  on the row it just created. */
  create: clubAdminAction(
    async ({ form, ctx }) => {
      const parsed = parseEventForm(form, HERO_TOKEN_SET);
      if ('error' in parsed) {
        ctx.audit({ action: 'create', entity: 'event', detail: `rejected: ${parsed.error}` });
        return fail(400, { error: parsed.error });
      }
      const seasonEntry = form.get('season');
      const season = typeof seasonEntry === 'string' ? Number(seasonEntry) : NaN;
      if (!isValidSeason(season)) {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: invalid season' });
        return fail(400, { error: 'Invalid season.' });
      }
      const slug = slugify(parsed.write.title);
      if (slug === '') {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: title has no letters or numbers' });
        return fail(400, { error: 'Enter a title with at least one letter or number.' });
      }
      if (await findEventBySeasonSlug(ctx.db, season, slug)) {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: name already exists this season' });
        return fail(400, { error: 'An event with that name already exists this season.' });
      }
      const seriesId = `series-${slug}-${season}`;
      const id = `${slug}-${season}`;

      let reusedExistingSeries: boolean;
      try {
        reusedExistingSeries = await seriesExists(ctx.db, seriesId);
        if (reusedExistingSeries) {
          await createEvent(ctx.db, { id, season, seriesId, write: { ...parsed.write, slug } });
        } else {
          await createSeriesWithEvent(ctx.db, { seriesId, title: parsed.write.title, recurrence: parsed.recurrence, id, season, write: { ...parsed.write, slug } });
        }
      } catch (err) {
        ctx.audit({ action: 'create', entity: 'event', detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE });
      }
      if (!reusedExistingSeries) {
        ctx.audit({ action: 'create', entity: 'event_series', entityId: seriesId });
      }
      ctx.audit({ action: 'create', entity: 'event', entityId: id });
      redirect(303, `?season=${encodeURIComponent(String(season))}&open=${encodeURIComponent(id)}`);
    },
    { action: 'create', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** Hide/Show, the footer's own visibility toggle -- the only other place `visible` is written
   *  besides `setDate`'s publish-on-date rule. Its own `opts.action` (`'visibility'`, not the
   *  generic `'update'` every other event write shares) so a wrapper-level refusal audit (CSRF,
   *  rate limit, access denied) names the actual verb rather than a generic one. */
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
        return fail(404, { error: 'No such event.', id });
      }
      try {
        await setEventVisibility(ctx.db, id, visible);
      } catch (err) {
        ctx.audit({ action: visible ? 'show' : 'hide', entity: 'event', entityId: id, detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE, id });
      }
      ctx.audit({ action: visible ? 'show' : 'hide', entity: 'event', entityId: id });
      return { ok: true };
    },
    { action: 'visibility', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),

  /** Retire/Unretire a series -- reversible, and refuses an unknown series id 404 rather than
   *  writing a no-op `UPDATE`. Its own `opts.action` (`'retire'`) for the same wrapper-refusal
   *  reason `setVisibility` carries. `retire` is a series-level action with no row id of its
   *  own, so every `fail()` here echoes back the posted `eventId` (`EventRowForm`'s own hidden
   *  field, the fix round's own addition) as `id`, letting the panel's `rowError` still find the
   *  right row to show the refusal against. */
  retire: clubAdminAction(
    async ({ form, ctx }) => {
      const seriesIdEntry = form.get('seriesId');
      const seriesId = typeof seriesIdEntry === 'string' ? seriesIdEntry : '';
      const eventIdEntry = form.get('eventId');
      const eventId = typeof eventIdEntry === 'string' ? eventIdEntry : undefined;
      const retired = form.get('retired') === '1';
      if (!seriesId || !(await seriesExists(ctx.db, seriesId))) {
        ctx.audit({
          action: retired ? 'retire' : 'unretire',
          entity: 'event_series',
          entityId: seriesId || undefined,
          detail: 'rejected: no such series',
        });
        return fail(404, { error: 'No such series.', id: eventId });
      }
      try {
        await retireSeries(ctx.db, seriesId, retired);
      } catch (err) {
        ctx.audit({ action: retired ? 'retire' : 'unretire', entity: 'event_series', entityId: seriesId, detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE, id: eventId });
      }
      ctx.audit({ action: retired ? 'retire' : 'unretire', entity: 'event_series', entityId: seriesId });
      return { ok: true };
    },
    { action: 'retire', entity: 'event_series', deniedMessage: DENIED_MESSAGE },
  ),

  /** Delete: 404s an unknown id (the up-front `getEvent` read also carries the row's own
   *  `season`, needed for the redirect back to it, so there is no cheaper way to get both), then
   *  calls `deleteEvent`, whose own guarded read is the REAL eligibility check (`events-store.ts`
   *  item 8) -- the panel's own `canDeleteEvent` gate is advisory only, this is the enforcement.
   *  Deletes the event and its now-orphaned series in one batch and returns the officer to the
   *  season they were viewing. */
  delete: clubAdminAction(
    async ({ form, ctx }) => {
      const idEntry = form.get('id');
      const id = typeof idEntry === 'string' ? idEntry : '';
      const row = id ? await getEvent(ctx.db, id) : null;
      if (!row) {
        ctx.audit({ action: 'delete', entity: 'event', entityId: id || undefined, detail: 'rejected: no such event' });
        return fail(404, { error: 'No such event.', id });
      }

      let result: { deleted: boolean; removedSeriesId: string | null };
      try {
        result = await deleteEvent(ctx.db, id);
      } catch (err) {
        ctx.audit({ action: 'delete', entity: 'event', entityId: id, detail: 'rejected: write failed' });
        return fail(500, { error: WRITE_FAILED_MESSAGE, id });
      }
      if (!result.deleted) {
        ctx.audit({ action: 'delete', entity: 'event', entityId: id, detail: 'rejected: cannot delete a published event' });
        return fail(400, { error: 'Only an event that has never been published can be deleted. Hide it instead.', id });
      }
      ctx.audit({ action: 'delete', entity: 'event', entityId: id });
      redirect(303, `?season=${row.season}`);
    },
    { action: 'delete', entity: 'event', deniedMessage: DENIED_MESSAGE },
  ),
};
