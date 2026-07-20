-- Verifies 0033_member_standing after rollback.sql: run via --command, same recipe as
-- verify-forward.sql.
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0033_member_standing/verify-rollback.sql)"
--
-- Expect no rows: both columns are gone.
SELECT name FROM pragma_table_info('households')
  WHERE name IN ('former_at', 'former_source')
  ORDER BY name;
