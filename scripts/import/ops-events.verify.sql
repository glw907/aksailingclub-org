-- ops-events verify: all SELECTs, so run via `--command` (the query path, per Task 1's
-- README note that `--file` silently switches to the bulk-import path for a write-only
-- file and returns no per-statement output).
--
-- Expected, matching the live asc-ops source read 2026-07-07: 12 rows total; category
-- distribution racing=7, operations=3, social=1, governance=1 (asc-ops's own event_type
-- distribution regatta=7/work_party=3/social=1/meeting=1, relabeled through
-- CATEGORY_BY_EVENT_TYPE in ops-events.mjs); the three spot-checked rows match asc-ops's
-- icebreaker-regatta (racing, 2026-05-24), annual-meeting (governance, 2026-11-14), and
-- fireweed-ladies-race (racing, 2026-08-08) exactly.

SELECT 'count' AS check_name, COUNT(*) AS value FROM events;

SELECT category, COUNT(*) AS n FROM events GROUP BY category ORDER BY category;

SELECT id, title, slug, category, start_date, visible FROM events
WHERE slug IN ('icebreaker-regatta', 'annual-meeting', 'fireweed-ladies-race')
ORDER BY slug;
