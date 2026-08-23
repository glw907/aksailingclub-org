-- asc-club migration 0036 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 no rows (no series holds two rows in the same season -- the invariant the new
-- UNIQUE index now enforces at the database layer); query 2 both index names present; queries
-- 3-8 are 0035_event_series/verify.sql's own six checks, re-run unchanged, to prove this
-- migration disturbs none of that migration's own invariants.
SELECT series_id, season, COUNT(*) AS n
FROM events
GROUP BY series_id, season
HAVING COUNT(*) > 1;

SELECT name FROM sqlite_master
WHERE type = 'index' AND name IN ('idx_events_series_season', 'idx_events_slug_season')
ORDER BY name;

SELECT
  (SELECT COUNT(*) FROM events) AS events_count,
  (SELECT COUNT(*) FROM event_series) AS series_count;

SELECT COUNT(*) AS orphan_series_id
FROM events e
LEFT JOIN event_series s ON s.id = e.series_id
WHERE s.id IS NULL;

SELECT season, slug, COUNT(*) AS n
FROM events
GROUP BY season, slug
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS bad_season
FROM events
WHERE season IS NULL OR season NOT BETWEEN 2000 AND 2100;

SELECT sql FROM sqlite_master WHERE name = 'events';

SELECT COUNT(*) AS undated_count FROM events WHERE start_date IS NULL;
