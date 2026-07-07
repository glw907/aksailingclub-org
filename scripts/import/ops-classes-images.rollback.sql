-- ops-classes-images rollback: undoes ops-classes-images.mjs's backfill in full.
--
-- Scoped to every class row this backfill has ever touched (tracked via audit_log's
-- actor='import:ops-classes-images' rows), the same reasoning ops-classes.rollback.sql
-- documents for its own full-import rollback: this is a natural-key update over a fixed
-- 5-row asc-ops source, so re-running never creates a distinguishable new "batch" to roll
-- back separately from any other run.
--
-- Write-only (an UPDATE plus its own audit row), so run via `--file` per the migration
-- convention:
--   npx wrangler d1 execute asc-club --remote --file scripts/import/ops-classes-images.rollback.sql

UPDATE classes
SET hero_image = NULL, hero_image_alt = NULL, updated_at = datetime('now')
WHERE id IN (
  SELECT DISTINCT entity_id FROM audit_log
  WHERE actor = 'import:ops-classes-images' AND entity = 'class' AND entity_id IS NOT NULL
);

INSERT INTO audit_log (actor, action, entity, entity_id, detail)
VALUES ('import:ops-classes-images', 'import.rollback', 'class', NULL,
        'ops-classes-images.mjs rollback: cleared hero_image/hero_image_alt on every backfilled class row');
