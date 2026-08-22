-- Verifies 0002_preview right after rollback.sql: run via --command.
--
--   npx wrangler d1 execute cairn-asc-auth --local --command "$(grep -v '^--' migrations/asc-auth/0002_preview/verify-rollback.sql)"
--
-- The example command targets --local, not --remote: rollback.sql has never run against the
-- live database (README.md's own "Applied to the real database" section), so this pairing is
-- exercised only in the scratch-proof cycle, which is local by construction.
--
-- Expect zero rows: the preview_tokens table and both indexes are gone.
SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'index') AND name IN (
  'preview_tokens',
  'idx_preview_tokens_expires_at',
  'idx_preview_tokens_concept_entry'
)
ORDER BY name;
