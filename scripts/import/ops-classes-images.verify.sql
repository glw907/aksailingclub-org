-- Run via --command (--file silently drops SELECT output for a verify script):
--   npx wrangler d1 execute asc-club --remote --command "$(cat scripts/import/ops-classes-images.verify.sql)"
--
-- Expected, matching the live asc-ops source: 5 rows total, 4 carrying a real hero_image (the
-- fifth, fleet_tuneup, is NULL in asc-ops itself, an already-documented gap, not a backfill
-- failure -- see docs/events-manifest.md's "Per-event images" section).

SELECT 'with_image' AS check_name, COUNT(*) AS value FROM classes WHERE hero_image IS NOT NULL
UNION ALL
SELECT 'total', COUNT(*) FROM classes;

SELECT id, hero_image, hero_image_alt FROM classes ORDER BY id;
