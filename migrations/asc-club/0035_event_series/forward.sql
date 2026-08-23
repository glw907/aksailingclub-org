-- asc-club migration 0035: events admin build pass, Task 1 (docs/plans/2026-08-22-events-admin.md,
-- "Task 1: The 0035_event_series migration"; docs/2026-08-22-events-admin-design.md, "Data
-- model"). Gives every `events` row a series identity that survives across seasons and a real
-- `season` column, so the ledger can show the last two seasons' dates beside the current one and
-- "Start the next season" can copy a series forward without guessing at a date's year.
--
-- WHY THIS NEEDS A RECREATE, NOT AN ALTER. `events.slug` carries a column-level `UNIQUE`
-- (`0001_substrate`), and SQLite cannot drop a column-level constraint in place; the new shape
-- needs a table-level `UNIQUE (season, slug)` instead, since a rolled-forward event keeps its
-- slug across seasons. SQLite also cannot add a `NOT NULL` column with no default to a populated
-- table in a plain `ALTER TABLE ADD COLUMN` -- `series_id TEXT NOT NULL REFERENCES
-- event_series(id)` needs a real value for every one of the table's existing rows before the
-- constraint can hold, and a `ADD COLUMN ... NOT NULL` with no `DEFAULT` is rejected outright.
-- This is the same recreate-and-copy technique `0006_offer_cascade_on_waitlist_delete`,
-- `0022_join_emails`, and `0029_signature_record` already use for the identical situation.
--
-- `events` has never been altered since `0001_substrate` (confirmed: `grep -rln events
-- migrations/asc-club/*/forward.sql` finds only `0001_substrate` itself,
-- `0003_class_images` -- which touches `classes`, not `events` -- and `0017_announcements`,
-- which only names `events` in a comment), so `events_new` below carries the table's original
-- column list unchanged and in order, with `series_id` and `season` appended.
--
-- No table anywhere declares `REFERENCES events(id)` (confirmed via the same grep, for
-- `REFERENCES events`), and `events` carries no index of its own, so unlike `0034`'s
-- insert-repoint-delete this recreate has no referential or index fan-out to preserve.
CREATE TABLE event_series (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('annual', 'once')),
  retired_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One series per existing events row, selected FROM events (never a hand-written list), so the
-- rollback and the verify can both find them by the same derived id and a re-read is
-- reproducible. Every existing row starts life as its own annual series; the officer links years
-- by hand where it matters (task 5's "instance of an existing series" control) -- nothing here
-- guesses at a link from a matching title.
INSERT INTO event_series (id, title, recurrence)
SELECT 'series-' || id, title, 'annual'
FROM events;

CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('racing','class','operations','social','governance')),
  short_description TEXT,
  long_description TEXT,
  start_date TEXT, start_time TEXT, end_date TEXT, end_time TEXT,
  location TEXT,
  hero_image TEXT, hero_image_alt TEXT, thumbnail_image TEXT,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  series_id TEXT NOT NULL REFERENCES event_series(id),
  season INTEGER NOT NULL,
  UNIQUE (season, slug)
);

-- season derives from start_date's year when there is one, else from settings.current_season --
-- the same fallback the design doc's "Data model" section states, so an undated legacy row still
-- gets a real season rather than a NULL the NOT NULL column would reject. series_id is the
-- deterministic 'series-' || id pairing every row got its own series above.
INSERT INTO events_new (
  id, title, slug, category, short_description, long_description,
  start_date, start_time, end_date, end_time, location,
  hero_image, hero_image_alt, thumbnail_image,
  visible, created_at, updated_at, series_id, season
)
SELECT
  id, title, slug, category, short_description, long_description,
  start_date, start_time, end_date, end_time, location,
  hero_image, hero_image_alt, thumbnail_image,
  visible, created_at, updated_at,
  'series-' || id,
  COALESCE(
    CAST(substr(start_date, 1, 4) AS INTEGER),
    (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season')
  )
FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.backfill', 'event_series', NULL,
   '0035_event_series: created one event_series row per existing events row, added events.series_id and events.season, moved slug uniqueness from a global UNIQUE to UNIQUE (season, slug)');
