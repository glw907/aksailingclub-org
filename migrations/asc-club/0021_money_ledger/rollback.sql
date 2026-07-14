-- Undoes 0021_money_ledger/forward.sql. Dropping both tables discards any ledger rows already
-- written (live Stripe writes, the MW backfill) — the same caveat 0003's, 0018's, 0019's, and
-- 0020's rollbacks document. `transaction_lines` drops first: it holds the FK to
-- `transactions`, and D1's default (foreign_keys off) does not require this order, but a
-- future foreign_keys=ON run would refuse dropping the referenced table first.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0021_money_ledger/rollback.sql
DROP TABLE transaction_lines;
DROP TABLE transactions;
