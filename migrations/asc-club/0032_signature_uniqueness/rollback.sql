-- Undoes 0032_signature_uniqueness/forward.sql: drops the two new indexes. Safe any time (dropping
-- an index never discards data, matching every other index-only rollback in this directory, e.g.
-- 0004_waitlist_integrity/rollback.sql).
DROP INDEX uq_waiver_acceptances_personal;
DROP INDEX uq_waiver_acceptances_minor;
