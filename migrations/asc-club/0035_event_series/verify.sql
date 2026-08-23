-- asc-club migration 0035 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 shows events_count equal to series_count (the one-series-per-row invariant);
-- query 2 returns 0 (no events row's series_id is missing its event_series row); query 3 returns
-- no rows (no (season, slug) pair is duplicated); query 4 returns 0 (every season is a plausible
-- four-digit year); query 5 is a human read of the new events schema (series_id, season, and the
-- table-level UNIQUE (season, slug), with no column-level UNIQUE on slug); query 6 is the undated
-- count, recorded in the README before and after so the migration is shown to have invented no
-- dates.
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
