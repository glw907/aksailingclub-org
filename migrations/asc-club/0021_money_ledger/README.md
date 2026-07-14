# 0021_money_ledger

Creates `transactions` and `transaction_lines`: the canonical, header-plus-lines home for every
money event the club has ever had (charge, refund, void, comp, donation), per the 2026-07-13
QBO ruling (`docs/2026-07-13-money-ledger-design.md`). A flat table cannot represent the club's
real history — MW membership charges bundle asset add-ons into a single charge, and 75 comped
seats are discount-coded — the same header-plus-lines shape QuickBooks Online's own
SalesReceipt/Refund entities use.

`transactions` carries one row per money event: `kind` (`charge`/`refund`/`void`), `source`
(`stripe`/`paypal`/`check`/`cash`/`comp`/`other`), `occurred_at`, `amount_total_cents` (always
`>= 0`; `kind` carries direction), the optional `fee_cents`/`processor_ref`, a self-FK
`refunds_transaction_id` to the refunded charge when identifiable, an optional `household_id`
(null for non-member donors) plus `payer_name`/`payer_email` snapshots, `memo`, the
born-null `qbo_ref`/`qbo_synced_at` the later `qbo-integration` initiative populates, and
`mw_ref`, the MW backfill's idempotency key (a partial unique index, `WHERE mw_ref IS NOT
NULL`, so it never blocks the many non-imported rows).

`transaction_lines` carries the breakdown: `item` (`dues`/`class-fee`/`asset-fee`/`donation`/
`discount`/`other`), `description`, a signed `amount_cents` (discounts negative, everything
else positive), and three nullable domain FKs (`membership_id`, `enrollment_id`,
`assignment_id`) — a line references at most one, enforced at the `ledger.ts` write seam (a
later task), not by a CHECK here: SQLite has no clean "at most one of three nullable columns"
constraint expression. The lines-sum-to-total invariant
(`SUM(lines.amount_cents) = transactions.amount_total_cents` per transaction, voids included)
is likewise enforced by tests and `verify.sql`, not a trigger.

All amounts are integer cents. Existing dollar-denominated columns
(`asset_payments.amount`, `memberships.price_paid`) are untouched; conversion happens at the
write sites, a later task's own work. No seed rows.

## Scratch-proof procedure (conductor-performed, not part of this task)

Per the repo's standing migration discipline, 0021 is proved against a disposable database
before it ever touches the real `asc-club`:

1. `npx wrangler d1 create asc-club-scratch-0021`.
2. Apply migrations 0001 through 0020 in order to reach the current live schema (`households`,
   `memberships`, `class_enrollments`, and `asset_assignments` — every table 0021's FKs
   reference — first exist at 0005/0001/0007 respectively).
3. **Forward**: apply `forward.sql`; confirm no error (D1 refuses an insert against a
   `REFERENCES` target table that does not exist at write time, per the
   `0004_waitlist_integrity`/`0005_member_domain` lesson, so a clean apply here also confirms
   every domain FK's target already exists on the real schema history).
4. **Verify**: run `verify.sql`; expect the column/index counts and zero rows this file's own
   header documents.
5. **Rollback**: apply `rollback.sql`; confirm both tables are gone.
6. **Verify-empty**: re-run `verify.sql`'s table-existence checks; expect `has_transactions = 0`
   and `has_transaction_lines = 0`.
7. `npx wrangler d1 delete asc-club-scratch-0021`.

Only after this proof succeeds does the conductor apply `forward.sql` to the live `asc-club`
and run `verify.sql` against it (Task 5 of the money-ledger plan).

## Rollback caveat

Rolling back after real money has been recorded (live Stripe writes, the MW backfill) discards
that ledger history — the same caveat 0003's, 0018's, 0019's, and 0020's rollbacks document. A
re-import from the committed MW archive (`data/membershipworks/`) plus replaying any live
Stripe events is the recovery path; there is no committed export of ledger rows themselves to
restore from.
