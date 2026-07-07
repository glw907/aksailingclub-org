-- Run via --command (per the migration mechanics note: --file silently drops SELECT output for a
-- verify script):
--   npx wrangler d1 execute asc-club --remote --command "$(cat migrations/asc-club/0005_member_domain/verify.sql)"
--
-- Expect five rows naming the new tables.
SELECT name FROM sqlite_master WHERE type = 'table'
  AND name IN ('households', 'members', 'memberships', 'credit_grants', 'credit_redemptions');
