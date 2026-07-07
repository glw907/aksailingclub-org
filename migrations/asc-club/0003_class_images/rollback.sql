-- Undoes 0003_class_images/forward.sql. Safe any time before the backfill (scripts/import/
-- ops-classes-images.mjs) or a later admin edit has written a real value into either column;
-- once real data exists, dropping the columns discards it, the same caveat 0002's own
-- rollback documents for its column.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0003_class_images/rollback.sql
ALTER TABLE classes DROP COLUMN hero_image;
ALTER TABLE classes DROP COLUMN hero_image_alt;
