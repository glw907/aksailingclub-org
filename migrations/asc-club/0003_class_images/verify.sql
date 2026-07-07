-- Run via --command (per the migration mechanics note: --file silently drops SELECT output
-- for a verify script):
--   npx wrangler d1 execute asc-club --remote --command "$(cat migrations/asc-club/0003_class_images/verify.sql)"
--
-- Expect two rows naming the new columns (both type TEXT, nullable).
SELECT name, type, "notnull" FROM pragma_table_info('classes') WHERE name IN ('hero_image', 'hero_image_alt');
