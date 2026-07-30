-- Undoes 0034_asset_type_ids/forward.sql. Same insert-repoint-delete technique in reverse, for
-- the same FK reason forward.sql's own header explains: an UPDATE that changes a referenced
-- primary key value while child rows still hold the old value fails against real remote D1.
--
-- SAFE ONLY BEFORE any post-migration write depends on the hyphenated ids -- a new
-- asset_assignments/asset_waitlist/asset_requests row created after forward.sql ran, using
-- 'rv-parking'/'boat-parking'/'small-boat-rack', is repointed back to the underscore form by the
-- same blanket UPDATEs below, same as forward.sql's own repoint step, so this rollback discards
-- no rows -- but a caller who has started depending on the hyphenated vocabulary elsewhere (a
-- signing list, a report) sees that dependency break the moment the ids move back.
INSERT INTO asset_types (id, name, fee, capacity, sort_order)
SELECT
  CASE id
    WHEN 'rv-parking' THEN 'rv_parking'
    WHEN 'boat-parking' THEN 'boat_parking'
    WHEN 'small-boat-rack' THEN 'small_boat'
  END,
  name,
  fee,
  -- The prior imported capacity values forward.sql replaced (rv_parking 5, boat_parking NULL was
  -- never true pre-migration -- boat_parking's own prior value was 15; small_boat was NULL both
  -- before and after).
  CASE id
    WHEN 'rv-parking' THEN 5
    WHEN 'boat-parking' THEN 15
    WHEN 'small-boat-rack' THEN NULL
  END,
  sort_order
FROM asset_types
WHERE id IN ('rv-parking', 'boat-parking', 'small-boat-rack');

UPDATE asset_assignments SET asset_type = 'rv_parking' WHERE asset_type = 'rv-parking';
UPDATE asset_assignments SET asset_type = 'boat_parking' WHERE asset_type = 'boat-parking';
UPDATE asset_assignments SET asset_type = 'small_boat' WHERE asset_type = 'small-boat-rack';

UPDATE asset_waitlist SET asset_type = 'rv_parking' WHERE asset_type = 'rv-parking';
UPDATE asset_waitlist SET asset_type = 'boat_parking' WHERE asset_type = 'boat-parking';
UPDATE asset_waitlist SET asset_type = 'small_boat' WHERE asset_type = 'small-boat-rack';

UPDATE asset_requests SET asset_type = 'rv_parking' WHERE asset_type = 'rv-parking';
UPDATE asset_requests SET asset_type = 'boat_parking' WHERE asset_type = 'boat-parking';
UPDATE asset_requests SET asset_type = 'small_boat' WHERE asset_type = 'small-boat-rack';

DELETE FROM asset_types WHERE id IN ('rv-parking', 'boat-parking', 'small-boat-rack');

UPDATE asset_types SET capacity = 12 WHERE id = 'mooring';

-- Reverts exactly the four rows this migration's own forward.sql backfilled, identified by their
-- live ids at authoring time (2026-07-30) rather than by the method/stripe_ref predicate forward
-- used: that predicate is not safely reversible, because 0008_asset_payment_method's own earlier
-- backfill already carries `method = 'card'` on every pre-existing row with a stripe_ref, and a
-- blanket `method IS NULL` cannot tell those apart from the four this migration touched. A row
-- outside this literal set was already 'card' before 0034 ran and stays 'card' on rollback.
UPDATE asset_payments SET method = NULL
  WHERE id IN ('ops-payment-100', 'ops-payment-105', 'ops-payment-106', 'ops-payment-107')
    AND method = 'card';

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.rollback', 'asset_types', NULL,
   '0034_asset_type_ids rollback: ids restored to underscore form, capacities restored to prior imported values, the four payment-method backfills reverted to NULL');
