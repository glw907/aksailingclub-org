-- Run via --command (strip this file's own leading comment lines first: a --command value that
-- itself starts with `--` makes wrangler's flag parser mistake the SQL for a bare flag terminator,
-- see 0005_member_domain/README.md's own Verify section):
--   npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0006_offer_cascade_on_waitlist_delete/verify.sql)"
--
-- Expect one row: waitlist_id = "waitlist_id", on_delete = "CASCADE".
SELECT "from" AS waitlist_id, on_delete FROM pragma_foreign_key_list('class_offers') WHERE "table" = 'class_waitlist';
