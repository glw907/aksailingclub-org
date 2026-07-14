-- Verifies 0021_money_ledger: both tables exist with their full column set, all eight new
-- indexes (four on transactions, four on transaction_lines) are present, and both tables are
-- empty on a fresh apply.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0021_money_ledger/verify.sql
--
-- Expected: has_transactions = 1; transactions_columns = 16; has_transaction_lines = 1;
-- transaction_lines_columns = 8; transactions_indexes = 4; transaction_lines_indexes = 4;
-- transactions_rows = 0; transaction_lines_rows = 0.
SELECT COUNT(*) AS has_transactions FROM sqlite_master WHERE type = 'table' AND name = 'transactions';
SELECT COUNT(*) AS transactions_columns FROM pragma_table_info('transactions');
SELECT COUNT(*) AS has_transaction_lines FROM sqlite_master WHERE type = 'table' AND name = 'transaction_lines';
SELECT COUNT(*) AS transaction_lines_columns FROM pragma_table_info('transaction_lines');
SELECT COUNT(*) AS transactions_indexes FROM sqlite_master
  WHERE type = 'index' AND tbl_name = 'transactions'
    AND name IN ('idx_transactions_household', 'idx_transactions_occurred',
                 'idx_transactions_processor_ref', 'idx_transactions_mw_ref');
SELECT COUNT(*) AS transaction_lines_indexes FROM sqlite_master
  WHERE type = 'index' AND tbl_name = 'transaction_lines'
    AND name IN ('idx_transaction_lines_transaction', 'idx_transaction_lines_membership',
                 'idx_transaction_lines_enrollment', 'idx_transaction_lines_assignment');
SELECT COUNT(*) AS transactions_rows FROM transactions;
SELECT COUNT(*) AS transaction_lines_rows FROM transaction_lines;
