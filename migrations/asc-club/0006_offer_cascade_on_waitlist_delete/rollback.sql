-- Undoes 0006_offer_cascade_on_waitlist_delete/forward.sql: recreates `class_offers` with its
-- original `NO ACTION` (no `ON DELETE` clause) FK, the pre-migration, structurally-broken shape
-- (see `forward.sql`'s own header). Safe only before `claimOffer` has actually run against real
-- data (any real usage after this rollback reopens the `FOREIGN KEY constraint failed` failure on
-- every claim): a fresh row-for-row copy, same recreate-and-copy method as `forward.sql`.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0006_offer_cascade_on_waitlist_delete/rollback.sql
CREATE TABLE class_offers_old (
  token TEXT PRIMARY KEY,
  waitlist_id TEXT NOT NULL REFERENCES class_waitlist(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  offered_by TEXT NOT NULL,
  offered_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  resolved TEXT CHECK (resolved IN ('claimed','declined','expired')),
  resolved_at TEXT
);

INSERT INTO class_offers_old (token, waitlist_id, class_id, offered_by, offered_at, expires_at, resolved, resolved_at)
  SELECT token, waitlist_id, class_id, offered_by, offered_at, expires_at, resolved, resolved_at FROM class_offers;

DROP TABLE class_offers;
ALTER TABLE class_offers_old RENAME TO class_offers;
