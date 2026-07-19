-- Verifies 0032_signature_uniqueness right after forward.sql: run via --command (a `--file` run
-- silently drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0032_signature_uniqueness/verify-forward.sql)"
--
-- Expect two rows naming the new indexes: uq_waiver_acceptances_minor, uq_waiver_acceptances_personal
-- (sqlite_master's own alphabetical-ish listing order, not the CREATE order).
SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'waiver_acceptances' AND name LIKE 'uq_%' ORDER BY name;
