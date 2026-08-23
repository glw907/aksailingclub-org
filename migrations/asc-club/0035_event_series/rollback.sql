-- Undoes 0035_event_series/forward.sql. Rebuilds `events` in its exact 0001_substrate shape
-- (a global `slug TEXT NOT NULL UNIQUE`, no `season`, no `series_id`), copies every row back,
-- drops `event_series`.
--
-- SAFE ONLY WHILE NO TWO `events` ROWS SHARE A SLUG -- that is, before the first roll-forward
-- (task 2's `rollForwardSeason`) has created a second season's copy of any series. The global
-- `UNIQUE` this rollback restores cannot hold once two rows share a slug across seasons, the
-- same precondition register `0034_asset_type_ids/README.md`'s own rollback section states for
-- its own irreversible-past-a-point step. Run the slug-level check below before rolling back
-- (README's "Rollback" section carries the exact command):
--   SELECT slug, COUNT(*) FROM events GROUP BY slug HAVING COUNT(*) > 1;
-- Any row returned means this rollback will fail on the table recreate below; do not run it.
CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('racing','class','operations','social','governance')),
  short_description TEXT,
  long_description TEXT,
  start_date TEXT, start_time TEXT, end_date TEXT, end_time TEXT,
  location TEXT,
  hero_image TEXT, hero_image_alt TEXT, thumbnail_image TEXT,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO events_new (
  id, title, slug, category, short_description, long_description,
  start_date, start_time, end_date, end_time, location,
  hero_image, hero_image_alt, thumbnail_image,
  visible, created_at, updated_at
)
SELECT
  id, title, slug, category, short_description, long_description,
  start_date, start_time, end_date, end_time, location,
  hero_image, hero_image_alt, thumbnail_image,
  visible, created_at, updated_at
FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;
DROP TABLE event_series;

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.rollback', 'event_series', NULL,
   '0035_event_series rollback: events restored to its 0001_substrate shape (global slug UNIQUE, no series_id, no season columns), event_series dropped');
