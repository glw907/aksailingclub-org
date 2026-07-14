# ROADMAP

> Strategic initiatives. Managed by `/log-project`. Individual carry-forwards live in
> `docs/STATUS.md` entries (this repo keeps no BACKLOG.md, per CLAUDE.md).

## Planned

### QuickBooks Online integration `qbo-integration`
Give the club's money events a ledger-shaped home and sync it to QuickBooks Online. A
`transactions` table (one row per charge, refund, void, or donation: date, amounts,
processor ref, fee, line items, and a `qbo_ref` sync status) that memberships,
enrollments, and asset payments hang off; live Stripe charges write into it; the archived
MW ledger (`data/membershipworks/`, 401 transactions) backfills it via the verified-import
pattern keyed on `mw_account_id`. Designed at the phase-2 payments/accounting pass, not
bolted onto the member domain mid-flow. Ruled by Geoff 2026-07-13.
