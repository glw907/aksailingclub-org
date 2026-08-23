# Events admin build pass

> For agentic workers: each task runs as the implementer → diff-reviewer → gate chain through
> `~/.claude/workflows/pass-execute.js` (workflow mode; `site-implementer`, `sonnet`;
> `diff-reviewer`, `claude-opus-5`). Steps use checkbox syntax.

**Goal:** Replace `/admin/club/events` — today a flat chronological list plus a separate
`[id]` detail page — with a series ledger: one row per event series, the two prior seasons'
dates read-only beside an inline-editable current-season date, the full edit opening in place,
and a "Start the next season" roll-forward that mints the next year's undated copies. Wire the
hero photo the redesigned public `/events` page reads.

**Spec:** `docs/2026-08-22-events-admin-design.md` (the ratified contract; executors read it
with this plan). Supporting inputs: `docs/2026-07-20-admin-toolkit-catalog.md` (the Events
sweep notes — the four category-chip dressings, the all-same-value Visibility column, the
floating red Delete, the monospace prose textareas), `docs/2026-08-22-events-redesign-design.md`
(what the public page consumes), and the Classes pass (`docs/plans/2026-07-21-classes-pass.md`,
`src/routes/admin/club/classes/+page.svelte`) as the toolkit precedent this screen follows.

**Architecture:** one `asc-club` migration (`0035_event_series`) adds the `event_series` table
and gives `events` a `series_id` and a `season`, moving slug uniqueness to `UNIQUE (season,
slug)`. `src/admin-club/lib/events-store.ts` grows from a five-function CRUD layer into the
ledger's whole data layer (series, seasons, the ledger read, the visibility rule, the series
move, the roll-forward). `/admin/club/events` becomes one route: a toolkit ledger
(`PageHeader` + `ListToolbar` + `AdminTable` + `ExpandableRow` + `StatusChip` + `EmptyState`)
whose panel carries the full form and whose form actions all run through `clubAdminAction`.
`events/[id]` shrinks to a redirect; `events/new` is deleted and its job becomes a blank panel
on the ledger. The two public queries (`src/theme/events-data.ts`,
`src/theme/season-data.ts`) trade their date-year derivation for a real `season` filter.

**Branch:** `events-admin` (already checked out).

**Token ceiling:** 2M. **Checkpoint interval:** every three tasks — write `docs/STATUS.md`
after task 3 and again at the close.

**Gate for every task:** `npm run check` (0 errors, 0 warnings) && `npm test` && `npm run
build`.

**Task independence.** Task 1 gates everything. Tasks 2 and 3 are independent of each other
and may run in parallel once 1 lands (2 touches only `src/admin-club/**` + its tests, 3 only
`src/theme/**` + `e2e/fixtures/**` + their tests; no shared file). Task 4 depends on 2. Task 5
depends on 4. Task 6 depends on all of them and is conductor-executed. So: **1 → (2 ∥ 3) → 4 →
5 → 6.**

## Global constraints

- Engine `@glw907/cairn-cms ^0.96.0`; Node 24; **no new dependencies** (this includes the hero
  picker — see task 5's seam note).
- **`asc-club` is fully evolvable via a real migration** (CLAUDE.md): the schema change is
  forward/rollback/verify/README, scratch-proven before it touches live. **`EVENTS_DB` is
  never read or written by this pass, and never migrated here.** `AUTH_DB` is untouched.
- `/admin/**` loads **only** cairn's precompiled `cairn-admin.css`
  (`src/admin-club/toolkit/README.md`): a daisyUI component class works only if it is already
  compiled there, and an arbitrary Tailwind utility string only if that literal string already
  appears in cairn's own scanned admin source. Route-local layout goes in a scoped `<style>`
  block with literal values, as every other `/admin/club/**` screen does. `badge-error` /
  `badge-success` are known **not** to compile there; `status-<tone>` modifiers do (see
  `StatusChip`'s own header).
- Every write path runs through `clubAdminAction` with a `ctx.audit(...)` call, including the
  refusal branches, matching the existing Events actions.
- **No "edited by" column** on the ledger, and no per-row destructive control in a summary
  cell — the current screen's own ruling stands until the audit sink has a season of history.
- Comments follow `ts-conventions` / `svelte-conventions` (TSDoc contracts, `@component`
  blocks, no em dashes in code comments).
- Visual baselines regenerate only through `ci.yml`'s `update_snapshots` dispatch (task 6),
  never a local `--update-snapshots` run.
- Out of scope, per the spec: any `EVENTS_DB` change; the Classes screen, including the open
  `fleet_tuneup` drop-in question; a roll-forward for classes; registration/fee/`drop_in`
  editing (they are `classes` columns and stay the Classes screen's job); any public-page
  design change.

---

### Task 1: The `0035_event_series` migration

**Independent:** no — it gates every other task.

**Files:** create `migrations/asc-club/0035_event_series/forward.sql`, `rollback.sql`,
`verify.sql`, `README.md`; create `src/tests/event-series-migration.test.ts`.

**Outcome.** `asc-club` carries an `event_series` table, every existing `events` row belongs to
a series of its own, every row has a `season`, and slug uniqueness is per-season. Scratch-proven
end to end. **The live `--remote` apply is NOT part of this task** — it is task 6's conductor
step, after the SQL has been reviewed (the same boundary `0034_asset_type_ids`'s README records).

**Acceptance criteria.**

- `forward.sql` creates `event_series` with exactly these columns: `id TEXT PRIMARY KEY`,
  `title TEXT NOT NULL`, `recurrence TEXT NOT NULL CHECK (recurrence IN ('annual', 'once'))`,
  `retired_at TEXT`, `created_at TEXT NOT NULL DEFAULT (datetime('now'))`, `updated_at TEXT NOT
  NULL DEFAULT (datetime('now'))`.
- It then inserts **exactly one series per existing `events` row**, selected from `events`
  (never a hand-written list): `id = 'series-' || events.id` (**plan decision:** a deterministic
  derived id, so the rollback and the verify can both find them and a re-read is reproducible),
  `title = events.title`, `recurrence = 'annual'`, `retired_at` null.
- `events` is **recreated**, not altered: SQLite cannot drop the column-level `slug TEXT NOT
  NULL UNIQUE` that `0001_substrate` declared, and cannot add a `NOT NULL` foreign key to a
  populated table. The statement order in the file is `CREATE TABLE event_series` → `INSERT INTO
  event_series` → `CREATE TABLE events_new` → `INSERT INTO events_new … SELECT … FROM events` →
  `DROP TABLE events` → `ALTER TABLE events_new RENAME TO events`, and the test asserts that
  order by string index (the `0029_signature_record` idiom).
- `events_new` carries every column the current table carries, unchanged, in the same order
  (`id`, `title`, `slug`, `category` with its five-value CHECK verbatim, `short_description`,
  `long_description`, `start_date`, `start_time`, `end_date`, `end_time`, `location`,
  `hero_image`, `hero_image_alt`, `thumbnail_image`, `visible` with its `CHECK (visible IN
  (0,1))`, `created_at`, `updated_at`) **plus** `series_id TEXT NOT NULL REFERENCES
  event_series(id)` and `season INTEGER NOT NULL`; `slug` is declared `slug TEXT NOT NULL`
  with **no** column-level `UNIQUE`; the table-level constraint `UNIQUE (season, slug)` is
  declared, matching `classes`' own shape. `start_date` stays nullable.
- The copy derives `season` as the year of `start_date` when there is one, else
  `settings.current_season`: `COALESCE(CAST(substr(start_date, 1, 4) AS INTEGER), (SELECT
  CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'))`, and `series_id` as
  `'series-' || id`. No row is dropped, reworded, or reordered; `created_at`/`updated_at` copy
  across verbatim.
- `forward.sql` ends with one `audit_log` row: actor `'system'`, action `'migration.backfill'`,
  entity `'event_series'`, detail naming `0035_event_series` and what it did.
- `verify.sql` is all `SELECT`s, run via `--command` (never `--file`; see
  `0005_member_domain/README.md`), and answers: (1) `SELECT COUNT(*) FROM events` equals
  `SELECT COUNT(*) FROM event_series` — the one-series-per-row invariant; (2) events whose
  `series_id` has no matching `event_series` row → 0; (3) `SELECT season, slug, COUNT(*) FROM
  events GROUP BY season, slug HAVING COUNT(*) > 1` → no rows; (4) `SELECT COUNT(*) FROM events
  WHERE season IS NULL OR season NOT BETWEEN 2000 AND 2100` → 0; (5) `SELECT sql FROM
  sqlite_master WHERE name = 'events'` for a human read of the new constraint set; (6) `SELECT
  COUNT(*) FROM events WHERE start_date IS NULL` — the undated count, which the README records
  before and after so the migration is shown to have invented no dates.
- `rollback.sql` reverses the recreate: rebuilds `events` in its exact `0001_substrate` shape
  (global `slug TEXT NOT NULL UNIQUE`, no `season`, no `series_id`), copies every row back,
  drops `event_series`, and writes its own `migration.rollback` audit row.
- `rollback.sql`'s header and the README both state the precondition in the
  `0034_asset_type_ids` register: **safe only while no two `events` rows share a slug** — that
  is, before the first roll-forward creates a second season's copy. `verify.sql` query 3's
  slug-level sibling (`SELECT slug, COUNT(*) FROM events GROUP BY slug HAVING COUNT(*) > 1`) is
  the check to run before a rollback, and the README says so.
- `README.md` follows `0034_asset_type_ids/README.md`'s sections exactly: What this does; Why
  the recreate (the two SQLite constraints above, named); Live pre-migration state (a `--remote`
  read-only count of `events`, of dated vs undated rows, and the current `settings.current_season`
  value, taken before the scratch run and recorded verbatim); How to run; Verify; Rollback (with
  the precondition); **Scratch-proof procedure** (a transcript, see below); Live apply sequence.
- **Scratch proof**, run and transcribed into the README, against a local disposable D1 replica
  with a `--persist-to` directory distinct from the repo's own `.wrangler/` state, never a
  Cloudflare-hosted scratch database: (1) fresh persist dir; (2) apply `0001` through `0034` in
  order; (3) seed the scratch replica to the live condition — a `settings` row for
  `current_season`, one dated event, one undated event, and two events sharing a title (so the
  "no guessing at links by title" claim is visible in the result: they get two separate series);
  (4) `forward.sql` → success; (5) `verify.sql` → the six expected answers; (6) `rollback.sql`
  → success, with a direct row check that `events` reads its original shape and every row is
  still present; (7) `verify`-after-rollback; (8) `forward.sql` again → the same answers as (5);
  (9) delete the persist dir. Any step that errors stops the task.
- `src/tests/event-series-migration.test.ts` asserts the **migration text**, the established
  idiom for this repo's migration suites (`fakeD1` executes no SQL, so runtime enforcement is
  the scratch transcript's job — the test file's header says exactly this, as
  `boats-model-migration.test.ts` and `signature-record-migration.test.ts` do). It covers: the
  six-statement order by index; the `recurrence` CHECK vocabulary verbatim; `series_id TEXT NOT
  NULL REFERENCES event_series(id)`; `season INTEGER NOT NULL`; `UNIQUE (season, slug)` present
  and `slug TEXT NOT NULL,` present without a column-level `UNIQUE`; the `COALESCE(CAST(substr(
  start_date, 1, 4) AS INTEGER), (SELECT CAST(value AS INTEGER) FROM settings WHERE key =
  'current_season'))` derivation verbatim; the per-row series insert selecting `FROM events`;
  the `category` CHECK carried across unchanged; and, for the rollback, that it restores `slug
  TEXT NOT NULL UNIQUE`, drops `event_series`, and mentions no `season`/`series_id` column.

**Notes.** No table anywhere references `events(id)` (verified: `grep -rn "REFERENCES events"
migrations/` returns nothing), and no index is declared on `events`, so the recreate has no
referential or index fan-out to carry — unlike `0034`, this needs no insert-repoint-delete
technique. Nothing in this migration guesses at series links by title; the officer links years
by hand through the form (task 5).

- [ ] Write the four migration files and the test.
- [ ] Run the scratch proof; transcribe every step's result into the README.
- [ ] Gate; commit `feat(events): the event_series migration`.

---

### Task 2: The store

**Independent:** independent of task 3; depends on task 1.

**Files:** modify `src/admin-club/lib/events-store.ts`; modify `src/tests/events-store.test.ts`;
create `src/tests/events-rollforward.test.ts`.

**Outcome.** One module answers every question the ledger asks and performs every write it
makes, with the visibility rule, the series move, and the roll-forward's selection and
idempotence all living here rather than in a route.

**Interface contract** (the exact names and shapes tasks 4 and 5 consume):

```ts
export const EVENT_RECURRENCES = ['annual', 'once'] as const;
export type EventRecurrence = (typeof EVENT_RECURRENCES)[number];
export const EVENT_RECURRENCE_LABEL: Record<EventRecurrence, string>;   // 'Annual' | 'Once-off'
export const EVENT_CATEGORY_TONE: Record<EventCategory, StatusChipTone>;

export interface EventSeriesRow {
  id: string; title: string; recurrence: EventRecurrence;
  retiredAt: string | null; createdAt: string; updatedAt: string;
}

// EventRow gains: seriesId: string; season: number.  Hero fields stay and are now writable.
// EventWrite gains heroImage / heroImageAlt and LOSES `visible` (the save path owns it).

export interface EventInstance {
  id: string; startDate: string | null; endDate: string | null; visible: boolean;
}

export interface LedgerRow {
  kind: 'event' | 'class';
  id: string;                       // events.id, or classes.id for a class row
  seriesId: string | null;          // null on a class row
  title: string;
  category: EventCategory;          // 'class' on a class row
  recurrence: EventRecurrence | null;
  retiredAt: string | null;
  current: EventInstance | null;    // the selected season's instance
  prior: [EventInstance | null, EventInstance | null];   // season-1, then season-2
  sortKey: string | null;           // 'MM-DD', or null when nothing dates the row
  seriesYearCount: number;          // seasons this series holds a row in; 0 on a class row
  event: EventRow | null;           // the full current-season row for the panel; null on a class row
}

export interface RollForwardPlan {
  fromSeason: number; toSeason: number;
  create: { seriesId: string; title: string }[];
  skipped: { seriesId: string; title: string; reason: 'once' | 'retired' | 'already-rolled' }[];
}

export async function listEventSeasons(db: D1Database): Promise<number[]>;
export async function listLedger(db: D1Database, season: number): Promise<LedgerRow[]>;
export async function getEvent(db: D1Database, id: string): Promise<EventRow | null>;
export async function findEventBySeasonSlug(db: D1Database, season: number, slug: string): Promise<EventRow | null>;
export async function createSeries(db: D1Database, args: { id: string; title: string; recurrence: EventRecurrence }): Promise<void>;
export async function createEvent(db: D1Database, args: { id: string; season: number; seriesId: string; write: EventWrite }): Promise<void>;
export async function updateEvent(db: D1Database, id: string, write: EventWrite): Promise<void>;
export async function setEventDates(db: D1Database, id: string, dates: { startDate: string | null; endDate: string | null }): Promise<void>;
export async function setEventVisibility(db: D1Database, id: string, visible: boolean): Promise<void>;
export async function setSeriesTitleAndRecurrence(db: D1Database, seriesId: string, args: { title: string; recurrence: EventRecurrence }): Promise<void>;
export async function retireSeries(db: D1Database, seriesId: string, retired: boolean): Promise<void>;
export async function linkEventToSeries(db: D1Database, eventId: string, targetSeriesId: string): Promise<{ removedSeriesId: string | null } | { error: string }>;
export function canDeleteEvent(row: EventRow): boolean;
export async function deleteEvent(db: D1Database, id: string): Promise<void>;
export async function previewRollForward(db: D1Database, args: { fromSeason: number; toSeason: number }): Promise<RollForwardPlan>;
export async function rollForwardSeason(db: D1Database, args: { fromSeason: number; toSeason: number }): Promise<{ created: number; skipped: number }>;
```

**Acceptance criteria.**

- **The dated-publishes rule lives in SQL, not in a caller.** Both `updateEvent` and
  `setEventDates` set `visible = CASE WHEN <new start_date> IS NOT NULL AND start_date IS NULL
  THEN 1 ELSE visible END` in the same statement that writes the dates, so saving a date on an
  undated row publishes it atomically and saving a date on an already-hidden, already-dated row
  does **not** re-publish it. `createEvent` sets `visible` to 1 when `write.startDate` is
  non-null and 0 otherwise. Nothing else in the module writes `visible` except
  `setEventVisibility`. `EventWrite` no longer carries `visible`, and the store exposes no way
  for a form to tick it.
- `listLedger(db, season)` issues **at most three statements** (one `events`-plus-`event_series`
  join across the three seasons, one `classes` read across the same three, one for the
  per-series year counts) — never a per-row query loop. It returns event rows for the three
  seasons `season`, `season - 1`, `season - 2` collapsed into one `LedgerRow` per series, plus
  one `LedgerRow` per `classes` row in those seasons (`kind: 'class'`, `event: null`,
  `seriesId: null`, `recurrence: null`, `seriesYearCount: 0`, `category: 'class'`).
- A series with no row in the selected season still appears, with `current: null`, so its
  history stays visible. A class appears once per series-equivalent (its own row per season,
  collapsed on `classes.slug` across the three seasons the same way).
- **Ordering** (plan decision, forced by the cross-year comparison the spec's rule implies): the
  sort key is the month-and-day (`MM-DD`) of the row's own current-season `start_date` when it
  has one, else of its `season - 1` date, else of its `season - 2` date, else null. Rows sort
  ascending by that key with **nulls last**, ties broken by `title` ascending, case-insensitive.
  Comparing month-and-day rather than the full date is what lets an undated 2027 row hold the
  position its 2026 date gave it, beside rows already dated in 2027.
- `previewRollForward` selects a series into `create` when it is **annual**, **not retired**,
  holds at least one row in `fromSeason`, **and** holds no row in `toSeason`; every other series
  with a `fromSeason` row lands in `skipped` with exactly one reason, in this precedence:
  `retired` → `once` → `already-rolled`. `create` and `skipped` are both title-sorted.
- `rollForwardSeason` inserts one row per `create` entry in a single `db.batch`, copying from
  the series' `fromSeason` row: `title`, `slug`, `category`, `short_description`,
  `long_description`, `location`, `hero_image`, `hero_image_alt`, `thumbnail_image`,
  `series_id`. It sets `season = toSeason`, `visible = 0`, and **all four of `start_date`,
  `start_time`, `end_date`, `end_time` to null** — the roll copies everything except the dates
  and the times. The new row's id is `` `${slug}-${toSeason}` ``.
- **Idempotence:** a second `rollForwardSeason` with the same arguments creates nothing and
  returns `{ created: 0 }`, because the `already-rolled` predicate is a `NOT EXISTS` on
  `(series_id, toSeason)` evaluated inside the insert's own `SELECT`, not only in the preview.
  A test asserts this by running the plan twice against a fixture whose second read reports the
  rolled row.
- `linkEventToSeries` moves the event onto the target series and, when the event's former series
  is left with no rows at all, deletes it and reports its id in `removedSeriesId`. It refuses
  with `{ error: 'That series already has an event in this season.' }` when the target series
  already holds a row in the moving event's season, and with `{ error: 'No such series.' }` when
  the target does not exist. Both the move and the orphan delete ride one `db.batch`.
- `setSeriesTitleAndRecurrence` writes `event_series.title` **and** `updated_at`. **Plan
  decision:** the form's single Title field writes both `events.title` (this year's own title,
  so history keeps each year's wording) and `event_series.title` (the ledger's row label, so it
  never goes stale); the route's save action calls `updateEvent` and
  `setSeriesTitleAndRecurrence` for one submitted title.
- `canDeleteEvent` is `row.visible === false && row.startDate === null` — **plan decision** for
  the spec's "never been visible": an undated, invisible row is exactly a row that was never
  published, because the only path to `visible = 1` is a saved date, and Hide never clears a
  date. It is a pure function so the route and the panel share one rule.
- `retireSeries(db, id, true)` sets `retired_at = datetime('now')`; `retireSeries(db, id,
  false)` sets it to null. Reversible, per the spec.
- `EVENT_CATEGORY_TONE` maps the five categories onto `StatusChipTone`: `racing` → `'info'`,
  `class` → `'warning'`, `operations` → `'neutral'`, `social` → `'neutral'`, `governance` →
  `'neutral'`. This is the one place the category chip's dressing is decided (task 4 consumes
  it), which closes the catalog's "four different dressings" finding at the source.
- The module stays a data-access layer: **no `ctx.audit` call, no `fail()`, no `redirect()`**,
  matching its own header's split.
- **Tests.** `src/tests/events-store.test.ts` (extended) covers, against `fakeD1` by asserting
  the SQL text and the bound arguments — the repo's established idiom, since `fakeD1` executes
  no SQL and every test file says so in its header: the publish-on-date CASE present in both
  `updateEvent` and `setEventDates`; `createEvent` binding `visible` 1 for a dated write and 0
  for an undated one; `EventWrite` carrying no `visible`; hero fields bound on both insert and
  update; `setEventVisibility` binding 0 for Hide and 1 for Show; `retireSeries` both
  directions; `linkEventToSeries`' three outcomes (move, orphan delete, both refusals);
  `canDeleteEvent`'s four combinations. `src/tests/events-rollforward.test.ts` covers:
  `previewRollForward`'s four selection outcomes with the reason precedence;
  `rollForwardSeason`'s inserted column set (dates and times null, hero and descriptions
  carried, `visible` 0, id `slug-toSeason`); idempotence on a second run; and `listLedger`'s
  ordering — a fixture with a dated current-season row, an undated row whose prior season dates
  it earlier, a class row, and a row dated nowhere, asserted to come back in the exact expected
  order.

- [ ] Write the failing tests for the contract above.
- [ ] Implement; run `npx vitest run src/tests/events-store.test.ts src/tests/events-rollforward.test.ts`.
- [ ] Gate; commit `feat(events): the series ledger store`.

---

### Task 3: The public queries

**Independent:** independent of task 2; depends on task 1.

**Files:** modify `src/theme/events-data.ts`, `src/theme/season-data.ts`,
`src/theme/event-images.ts`; modify `src/tests/events-data.test.ts`,
`src/tests/season-data.test.ts`; modify `e2e/fixtures/events-seed.sql`,
`e2e/fixtures/bootstrap-club-db.mjs`.

**Outcome.** Both public reads scope events by the real `season` column instead of deriving a
year from `start_date`, a hero picked in the admin resolves on the public page, and `/events`
renders exactly as it does today.

**Acceptance criteria.**

- `events-data.ts`'s `EVENTS_QUERY` becomes `${EVENTS_COLUMNS} WHERE visible = 1 AND (?1 IS
  NULL OR season = ?1)`. The `substr(start_date, 1, 4)` derivation and its "events carries no
  season column" comment are gone; the header comment says what replaced them and why. The
  `?1 IS NULL` arm stays: an unset `current_season` quiets the filter rather than emptying the
  page, the posture the current comment already ratifies.
- `readEventRows` binds the season as a **number** (`season`), not `String(season)`; the
  bound-as-text comment goes with the `substr` comparison it explained. A test asserts the bound
  argument's type.
- **Plan decision — slug is no longer globally unique.** `EVENT_BY_SLUG_QUERY` gains `ORDER BY
  season DESC` before its `LIMIT 1`, so `/events/{slug}` and its `.ics` sibling resolve to the
  most recent instance of a rolled series rather than an arbitrary one. Its comment says so.
  The existing `fakeD1` substring keys in `src/tests/events-detail-route.test.ts` and
  `src/tests/events-ics-route.test.ts` (`'FROM events WHERE slug = ?1'`) still match; if either
  breaks, fix the key rather than the query.
- `season-data.ts`'s `EVENTS_QUERY` gains `AND (?1 IS NULL OR season = ?1)`, and both
  `loadSeasonMonths` and `loadSeasonHasLiveEvents` bind the season they already read for the
  classes arm. **Nothing else in that module changes**: `seasonHasLiveEvents`'s JS-side
  `currentSeason` year bound stays exactly as it is (it now duplicates the SQL scope for the
  database path but still guards its direct-array callers and its own tests); its comment gains
  one sentence recording that the SQL now scopes too.
- `event-images.ts`'s `resolveEventImageUrl` accepts a stored `media:` token directly: it tries
  `parseMediaToken(value)` first and resolves that, and only falls back to the 14-entry legacy
  filename map when the value is not a token. Without this, a hero picked through the admin
  (task 5) writes a `media:slug.hash` reference that the public page silently drops. Its TSDoc
  records both accepted forms. Tests cover a token, a known legacy filename, an unknown
  filename, and null.
- `e2e/fixtures/events-seed.sql` inserts `event_series` rows and gives every seeded `events`
  row a `series_id` and a `season` equal to the `settings.current_season` value the same fixture
  seeds — otherwise the new season filter drops every fixture row and the `/events` visual
  baseline goes blank.
- `e2e/fixtures/bootstrap-club-db.mjs` applies `0035_event_series/forward.sql` to a **warm**
  local replica: its current `schemaAlreadyMigrated()` short-circuit (probing for the `settings`
  table) skips the whole migration set on a workstation replica that already carries 0001–0034,
  so the reseed would fail on the missing columns. Add a second, narrow probe — if `settings`
  exists but `event_series` does not, apply `0035`'s `forward.sql` alone — with a comment saying
  why a blanket re-run is not the fix (re-running `0001` against a populated replica fails).
- **`/events` still renders.** Run `npm run dev`, load `/events`, and confirm the season's bands
  render with their photos, the month index resolves, and the `#meetings` coda is present. Then
  run `node scripts/design-probe.mjs` against a `npm run build` + `vite preview` and confirm its
  `/events` checks are clean. Neither is automated by this task; both are recorded in the task
  report.
- Tests: `src/tests/events-data.test.ts` gains coverage of the new `WHERE` clause and the
  numeric bind, and of the unset-season arm reading every event; `src/tests/season-data.test.ts`
  gains the same for its own query. Any test whose `fakeD1` key no longer matches is updated,
  never deleted.

**Notes.** The `date_history` fallback and the `"Date to be announced"` label become unreachable
for `events` rows once undated means invisible; leave both in place (classes still reach the
label) and note it in the task report rather than pruning them in this pass.

- [ ] Write the failing tests; implement.
- [ ] Fix the e2e fixture and bootstrap; run `npm run test:e2e` locally far enough to prove the
      seed applies (the visual baselines themselves are CI's job).
- [ ] Read `/events` on dev-server; run the design probe.
- [ ] Gate; commit `feat(events): season-filter the public event queries`.

---

### Task 4: The ledger

**Independent:** no — consumes task 2's store.

**Files:** modify `src/routes/admin/club/events/+page.server.ts` and `+page.svelte`; create
`src/tests/events-ledger.test.ts` and `src/tests/events-ledger-page.test.ts`.

**Outcome.** `/admin/club/events` is the series ledger: three season columns, an inline-editable
current-season date, the toolkit toolbar with the to-do count and the two season actions, class
rows merged read-only, and a real empty state.

**Acceptance criteria.**

- **Load.** `requireSession`, then `resolveClubDb`; the selected season is `?season=` when
  present and finite, else `getCurrentSeason(db)` (the Classes screen's `parseSeason` idiom,
  copied not re-derived in spirit). It returns `{ rows: LedgerRow[], season, currentSeason,
  seasons, undatedCount, rollPlan, openId, error }` where `seasons` is
  `listEventSeasons(db)` unioned with `currentSeason` and sorted descending (a brand-new season
  must appear in its own filter before it has a row), `undatedCount` counts `kind === 'event'`
  rows whose `current` exists and whose `current.startDate` is null, `rollPlan` is
  `previewRollForward(db, { fromSeason: season, toSeason: season + 1 })`, and `openId` is
  `?open=`'s value or null. A `CLUB_DB` read failure degrades to an empty list with an honest
  `error` string, exactly as today, never a 500.
- **Table.** `AdminTable` with `density="sm"` and `zebra`, columns in this order: Event
  (title + chips), `{season - 2}`, `{season - 1}`, `{season}`, and the `sr-only` Details column
  `ExpandableRow` supplies. The two prior-season cells are plain read-only text
  (`formatCivilDate`, with an en-dash range when an end date exists, and an empty cell — not a
  dash — for a season the series did not run). All three date cells are `tabular-nums`.
- **The current-season cell is the only editable one**: a `<form method="post"
  action="?/setDate">` inside that `<td>`, carrying `<CsrfField />`, a hidden `id`, and
  `<input type="date" name="startDate">` plus `<input type="date" name="endDate">`. It submits
  on `change` (which fires on blur and on Enter for a native date input) via `requestSubmit()`,
  and runs `use:enhance` with `update({ reset: false })` so the burst of a dozen dates does not
  cost a dozen full page reloads (`use:enhance` is already the idiom on four `/admin/club/**`
  screens).
- **`ExpandableRow` conflict, handled explicitly.** That component's contract puts a row-level
  `onclick` on the whole summary `<tr>` and states that summary cells should stay
  non-interactive. The date cell is the one deliberate exception: its wrapper stops click and
  keydown propagation so typing a date never toggles the row, and a comment in the file names
  the contract it is departing from and points at the harvest finding task 6 files. The trailing
  trigger button keeps its `aria-expanded` and its accessible name.
- **Chips, one dressing.** Every category chip renders through the toolkit's `StatusChip` with
  `size="xs"` and `register="quiet"`, its tone from `EVENT_CATEGORY_TONE`; the label is
  `EVENT_CATEGORY_LABEL[category]`, and `'Class'` for a class row. There is **no** hand-rolled
  `badge` class string anywhere in the file. This is the fix for the catalog's "four different
  dressings" finding, and the render test asserts that the rendered markup contains no
  `badge-info` / `badge-neutral` / `bg-warning` literals.
- A class row additionally carries the public page's gold star before its title, as an
  `aria-hidden` glyph with a scoped `color: var(--color-warning)` rule plus an `sr-only`
  "Class" for assistive tech, and its row's only action is a link to `/admin/club/classes`
  (in the panel, per `ExpandableRow`'s contract, not in a summary cell). A class row's
  `ExpandableRow` panel carries that link and nothing editable.
- A hidden event row carries a quiet `Hidden` marker beside its title (the Classes screen's own
  inline marker), and a retired series carries a quiet `Retired` marker. **No Visibility
  column** — the catalog's all-same-value column finding.
- **Toolbar.** One `ListToolbar` with: a client-side title search (`searchLabel="Search by
  event name"`); three filters, all `display="select"` — `Season` (options from `seasons`,
  `defaultValue` the current season, `onChange` pushing `?season=` through `goto(…,
  { replaceState: true, noScroll: true, invalidateAll: true })`, the Classes screen's
  `pushSeason` idiom), `Dates` (`all` → "All rows", `undated` → "Undated only"), and `Rows`
  (`all` → "Events and classes", `events` → "Events only"); `primaryAction` `{ label: 'New
  event', onClick }` toggling task 5's blank panel; and `count={undatedCount}`
  `itemLabel={{ one: 'undated', many: 'undated' }}`, so the count line reads exactly `5
  undated` for five and `1 undated` for one.
- **"Start the next season"** renders in `ListToolbar`'s `trailing` snippet as a quiet bordered
  button (never fireweed, never red). Clicking it reveals the confirmation panel — no dialog
  element, a `$state` disclosure — whose copy is exactly:
  - heading: `Start the {season + 1} season`
  - `Creates {n} events in {season + 1}, undated and hidden until you save a date.`
  - `Skips {m}: {a} once-off, {b} retired, {c} already in {season + 1}.` — each clause omitted
    when its count is zero; the whole line omitted when `m` is zero.
  - a `<ul>` naming every title in `rollPlan.create`, so the officer sees what is about to
    appear.
  - the submit button labeled `Start the next season`, and a `Cancel` that closes the panel.
  The form posts `?/rollForward` with `<CsrfField />` and a hidden `toSeason`.
- **Empty state.** When the selected season has no rows at all, `EmptyState` renders with
  heading `No events in season {season} yet` and message `Events you add for this season show up
  here, with the last two seasons' dates beside them.`, and an action that opens the new-event
  panel. When rows exist but the filters match none, `AdminTable`'s own `empty` snippet renders
  `No events match those filters.`
- **Actions.** `setDate` and `rollForward`, both `clubAdminAction` with `deniedMessage: 'A club
  role is required to manage events.'`:
  - `setDate` refuses a missing or unknown `id` with `fail(404)` and an audit
    `detail: 'rejected: no such event'`; refuses a malformed date (anything not `''` or strict
    `YYYY-MM-DD`) with `fail(400, { error: 'Enter a date as YYYY-MM-DD.' })`; refuses an end
    date earlier than the start with `fail(400, { error: 'The end date is before the start
    date.' })`; otherwise calls `setEventDates` and audits `{ action: 'update', entity: 'event',
    entityId, detail: 'dates' }`, plus a second audit `detail: 'published'` when the row was
    undated before the write.
  - `rollForward` reads `toSeason` from the form, refuses anything other than `season + 1` with
    `fail(400)`, calls `rollForwardSeason`, audits `{ action: 'roll-forward', entity: 'event',
    entityId: String(toSeason), detail: '{n} created, {m} skipped' }`, and redirects `303` to
    `?season={toSeason}` so the officer lands on the season they just created. It **never**
    writes `settings.current_season` — the officer switches that from the Settings screen when
    the season is ready, as `rollover.ts` already expects.
- **`sr-only` status line** at the top of the page announcing `{undatedCount} undated`, matching
  the existing screens' `role="status"` idiom.
- **Tests.** `src/tests/events-ledger.test.ts` (the `classes-list.test.ts` load-event and
  `postEvent` recipe): the load's season defaulting and `?season=` override; the `seasons` union
  with the current season; `undatedCount`; the `rollPlan` passthrough; the degrade-to-error
  path; `setDate`'s four branches with their audit records; `rollForward`'s refusal, its success
  redirect target, and its audit; and the no-club-role refusal for both actions.
  `src/tests/events-ledger-page.test.ts` (`render` from `svelte/server`, the
  `members-page-toolbar.test.ts` idiom): the three season column headers in order; a prior-season
  cell rendering read-only text and the current cell rendering a date input; the count line
  reading exactly `5 undated` for a five-undated fixture and `1 undated` for one; the class row
  carrying the star, the `Class` chip, and a `/admin/club/classes` link; no `badge-info` /
  `badge-neutral` / `bg-warning` literal anywhere; no "Visibility" or "Edited by" header; the
  roll-forward confirmation's exact copy for a fixture plan of 12 create / 3 skipped; and the
  empty state's heading.

- [ ] Write the failing load/action tests and the render test.
- [ ] Build the route and the page; check at 1440 and 390 with a Playwright capture using
      `e2e/helpers/admin-session`'s `mintAdminSession` (own correction only).
- [ ] Gate; commit `feat(events): the season ledger`.

---

### Task 5: The row form

**Independent:** no — builds inside task 4's page.

**Files:** create `src/routes/admin/club/events/EventRowForm.svelte` and
`src/routes/admin/club/events/HeroImageField.svelte`; delete
`src/routes/admin/club/events/EventForm.svelte`; modify
`src/routes/admin/club/events/event-form-input.ts`,
`src/routes/admin/club/events/+page.server.ts`, `+page.svelte`; replace
`src/routes/admin/club/events/[id]/+page.server.ts` with a redirect-only load and delete
`src/routes/admin/club/events/[id]/+page.svelte`; delete
`src/routes/admin/club/events/new/+page.server.ts` and `new/+page.svelte`; modify
`src/tests/events-actions.test.ts`; modify `src/tests/events-ledger-page.test.ts`; create
`src/tests/events-detail-redirect.test.ts`.

**Outcome.** The full event edits in place beneath its ledger row, the hero photo is pickable,
a year links to an existing series, and the destructive actions live as footer action-links with
their guards.

**Acceptance criteria.**

- **`EventRowForm.svelte`** renders inside `ExpandableRow`'s `panel` snippet, following the
  panel-follows-summary-width contract the Classes pass recorded (lower-priority summary columns
  hide under 640px so the whole row, panel included, fits the viewport with nothing to scroll).
  Its fields, in order: Title, Recurrence (a `SelectInput` over `EVENT_RECURRENCES`), the series
  link control (below), Category (`SelectInput` over `EVENT_CATEGORIES`), Start date, End date,
  Start time, End time, Location, Short description, Long description, and the hero photo with
  its alt text. Composed from `TextInput` / `SelectInput` / `FieldLabel`, stacked register (the
  default), the same recipe `EventForm.svelte` used.
- **The two description textareas render in the body face, not monospace** — the catalog's
  "monospace textareas for prose descriptions" finding. A scoped `font-family: inherit` rule in
  the component's own `<style>` block if cairn's admin sheet defaults them to mono; the task
  report records which was true.
- **No Visible checkbox.** The field is gone from the form and from `parseEventForm`'s output;
  visibility moves entirely to the footer's Hide/Show and the save path's publish rule.
- **No slug field, no thumbnail field.** The slug stays derived (see the create action below) and
  the thumbnail derives from the hero and has no field, per the spec; `thumbnail_image` is never
  written by this screen and rides the roll-forward copy untouched.
- **`HeroImageField.svelte`** is a site-local picker over the committed media library: it takes
  the projected library and the current reference, renders the current asset's thumbnail plus
  its display name and alt, a search-filtered list of the library's image entries, a "Clear"
  control, and an alt-text `TextInput`. It emits two hidden inputs, `heroImage` (a
  `media:slug.hash` token, or empty) and `heroImageAlt`. It is a real listbox with a visible
  focus ring and an accessible name; it never uploads.
  - **The seam, stated as a plan decision.** Cairn ships `MediaPicker.svelte` and
    `MediaInsertPopover.svelte` in `node_modules/@glw907/cairn-cms/dist/components/`, but
    neither is re-exported from `dist/components/index.d.ts`, `mediaLibraryEntry` /
    `MediaLibraryEntry` are absent from `dist/media/index.d.ts`, and the package's `exports` map
    carries no `./components/*` wildcard — so **no import path reaches them from this site**.
    Adding a dependency or deep-importing past the exports map are both out (global
    constraints). This pass therefore builds the field locally over `mediaManifest` from
    `src/theme/cairn.config.ts` (`readCommittedManifest`, already exported) and
    `publicMediaResolver` for thumbnails, filtered to `contentType` starting `image/`, and files
    the missing seam as task 6's first harvest finding.
  - The load supplies the projection: the page's `load` maps `mediaManifest` to
    `{ token, displayName, alt, url }` entries sorted by `displayName`, so the component takes a
    plain array and the route owns the manifest read.
  - Known limitation, recorded in the component's `@component` block: the committed manifest is
    a build-time read, so an asset uploaded through cairn's Library appears in this picker only
    after that commit deploys.
- **The series link control** renders only when `seriesYearCount === 1` (a series holding a
  single year). Its label is exactly `This is the {season} instance of an existing series`, its
  control a `SelectInput` of every other series' title (annual first, then title order), and its
  submitted field `linkSeriesId`. It sits directly beneath Recurrence. For a series with more
  than one year it renders nothing at all.
- **The footer** is a single row of action-links following the toolkit's action-link discipline —
  no floating red top-right control, the catalog's Event-detail finding:
  - `Save` (the primary submit for `?/save`).
  - `Hide this year` when the row is visible; `Show` when it is not — a form posting
    `?/setVisibility`.
  - `Retire series` when `retiredAt` is null; `Unretire series` when it is not — a form posting
    `?/retire`.
  - `Delete` **only** when `canDeleteEvent(row)` is true, styled quiet, and gated behind a
    confirmation whose text is exactly `Delete "{title}"? It has never been published, so
    nothing public changes.` with `Delete` and `Cancel`.
- **`event-form-input.ts`** returns `{ write: EventWrite; recurrence: EventRecurrence;
  linkSeriesId: string | null } | { error: string }`. It keeps the title requirement, drops the
  posted-slug requirement (the slug is derived), validates `recurrence` against
  `EVENT_RECURRENCES` with `A valid recurrence is required.`, validates `category` as today,
  accepts `heroImage` as either empty (→ null) or a string matching `^media:[a-z0-9-]+\.[0-9a-f]{16}$`
  (else `That hero image reference is not valid.`), rejects an end date before the start date
  (`The end date is before the start date.`), and treats every other blank as null.
- **Actions** on `/admin/club/events`, all `clubAdminAction` with the club-role denied message,
  all auditing on both the refusal and the success path:
  - `save` — 404s an unknown `id`; parses; calls `updateEvent` and
    `setSeriesTitleAndRecurrence`; when `linkSeriesId` is present and differs from the row's own
    series, calls `linkEventToSeries` and surfaces its error as `fail(400)`. Audits `{ action:
    'update', entity: 'event' }`, and a second `{ action: 'link-series', entity: 'event_series',
    entityId: targetSeriesId }` when a link happened.
  - `create` — derives the slug from the title (lowercase, non-alphanumerics to single hyphens,
    trimmed), refuses with `An event with that name already exists this season.` when
    `findEventBySeasonSlug` hits, mints a series id `` `series-${slug}-${season}` `` and an
    event id `` `${slug}-${season}` ``, calls `createSeries` then `createEvent` in that order,
    audits `create` for both entities, and redirects `303` to `?season={season}&open={id}`.
  - `setVisibility` — 404s an unknown id, calls `setEventVisibility`, audits `{ action: 'hide' }`
    or `{ action: 'show' }`.
  - `retire` — 404s an unknown series, calls `retireSeries`, audits `{ action: 'retire' }` or
    `{ action: 'unretire' }`, entity `'event_series'`.
  - `delete` — 404s an unknown id, **re-checks `canDeleteEvent` server-side** and refuses with
    `fail(400, { error: 'Only an event that has never been published can be deleted. Hide it
    instead.' })` when it fails, calls `deleteEvent` (and deletes the now-orphaned series in the
    same batch when it holds no other rows), audits `delete`, and redirects `303` to
    `?season={season}`.
- **`New event`** opens a blank `EventRowForm` in a `<tr>` above the first ledger row, from
  client state — no draft row is written to the database, so an abandoned new event leaves
  nothing behind. Its form posts `?/create`. The `events/new` route is deleted.
- **The `[id]` redirect.** `events/[id]/+page.server.ts` keeps only a `load` that calls
  `requireSession`, reads the row, and `redirect(308, '/admin/club/events?season={row.season}&open={row.id}')`,
  falling back to `redirect(308, '/admin/club/events')` when the row is absent or `CLUB_DB` is
  unbound. `+page.svelte` is deleted; the route exports no actions.
- The ledger reads `?open=` into its expanded-row state on load, so both the redirect and the
  create action land with the right row open.
- **Tests.** `src/tests/events-actions.test.ts` is rewritten against the ledger's actions (its
  current imports from `events/new` and `events/[id]` no longer exist): every action's success
  path with its audit record, every refusal with its audit record, the no-club-role refusal, and
  the CSRF fixture recipe unchanged. `src/tests/events-detail-redirect.test.ts` asserts the 308
  target for a known id, for an unknown id, and for an unbound `CLUB_DB`.
  `src/tests/events-ledger-page.test.ts` gains: the panel's field set; no `name="visible"`
  anywhere in the rendered markup; no `name="slug"`; `Hide this year` on a visible row and
  `Show` on a hidden one; `Retire series` present; `Delete` present only for an undated,
  invisible fixture row and absent for a published one; the series link control present at
  `seriesYearCount === 1` with its exact label for a fixture season, and absent at 2; the hero
  field emitting `heroImage` and `heroImageAlt` inputs.

- [ ] Write the failing action and render tests.
- [ ] Build the form, the hero field, the actions, and the redirect; delete the two retired
      routes and `EventForm.svelte`.
- [ ] Check the panel at 1440 and 390 with a minted admin session (own correction only).
- [ ] Gate; commit `feat(events): the in-place row form`.

---

### Task 6: Close

**Independent:** no — conductor-executed, after 1–5.

**Files:** modify `docs/STATUS.md`, `docs/HISTORY.md`, `ROADMAP.md`,
`docs/design-benchmark/ledger.md`; create
`docs/2026-08-22-events-admin-harvest-findings.md`; visual baselines under `e2e/` (CI-generated,
if any change at all).

**Outcome.** The migration is live, the pass is closed the way this repo closes passes, and the
seams this build hit are filed for cairn.

**Acceptance criteria (conductor-executed, not an implementer task).**

- **The live migration apply, with its precondition.** Only after task 1's scratch proof is
  green and the SQL has been reviewed:

  ```sh
  source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0035_event_series/forward.sql
  source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0035_event_series/verify.sql)"
  ```

  A pre-apply `--remote` read records the `events` row count, the dated/undated split, and
  `settings.current_season`; the post-apply verify must show the same row count, one series per
  row, no orphan `series_id`, no duplicate `(season, slug)`, and the same undated count. The
  before/after table goes into the migration's README as a **Live apply record**, and the README
  gains the note that `forward.sql` is now the record of what ran and must not be edited. This
  repo applies `asc-club` migrations by `wrangler d1 execute --remote --file`; there is no
  `wrangler d1 migrations` usage anywhere in it and none is introduced here.
- **`/events` is re-read after the live apply**, since both public queries changed: the season's
  bands render, the photos resolve, the month index resolves. A blank or short page after the
  apply means a `season` derivation went wrong and the rollback precondition still holds.
- **Baselines.** `gh workflow run ci.yml -f update_snapshots=true --ref events-admin`, the log
  read (not the conclusion). The expected outcome is **no new PNGs**: the admin surface is
  deliberately outside the pixel-diff suite (`e2e/admin-login.spec.ts`'s own header), and
  `/events` should render identically once the fixture carries seasons. A PNG that does land is
  reviewed at 1440 and 390 before it is accepted, and its cause explained in the recap.
- **Design probe and coherence.** `node scripts/design-probe.mjs` clean for `/` and `/events`.
  The probe renders every path signed out and therefore cannot reach `/admin/club/events`; the
  admin screen's read is a fresh-context whole-page coherence read instead, at 390 and 1440
  against captures taken with `mintAdminSession`, asking the expert-tells question. Verdict to
  `docs/design-benchmark/ledger.md`.
- **Reviewer fan-out:** `svelte-reviewer`, `daisyui-a11y-reviewer` (the inline date cell inside
  an expandable row, the hero picker's listbox, the roll-forward confirmation, focus after an
  enhanced submit), `web-auth-security-reviewer` (seven new form actions), and
  `cloudflare-workers-reviewer` (the ledger's three-statement read and the batched roll-forward).
  Findings triaged and fixed.
- **`docs/2026-08-22-events-admin-harvest-findings.md`** in the
  `docs/2026-08-22-events-redesign-harvest-findings.md` register (a staging file for cairn's
  friction log; engine mechanics and contract gaps only, never a site design choice), seeded
  with:
  1. **The media-library picker has no reuse seam for a site's own admin screen.**
     `dist/components/MediaPicker.svelte` and `dist/components/MediaInsertPopover.svelte` exist
     in the published package but are absent from `dist/components/index.d.ts`;
     `mediaLibraryEntry` and `MediaLibraryEntry` are absent from `dist/media/index.d.ts`; and
     `package.json`'s `exports` map has no `./components/*` wildcard, so a site cannot reach
     either by any legal import path. ASC's own `events-store.ts` and `classes-store.ts` have
     each carried a "the picker seam is not wired" comment since pass 2.1; this pass had to
     rebuild the field locally over `readCommittedManifest`. What cairn wants: `MediaPicker` and
     `mediaLibraryEntry` exported, plus a documented way for a site's own `/admin` screen to get
     the projected library (a loader helper alongside `mediaLibraryLoad`).
  2. **`ExpandableRow` has no interactive-summary-cell seam.** Its row-level `onclick` and its
     "summary cells should stay non-interactive" contract are correct for a read-only summary,
     but a ledger with an inline-editable cell has to hand-roll `stopPropagation` on both click
     and keydown. The component wants an opt-out (an `inert`-cell wrapper snippet, or a
     documented `data-` escape) so every consumer does not re-derive it.
  3. Anything else the build surfaced; the reviewer fan-out's engine-level findings land here
     too, and the mechanically detectable half belongs in `cairn-audit`, not
     `scripts/design-probe.mjs`.
- **`docs/HISTORY.md`** gains the pass entry, newest first, in the existing shape: what landed,
  what the gates caught, what a later pass would be wrong to rediscover (the SQLite recreate
  forced by the column-level UNIQUE; the slug-no-longer-unique consequence for
  `EVENT_BY_SLUG_QUERY`; the `bootstrap-club-db.mjs` warm-replica gap; the picker seam).
- **`ROADMAP.md`**'s `admin-screen-passes` entry gains Events to its shipped list with the date,
  leaving the remaining screens as they stand.
- **`docs/STATUS.md`** stays under 60 lines and points at Geoff's before/after of
  `/admin/club/events` on dev as the next action, keeps the live-migration record visible, and
  carries the pass's open items forward.
- Merge and dev deploy follow the standing authorization in `CLAUDE.md` once the PR is green on
  its final commit; the apex cutover is untouched.

- [ ] Apply the migration to live and record the before/after in its README.
- [ ] Re-read `/events`; dispatch the baseline regeneration and read the log.
- [ ] Run the reviewer fan-out and the coherence read; fix what survives.
- [ ] Write the harvest doc and the records; commit `docs: close the events-admin pass`.
