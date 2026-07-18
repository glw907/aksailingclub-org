-- Undoes 0027_directory_domain/forward.sql: drops the four new tables (children before parents
-- -- `committee_members` before `committees`) and the four new household address columns.
--
-- Safe only before any real boat, committee, committee-membership, or member-position data
-- exists, and before any household address has been captured: this discards rows, not just
-- structure, exactly like every other additive migration's rollback in this directory (see
-- `0023_membership_admin/rollback.sql`'s own header for the same caveat).
DROP TABLE committee_members;
DROP TABLE member_positions;
DROP TABLE committees;
DROP TABLE boats;

ALTER TABLE households DROP COLUMN postal_code;
ALTER TABLE households DROP COLUMN state;
ALTER TABLE households DROP COLUMN address_line2;
ALTER TABLE households DROP COLUMN address_line1;
