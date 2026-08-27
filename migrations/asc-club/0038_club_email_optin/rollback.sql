-- Undoes 0038_club_email_optin/forward.sql: drops the one added column. Dropping it discards
-- every opt-in a member or an admin has recorded (the same caveat 0020's and 0023's own
-- rollbacks document for their own added columns); there is no archive to re-import from, since
-- the flag is a member's own stated preference and exists nowhere else. Safe only before any
-- real opt-in has been set.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0038_club_email_optin/rollback.sql
ALTER TABLE members DROP COLUMN club_email_opt_in;
