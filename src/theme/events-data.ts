// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): the `/events` season
// page's own data shape. Reads the same club-owned D1 tables `$theme/season-data.ts` already
// verified (`events` and `classes`, unioned, `classes` tagged with the synthesized `'class'`
// category), but pulls every display field the season page's photo bands and governance coda
// need. Shares the low-level date helpers with season-data.ts (`monthAndDay`, `readCurrentSeason`,
// `routeIdOf`, `seasonDotKind`) rather than a second copy of that logic; this module owns
// everything specific to the full season page: the richer row shape, the date/time label
// formatting, and the month/governance grouping (a governance row leaves the chronology
// entirely, by category, regardless of its date).
import type { MediaResolve } from '@glw907/cairn-cms/media';
import { monthAndDay, readCurrentSeason, routeIdOf, seasonDotKind, type SeasonDotKind } from './season-data';
import { resolveEventImageUrl } from './event-images';

/** A raw event or class row from D1, the full column set the season page reads (a superset of
 *  season-data.ts's own `EventRow`, structurally compatible with its exported date helpers and
 *  `routeIdOf`). */
export interface EventDetailRow {
  id: string;
  title: string;
  slug: string;
  event_type: string;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  date_history: string | null;
  location: string | null;
  short_description: string | null;
  long_description: string | null;
  hero_image: string | null;
  hero_image_alt: string | null;
  registration_url: string | null;
  /** Only ever set on a synthesized `'class'` row; a real `events` row selects a literal `NULL`. */
  registration_status: string | null;
  /** A class's whole-dollar fee (`classes.fee`); a real `events` row selects a literal `NULL`,
   *  since events carry no fee column. */
  fee: number | null;
  /** A class's age gate (`classes.track`, `'adult-teen' | 'youth'`); a real `events` row selects
   *  a literal `NULL`, since events carry no track column. */
  track: string | null;
  /** A class's drop-in flag (`classes.drop_in`); a real `events` row selects a literal `NULL`,
   *  since events carry no drop_in column. Confirmed present on the live `asc-club` database via
   *  `PRAGMA table_info(classes)` against `--remote`. */
  drop_in: number | null;
}

/** The events table's full-detail SELECT. asc-club's `events` (`migrations/asc-club/
 *  0001_substrate/`) carries no `registration_url` column (ops-only, per
 *  `scripts/import/ops-events.README.md`'s field mapping), so it selects as a literal `NULL`,
 *  keeping `EventDetailRow`'s shape unchanged for `buildEventsPage`'s date helpers. */
const EVENTS_COLUMNS = `SELECT id, title, slug, category AS event_type, start_date, start_time,
                               end_date, end_time, NULL AS date_history, location,
                               short_description, long_description, hero_image, hero_image_alt,
                               NULL AS registration_url, NULL AS registration_status, NULL AS fee,
                               NULL AS track, NULL AS drop_in
                        FROM events`;
/** Every visible event of the current season. `events` now carries a real `season` column
 *  (`migrations/asc-club/0035_event_series/`), so this filters on it directly rather than
 *  deriving a year from `start_date`; an undated row's `season` is still set (the migration backs
 *  it onto `settings.current_season` when there is no date to read one from), so an undated row
 *  in the selected season still reads. `?1 IS NULL` is the unset-`current_season` arm, which
 *  reads every event rather than none: an unconfigured setting should quiet the season filter,
 *  not empty the page. */
const EVENTS_QUERY = `${EVENTS_COLUMNS} WHERE visible = 1 AND (?1 IS NULL OR season = ?1)`;
/** One event by its public route segment (its slug), for the per-event stub and its `.ics`
 *  sibling: a targeted read, never the whole table filtered in JavaScript. No season filter here,
 *  since a shared link to a past season's event should still unfurl rather than 404. **Plan
 *  decision:** slug is no longer globally unique (`UNIQUE (season, slug)`, migration 0035), so a
 *  rolled-forward series can have one row per season sharing a slug; `ORDER BY season DESC`
 *  resolves to the most recent instance rather than an arbitrary one. */
const EVENT_BY_SLUG_QUERY = `${EVENTS_COLUMNS} WHERE slug = ?1 AND visible = 1 ORDER BY season DESC LIMIT 1`;
/** The classes table's full-detail SELECT, tagged with the synthesized `'class'` category. Two
 *  differences from the events query above, both forced by the ratified `classes` schema
 *  (`migrations/asc-club/0001_substrate/`), which was never designed to carry the public listing's
 *  richer row shape: (1) `classes` has one merged `description` column, not a short/long pair (see
 *  `scripts/import/ops-classes.README.md`: asc-club joined ops's `short_description` and
 *  `long_description` into it at import time), so the whole thing selects as `long_description`
 *  (markdown-rendered) and `short_description` is a literal `NULL`; (2) neither `registration_url`
 *  nor `registration_status` is a stored column (registration is now the internal
 *  enrollment/waitlist machine): the signup link is computed directly from the class's own `id`,
 *  and the status derives from the freed-spot rule (`$admin-club/lib/classes-store.ts`'s
 *  `isPubliclyOpen`, expressed here as one SQL `CASE` rather than a second round trip): `full`
 *  when enrollment has reached capacity, `closed` (a live offer or a nonempty waitlist) when there
 *  is free capacity but anyone is still queued, and `open` only when none of that holds. A freed
 *  spot with anyone still queued never reopens to the public; only a drop that empties the queue
 *  does. `hero_image`/`hero_image_alt` select as real columns (migration `0003_class_images`).
 *  `classes` carries no `start_time`/`end_time` column of its own, so both select as a literal
 *  `NULL`. `season = ?1` is the fix for a real display bug: the MembershipWorks import mints a
 *  `classes` row per season, so an unfiltered read leaked prior-season instances of the same class
 *  into the listing as duplicate, wrong-dated entries; `events` now carries its own `season`
 *  column too and scopes the same way (see `EVENTS_QUERY`, above). */
const CLASSES_COLUMNS = `SELECT id, name AS title, slug, 'class' AS event_type, start_date,
                               NULL AS start_time, end_date, NULL AS end_time,
                               NULL AS date_history, location, NULL AS short_description,
                               description AS long_description, hero_image, hero_image_alt,
                               '/classes/' || id || '/signup' AS registration_url,
                               CASE
                                 WHEN (SELECT COUNT(*) FROM class_enrollments e WHERE e.class_id = classes.id) >= capacity
                                   THEN 'full'
                                 WHEN (SELECT COUNT(*) FROM class_waitlist w WHERE w.class_id = classes.id) > 0
                                   THEN 'closed'
                                 WHEN EXISTS (
                                   SELECT 1 FROM class_offers o
                                   WHERE o.class_id = classes.id AND o.resolved IS NULL AND o.expires_at > datetime('now')
                                 )
                                   THEN 'closed'
                                 ELSE 'open'
                               END AS registration_status,
                               fee, track, drop_in
                        FROM classes`;
const CLASSES_QUERY = `${CLASSES_COLUMNS} WHERE visible = 1 AND season = ?1`;
/** One class by its public route segment (its own id, since a class slug is only unique within
 *  its season), for the per-event stub and its `.ics` sibling. */
const CLASS_BY_ID_QUERY = `${CLASSES_COLUMNS} WHERE id = ?1 AND visible = 1 AND season = ?2 LIMIT 1`;

/** The whole season's rows plus the season they were read for. The season comes back with the
 *  rows because the caller needs it too (it titles the page), and reading it a second time in the
 *  route would put a second D1 failure outside this function's own degrade-to-empty guard: a
 *  `settings` read that throws there would 500 the page instead of quieting it. */
export interface EventRowsRead {
  rows: EventDetailRow[];
  /** `settings.current_season`, or `null` when unset OR when the read failed outright. */
  season: number | null;
}

/** Read every visible event and class row of the current season, full detail. Degrades to an
 *  empty list on any D1 failure, the same safe failure `season-data.ts`'s `loadSeasonMonths` uses.
 *  The classes arm reads no rows at all when `current_season` is missing from `settings`
 *  (`readCurrentSeason`), rather than falling back to every season; the events arm quiets its own
 *  season filter instead (see `EVENTS_QUERY`), since an event row's season is inferred from its
 *  date rather than stored. */
export async function readEventRows(db: D1Database): Promise<EventRowsRead> {
  try {
    const season = await readCurrentSeason(db);
    const [events, classes] = await Promise.all([
      // Bound as a number: the filter now compares against the real `season INTEGER` column.
      db.prepare(EVENTS_QUERY).bind(season).all<EventDetailRow>(),
      season === null
        ? Promise.resolve({ results: [] as EventDetailRow[] })
        : db.prepare(CLASSES_QUERY).bind(season).all<EventDetailRow>(),
    ]);
    return { rows: [...(events.results ?? []), ...(classes.results ?? [])], season };
  } catch (err) {
    console.error('events-data: CLUB_DB read failed', err);
    return { rows: [], season: null };
  }
}

/** One row's read outcome, keyed by what the caller must do with it: serve the row, 404 (the id
 *  names nothing visible), or 503 (the database itself did not answer). The two failure arms are
 *  deliberately distinct, since collapsing them would tell a crawler that a live event is gone
 *  whenever D1 hiccups. */
export type EventRowRead =
  | { status: 'found'; row: EventDetailRow }
  | { status: 'absent' }
  | { status: 'failed' };

/** Read the one event or class a public route segment names (`routeIdOf`: an event's slug, a
 *  class's id). Two targeted statements in a single `db.batch` round trip, not the whole of both
 *  tables filtered in JavaScript: the id can only ever match one of them, and the batch means the
 *  miss costs no second trip. The class statement is skipped entirely when `current_season` is
 *  unset, since it has no season to bind. */
export async function readEventRow(db: D1Database, routeId: string): Promise<EventRowRead> {
  try {
    const season = await readCurrentSeason(db);
    const statements = [db.prepare(EVENT_BY_SLUG_QUERY).bind(routeId)];
    if (season !== null) statements.push(db.prepare(CLASS_BY_ID_QUERY).bind(routeId, season));
    const results = await db.batch<EventDetailRow>(statements);
    const row = results.flatMap((result) => result.results ?? [])[0];
    return row ? { status: 'found', row } : { status: 'absent' };
  } catch (err) {
    console.error('events-data: CLUB_DB single-row read failed', err);
    return { status: 'failed' };
  }
}

/** The registration-status badge's color role, one of the reserved semantic tokens (never the
 *  club-grounds palette; see theme.css's own header comment on why info/success/warning/error
 *  stay separate). Shared with the education page's live class schedule
 *  (`class-schedule-data.ts`), which derives its own richer, year-round lifecycle independently. */
export type RegStatusKind = 'success' | 'info' | 'warning' | 'error' | 'muted';

/** A class's age gate, the ratified DDL's own CHECK constraint values
 *  (`migrations/asc-club/0001_substrate/`). */
export type ClassTrack = 'adult-teen' | 'youth';

/** The `registration_status` SQL CASE's raw values, mapped to the season page's own three-way
 *  vocabulary: `full` (enrolled at capacity, the waitlist still takes names) reads as
 *  `waitlisted` here, since "Full" alone reads like a dead end rather than an invitation to
 *  queue. */
const REGISTRATION_STATE: Record<string, 'open' | 'waitlisted' | 'closed'> = {
  open: 'open',
  full: 'waitlisted',
  closed: 'closed',
};

/** One event or class, display-ready for the season page's photo bands: every field a band or
 *  the governance coda needs, and nothing the old spine listing needed instead. */
export interface EventCard {
  /** The `/events/[id]` route segment (`routeIdOf`): an event's `slug`, or a class's own `id`
   *  (whose `slug` is only unique within its season). Also the band's own anchor id. */
  routeId: string;
  slug: string;
  title: string;
  /** The home Season list's own four-way taxonomy (`season-data.ts`'s `seasonDotKind`, reused
   *  verbatim, never a second mapping): `'class'` marks the gold star preceding a class or
   *  clinic's title (the C7 taxonomy). Undefined only for a category outside the ratified
   *  taxonomy, the same defensive fallback `seasonDotKind` itself documents. */
  dotKind?: SeasonDotKind;
  /** `"Saturday, May 23"` for one day, `"September 5–7"` for a range in one month,
   *  `"September 28 – October 2"` across months, `"Date to be announced"` when undated. */
  dateLabel: string;
  /** A friendly 12-hour rendering of `start_time` (events only; `classes` carries no time
   *  column), e.g. `"1 p.m."` or `"10:30 a.m."`; undefined when the row has no start time. */
  time?: string;
  location?: string;
  /** The row's `short_description`, undefined when absent. Only ever rendered by the governance
   *  coda (`EventsGovernance.svelte`), which is a plain reference table with no room for the
   *  full `longHtml` body a season band shows instead; a plain event or class row carries this
   *  through unused. */
  note?: string;
  /** A class's whole-dollar fee; never set on a plain event (which has no fee column). */
  fee?: number;
  /** A class's age gate; never set on a plain event. */
  track?: ClassTrack;
  /** A class's drop-in flag; always `false` on a plain event (which has no drop_in column). */
  dropIn: boolean;
  /** True when the row's end date, or its start date when it has no end date, falls before the
   *  `today` `buildEventsPage`/`toEventCard` was given; false for a genuinely undated row (there
   *  is no evidence it has already happened). */
  isPast: boolean;
  /** Pre-rendered markdown (the async render step runs once, in the page's own server load):
   *  the event's `long_description`, or a class's merged `description` column. */
  longHtml?: string;
  registrationUrl?: string;
  /** A class's registration lifecycle, the `registration_status` SQL CASE mapped to the season
   *  page's own vocabulary; never set on a plain event. */
  registrationState?: 'open' | 'waitlisted' | 'closed';
  image?: { url: string; alt: string };
}

/** One month's group of season bands, in the page's own display order. */
export interface MonthGroup {
  name: string;
  id: string;
  events: EventCard[];
}

/** The full `/events` page's data: the season year for the hero title, the route id of the next
 *  upcoming band (the page's scroll-on-load target), the route id of the one band allowed to
 *  render the fireweed Register button, every month that has at least one non-governance row, and
 *  the governance coda. */
export interface EventsPageData {
  seasonYear: number;
  /** The route id of the first dated, non-governance row that has not already happened;
   *  undefined when every dated row is past. An undated row never wins this slot: it is never
   *  provably past, but it is also never a real scroll target. */
  nextUpcomingId?: string;
  /** The route id of the first non-past class whose registration is open and which is not a
   *  drop-in: the one band allowed to render the fireweed Register button. Undefined when no
   *  class on the page is taking registrations, in which case the page spends no fireweed at all.
   *  Deliberately independent of `nextUpcomingId`, which answers a different question (where the
   *  reader lands). */
  primaryClassId?: string;
  months: MonthGroup[];
  governance: EventCard[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** The trailing bucket for a row with no resolvable date at all (`monthAndDay`'s own `{99, 99}`
 *  fallback): sorts after every named month, so a genuinely undated row is never dropped from the
 *  page. */
const UNDATED_MONTH: Pick<MonthGroup, 'name' | 'id'> = { name: 'Later', id: 'later' };

const WEEKDAY_MONTH_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
const MONTH_ONLY = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** `Invalid Date` for a string `Date` cannot parse; `Intl.DateTimeFormat.format` throws a
 *  `RangeError` on one rather than returning a placeholder, so every caller here checks this
 *  first rather than letting a malformed `start_date`/`end_date` crash the whole render. */
function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/** The season page's own date-label vocabulary (docs/2026-08-22-events-redesign-design.md's
 *  probe): a single day carries its weekday, a range within one calendar month collapses to one
 *  month name, and a range crossing months spells both out in full, en-dash joined. Falls back
 *  to the TBD label on an unparseable `startIso` -- the database column is a plain `TEXT` with no
 *  date-shape CHECK (`0036_event_indexes`'s own "enforced in code, not SQL" decision), so a
 *  malformed value degrades to "date to be announced" rather than throwing and breaking the whole
 *  season page. An unparseable `endIso` degrades one step further, to the start date alone, since
 *  a genuinely bad end date is not a reason to hide a start date that did parse. */
function formatDateLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso) return 'Date to be announced';
  const start = new Date(`${startIso}T00:00:00`);
  if (!isValidDate(start)) return 'Date to be announced';
  if (!endIso || endIso === startIso) return WEEKDAY_MONTH_DAY.format(start);
  const end = new Date(`${endIso}T00:00:00`);
  if (!isValidDate(end)) return WEEKDAY_MONTH_DAY.format(start);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_ONLY.format(start)} ${start.getDate()}–${end.getDate()}`;
  }
  return `${MONTH_DAY.format(start)} – ${MONTH_DAY.format(end)}`;
}

/** Format a 24-hour `"HH:MM"` start time (the admin form's own `type="time"` input) as a
 *  friendly, lowercase 12-hour string, e.g. `"13:00"` -> `"1 p.m."`, `"10:30"` -> `"10:30 a.m."`;
 *  the minute is dropped entirely on the hour. Returns undefined for a malformed value, so a
 *  caller degrades to omitting the time line entirely rather than showing a broken string. */
function formatTimeLabel(time: string): string | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 < 12 ? 'a.m.' : 'p.m.';
  return minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${match[2]} ${suffix}`;
}

/** Today as a calendar date (`YYYY-MM-DD`) in the club's own timezone. A Worker's clock is UTC,
 *  and an Alaska evening is already tomorrow in UTC, so a UTC "today" would quiet an event that
 *  has not happened yet, nine hours early. Same one-line Intl derivation
 *  `class-schedule.remote.ts` uses for the same reason. */
export function anchorageTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Anchorage' }).format(new Date());
}

/** True when `dateStr` (a row's end date, or its start date when it has none) falls strictly
 *  before `today`; false for a row with no date at all. Both sides are `YYYY-MM-DD` calendar
 *  dates, which sort lexicographically the same way they sort chronologically, so the comparison
 *  needs no `Date` at all and cannot pick up a timezone offset on the way through. */
function isRowPast(dateStr: string | null, today: string): boolean {
  if (!dateStr) return false;
  return dateStr < today;
}

/** Render a row's markdown field and resolve its photo, the two async steps a bare D1 row needs
 *  before it is display-ready; `buildEventsPage`'s own per-row enrichment step. Exported for
 *  direct unit testing, since it is the one place all of a card's field mappings live. */
export async function toEventCard(
  row: EventDetailRow,
  today: string,
  resolveMedia: MediaResolve,
  renderMarkdown: (md: string) => Promise<string>,
): Promise<EventCard> {
  const imageUrl = resolveEventImageUrl(row.hero_image, resolveMedia);
  const longSource = row.long_description ?? undefined;
  const track = row.track === 'adult-teen' || row.track === 'youth' ? row.track : undefined;

  const card: EventCard = {
    routeId: routeIdOf(row),
    slug: row.slug,
    title: row.title,
    dotKind: seasonDotKind(row.event_type),
    dateLabel: formatDateLabel(row.start_date, row.end_date),
    time: row.start_time ? formatTimeLabel(row.start_time) : undefined,
    location: row.location ?? undefined,
    note: row.short_description ?? undefined,
    fee: row.event_type === 'class' && row.fee !== null ? row.fee : undefined,
    track,
    dropIn: Boolean(row.drop_in),
    isPast: isRowPast(row.end_date ?? row.start_date, today),
    registrationUrl: row.registration_url ?? undefined,
    registrationState: row.registration_status ? REGISTRATION_STATE[row.registration_status] : undefined,
    // An empty alt, not the title, when the row carries none: the band's own h2 already names the
    // event right beside the photo, so repeating it in the alt reads the same thing twice to a
    // screen reader. An unlabelled decorative photo is the honest answer until an editor writes
    // real alt text.
    image: imageUrl && row.hero_image ? { url: imageUrl, alt: row.hero_image_alt ?? '' } : undefined,
  };
  if (longSource) card.longHtml = await renderMarkdown(longSource);
  return card;
}

const byMonthThenDay = (a: { month: number; sortDay: number }, b: { month: number; sortDay: number }) =>
  a.month !== b.month ? a.month - b.month : a.sortDay - b.sortDay;

/** The year of the chronologically earliest `start_date` among every row; undefined when no row
 *  is dated at all. Every stored date is `YYYY-MM-DD`, so a plain string minimum sorts the same as
 *  a chronological one; read order plays no part, unlike a plain `.find()`. */
function firstDatedYear(rows: EventDetailRow[]): number | undefined {
  const dates = rows.map((row) => row.start_date).filter((date): date is string => date !== null);
  if (dates.length === 0) return undefined;
  const earliest = dates.reduce((min, date) => (date < min ? date : min));
  return new Date(`${earliest}T00:00:00`).getFullYear();
}

/** Drop any row whose route id a preceding row already claimed. A route id is a slug from
 *  `events` or an id from `classes`, two independently-keyed tables, so nothing at the schema
 *  level stops one table's value from colliding with the other's. The collision would otherwise
 *  reach the page as two `<section>`s sharing one DOM id (a dead anchor, a doubled `.ics` link)
 *  and, on the keyed `{#each}`, as a Svelte duplicate-key crash that 500s the whole page. The
 *  first row wins and the later one is logged, since one visible row is a far better outcome than
 *  none. */
function dedupeByRouteId<T extends { card: EventCard; row: EventDetailRow }>(items: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const item of items) {
    if (seen.has(item.card.routeId)) {
      console.warn('events_data.duplicate_route_id', {
        routeId: item.card.routeId,
        droppedTitle: item.row.title,
      });
      continue;
    }
    seen.add(item.card.routeId);
    kept.push(item);
  }
  return kept;
}

/** Build the full `/events` page's data from every visible row: the enriched cards, grouped by
 *  calendar month (a governance row pulled out of the chronology entirely, by category,
 *  regardless of its date), the season year for the hero title, and the route id of the next
 *  upcoming band. */
export async function buildEventsPage(
  rows: EventDetailRow[],
  opts: {
    /** The `YYYY-MM-DD` calendar date every past/upcoming judgment is made against; defaults to
     *  today in the club's own timezone (`anchorageTodayIso`) so a caller need not pass it, but
     *  every test does, for a deterministic result. */
    today?: string;
    /** `settings.current_season`, already read by the caller (`readCurrentSeason`); `null` when
     *  unset, in which case the season year falls back to the first dated row's own year. */
    currentSeason: number | null;
    resolveMedia: MediaResolve;
    renderMarkdown: (md: string) => Promise<string>;
  },
): Promise<EventsPageData> {
  const today = opts.today ?? anchorageTodayIso();
  const currentYear = Number(today.slice(0, 4));

  const enriched = await Promise.all(
    rows.map(async (row) => ({
      row,
      ...monthAndDay(row, currentYear),
      card: await toEventCard(row, today, opts.resolveMedia, opts.renderMarkdown),
    })),
  );

  const unique = dedupeByRouteId(enriched);
  const governanceRows = unique.filter((item) => item.row.event_type === 'governance');
  const seasonRows = unique.filter((item) => item.row.event_type !== 'governance');
  seasonRows.sort(byMonthThenDay);
  governanceRows.sort(byMonthThenDay);

  const monthBuckets = new Map<number, typeof seasonRows>();
  for (const item of seasonRows) {
    const bucket = monthBuckets.get(item.month) ?? [];
    bucket.push(item);
    monthBuckets.set(item.month, bucket);
  }

  const months: MonthGroup[] = [];
  for (let month = 1; month <= 12; month++) {
    const bucket = monthBuckets.get(month);
    if (!bucket || bucket.length === 0) continue;
    months.push({ name: MONTH_NAMES[month - 1], id: MONTH_NAMES[month - 1].toLowerCase(), events: bucket.map((b) => b.card) });
  }
  const undatedBucket = monthBuckets.get(99);
  if (undatedBucket && undatedBucket.length > 0) {
    months.push({ ...UNDATED_MONTH, events: undatedBucket.map((b) => b.card) });
  }

  // An undated row is never the scroll target: `isRowPast` always reads it as not-past (there is
  // no evidence it already happened), so without the `start_date` guard a genuinely TBD row would
  // win this search whenever every dated row has already passed.
  const nextUpcoming = seasonRows.find((item) => item.row.start_date && !item.card.isPast);

  // The page's one fireweed control, chosen independently of `nextUpcomingId`: the next band the
  // reader lands on is often a regatta or a work party, and the register button has to follow the
  // registration, not the scroll. A drop-in class takes no registration at all, so it never wins
  // the slot.
  const primaryClass = seasonRows.find(
    (item) => !item.card.isPast && item.card.registrationState === 'open' && !item.card.dropIn,
  );

  return {
    seasonYear: opts.currentSeason ?? firstDatedYear(rows) ?? currentYear,
    nextUpcomingId: nextUpcoming?.card.routeId,
    primaryClassId: primaryClass?.card.routeId,
    months,
    governance: governanceRows.map((r) => r.card),
  };
}
