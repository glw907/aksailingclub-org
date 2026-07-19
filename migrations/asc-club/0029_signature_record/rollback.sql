-- Undoes 0029_signature_record/forward.sql: drops the widened `waiver_acceptances` and recreates
-- the original `0001_substrate` shape verbatim (the two-value `context` CHECK, `waiver_version`
-- NOT NULL, `accepted_at` in place of `signed_at`, none of the new spec columns), copying back
-- only the five legacy columns every pre-migration row actually carried.
--
-- Safe only before any post-migration signature data exists: a row written under the new shape
-- with `context` in ('renewal', 'mooring-fee', 'storage-fee'), or with `waiver_version` left NULL
-- (the new per-document model's own convention, see forward.sql's header), fails this rollback's
-- own copy step against the restored, narrower CHECK/NOT NULL -- exactly like every other
-- recreate-and-copy rollback in this directory (`0006`, `0022`, `0028`), this discards the new
-- columns' data (hash, snapshot, auth event, minors fields), not just structure.
CREATE TABLE waiver_acceptances_old (
  id TEXT PRIMARY KEY,
  person_name TEXT NOT NULL,
  person_email TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('class-signup', 'join')),
  waiver_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO waiver_acceptances_old (id, person_name, person_email, context, waiver_version, accepted_at)
  SELECT id, person_name, person_email, context, waiver_version, signed_at FROM waiver_acceptances;
DROP TABLE waiver_acceptances;
ALTER TABLE waiver_acceptances_old RENAME TO waiver_acceptances;
CREATE INDEX idx_waiver_acceptances_email ON waiver_acceptances(person_email);
