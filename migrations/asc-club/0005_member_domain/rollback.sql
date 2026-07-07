-- Undoes 0005_member_domain/forward.sql. Drops in reverse dependency order (a table's own
-- referencing tables first) so no DROP ever leaves a dangling structural reference mid-rollback,
-- even though SQLite does not enforce that on DROP TABLE itself.
--
-- Safe only before any real member/household/membership/credit data exists, since this discards
-- rows, not just structure: once `ensureMember` (Part 2) or a real membership purchase has
-- written rows, a rollback also reopens the `no such table: main.members` failure
-- `0004_waitlist_integrity/README.md` and this migration's own `forward.sql` document, for every
-- write into `class_waitlist`/`class_enrollments`/`class_instructors`.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0005_member_domain/rollback.sql
DROP TABLE credit_redemptions;
DROP TABLE credit_grants;
DROP TABLE memberships;
DROP TABLE members;
DROP TABLE households;
