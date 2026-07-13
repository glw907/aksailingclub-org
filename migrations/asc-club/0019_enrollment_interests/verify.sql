-- Verifies 0019_enrollment_interests: the column exists and every existing row reads NULL.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0019_enrollment_interests/verify.sql
--
-- Expected: has_column = 1; answered = 0 on a fresh application.
SELECT COUNT(*) AS has_column FROM pragma_table_info('class_enrollments') WHERE name = 'interests';
SELECT COUNT(*) AS answered FROM class_enrollments WHERE interests IS NOT NULL;
