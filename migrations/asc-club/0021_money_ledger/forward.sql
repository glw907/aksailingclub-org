-- asc-club migration 0021: the transactions/transaction_lines money ledger.
--
-- The 2026-07-13 QBO ruling (docs/2026-07-13-money-ledger-design.md): every money event the
-- club has ever had, charge/refund/void/comp/donation, gets one canonical header-plus-lines
-- home. A flat table cannot represent it: MW membership charges bundle asset add-ons into a
-- single charge, and 75 comped seats are discount-coded, so a real transaction needs its own
-- line-item breakdown, the same shape QuickBooks Online's SalesReceipt/Refund entities use.
--
-- All amounts are integer cents (Stripe is cents-native; processor fees are fractional
-- dollars). Existing dollar-denominated columns (asset_payments.amount, memberships.pricePaid)
-- are untouched; conversion happens at the write sites, a later task's own work.
--
-- `transactions.refunds_transaction_id` is a self-FK, declared before any row exists so no
-- ordering trick is needed. `transaction_lines`'s three domain FKs (memberships,
-- class_enrollments, asset_assignments) all target tables 0001_substrate/0005_member_domain/
-- 0007_assets_email already landed, so every REFERENCES target exists at write time per the
-- FK-enforcement lesson 0004_waitlist_integrity/0005_member_domain both document.
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('charge','refund','void')),
  source TEXT NOT NULL CHECK (source IN ('stripe','paypal','check','cash','comp','other')),
  occurred_at TEXT NOT NULL,        -- when the money moved (or would have, for voids)
  amount_total_cents INTEGER NOT NULL CHECK (amount_total_cents >= 0),  -- kind carries direction
  fee_cents INTEGER,                -- processor fee when known; null until the QBO pass needs
                                     -- Stripe balance-transaction lookups
  processor_ref TEXT,               -- Stripe session/charge id or PayPal ref; not unique (a
                                     -- refund may share its charge's ref)
  refunds_transaction_id TEXT REFERENCES transactions(id),  -- self-FK to the refunded charge,
                                     -- when identifiable
  household_id TEXT REFERENCES households(id),  -- null for non-member donors
  payer_name TEXT,                  -- snapshot, for payers with no member row
  payer_email TEXT,                 -- snapshot
  memo TEXT,                        -- free text (import notes, admin notes)
  qbo_ref TEXT,                     -- born null; the qbo-integration initiative populates
  qbo_synced_at TEXT,                -- born null
  mw_ref TEXT,                      -- stable id derived from the MW accounting export row;
                                     -- presence marks an imported row, the backfill's
                                     -- idempotency key
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_transactions_occurred ON transactions(occurred_at);
CREATE INDEX idx_transactions_processor_ref ON transactions(processor_ref);
CREATE UNIQUE INDEX idx_transactions_mw_ref ON transactions(mw_ref) WHERE mw_ref IS NOT NULL;

-- The breakdown. A line references at most one domain row (enforced at the ledger.ts write
-- seam, not by a CHECK here: SQLite has no clean "at most one of three columns" constraint
-- expression across nullable FKs). amount_cents is signed within the transaction: discounts
-- negative, everything else positive; SUM(lines.amount_cents) = transactions.amount_total_cents
-- is a per-transaction invariant enforced by tests and verify.sql, not a trigger.
CREATE TABLE transaction_lines (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  item TEXT NOT NULL CHECK (item IN ('dues','class-fee','asset-fee','donation','discount','other')),
  description TEXT NOT NULL,        -- display text ("2026 Family Membership", "Intro to
                                     -- Sailing seat")
  amount_cents INTEGER NOT NULL,
  membership_id TEXT REFERENCES memberships(id),
  enrollment_id TEXT REFERENCES class_enrollments(id),
  assignment_id TEXT REFERENCES asset_assignments(id)
);
CREATE INDEX idx_transaction_lines_transaction ON transaction_lines(transaction_id);
CREATE INDEX idx_transaction_lines_membership ON transaction_lines(membership_id);
CREATE INDEX idx_transaction_lines_enrollment ON transaction_lines(enrollment_id);
CREATE INDEX idx_transaction_lines_assignment ON transaction_lines(assignment_id);
