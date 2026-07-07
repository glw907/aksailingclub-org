-- Run via --command (0005's own README names the reason: --file silently drops SELECT output for
-- a verify script):
--   npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0011_member_portal/verify.sql | grep -v '^\s*$')"
--
-- Expect one row naming the new table, two rows naming its indexes, and one row confirming
-- households.left_at exists (a non-empty pragma read).
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'asset_requests';

SELECT name FROM sqlite_master WHERE type = 'index'
  AND name IN ('idx_asset_requests_household', 'idx_asset_requests_status')
  ORDER BY name;

SELECT name FROM pragma_table_info('households') WHERE name = 'left_at';
