-- asc-club migration 0003: class images (a rider closing a regression Task 9 surfaced).
--
-- The ratified `classes` table (0001_substrate) carries no hero_image/hero_image_alt columns,
-- unlike `events`, which has always had them. Task 9 repointed the public events/season read
-- from asc-ops (EVENTS_DB) to asc-club (CLUB_DB), and $theme/events-data.ts's CLASSES_QUERY had
-- to select a literal `NULL` for both fields as a result: the five imported classes' cards lost
-- the photography the live site's own layout carries (Geoff's ruling: the events page preserves
-- live's shape INCLUDING per-event photography). This rider adds the missing pair of nullable
-- columns, matching `events`'s own shape exactly, so the query can select real data instead of a
-- literal `NULL` once the follow-up backfill (scripts/import/ops-classes-images.mjs) populates
-- them from asc-ops.
ALTER TABLE classes ADD COLUMN hero_image TEXT;
ALTER TABLE classes ADD COLUMN hero_image_alt TEXT;
