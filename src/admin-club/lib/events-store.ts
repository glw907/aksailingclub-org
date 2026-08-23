// The Events admin's whole data layer (events-admin pass, Task 2, `docs/plans/
// 2026-08-22-events-admin.md`): grown from a five-function CRUD module into the series ledger's
// reads and writes -- the series/season model migration 0035_event_series added, the ledger read
// itself, the publish-on-date rule, the series move, and the roll-forward's selection and
// idempotence. This module stays a thin data-access layer only: validation lives in the route's
// own form-parsing helper (event-form-input.ts), and the audit emit stays in the action layer
// (clubAdminAction's ctx.audit), never here, matching every other Club store's own split. There is
// deliberately no `updatedBy`/editor-email parameter on the write functions: unlike
// `settings.updated_by`, neither `events` nor `event_series` carries a per-row attribution column,
// so there is nowhere for one to go; the acting editor's identity lives only in the audit record
// the action layer emits.
//
// `listEvents` (below `getEvent`) is a deliberate holdover from the pre-ledger screen, kept only
// so `/admin/club/events`'s current list route and its `new`/`[id]` actions keep compiling and
// behaving between this task landing and Task 4/5's ledger rebuild replacing them outright (the
// plan's own "Task 4 depends on 2, Task 5 depends on 4" sequencing runs both through this
// module in the interim). It reads every event across every season, unscoped -- the ledger's own
// `listLedger` is the real, season-scoped replacement and is what Task 4 wires in.
//
// Every read here that follows a write in the same request (a write's own audit emit reading
// the row back, a route re-reading after a redirect) assumes `asc-club` has no read replication:
// a read issued right after a write sees that write's own effect. If `asc-club` ever grows a
// read replica, every "guard folded into a statement, read back with a fresh SELECT" shape below
// (`deleteEvent`'s eligibility read, `linkEventToSeries`'s target check) needs re-auditing for
// replica lag, not just the obviously-sequential ones.
import type { StatusChipTone } from '@glw907/cairn-cms/admin-toolkit';

/** The `events.category` CHECK constraint's exact vocabulary (forward.sql). Every consumer (the
 *  ledger chip, the row form's select) reads the same five values. */
export const EVENT_CATEGORIES = ['racing', 'class', 'operations', 'social', 'governance'] as const;

/** One allowed `events.category` value. */
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** The display label for each category, so the ledger chip and the row form's select share one
 *  vocabulary rather than each spelling it out. */
export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  racing: 'Racing',
  class: 'Class',
  operations: 'Operations',
  social: 'Social',
  governance: 'Governance',
};

/** The `event_series.recurrence` CHECK constraint's exact vocabulary
 *  (`migrations/asc-club/0035_event_series/forward.sql`). */
export const EVENT_RECURRENCES = ['annual', 'once'] as const;

/** One allowed `event_series.recurrence` value. */
export type EventRecurrence = (typeof EVENT_RECURRENCES)[number];

/** The display label for each recurrence, so the ledger and the row form's select share one
 *  vocabulary. */
export const EVENT_RECURRENCE_LABEL: Record<EventRecurrence, string> = {
  annual: 'Annual',
  once: 'Once-off',
};

/** The one place the category chip's dressing is decided (design doc's "one dressing" ruling,
 *  the catalog's "four different dressings" finding): every consumer reads this map rather than
 *  hand-rolling its own tone-to-category guess.
 *
 *  `class` reads `neutral`, not `warning` (the second coherence read's own finding): `warning` is
 *  part of the club-grounds palette's reserved alarm vocabulary (CLAUDE.md's "the semantic
 *  palette stays a separate reserved vocabulary"), and a Class row's own gold star already marks
 *  it -- the chip's dot needs only to read as a plain category, not another alarm color. `racing`
 *  keeps `info`, which is not part of that reserved set, so the two categories still read as two
 *  different dot colors at a glance. */
export const EVENT_CATEGORY_TONE: Record<EventCategory, StatusChipTone> = {
  racing: 'info',
  class: 'neutral',
  operations: 'neutral',
  social: 'neutral',
  governance: 'neutral',
};

/** One `event_series` row, camelCased. */
export interface EventSeriesRow {
  id: string;
  title: string;
  recurrence: EventRecurrence;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One `events` row, camelCased for the admin screens. Hero/thumbnail image fields are readable
 *  here; `heroImage`/`heroImageAlt` are also writable (the row form's hero picker, Task 5) --
 *  `thumbnailImage` stays read-only everywhere, derived from the hero and never posted by a
 *  form. */
export interface EventRow {
  id: string;
  seriesId: string;
  season: number;
  title: string;
  slug: string;
  category: EventCategory;
  shortDescription: string | null;
  longDescription: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  thumbnailImage: string | null;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The row form's payload: every column a save posts. Carries no `visible`: the only paths that
 *  ever change it are the publish-on-date rule built into `updateEvent`/`setEventDates` below and
 *  the explicit `setEventVisibility` Hide/Show action, never a form checkbox. Excludes the audit
 *  columns (`created_at`/`updated_at`, store-owned) and `thumbnail_image` (derived, never posted).
 */
export interface EventWrite {
  title: string;
  slug: string;
  category: EventCategory;
  shortDescription: string | null;
  longDescription: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
}

/** The raw shape a `SELECT` off `events` returns, before `toEventRow` camelCases it. */
interface EventRawRow {
  id: string;
  series_id: string;
  season: number;
  title: string;
  slug: string;
  category: string;
  short_description: string | null;
  long_description: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  hero_image: string | null;
  hero_image_alt: string | null;
  thumbnail_image: string | null;
  visible: 0 | 1;
  created_at: string;
  updated_at: string;
}

function toEventRow(row: EventRawRow): EventRow {
  return {
    id: row.id,
    seriesId: row.series_id,
    season: row.season,
    title: row.title,
    slug: row.slug,
    category: row.category as EventCategory,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    startDate: row.start_date,
    startTime: row.start_time,
    endDate: row.end_date,
    endTime: row.end_time,
    location: row.location,
    heroImage: row.hero_image,
    heroImageAlt: row.hero_image_alt,
    thumbnailImage: row.thumbnail_image,
    visible: row.visible === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EVENT_SELECT_COLUMNS = `id, series_id, season, title, slug, category, short_description,
  long_description, start_date, start_time, end_date, end_time, location, hero_image,
  hero_image_alt, thumbnail_image, visible, created_at, updated_at`;

/** Every event across every season, soonest first; an unscheduled event (a null `start_date`)
 *  sorts last. Superseded by `listLedger` once Task 4 lands (see this module's own header). */
export async function listEvents(db: D1Database): Promise<EventRow[]> {
  const { results } = await db
    .prepare(`SELECT ${EVENT_SELECT_COLUMNS} FROM events ORDER BY start_date IS NULL, start_date ASC`)
    .all<EventRawRow>();
  return results.map(toEventRow);
}

/** One event by id, or `null` if no such row (a stale link or a bad id, never thrown). */
export async function getEvent(db: D1Database, id: string): Promise<EventRow | null> {
  const row = await db.prepare(`SELECT ${EVENT_SELECT_COLUMNS} FROM events WHERE id = ?1 LIMIT 1`).bind(id).first<EventRawRow>();
  return row ? toEventRow(row) : null;
}

/** One event by its `(season, slug)` pair, or `null`: the create action's own uniqueness check
 *  now that slug uniqueness is per-season (`UNIQUE (season, slug)`, migration 0035), not global.
 */
export async function findEventBySeasonSlug(db: D1Database, season: number, slug: string): Promise<EventRow | null> {
  const row = await db
    .prepare(`SELECT ${EVENT_SELECT_COLUMNS} FROM events WHERE season = ?1 AND slug = ?2 LIMIT 1`)
    .bind(season, slug)
    .first<EventRawRow>();
  return row ? toEventRow(row) : null;
}

/** Every season at least one `events` or `classes` row belongs to, most recent first: the
 *  ledger's own season filter vocabulary. Unioned across both tables, not `events` alone --
 *  `listLedger` shows a class-only season's rows too (`kind: 'class'`), so a season holding
 *  nothing but classes must still appear in the filter, or that season's classes become
 *  unreachable through it. The same shape `classes-store.ts`'s `listClassSeasons` already
 *  establishes for the Classes screen's own filter. */
export async function listEventSeasons(db: D1Database): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT season FROM events
       UNION
       SELECT DISTINCT season FROM classes
       ORDER BY season DESC`,
    )
    .all<{ season: number }>();
  return results.map((row) => row.season);
}

/** The unrun `INSERT INTO event_series` statement, shared by `createSeries` (its own single-write
 *  call) and `createSeriesWithEvent` (which batches it alongside the event insert below). */
function createSeriesStatement(
  db: D1Database,
  args: { id: string; title: string; recurrence: EventRecurrence },
): D1PreparedStatement {
  return db.prepare('INSERT INTO event_series (id, title, recurrence) VALUES (?1, ?2, ?3)').bind(args.id, args.title, args.recurrence);
}

/** Insert a new `event_series` row. `id` is the caller's chosen stable identifier (the create
 *  action's own `series-${slug}-${season}` convention, Task 5). */
export async function createSeries(db: D1Database, args: { id: string; title: string; recurrence: EventRecurrence }): Promise<void> {
  await createSeriesStatement(db, args).run();
}

/** The unrun `INSERT INTO events` statement, shared by `createEvent` and `createSeriesWithEvent`.
 *  `visible` is never taken from the caller: it is 1 when `write.startDate` is already set (a
 *  dated event, published from the moment it exists) and 0 otherwise (an undated event, exactly
 *  like a roll-forward copy) -- the same "a date publishes" rule `updateEvent`/`setEventDates`
 *  enforce for an edit. */
function createEventStatement(
  db: D1Database,
  args: { id: string; season: number; seriesId: string; write: EventWrite },
): D1PreparedStatement {
  const { id, season, seriesId, write } = args;
  return db
    .prepare(
      `INSERT INTO events (id, series_id, season, title, slug, category, short_description,
        long_description, start_date, start_time, end_date, end_time, location, hero_image,
        hero_image_alt, visible)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
    )
    .bind(
      id,
      seriesId,
      season,
      write.title,
      write.slug,
      write.category,
      write.shortDescription,
      write.longDescription,
      write.startDate,
      write.startTime,
      write.endDate,
      write.endTime,
      write.location,
      write.heroImage,
      write.heroImageAlt,
      write.startDate !== null ? 1 : 0,
    );
}

/** Insert a new `events` row onto an existing series. */
export async function createEvent(db: D1Database, args: { id: string; season: number; seriesId: string; write: EventWrite }): Promise<void> {
  await createEventStatement(db, args).run();
}

/** Insert a fresh series and its first event in one `db.batch`, atomically: the "New event"
 *  action's own write, so a request that fails partway (a dropped connection between the two
 *  inserts the old two-call sequence risked) never leaves a series with no event or an event
 *  pointing at a series that never landed. */
export async function createSeriesWithEvent(
  db: D1Database,
  args: { seriesId: string; title: string; recurrence: EventRecurrence; id: string; season: number; write: EventWrite },
): Promise<void> {
  const { seriesId, title, recurrence, id, season, write } = args;
  await db.batch([
    createSeriesStatement(db, { id: seriesId, title, recurrence }),
    createEventStatement(db, { id, season, seriesId, write }),
  ]);
}

/** The unrun `UPDATE events` statement, shared by `updateEvent` and `saveEventAndSeries`; `id`,
 *  `series_id`, and `season` never change here (a series move is `linkEventToSeries`' own job).
 *
 *  The dated-publishes rule lives in this one statement, not in a caller: `visible` becomes 1
 *  when the new `start_date` is non-null AND the row's own current `start_date` (read before this
 *  UPDATE applies, SQLite's ordinary same-statement `SET` semantics) is null -- an undated row
 *  that gets a date is published atomically with the write. Saving a date on a row that already
 *  had one (hidden or not) leaves `visible` exactly as it was: re-dating an already-published row
 *  does not touch it, and re-dating an already-hidden, already-dated row does not silently
 *  re-publish it. Nothing else in this module writes `visible` except `setEventVisibility`. */
function updateEventStatement(db: D1Database, id: string, write: EventWrite): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE events SET title = ?1, slug = ?2, category = ?3, short_description = ?4,
        long_description = ?5, start_date = ?6, start_time = ?7, end_date = ?8, end_time = ?9,
        location = ?10, hero_image = ?11, hero_image_alt = ?12,
        visible = CASE WHEN ?6 IS NOT NULL AND start_date IS NULL THEN 1 ELSE visible END,
        updated_at = datetime('now')
       WHERE id = ?13`,
    )
    .bind(
      write.title,
      write.slug,
      write.category,
      write.shortDescription,
      write.longDescription,
      write.startDate,
      write.startTime,
      write.endDate,
      write.endTime,
      write.location,
      write.heroImage,
      write.heroImageAlt,
      id,
    );
}

/** Update an existing event's editable columns. See `updateEventStatement`'s own doc for the
 *  publish-on-date rule this carries. */
export async function updateEvent(db: D1Database, id: string, write: EventWrite): Promise<void> {
  await updateEventStatement(db, id, write).run();
}

/** The ledger's own inline date-cell save: writes only the two date columns, with the identical
 *  publish-on-date `CASE` `updateEvent` carries (this module's own header on why the rule lives in
 *  SQL, not a caller). */
export async function setEventDates(
  db: D1Database,
  id: string,
  dates: { startDate: string | null; endDate: string | null },
): Promise<void> {
  await db
    .prepare(
      `UPDATE events SET start_date = ?1, end_date = ?2,
        visible = CASE WHEN ?1 IS NOT NULL AND start_date IS NULL THEN 1 ELSE visible END,
        updated_at = datetime('now')
       WHERE id = ?3`,
    )
    .bind(dates.startDate, dates.endDate, id)
    .run();
}

/** Hide (`visible = false`) or Show (`visible = true`) one event, the row form footer's own
 *  action -- the only other place `visible` is written besides the publish-on-date rule above. */
export async function setEventVisibility(db: D1Database, id: string, visible: boolean): Promise<void> {
  await db
    .prepare(`UPDATE events SET visible = ?1, updated_at = datetime('now') WHERE id = ?2`)
    .bind(visible ? 1 : 0, id)
    .run();
}

/** The unrun `UPDATE event_series` statement, shared by `setSeriesTitleAndRecurrence` and
 *  `saveEventAndSeries`. */
function setSeriesTitleAndRecurrenceStatement(
  db: D1Database,
  seriesId: string,
  args: { title: string; recurrence: EventRecurrence },
): D1PreparedStatement {
  return db
    .prepare(`UPDATE event_series SET title = ?1, recurrence = ?2, updated_at = datetime('now') WHERE id = ?3`)
    .bind(args.title, args.recurrence, seriesId);
}

/** Write the series' own title and recurrence. The row form's single Title field writes both this
 *  and `updateEvent`'s own `events.title` for one submitted value (plan decision, `events-admin`
 *  design doc): `events.title` keeps each year's own wording in history, `event_series.title` is
 *  the ledger row's label and must never go stale. */
export async function setSeriesTitleAndRecurrence(
  db: D1Database,
  seriesId: string,
  args: { title: string; recurrence: EventRecurrence },
): Promise<void> {
  await setSeriesTitleAndRecurrenceStatement(db, seriesId, args).run();
}

/** Save an existing row's own fields and its series' title/recurrence in one `db.batch`, the
 *  row form's single Save button (`updateEvent` plus `setSeriesTitleAndRecurrence`, atomically):
 *  the two writes either both land or neither does, rather than the prior two-call sequence's
 *  window where a dropped connection between them could leave the event's own fields saved but
 *  the series label stale, or vice versa. */
export async function saveEventAndSeries(
  db: D1Database,
  id: string,
  write: EventWrite,
  series: { seriesId: string; title: string; recurrence: EventRecurrence },
): Promise<void> {
  await db.batch([updateEventStatement(db, id, write), setSeriesTitleAndRecurrenceStatement(db, series.seriesId, series)]);
}

/** Retire (`retired_at` set) or unretire (`retired_at` cleared) a series -- reversible, per the
 *  design doc. A retired series never appears in `previewRollForward`'s `create` list. */
export async function retireSeries(db: D1Database, seriesId: string, retired: boolean): Promise<void> {
  await db
    .prepare(
      `UPDATE event_series SET retired_at = CASE WHEN ?1 = 1 THEN datetime('now') ELSE NULL END,
        updated_at = datetime('now')
       WHERE id = ?2`,
    )
    .bind(retired ? 1 : 0, seriesId)
    .run();
}

/** The orphan-series cleanup statement shared by `linkEventToSeries` and `deleteEvent`: deletes
 *  `seriesId` only when no `events` row still references it. Folded into a `db.batch` alongside
 *  the write that might have just orphaned it (a move, or a delete), so its own `NOT EXISTS`
 *  always evaluates against that write's post-write state, never a stale pre-write read. */
function deleteOrphanedSeriesStatement(db: D1Database, seriesId: string): D1PreparedStatement {
  return db.prepare('DELETE FROM event_series WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1)').bind(seriesId);
}

/**
 * Move one event onto a different series ("this is the {season} instance of an existing series",
 * Task 5's row form): refuses with `{ error: 'No such series.' }` when `targetSeriesId` names no
 * `event_series` row. The "does the target already hold a row for this season" guard is folded
 * into the `UPDATE`'s own `WHERE NOT EXISTS` (rather than a separate conflict `SELECT` run
 * first) -- the table-level `UNIQUE (season, slug)` says nothing about a season already having a
 * member of that series, so the guard still has to exist, it just lives in the statement that
 * would violate it rather than a read taken before it. `updateResult.meta.changes === 0` after
 * that guard already ruled out "no such series" is what tells the two refusal cases apart.
 *
 * When the move leaves the event's former series holding no rows at all, that now-orphaned series
 * is deleted (`deleteOrphanedSeriesStatement`) in the same `db.batch` as the move -- its `NOT
 * EXISTS` runs after the `UPDATE` has already moved the row, so it sees the post-move state
 * whether or not the move actually happened -- and its id is reported as `removedSeriesId`, so
 * the ledger never accumulates a phantom empty series a link created and abandoned. A missing
 * `eventId` is treated as a no-op (`{ removedSeriesId: null }`): the caller (Task 5's `save`
 * action) already 404s an unknown event before this is ever reached.
 */
export async function linkEventToSeries(
  db: D1Database,
  eventId: string,
  targetSeriesId: string,
): Promise<{ removedSeriesId: string | null } | { error: string }> {
  const event = await getEvent(db, eventId);
  if (!event) return { removedSeriesId: null };

  const target = await db.prepare('SELECT id FROM event_series WHERE id = ?1 LIMIT 1').bind(targetSeriesId).first<{ id: string }>();
  if (!target) return { error: 'No such series.' };

  const formerSeriesId = event.seriesId;
  const [updateResult, deleteResult] = await db.batch([
    db
      .prepare(
        `UPDATE events SET series_id = ?1, updated_at = datetime('now')
         WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1 AND season = ?3)`,
      )
      .bind(targetSeriesId, eventId, event.season),
    deleteOrphanedSeriesStatement(db, formerSeriesId),
  ]);

  if ((updateResult.meta.changes ?? 0) === 0) {
    return { error: 'That series already has an event in this season.' };
  }
  const orphaned = (deleteResult.meta.changes ?? 0) > 0;
  return { removedSeriesId: orphaned ? formerSeriesId : null };
}

/** Whether the row form's Delete footer action may show at all: an undated, never-visible row is
 *  exactly a row that was never published, since the only path to `visible = 1` is a saved date
 *  and Hide never clears one (plan decision, `events-admin` design doc's "never been visible"). A
 *  pure function so the route's own server-side re-check and the panel's own visibility share one
 *  rule; `deleteEvent` below folds the identical rule into its own `WHERE` clause rather than
 *  calling this on an already-fetched row, so the two stay independently expressed on purpose --
 *  this one gates what the client shows, that one gates what the database actually does. */
export function canDeleteEvent(row: EventRow): boolean {
  return row.visible === false && row.startDate === null;
}

/**
 * Delete an event: a single guarded read (`visible = 0 AND start_date IS NULL`, `canDeleteEvent`'s
 * own rule folded into a `WHERE` clause rather than a JS predicate on an already-fetched row)
 * finds the row's `seriesId` and, in the same motion, confirms it is eligible; a missing or
 * ineligible row both read back nothing here; the caller (the route's `delete` action) tells
 * those two cases apart with its own `getEvent` re-read on the `deleted: false` branch, since this
 * function has no reason to spend a second read distinguishing them on the common, successful
 * path. When eligible, the delete itself and the orphan-series cleanup
 * (`deleteOrphanedSeriesStatement`, the same statement `linkEventToSeries` shares) run in one
 * `db.batch`, so the orphan check always sees the post-delete state.
 */
export async function deleteEvent(db: D1Database, id: string): Promise<{ deleted: boolean; removedSeriesId: string | null }> {
  const eligible = await db
    .prepare('SELECT series_id FROM events WHERE id = ?1 AND visible = 0 AND start_date IS NULL LIMIT 1')
    .bind(id)
    .first<{ series_id: string }>();
  if (!eligible) return { deleted: false, removedSeriesId: null };

  const [, deleteResult] = await db.batch([
    db.prepare('DELETE FROM events WHERE id = ?1 AND visible = 0 AND start_date IS NULL').bind(id),
    deleteOrphanedSeriesStatement(db, eligible.series_id),
  ]);
  const orphaned = (deleteResult.meta.changes ?? 0) > 0;
  return { deleted: true, removedSeriesId: orphaned ? eligible.series_id : null };
}

/** One season's worth of an event or class row, as the ledger cell needs it: enough to render a
 *  date (with an en-dash range) and to know whether it is currently visible. */
export interface EventInstance {
  id: string;
  startDate: string | null;
  endDate: string | null;
  visible: boolean;
}

/** One ledger row: either an event series collapsed across three seasons, or a class collapsed
 *  the same way (`kind: 'class'`, read-only, linking out to the Classes screen). */
export interface LedgerRow {
  kind: 'event' | 'class';
  /** `events.id`, or `classes.id` for a class row -- whichever season's row is available
   *  (`current`, else the nearer prior season), so a series absent this season still has a stable
   *  key. */
  id: string;
  /** `null` on a class row (classes carry no series concept). */
  seriesId: string | null;
  title: string;
  /** `'class'` on a class row. */
  category: EventCategory;
  /** `null` on a class row. */
  recurrence: EventRecurrence | null;
  /** `null` on a class row (classes are never retired through this screen). */
  retiredAt: string | null;
  /** The selected season's own instance, or `null` when the series/class did not run that year. */
  current: EventInstance | null;
  /** `[season - 1, season - 2]`, each `null` when nothing ran that year. */
  prior: [EventInstance | null, EventInstance | null];
  /** `MM-DD` of whichever instance (current, else season - 1, else season - 2) has a date, so a
   *  series keeps its prior year's calendar position while it is undated this year; `null` when
   *  nothing dates the row at all. */
  sortKey: string | null;
  /** How many distinct seasons this series holds a row in, across all of history, not just the
   *  three shown -- the row form's own "single-year series" gate. `0` on a class row. */
  seriesYearCount: number;
  /** The full current-season row, for the row form's panel; `null` on a class row or when the
   *  series has no row this season. */
  event: EventRow | null;
}

interface LedgerEventRawRow extends EventRawRow {
  series_title: string;
  recurrence: string;
  retired_at: string | null;
}

interface LedgerClassRawRow {
  id: string;
  season: number;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  visible: 0 | 1;
}

function toEventInstance(row: { id: string; start_date: string | null; end_date: string | null; visible: 0 | 1 }): EventInstance {
  return { id: row.id, startDate: row.start_date, endDate: row.end_date, visible: row.visible === 1 };
}

/** `YYYY-MM-DD` -> `MM-DD`, so two different years' dates compare on the calendar day alone. */
function monthDay(date: string | null): string | null {
  return date === null ? null : date.slice(5, 10);
}

function compareTitles(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The ledger's whole read: every event series and every class with at least one row in `season`,
 * `season - 1`, or `season - 2`, collapsed to one `LedgerRow` each. At most three statements --
 * one `events`-plus-`event_series` join across the three seasons, one `classes` read across the
 * same three, one for the per-series year counts -- never a per-row query loop.
 *
 * Ordering (plan decision, forced by the cross-year comparison the "last two seasons beside this
 * one" rule implies): ascending by `sortKey`, nulls last, ties broken by `title` ascending,
 * case-insensitive. Comparing month-and-day rather than the full date is what lets an undated
 * row hold the calendar position its prior-year date gave it, beside rows already dated this year.
 */
export async function listLedger(db: D1Database, season: number): Promise<LedgerRow[]> {
  const seasons: [number, number, number] = [season, season - 1, season - 2];

  const [eventsResult, classesResult, yearCountsResult] = await Promise.all([
    db
      .prepare(
        `SELECT e.id AS id, e.series_id AS series_id, e.season AS season, e.title AS title,
           e.slug AS slug, e.category AS category, e.short_description AS short_description,
           e.long_description AS long_description, e.start_date AS start_date,
           e.start_time AS start_time, e.end_date AS end_date, e.end_time AS end_time,
           e.location AS location, e.hero_image AS hero_image, e.hero_image_alt AS hero_image_alt,
           e.thumbnail_image AS thumbnail_image, e.visible AS visible, e.created_at AS created_at,
           e.updated_at AS updated_at, s.title AS series_title, s.recurrence AS recurrence,
           s.retired_at AS retired_at
         FROM events e JOIN event_series s ON s.id = e.series_id
         WHERE e.season IN (?1, ?2, ?3)`,
      )
      .bind(...seasons)
      .all<LedgerEventRawRow>(),
    db
      .prepare(
        `SELECT id, season, name, slug, start_date, end_date, visible
         FROM classes WHERE season IN (?1, ?2, ?3)`,
      )
      .bind(...seasons)
      .all<LedgerClassRawRow>(),
    // Bound with the same three-season window as the events read, not the events read's own
    // result: a constant three-placeholder IN clause instead of a dynamic placeholder list built
    // from `seriesIds`, so this can run alongside the other two reads in the same Promise.all
    // rather than waiting on the first one's rows before it knows what to bind.
    db
      .prepare(
        `SELECT series_id, COUNT(DISTINCT season) AS n FROM events
         WHERE series_id IN (SELECT series_id FROM events WHERE season IN (?1, ?2, ?3))
         GROUP BY series_id`,
      )
      .bind(...seasons)
      .all<{ series_id: string; n: number }>(),
  ]);

  const yearCounts = new Map<string, number>();
  for (const row of yearCountsResult.results) yearCounts.set(row.series_id, row.n);

  const bySeries = new Map<string, LedgerEventRawRow[]>();
  for (const row of eventsResult.results) {
    const rows = bySeries.get(row.series_id) ?? [];
    rows.push(row);
    bySeries.set(row.series_id, rows);
  }

  const rows: LedgerRow[] = [];
  for (const [seriesId, seriesRows] of bySeries) {
    const current = seriesRows.find((row) => row.season === season) ?? null;
    const prior0 = seriesRows.find((row) => row.season === season - 1) ?? null;
    const prior1 = seriesRows.find((row) => row.season === season - 2) ?? null;
    const reference = current ?? prior0 ?? prior1;
    if (!reference) continue;
    rows.push({
      kind: 'event',
      id: reference.id,
      seriesId,
      title: reference.series_title,
      category: reference.category as EventCategory,
      recurrence: reference.recurrence as EventRecurrence,
      retiredAt: reference.retired_at,
      current: current ? toEventInstance(current) : null,
      prior: [prior0 ? toEventInstance(prior0) : null, prior1 ? toEventInstance(prior1) : null],
      sortKey: monthDay(current?.start_date ?? prior0?.start_date ?? prior1?.start_date ?? null),
      seriesYearCount: yearCounts.get(seriesId) ?? 0,
      event: current ? toEventRow(current) : null,
    });
  }

  const bySlug = new Map<string, LedgerClassRawRow[]>();
  for (const row of classesResult.results) {
    const slugRows = bySlug.get(row.slug) ?? [];
    slugRows.push(row);
    bySlug.set(row.slug, slugRows);
  }

  for (const [, slugRows] of bySlug) {
    const current = slugRows.find((row) => row.season === season) ?? null;
    const prior0 = slugRows.find((row) => row.season === season - 1) ?? null;
    const prior1 = slugRows.find((row) => row.season === season - 2) ?? null;
    const reference = current ?? prior0 ?? prior1;
    if (!reference) continue;
    rows.push({
      kind: 'class',
      id: reference.id,
      seriesId: null,
      title: reference.name,
      category: 'class',
      recurrence: null,
      retiredAt: null,
      current: current ? toEventInstance(current) : null,
      prior: [prior0 ? toEventInstance(prior0) : null, prior1 ? toEventInstance(prior1) : null],
      sortKey: monthDay(current?.start_date ?? prior0?.start_date ?? prior1?.start_date ?? null),
      seriesYearCount: 0,
      event: null,
    });
  }

  rows.sort((a, b) => {
    if (a.sortKey === null && b.sortKey === null) return compareTitles(a.title, b.title);
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
    return compareTitles(a.title, b.title);
  });
  return rows;
}

/** What "Start the next season" is about to do, computed live and never stored (the confirmation
 *  panel's own preview need, read before the officer ever sees it). */
export interface RollForwardPlan {
  fromSeason: number;
  toSeason: number;
  create: { seriesId: string; title: string }[];
  skipped: { seriesId: string; title: string; reason: 'once' | 'retired' | 'already-rolled' | 'slug-taken' }[];
}

/**
 * Which series a roll-forward would create a `toSeason` copy for, and which it would skip and
 * why. A series lands in `create` when it is annual, not retired, holds at least one row in
 * `fromSeason`, holds none in `toSeason`, and its slug is not already held by a DIFFERENT series
 * in `toSeason`; every other series with a `fromSeason` row lands in `skipped` with exactly one
 * reason, in this precedence: `retired` -> `once` -> `already-rolled` -> `slug-taken`. Both lists
 * are title-sorted.
 *
 * `slug-taken` surfaces a collision the insert's own `UNIQUE (season, slug)` would otherwise
 * reject silently (a `NOT EXISTS` guard, like `rollForwardSeason`'s own, just skips the row) --
 * naming it here lets the officer see the skip on the confirmation panel before committing,
 * rather than discovering afterward that a series they expected to roll forward silently did not.
 */
export async function previewRollForward(db: D1Database, args: { fromSeason: number; toSeason: number }): Promise<RollForwardPlan> {
  const { results } = await db
    .prepare(
      `SELECT es.id AS series_id, es.title AS title, es.recurrence AS recurrence,
         es.retired_at AS retired_at,
         EXISTS (SELECT 1 FROM events e2 WHERE e2.series_id = es.id AND e2.season = ?2) AS has_to_season,
         EXISTS (
           SELECT 1 FROM events e3 WHERE e3.season = ?2 AND e3.slug = e1.slug AND e3.series_id != es.id
         ) AS slug_taken
       FROM event_series es
       JOIN events e1 ON e1.series_id = es.id AND e1.season = ?1`,
    )
    .bind(args.fromSeason, args.toSeason)
    .all<{
      series_id: string;
      title: string;
      recurrence: string;
      retired_at: string | null;
      has_to_season: 0 | 1;
      slug_taken: 0 | 1;
    }>();

  const create: RollForwardPlan['create'] = [];
  const skipped: RollForwardPlan['skipped'] = [];
  for (const row of results) {
    if (row.retired_at !== null) {
      skipped.push({ seriesId: row.series_id, title: row.title, reason: 'retired' });
    } else if (row.recurrence !== 'annual') {
      skipped.push({ seriesId: row.series_id, title: row.title, reason: 'once' });
    } else if (row.has_to_season === 1) {
      skipped.push({ seriesId: row.series_id, title: row.title, reason: 'already-rolled' });
    } else if (row.slug_taken === 1) {
      skipped.push({ seriesId: row.series_id, title: row.title, reason: 'slug-taken' });
    } else {
      create.push({ seriesId: row.series_id, title: row.title });
    }
  }
  create.sort((a, b) => compareTitles(a.title, b.title));
  skipped.sort((a, b) => compareTitles(a.title, b.title));
  return { fromSeason: args.fromSeason, toSeason: args.toSeason, create, skipped };
}

/**
 * Run `previewRollForward`'s plan: one `db.batch`, one `INSERT ... SELECT` per `create` entry,
 * each copying its series' `fromSeason` row entirely in SQL -- no per-row JS read of the source
 * first, unlike the prior two-step (read the source row, then insert its fields back as bound
 * parameters). Every column copies except the dates and times (`start_date`, `start_time`,
 * `end_date`, `end_time` all null, `visible` 0 -- undated and hidden until an officer saves a
 * date, same as any other newly created row). The new row's id is `` `${slug}-${toSeason}` ``,
 * computed in SQL (`src.slug || '-' || ?2`).
 *
 * Idempotent, and guarded against every constraint the insert can hit, not just the one
 * `previewRollForward` already filters on: each insert's own `WHERE` carries three `NOT EXISTS`
 * guards -- `(series_id, toSeason)` (already-rolled), `(toSeason, slug)` (a different series
 * holding the same slug this season), and `id` (the exact row this insert would mint) -- so a
 * second run against an unchanged plan inserts nothing even if a row landed between the preview
 * and this call, and a same-second race against a `slug-taken` collision the preview missed still
 * cannot violate the new `UNIQUE (season, slug)`. When the plan already has nothing to create (the
 * ordinary repeat-run case, once the preview itself sees the rolled rows), no statement is issued
 * at all and `created` is `0`. `created` counts each batched statement's own `meta.changes`, not
 * `statements.length`: a statement whose guard skips its row still runs and still returns success,
 * so counting statements queued would over-report by one for every guard that fires.
 */
export async function rollForwardSeason(
  db: D1Database,
  args: { fromSeason: number; toSeason: number },
): Promise<{ created: number; skipped: number }> {
  const plan = await previewRollForward(db, args);
  if (plan.create.length === 0) {
    return { created: 0, skipped: plan.skipped.length };
  }

  const statements: D1PreparedStatement[] = plan.create.map((entry) =>
    db
      .prepare(
        `INSERT INTO events (id, series_id, season, title, slug, category, short_description,
          long_description, start_date, start_time, end_date, end_time, location, hero_image,
          hero_image_alt, thumbnail_image, visible)
         SELECT src.slug || '-' || ?2, src.series_id, ?2, src.title, src.slug, src.category,
           src.short_description, src.long_description, NULL, NULL, NULL, NULL, src.location,
           src.hero_image, src.hero_image_alt, src.thumbnail_image, 0
         FROM events src
         WHERE src.series_id = ?1 AND src.season = ?3
           AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1 AND season = ?2)
           AND NOT EXISTS (SELECT 1 FROM events WHERE slug = src.slug AND season = ?2)
           AND NOT EXISTS (SELECT 1 FROM events WHERE id = src.slug || '-' || ?2)`,
      )
      .bind(entry.seriesId, args.toSeason, args.fromSeason),
  );
  const results = await db.batch(statements);
  const created = results.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
  return { created, skipped: plan.skipped.length };
}
