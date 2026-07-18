-- Verifies 0027_directory_domain after rollback.sql: run via --command, same recipe as
-- verify-forward.sql.
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0027_directory_domain/verify-rollback.sql)"
--
-- Expect no rows from either query: the four tables and the four household columns are gone.
SELECT name FROM sqlite_master WHERE type = 'table'
  AND name IN ('boats', 'committees', 'committee_members', 'member_positions')
  ORDER BY name;

SELECT name FROM pragma_table_info('households')
  WHERE name IN ('address_line1', 'address_line2', 'state', 'postal_code')
  ORDER BY name;
