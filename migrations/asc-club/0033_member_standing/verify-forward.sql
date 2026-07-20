-- Verifies 0033_member_standing right after forward.sql: run via --command (a `--file` run
-- silently drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
--   npx wrangler d1 execute asc-club --local --command "$(grep -v '^--' migrations/asc-club/0033_member_standing/verify-forward.sql)"
--
-- First query: two column names (former_at, former_source), confirming the ADD COLUMNs landed.
-- Second query: a Current/Overdue/Former/None breakdown reproducing standing.ts's own
-- classifyHouseholdStanding logic directly in SQL, so a human can spot-check the backfill's
-- counts against known households (e.g. a household documented "Lapsed -- last 2024" should count
-- under 'former').
SELECT name FROM pragma_table_info('households')
  WHERE name IN ('former_at', 'former_source')
  ORDER BY name;

SELECT
  CASE
    WHEN h.former_at IS NOT NULL THEN 'former'
    WHEN g.paid_at IS NULL THEN 'none'
    WHEN datetime(g.paid_at, '+1 year') >= datetime('now') THEN 'current'
    ELSE 'overdue'
  END AS standing,
  COUNT(*) AS household_count
FROM households h
LEFT JOIN (
  SELECT household_id, MAX(paid_at) AS paid_at
  FROM memberships
  WHERE paid_at IS NOT NULL AND refunded_at IS NULL
  GROUP BY household_id
) g ON g.household_id = h.id
GROUP BY standing
ORDER BY standing;
