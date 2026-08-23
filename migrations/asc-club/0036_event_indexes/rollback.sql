-- Undoes 0036_event_indexes/forward.sql: drops both indexes. Nothing else in the schema changed,
-- so there is no row data to restore.
DROP INDEX idx_events_series_season;
DROP INDEX idx_events_slug_season;

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.rollback', 'events', NULL,
   '0036_event_indexes rollback: dropped idx_events_series_season and idx_events_slug_season');
