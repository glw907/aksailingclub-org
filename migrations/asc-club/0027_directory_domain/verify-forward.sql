-- Verifies 0027_directory_domain right after forward.sql: run via --command (a `--file` run
-- silently drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0027_directory_domain/verify-forward.sql)"
--
-- Expect four rows naming the new tables (boats, committee_members, committees,
-- member_positions), then four rows naming the new household columns (address_line1,
-- address_line2, postal_code, state).
SELECT name FROM sqlite_master WHERE type = 'table'
  AND name IN ('boats', 'committees', 'committee_members', 'member_positions')
  ORDER BY name;

SELECT name FROM pragma_table_info('households')
  WHERE name IN ('address_line1', 'address_line2', 'state', 'postal_code')
  ORDER BY name;
