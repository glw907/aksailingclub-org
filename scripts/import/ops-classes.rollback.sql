-- ops-classes rollback: undoes ops-classes.mjs's import in full.
--
-- This is scoped to every class row the importer has ever touched (tracked via
-- audit_log's actor='import:ops' rows), not to one specific run's batch id. The import
-- is a natural-key upsert over a fixed 5-row asc-ops source, so re-running never creates
-- a distinguishable new "batch" of rows to roll back separately from any other run;
-- "roll back the import" and "roll back the latest run" are the same operation here.
-- Each run's own batch id is still recorded in audit_log.detail for traceability, read
-- there if a specific run's provenance is needed.
--
-- Write-only (a DELETE plus its own audit row), so run via `--file` per Task 1's
-- migration convention:
--   npx wrangler d1 execute asc-club --remote --file scripts/import/ops-classes.rollback.sql

DELETE FROM classes
WHERE id IN (
  SELECT DISTINCT entity_id FROM audit_log
  WHERE actor = 'import:ops' AND entity = 'class' AND entity_id IS NOT NULL
);

INSERT INTO audit_log (actor, action, entity, entity_id, detail)
VALUES ('import:ops', 'import.rollback', 'class', NULL,
        'ops-classes.mjs rollback: removed every imported class row');
