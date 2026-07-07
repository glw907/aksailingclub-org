-- asc-club migration 0006: let a claimed offer's own row survive its waitlist entry's deletion.
--
-- A second real-D1 FK finding this pass's own end-to-end write-path proof surfaced (this time
-- from `scripts/verify/real-d1-write-path.mjs`, exercising `claimOffer` end to end, not from the
-- member-domain gap 0005 fixed): `class_offers.waitlist_id REFERENCES class_waitlist(id)`
-- (0001_substrate) carries NO `ON DELETE` clause, SQLite's default `NO ACTION`, which BLOCKS
-- deleting a `class_waitlist` row for as long as any `class_offers` row still references it.
-- `claimOffer` (offers.ts) marks the consumed offer `resolved = 'claimed'` (never deletes it, by
-- design: the offers admin view's own history) and THEN deletes the waitlist row it was offered
-- to. Against real (remote) D1, that delete has ALWAYS failed with a `FOREIGN KEY constraint
-- failed` (confirmed directly this session, reproduced deterministically with a minimal isolated
-- parent/child table, independent of migration 0005 or any replica timing): this FK has been live
-- since 0001_substrate landed `class_waitlist`, so `claimOffer` could never actually complete
-- against real D1, only against the `fakeD1` test double every existing unit test uses (`fakeD1`
-- enforces no FK at all, the same blind spot 0004's own README first named for the member-domain
-- gap).
--
-- The fix is `ON DELETE CASCADE` on `waitlist_id`: when a waitlist row is deleted, its own
-- `class_offers` row(s) go with it, rather than blocking the delete. This does not change any
-- OBSERVABLE behavior: the classes detail screen's own `waitlistView` (`+page.svelte`) already
-- documents that a claimed offer's history chip never renders, because it joins `data.offers` back
-- to `data.waitlist` by id, and a claimed offer's waitlist row is (already, by design) gone. CASCADE
-- only makes the stored data match what the UI has always shown: a claimed offer becomes invisible
-- the moment its waitlist entry is claimed, whether the underlying row lingers forever (the pre-
-- migration, structurally-broken state) or is cleaned up immediately (this migration). A declined
-- or expired offer's waitlist row is NEVER deleted by any code path (only `claimOffer` deletes one),
-- so this CASCADE never fires for those, and their history chips are entirely unaffected.
--
-- SQLite cannot ALTER a column's REFERENCES clause in place; this is the standard recreate-and-
-- copy (the same one `0002_instructor_display_name`'s own README explains 0001 avoided for a
-- different column, by choosing a workaround instead of a recreate; here there is no such
-- workaround, since the constraint clause itself, not just a NOT NULL, is what must change).
CREATE TABLE class_offers_new (
  token TEXT PRIMARY KEY,
  waitlist_id TEXT NOT NULL REFERENCES class_waitlist(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id),
  offered_by TEXT NOT NULL,
  offered_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  resolved TEXT CHECK (resolved IN ('claimed','declined','expired')),
  resolved_at TEXT
);

INSERT INTO class_offers_new (token, waitlist_id, class_id, offered_by, offered_at, expires_at, resolved, resolved_at)
  SELECT token, waitlist_id, class_id, offered_by, offered_at, expires_at, resolved, resolved_at FROM class_offers;

DROP TABLE class_offers;
ALTER TABLE class_offers_new RENAME TO class_offers;
