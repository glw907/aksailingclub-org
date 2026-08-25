-- asc-club migration 0037 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 returns exactly one row naming `uq_asset_requests_pending_household_type` with
-- the partial `WHERE status = 'pending'` clause in its `sql` text; query 2 returns no rows (no
-- household/asset-type pair holds more than one `pending` row -- the exact condition the index
-- itself now makes impossible to reach, so this is a structural sanity check, not a live proof of
-- enforcement, which the scratch-proof transcript in README.md's own "Scratch-proof procedure"
-- section covers instead).
SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'uq_asset_requests_pending_household_type';

SELECT household_id, asset_type, COUNT(*) AS pending_count
FROM asset_requests
WHERE status = 'pending'
GROUP BY household_id, asset_type
HAVING COUNT(*) > 1;
