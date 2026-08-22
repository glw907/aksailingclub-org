-- Verifies 0002_preview right after forward.sql: run via --command (a `--file` run silently
-- drops SELECT output; see migrations/asc-club/0005_member_domain/README.md's own Verify section
-- for why).
--
--   npx wrangler d1 execute cairn-asc-auth --remote --command "$(grep -v '^--' migrations/asc-auth/0002_preview/verify-forward.sql)"
--
-- Expect three rows: the preview_tokens table and its two indexes.
SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'index') AND name IN (
  'preview_tokens',
  'idx_preview_tokens_expires_at',
  'idx_preview_tokens_concept_entry'
)
ORDER BY name;
