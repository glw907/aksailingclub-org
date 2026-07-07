-- ops-classes verify: all SELECTs, so run via `--command` (the query path, per Task 1's
-- README note that `--file` silently switches to the bulk-import path for a write-only
-- file and returns no per-statement output).
--
-- Expected, matching the live asc-ops source read 2026-07-07: 5 rows total, all season
-- 2026 (asc-club settings.current_season); track adult-teen=3 (1st/2nd Adult Intro,
-- Fleet Tune-Up Weekend), youth=2 (1st/2nd Youth Intro); the three spot-checked rows
-- match asc-ops's 1st_youth_intro (2026-06-18..2026-06-21), 2nd_adult_teen_intro (the
-- known asc-ops data anomaly: end_date 2016-07-12, imported verbatim, unfixed), and
-- fleet_tuneup (2026-06-12..2026-06-14) exactly.

SELECT 'count' AS check_name, COUNT(*) AS value FROM classes;

SELECT track, COUNT(*) AS n FROM classes GROUP BY track ORDER BY track;

SELECT id, name, slug, track, season, start_date, end_date FROM classes
WHERE id IN ('1st_youth_intro', '2nd_adult_teen_intro', 'fleet_tuneup')
ORDER BY id;
