-- asc-club migration 0034 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 returns no rows (no asset_types id in the old underscore form); query 2 returns
-- no rows (no referencing column still holds an underscore value); query 3 lists the four
-- hyphenated ids with the confirmed capacities (mooring 10, rv-parking 10, boat-parking NULL,
-- small-boat-rack 9); query 4 returns 0 (no asset_payments row still missing method despite a
-- stripe_ref); query 5 is the waiver-requirements derivation's own proxy, reproducing
-- src/member-portal/lib/waiver-requirements.ts's household-level asset-kind match against
-- asset_types.id -- expect 0 (down from the live pre-migration 21).
SELECT id FROM asset_types WHERE id LIKE '%\_%' ESCAPE '\';

SELECT 'asset_assignments' AS tbl, asset_type FROM asset_assignments WHERE asset_type LIKE '%\_%' ESCAPE '\'
UNION ALL
SELECT 'asset_waitlist', asset_type FROM asset_waitlist WHERE asset_type LIKE '%\_%' ESCAPE '\'
UNION ALL
SELECT 'asset_requests', asset_type FROM asset_requests WHERE asset_type LIKE '%\_%' ESCAPE '\';

SELECT id, capacity FROM asset_types ORDER BY sort_order;

SELECT COUNT(*) AS still_missing_method FROM asset_payments WHERE method IS NULL AND stripe_ref IS NOT NULL;

SELECT COUNT(DISTINCT m.household_id) AS mismatched_households
FROM asset_assignments aa
JOIN memberships m ON m.id = aa.membership_id
WHERE aa.status = 'active'
  AND aa.asset_type NOT IN ('mooring', 'rv-parking', 'boat-parking', 'small-boat-rack');
