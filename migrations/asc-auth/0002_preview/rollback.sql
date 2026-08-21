-- Undoes 0002_preview/forward.sql: drops the preview_tokens table and its two indexes. Safe any
-- time before a real preview link is minted against it; once a link is live, rolling back drops
-- every outstanding token along with the table (previewLoad and mintPreviewToken both fail closed
-- with no table to read or write, matching the 503 previewLoad already returns for a missing
-- AUTH_DB binding).
--
-- SQLite drops an index automatically when its own table is dropped, but both are named
-- explicitly here for the same reason forward.sql names them explicitly: this file is the one
-- place a reader checks "does this migration leave anything behind."
DROP INDEX IF EXISTS idx_preview_tokens_concept_entry;
DROP INDEX IF EXISTS idx_preview_tokens_expires_at;
DROP TABLE IF EXISTS preview_tokens;
