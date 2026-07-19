-- Verifies 0029_signature_record after rollback.sql: run via --command, same recipe as
-- verify-forward.sql.
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0029_signature_record/verify-rollback.sql)"
--
-- Expect: rows for the five original columns only (accepted_at present, signed_at absent, none
-- of the new spec columns present), waiver_version back to notnull = 1; then
-- context_widened = 0 (the CHECK narrowed back to just 'class-signup'/'join'); then the
-- surviving row count.
SELECT name, "notnull" FROM pragma_table_info('waiver_acceptances')
  WHERE name IN (
    'id', 'document_id', 'accepted_at', 'signed_at', 'person_name', 'person_email', 'context',
    'waiver_version', 'content_hash'
  )
  ORDER BY name;

SELECT sql LIKE '%renewal%' AS context_widened FROM sqlite_master WHERE name = 'waiver_acceptances';

SELECT COUNT(*) AS row_count FROM waiver_acceptances;
