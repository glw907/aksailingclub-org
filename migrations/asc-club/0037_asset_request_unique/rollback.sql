-- Undoes 0037_asset_request_unique/forward.sql: drops the one new index. Safe any time: dropping
-- an index never discards data, matching every other index-only rollback in this directory (e.g.
-- 0004_waitlist_integrity/rollback.sql, 0032_signature_uniqueness/rollback.sql).
DROP INDEX uq_asset_requests_pending_household_type;
