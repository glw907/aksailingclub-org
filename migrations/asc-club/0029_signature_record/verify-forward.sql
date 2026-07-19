-- Verifies 0029_signature_record right after forward.sql: run via --command (a --file run
-- silently drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
--   npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0029_signature_record/verify-forward.sql)"
--
-- Expect: one row per listed column below (20 rows, name-sorted) with its notnull flag -- only
-- id, person_name, person_email, context, and signed_at should read notnull = 1, every other
-- listed column notnull = 0; then one row with context_widened = 1 (the CHECK now mentions
-- 'renewal'); then the surviving row count (0 against the live database at migration time, per
-- forward.sql's own header -- any other count here just proves no row was lost in the recreate).
SELECT name, "notnull" FROM pragma_table_info('waiver_acceptances')
  WHERE name IN (
    'id', 'document_id', 'version', 'season', 'kind', 'content_hash', 'content_snapshot',
    'person_name', 'person_email', 'context', 'waiver_version', 'signed_at', 'ip_address',
    'member_id', 'auth_token_id', 'auth_issued_at', 'auth_consumed_at', 'build_hash',
    'signer_relationship', 'minor_member_id'
  )
  ORDER BY name;

SELECT sql LIKE '%renewal%' AS context_widened FROM sqlite_master WHERE name = 'waiver_acceptances';

SELECT COUNT(*) AS row_count FROM waiver_acceptances;
