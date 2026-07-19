-- asc-club migration 0029: evolve `waiver_acceptances` into the member-waivers spec's signature
-- record (member-waivers T2, docs/2026-07-17-member-waivers-design.md "The signature record" and
-- "Minors"). `0001_substrate`'s original table carried only the gap-analysis rider's five columns
-- (id, person_name, person_email, context, waiver_version, accepted_at); this migration widens it
-- to the full record the spec requires while keeping every existing row's data.
--
-- SQLite/D1 cannot alter a CHECK constraint, rename a column, or relax NOT NULL in place, so this
-- is the standard recreate-and-copy this repo already uses for the identical situation
-- (`0006_offer_cascade_on_waitlist_delete`, `0022_join_emails`): create the new shape under a
-- `_new` name, copy every existing row across, drop the old table, rename the new one into place.
-- The live `asc-club` carries zero `waiver_acceptances` rows as of this migration (confirmed via
-- `wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) FROM waiver_acceptances"`), so
-- the copy has nothing to reconcile today, but the migration is written to be correct for any row
-- count, not just the current empty case.
--
-- Column-by-column mapping from the old shape (spec "Existing rows migrate forward losslessly"):
--   id             -> id, unchanged
--   person_name    -> person_name, unchanged (already IS the spec's "name as typed")
--   person_email   -> person_email, unchanged
--   context        -> context, unchanged value; the CHECK widens from ('class-signup','join') to
--                     also accept 'renewal', 'mooring-fee', 'storage-fee'
--   waiver_version -> waiver_version, unchanged value, but the column now allows NULL: it was a
--                     single global "which wording did they read" string
--                     (`$theme/waiver-text.ts`'s `WAIVER_TEXT_VERSION`, one constant for the
--                     whole site). The new per-document model (T1, `$theme/documents.ts`) tracks
--                     that per document via `document_id`/`version`/`season` instead, so a
--                     signature written under the new model has no reason to also populate this
--                     legacy string. Old rows keep their value untouched; this column is now a
--                     read-only historical field, never written by new code.
--   accepted_at    -> signed_at, renamed (unchanged value and default): "signed_at" names the
--                     spec's own field precisely (a typed-name signature, not a generic
--                     "acceptance"), and no existing write site names this column explicitly --
--                     both `enrollments.ts`'s `waiverAcceptanceInsert` and
--                     `statements.ts`'s `buildJoinStatements` rely on the column default, so the
--                     rename is invisible to them.
--
-- Every other column below is wholly new, has no legacy counterpart, and is nullable per the
-- task's own instruction ("New columns for data the old rows lack are nullable"):
--   document_id, version, season, kind  -- the signed document's identity, matching
--     `$theme/documents.ts`'s `DocumentFrontmatter.document`/`version`/`season`/`kind` (`kind`'s
--     CHECK mirrors that module's `DocumentKind` union exactly). `document_id` is a business key
--     into the repo's content, not a DB foreign key: documents live as markdown, not a table.
--   content_hash, content_snapshot  -- the SHA-256 hex digest and full text of the exact document
--     body presented at signing (`content_hash`'s CHECK guards the fixed SHA-256-hex length; a
--     bare `length(x) = 64` already passes on NULL under SQLite's standard NULL-in-CHECK
--     semantics, the same convention `0001_substrate`'s `resolved TEXT CHECK (resolved IN (...))`
--     already relies on with no explicit `IS NULL OR` guard).
--   ip_address  -- the signer's IP at signing time.
--   member_id  -- the authenticated signer (FK to `members`, the adult who is signed in).
--   auth_token_id, auth_issued_at, auth_consumed_at  -- the auth event backing the signature (the
--     research finding: IP alone is a weak attribution signal, the magic-link auth event is the
--     strong one). `auth_token_id` is an FK to `member_tokens` (`0009_member_auth`) for a live
--     join; `auth_issued_at`/`auth_consumed_at` snapshot that same token row's own
--     `created_at`/`consumed_at` AT SIGNING TIME, so the signature record stands on its own even
--     if the token row is later pruned -- the same self-contained-record principle the spec states
--     for `content_snapshot` ("independent of the repo").
--   build_hash  -- the frontend build hash at sign time (spec: "so the club can later show which
--     rendering served the text").
--   signer_relationship, minor_member_id  -- the Minors fields: a parent's attested relationship
--     to the child from AS 09.65.292(c)'s enumerated categories (five values, matching
--     `docs/waivers/2027-general-release.md`'s "Who may sign" list exactly), and the minor's own
--     `members` row (the members table already carries `birthdate`, per the spec, so no separate
--     name/DOB columns are needed here).
CREATE TABLE waiver_acceptances_new (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  version INTEGER,
  season INTEGER,
  kind TEXT CHECK (kind IN ('release', 'acknowledgement', 'agreement')),
  content_hash TEXT CHECK (length(content_hash) = 64),
  content_snapshot TEXT,
  person_name TEXT NOT NULL,
  person_email TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('class-signup', 'join', 'renewal', 'mooring-fee', 'storage-fee')),
  waiver_version TEXT,             -- legacy pre-T2 wording version; historical only, never written going forward
  signed_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  member_id TEXT REFERENCES members(id),
  auth_token_id TEXT REFERENCES member_tokens(id),
  auth_issued_at TEXT,
  auth_consumed_at TEXT,
  build_hash TEXT,
  signer_relationship TEXT CHECK (
    signer_relationship IN ('parent', 'legal-guardian', 'agency-representative', 'power-of-attorney', 'qualifying-relative')
  ),
  minor_member_id TEXT REFERENCES members(id)
);
INSERT INTO waiver_acceptances_new (id, person_name, person_email, context, waiver_version, signed_at)
  SELECT id, person_name, person_email, context, waiver_version, accepted_at FROM waiver_acceptances;
DROP TABLE waiver_acceptances;
ALTER TABLE waiver_acceptances_new RENAME TO waiver_acceptances;
CREATE INDEX idx_waiver_acceptances_email ON waiver_acceptances(person_email);
