-- Undoes 0033_member_standing/forward.sql: drops the two new household columns (reverse of the
-- ADD order, matching 0027_directory_domain's own rollback convention). Safe only before any real
-- Former transition (sequence or manual) has been recorded and relied on elsewhere -- a rollback
-- after that point discards that history, not just structure, the same caveat 0027's own rollback
-- carries for its additive household columns. The backfill UPDATE itself needs no separate undo:
-- it only ever wrote into the two columns this drops.
ALTER TABLE households DROP COLUMN former_source;
ALTER TABLE households DROP COLUMN former_at;
