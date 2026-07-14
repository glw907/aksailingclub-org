-- mw-ledger verify: all SELECTs, so run via `--command` (per the migration mechanics convention:
-- `--file` silently switches to the bulk-import path for a write-only file and returns no
-- per-statement output). Structural only -- no name or email is named here, per this repo's own
-- import-verify convention (mw-members.verify.sql's own header explains why).
--
--   VERIFY_SQL=$(grep -v '^--' scripts/import/mw-ledger.verify.sql | grep -v '^\s*$')
--   npx wrangler d1 execute asc-club --remote --command "$VERIFY_SQL"
--
-- Expected end state, per the spec's own category counts (docs/2026-07-13-money-ledger-design.md,
-- "Backfill"): 401 imported rows total, kind='charge' the overwhelming majority (239 Membership +
-- 157 Event + 5 Donation transaction-type rows, less the 9 that net negative and the 14 voided),
-- kind='refund' = 9, kind='void' = 14; source='comp' = 75. The exact per-kind/source split is the
-- run's own console report (`formatReport`), not asserted as a literal number here -- refund
-- netting and comp detection both depend on the live data's own shape.

SELECT 'transactions_total' AS check_name, COUNT(*) AS value FROM transactions WHERE mw_ref IS NOT NULL
UNION ALL
SELECT 'transaction_lines_total', COUNT(*) FROM transaction_lines tl JOIN transactions t ON t.id = tl.transaction_id WHERE t.mw_ref IS NOT NULL;

-- Per-kind, per-source counts (the category breakdown the spec's Backfill section names).
SELECT kind, source, COUNT(*) AS n FROM transactions WHERE mw_ref IS NOT NULL GROUP BY kind, source ORDER BY kind, source;

-- Invariant 1: every imported transaction's lines sum to its own amount_total_cents. Zero rows
-- expected; any row here is a defect (a comp whose list price didn't net to zero, a malformed
-- sub-total split).
SELECT t.id, t.mw_ref, t.amount_total_cents, COALESCE(SUM(tl.amount_cents), 0) AS line_sum
FROM transactions t
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
WHERE t.mw_ref IS NOT NULL
GROUP BY t.id
HAVING t.amount_total_cents != COALESCE(SUM(tl.amount_cents), 0);

-- Invariant 2: every membership row this import could see already has `paid_at` set (mw-members.mjs
-- retired the paid_at-NULL approximation); a paid membership should carry exactly one dues line.
-- Zero or more than one is worth a human's look (a membership deleted post-import per the
-- accounting-is-canon ruling legitimately has zero -- this reports rather than asserts).
SELECT m.id AS membership_id, m.household_id, m.season, m.price_paid, m.paid_at,
       COUNT(tl.id) AS dues_line_count
FROM memberships m
LEFT JOIN transaction_lines tl ON tl.membership_id = m.id AND tl.item = 'dues'
WHERE m.paid_at IS NOT NULL
GROUP BY m.id
HAVING COUNT(tl.id) != 1;

-- Invariant 3: a membership's own dues line total reconciles to memberships.price_paid (dollars)
-- converted to cents. Zero rows expected among memberships that DO have a linked dues line.
SELECT m.id AS membership_id, m.price_paid * 100 AS price_paid_cents, SUM(tl.amount_cents) AS dues_line_total
FROM memberships m
JOIN transaction_lines tl ON tl.membership_id = m.id AND tl.item = 'dues'
GROUP BY m.id
HAVING m.price_paid * 100 != SUM(tl.amount_cents);

-- A quick re-run signal: a second `--apply` of mw-ledger.mjs against unchanged input should report
-- 0 to insert, all planned rows already-imported by mw_ref -- confirm by re-running the script
-- itself in dry-run mode, not by a query here (mw_ref uniqueness is enforced by the migration's
-- own partial unique index, not re-derivable from a read-only check).
