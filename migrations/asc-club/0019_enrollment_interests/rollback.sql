-- Undoes 0019_enrollment_interests/forward.sql. Dropping the column discards any answers
-- members have already typed (the same caveat 0003's and 0018's rollbacks document).
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0019_enrollment_interests/rollback.sql
ALTER TABLE class_enrollments DROP COLUMN interests;
