-- Undoes 0011_member_portal/forward.sql. Safe only before any real asset request or household
-- left_at data exists.
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0011_member_portal/rollback.sql
DROP TABLE IF EXISTS asset_requests;
-- SQLite has no DROP COLUMN prior to 3.35's ALTER TABLE DROP COLUMN (D1 supports it); if the
-- running D1 engine ever lags that support, the column stays (a harmless always-NULL leftover)
-- rather than failing the rollback outright.
ALTER TABLE households DROP COLUMN left_at;
