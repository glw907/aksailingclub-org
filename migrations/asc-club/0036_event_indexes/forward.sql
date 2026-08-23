-- asc-club migration 0036: events-admin reviewer fan-out fixes (docs/plans/
-- 2026-08-22-events-admin.md's fix round). Two indexes the store and the public queries already
-- rely on but never had: a UNIQUE index that enforces "at most one events row per series per
-- season" at the database layer (today that invariant lives only in application code --
-- linkEventToSeries's own conflict SELECT, rollForwardSeason's NOT EXISTS guard), and a covering
-- index for the slug lookup task 3's `EVENT_BY_SLUG_QUERY ... ORDER BY season DESC LIMIT 1`
-- already performs.
--
-- WHY NO RECREATE, AND NO CHECK CONSTRAINT. The security review that produced this migration
-- also asked for a date-shape backstop (start_date/end_date/start_time/end_time as real
-- YYYY-MM-DD / HH:MM strings, not arbitrary text). Adding a CHECK to an existing column needs
-- the same recreate-and-copy technique 0035 used (SQLite cannot ALTER TABLE ADD CONSTRAINT), and
-- this migration deliberately avoids that: a bare CREATE INDEX needs no table copy at all, so
-- "prefer no recreate" wins here. The date-shape rule is enforced in code instead --
-- `parseEventForm` (event-form-input.ts) validates `startDate`/`endDate` against the
-- `YYYY-MM-DD` pattern and `startTime`/`endTime` against `HH:MM` before either ever reaches a
-- write. See this migration's own README, "Why no CHECK constraint," for the full reasoning.
CREATE UNIQUE INDEX idx_events_series_season ON events(series_id, season);
CREATE INDEX idx_events_slug_season ON events(slug, season DESC);

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.backfill', 'events', NULL,
   '0036_event_indexes: added UNIQUE INDEX idx_events_series_season(series_id, season) and INDEX idx_events_slug_season(slug, season DESC); the date-shape backstop is enforced in application code (parseEventForm) to avoid a table recreate -- see README');
