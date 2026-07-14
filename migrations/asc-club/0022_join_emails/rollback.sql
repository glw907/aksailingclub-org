-- Undoes 0022_join_emails/forward.sql: narrows `processed_stripe_sessions.kind` back to its
-- 0014 CHECK (dropping any row whose kind is 'donation' or 'join' -- there should be none on a
-- fresh-apply-then-rollback proof, the same caveat 0006's own rollback documents for a real
-- database that has since recorded live rows of the newly-allowed kind) and removes the two
-- seeded templates.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0022_join_emails/rollback.sql
CREATE TABLE processed_stripe_sessions_old (
  session_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('dues', 'class-fee', 'asset-fee')),
  ref_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO processed_stripe_sessions_old (session_id, kind, ref_id, processed_at)
  SELECT session_id, kind, ref_id, processed_at FROM processed_stripe_sessions
  WHERE kind IN ('dues', 'class-fee', 'asset-fee');
DROP TABLE processed_stripe_sessions;
ALTER TABLE processed_stripe_sessions_old RENAME TO processed_stripe_sessions;

DELETE FROM email_templates WHERE id IN ('join_welcome', 'board_join_notice');
