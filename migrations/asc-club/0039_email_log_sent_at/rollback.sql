-- Undoes 0039_email_log_sent_at/forward.sql: drops the one new index. Safe any time: dropping an
-- index never discards data, matching every other index-only rollback in this directory (e.g.
-- 0004_waitlist_integrity/rollback.sql, 0037_asset_request_unique/rollback.sql). Nothing breaks
-- functionally, since no query depends on this index for correctness; the send-log read just
-- sorts without it again.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0039_email_log_sent_at/rollback.sql
DROP INDEX idx_email_log_sent_at;
