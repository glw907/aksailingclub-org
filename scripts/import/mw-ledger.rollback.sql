-- mw-ledger rollback: undoes every row mw-ledger.mjs has ever created.
--
-- Unlike mw-members.mjs, this import writes no audit_log rows of its own (the `transactions`
-- table's own `mw_ref IS NOT NULL` marker is the complete provenance signal -- an imported row
-- IS a `transactions` row with a non-null `mw_ref`, nothing else touches that column). Rollback
-- is therefore a plain delete scoped to that marker, lines before their header per the schema's
-- own foreign key (transaction_lines.transaction_id -> transactions.id).
--
-- This import creates rows only -- no import.update, no import.delete on a pre-existing row (the
-- reconcilers' own live writes carry no mw_ref and are never touched here) -- so this rollback,
-- unlike mw-members.rollback.sql, has no update-reversal caveat: it fully undoes exactly what
-- this script ever wrote.
--
-- Write-only, so run via `--file` per this repo's own migration convention:
--   npx wrangler d1 execute asc-club --remote --file scripts/import/mw-ledger.rollback.sql

DELETE FROM transaction_lines
WHERE transaction_id IN (SELECT id FROM transactions WHERE mw_ref IS NOT NULL);

DELETE FROM transactions
WHERE mw_ref IS NOT NULL;
