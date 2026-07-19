-- Verifies 0032_signature_uniqueness right after rollback.sql: run via --command.
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0032_signature_uniqueness/verify-rollback.sql)"
--
-- Expect zero rows: both indexes are gone.
SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'waiver_acceptances' AND name LIKE 'uq_%' ORDER BY name;
