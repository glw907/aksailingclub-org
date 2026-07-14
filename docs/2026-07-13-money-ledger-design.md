# The money ledger (`money-ledger`) — design spec

Approved by Geoff 2026-07-13. Initiative 1 of the MembershipWorks replacement program
(ROADMAP.md). Executes the 2026-07-13 QBO ruling: money events get a first-class,
ledger-shaped home, designed now at the payments pass rather than bolted on mid-flow.

## Goal

One canonical record of every money event the club has ever had — charge, refund, void,
comp, donation — with the line-item breakdown QuickBooks Online will eventually consume.
Live Stripe payments write into it from day one; the archived 401-transaction
MembershipWorks accounting ledger backfills it. The QBO sync itself is a later initiative
(`qbo-integration`); this initiative delivers the table, the live write path, and the
backfill.

## Why two tables

The club's real history requires a header-plus-lines shape. MW membership charges bundle
asset add-ons into a single charge (membership money reads from `Membership Sub-Total`,
per `docs/mw-export-findings.md`), and 75 comped seats are discount-coded. QBO's
SalesReceipt/Refund entities are themselves header-plus-lines. A flat table cannot
represent either.

## Schema (migration 0021, asc-club)

Naming follows the repo's newer migrations (snake_case, TEXT uuid primary keys, sqlite
`datetime('now')` timestamps). All amounts are **integer cents**: Stripe is cents-native
and processor fees are fractional dollars. Existing dollar-denominated columns
(`asset_payments.amount`, `memberships.pricePaid`) are untouched; conversion happens at
the write sites.

### `transactions` — one row per money event

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `kind` | TEXT NOT NULL | CHECK: `charge`, `refund`, `void` |
| `source` | TEXT NOT NULL | CHECK: `stripe`, `paypal`, `check`, `cash`, `comp`, `other` |
| `occurred_at` | TEXT NOT NULL | when the money moved (or would have, for voids) |
| `amount_total_cents` | INTEGER NOT NULL | always >= 0; `kind` carries direction |
| `fee_cents` | INTEGER NULL | processor fee when known (MW export carries it; Stripe checkout events do not — left null until the QBO pass needs balance-transaction lookups) |
| `processor_ref` | TEXT NULL | Stripe session/charge id or PayPal ref; not unique (a refund may share its charge's ref) |
| `refunds_transaction_id` | TEXT NULL | self-FK to the refunded charge, when identifiable |
| `household_id` | TEXT NULL | FK households; null for non-member donors |
| `payer_name` | TEXT NULL | snapshot, for payers with no member row |
| `payer_email` | TEXT NULL | snapshot |
| `memo` | TEXT NULL | free text (import notes, admin notes) |
| `qbo_ref` | TEXT NULL | born null; the `qbo-integration` initiative populates |
| `qbo_synced_at` | TEXT NULL | born null |
| `mw_ref` | TEXT NULL | stable identifier derived from the MW accounting export row; UNIQUE where not null; presence marks an imported row and is the backfill's idempotency key |
| `created_at` | TEXT NOT NULL | default `datetime('now')` |

Indexes: `household_id`, `occurred_at`, `processor_ref`, partial unique on `mw_ref`.

### `transaction_lines` — the breakdown

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | uuid |
| `transaction_id` | TEXT NOT NULL | FK transactions |
| `item` | TEXT NOT NULL | CHECK: `dues`, `class-fee`, `asset-fee`, `donation`, `discount`, `other` |
| `description` | TEXT NOT NULL | display text ("2026 Family Membership", "Intro to Sailing seat") |
| `amount_cents` | INTEGER NOT NULL | signed within the transaction: discounts negative, everything else positive |
| `membership_id` | TEXT NULL | FK memberships |
| `enrollment_id` | TEXT NULL | FK class_enrollments |
| `assignment_id` | TEXT NULL | FK asset_assignments |

Indexes: `transaction_id` and each domain FK.

### Invariants (enforced by tests and verify.sql, not triggers)

- Per transaction: `SUM(lines.amount_cents) = amount_total_cents` (voids included — a
  void records what would have moved; `kind='void'` excludes it from any revenue sum).
- A line references at most one domain row.
- Sum helpers (and later QBO mapping) treat `charge` as positive, `refund` as negative,
  `void` as zero.

### Direction of reference

Lines point at domain rows. Domain tables keep `paid_at` / `fee_paid` / `stripe_ref` as
activation state — "membership activates on payment" stays where it lives. The ledger is
the canonical home of money facts; dropping the now-redundant domain columns is
deliberately deferred to the QBO pass, once nothing reads them.

## Live write path

### `ledger.ts` (new, `src/admin-club/lib/`)

`recordTransaction(db, { header, lines })` builds the prepared statements for one
transaction plus its lines and returns them for inclusion in a `db.batch()` — so a caller
commits its domain write and its ledger write atomically. A convenience wrapper executes
the batch directly for callers with no domain write (donations, future admin manual
payments in `membership-admin`).

### Reconcilers (`stripe-reconcile.ts`)

Each of the three per-kind reconcilers (`dues`, `class-fee`, `asset-fee`) adds a ledger
write after its existing guarded domain flip, only when that flip reported `changes: 1`
(the no-op paths write no ledger row). The two writes are sequential, not batched: the
ledger insert cannot be conditioned on the UPDATE's changes count inside a `db.batch()`,
and the session-claim gate already prevents replays. The residual crash window (domain
row paid, ledger row missing) is acceptable and detectable — verify.sql and the tests
check that every paid domain row has its line. Header: `kind='charge'`, `source='stripe'`,
`amount_total_cents = session.amount_total`, `processor_ref = session.id`,
`household_id` resolved the way each reconciler already resolves its contact. One line,
item matching the payment kind, referencing the domain row.

The reconcilers are not yet called in production (their checkout call sites land in
`unified-signup`); this initiative makes the seams ledger-complete before real money
flows.

### Donations (new fourth kind)

`PAYMENT_KINDS` grows `'donation'`. `donate.remote.ts` switches from its hand-rolled body
to `createCheckout({ kind: 'donation', refId: <pre-minted uuid> })`; the webhook gains a
donation reconciler that inserts the transaction (id = refId, one `donation` line, payer
snapshot from the session's customer details where present). This closes today's gap
where donations exist only inside Stripe. Idempotency: the existing
`processed_stripe_sessions` claim plus the transaction PK.

## Backfill (`scripts/import/mw-ledger.mjs`)

The verified-import-script pattern (`mw-members.mjs` v2 is the exemplar): reads the
machine-local plaintext at `~/.local/asc-data/` (never decrypts in-repo), dry-run plan by
default, `--apply` gate, audit provenance, `verify.sql`, pre-apply backup, idempotent —
a re-run after apply plans zero changes, keyed on `mw_ref`.

Scope — all 401 rows of the canon accounting export (Apr 2024 – Jul 2026):

- **239 Membership transactions** → `charge` rows; a `dues` line per membership at
  `Membership Sub-Total`, linked to the already-imported `memberships` rows (match via
  `mw_account_id` + season/date, cross-checked against stored `stripe_ref`); bundled
  asset add-on items become their own lines.
- **157 Event rows** → `charge` rows with `class-fee` lines linked to the
  roster-identified `class_enrollments` rows.
- **75 zero-total comped seats** → `charge` rows, `source='comp'`, item line at list
  price plus a negative `discount` line, total zero.
- **5 donations** → `charge` rows with `donation` lines (previously unimported).
- **9 refunds** → `refund` rows, `refunds_transaction_id` linked where the original
  charge is identifiable.
- **14 voided items** → `void` rows.
- 4 historical `Youth membership` rows keep their MW description text in the line;
  no new tier vocabulary.

`verify.sql` cross-checks: row counts per category above; every membership row with
`paid_at` has exactly one dues line; per-membership dues totals reconcile against
`memberships.pricePaid` (dollars-to-cents); the lines-sum-to-total invariant holds for
every transaction.

Unmatchable rows (a transaction whose account resolves to no imported member) are
refused loudly in the dry-run plan, never silently skipped — the mw-members import
resolved all 148 accounts, so any miss is a defect to surface.

## Migration discipline

0021 is scratch-proven (forward, verify, rollback, verify-empty) before touching the
live `asc-club`, per the repo's standing pattern. `EVENTS_DB` is untouched. The backfill
applies to live only after the migration is live and the dry-run plan has been read by
the conductor.

## Testing

- Unit tests: `ledger.ts` statement building; each reconciler's ledger write (including
  the no-op paths writing nothing); the donation reconciler end-to-end at the webhook
  seam; sum-helper sign conventions.
- Import tests: fixture-driven dry-run plans for each category (membership bundle, comp,
  refund link, void, donation, unmatchable-refusal).
- The full existing suite (915 tests) stays green; `npm run check` 0/0; build green.

## Non-goals

- No admin or member-facing UI (the read view rides `membership-admin`).
- No QBO sync, OAuth, or entity mapping (`qbo-integration`).
- No dues/class-fee/asset-fee checkout call sites (`unified-signup`).
- No removal of domain payment columns.
- No Stripe balance-transaction fee lookups.
