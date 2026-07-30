-- asc-club migration 0034: asset_types ids move to the hyphenated vocabulary, capacities get
-- Geoff's confirmed numbers, and the four asset_payments rows the 0008 backfill missed get their
-- method filled in.
--
-- THE RENAME TECHNIQUE. `asset_types.id` is a PRIMARY KEY, and three tables declare
-- `REFERENCES asset_types(id)` with no `ON UPDATE CASCADE` clause: `asset_assignments.asset_type`,
-- `asset_waitlist.asset_type`, `asset_requests.asset_type` (all confirmed by a live schema read,
-- `SELECT name, sql FROM sqlite_master WHERE type='table'`; `asset_payments` references only
-- `asset_assignments(id)`, never an asset type directly). Real remote D1 enforces foreign keys
-- (the same finding 0006_offer_cascade_on_waitlist_delete's own header documents for a DELETE): an
-- UPDATE that changes a referenced primary key value while child rows still hold the old value
-- fails exactly as a DELETE would, per SQLite's own documented FK behavior for parent-key updates
-- with no CASCADE. A direct `UPDATE asset_types SET id = ...` therefore cannot work here.
--
-- The technique that avoids ever disabling FK enforcement: insert the new-id row alongside the
-- old one (both exist briefly, so every child row's foreign key is valid throughout), repoint
-- every child row from the old id to the new id, then delete the now-unreferenced old row. No
-- `PRAGMA foreign_keys` toggle, no recreate-and-copy of any of the three referencing tables.
INSERT INTO asset_types (id, name, fee, capacity, sort_order)
SELECT
  CASE id
    WHEN 'rv_parking' THEN 'rv-parking'
    WHEN 'boat_parking' THEN 'boat-parking'
    WHEN 'small_boat' THEN 'small-boat-rack'
  END,
  name,
  fee,
  -- Geoff's four confirmed capacities (2026-07-30), replacing the imported placeholder numbers
  -- the design spec's ruling 1 names as invented. `mooring` keeps its id and is corrected below.
  CASE id
    WHEN 'rv_parking' THEN 10
    WHEN 'boat_parking' THEN NULL     -- deliberate: "plenty of space to add more," not a gap
    WHEN 'small_boat' THEN 9
  END,
  sort_order
FROM asset_types
WHERE id IN ('rv_parking', 'boat_parking', 'small_boat');

UPDATE asset_assignments SET asset_type = 'rv-parking' WHERE asset_type = 'rv_parking';
UPDATE asset_assignments SET asset_type = 'boat-parking' WHERE asset_type = 'boat_parking';
UPDATE asset_assignments SET asset_type = 'small-boat-rack' WHERE asset_type = 'small_boat';

UPDATE asset_waitlist SET asset_type = 'rv-parking' WHERE asset_type = 'rv_parking';
UPDATE asset_waitlist SET asset_type = 'boat-parking' WHERE asset_type = 'boat_parking';
UPDATE asset_waitlist SET asset_type = 'small-boat-rack' WHERE asset_type = 'small_boat';

UPDATE asset_requests SET asset_type = 'rv-parking' WHERE asset_type = 'rv_parking';
UPDATE asset_requests SET asset_type = 'boat-parking' WHERE asset_type = 'boat_parking';
UPDATE asset_requests SET asset_type = 'small-boat-rack' WHERE asset_type = 'small_boat';

DELETE FROM asset_types WHERE id IN ('rv_parking', 'boat_parking', 'small_boat');

-- mooring's id is already correct; only its capacity moves, from the imported 12 to Geoff's
-- confirmed 10.
UPDATE asset_types SET capacity = 10 WHERE id = 'mooring';

-- Payment-method backfill (the design gate's adjacency rider,
-- scripts/import/ops-assets.mjs:640's insert never populated the column for these rows).
-- Idempotent by construction, same predicate 0008_asset_payment_method's own backfill used: it
-- only ever touches a row still missing method despite carrying a stripe_ref, so re-running this
-- migration or 0008's finds nothing left to do.
UPDATE asset_payments SET method = 'card' WHERE method IS NULL AND stripe_ref IS NOT NULL;

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.backfill', 'asset_types', NULL,
   '0034_asset_type_ids: rv_parking/boat_parking/small_boat renamed to rv-parking/boat-parking/small-boat-rack, capacities corrected to confirmed values, asset_payments.method backfilled for stripe-referenced rows still missing it');
