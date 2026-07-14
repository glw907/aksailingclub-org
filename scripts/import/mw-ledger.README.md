# mw-ledger: the MembershipWorks accounting export -> the money ledger

## What this does

Backfills `transactions`/`transaction_lines` (migration `0021_money_ledger`,
`docs/2026-07-13-money-ledger-design.md`) from the same canon accounting export
`mw-members.mjs` already reads: **every one of its 401 rows becomes exactly one `transactions`
row**, no row dropped and no row netted away, unlike that script's own `preprocessAccounting`
(which drops voided rows and cancels refund/charge pairs before the member/membership import
ever sees them -- this script is the reason those rows still need a home).

| Flag | Default | Contents |
|---|---|---|
| `--accounting` | `~/.local/asc-data/mw-accounting-2026-07-13.csv` | the canon accounting export: 401 transactions, Apr 2024 - Jul 2026 |
| `--db` | `asc-club` | the wrangler D1 database name (a `--db-name` scratch database when scratch-proving) |

Dry run is the default (prints the plan, writes nothing); `--apply` gates the real write.

## Categorization -- structural, read straight off the row

- `Items = 'Voided'` -> `kind = 'void'` (14 in the real export).
- a negative `Transaction Total` -> `kind = 'refund'` (9 in the real export).
- everything else -> `kind = 'charge'`.

`source = 'comp'` when `Discount Code` is set and `Transaction Total = 0` (75 in the real
export); otherwise `'stripe'` when `Payment ID` is present, else `'other'`.

## The line-item breakdown

The export's own five sub-total columns map directly to `transaction_lines.item` -- this is the
export's own header-plus-lines shape, not a guess:

| Export column | `item` |
|---|---|
| `Membership Sub-Total` | `dues` |
| `Event Sub-Total` | `class-fee` |
| `Donation Sub-Total` | `donation` |
| `Cart Sub-Total` | `asset-fee` (the bundled asset add-ons the spec names: RV parking, mooring, boat storage) |
| `Other Sub-Total` | `other` |

`Handling` and `Total Tax` combine into one additional `other` line when their sum is non-zero.
Every column is taken as its absolute value in cents (`buildSubtotalLines`); the row's `kind`
carries the money's direction, never an individual line's sign (the spec's "everything else
positive" rule -- only a `discount` line is ever negative).

## Comps: the list-price problem

A comped row's own sub-totals are already zero (the discount is baked into the export, there is
no separate "list price, then a deduction" pair of columns). `buildListPriceIndex` derives a list
price per membership tier (from the row's own `Items` text, via `mw-members.mjs`'s
`deriveMembershipTier`) or per event `Reference`, from the SAME export's own highest real
(non-comped, non-voided) sub-total for that key -- the file's own going rate, never an external
assumption. The comp then gets one positive item line at that price plus one `discount` line at
its negative, netting to the row's real zero total. A tier or event `Reference` this export never
charges anyone a real price for (every occurrence happens to be comped) has no list price to
derive from; that comp is REFUSED, never guessed at.

A later charge that itself later gets refunded still counts as a valid list-price source (the
amount actually charged, whatever happened after) -- refund status is orthogonal to whether a
price was real.

## Domain linking -- best-effort, never a requirement to write the row

- A `dues` line links to the `memberships` row sharing this transaction's household, `paid_at`
  date, and `price_paid` (the exact three columns `mw-members.mjs` wrote that row from). No match
  (a fully-refunded membership `mw-members.mjs` deleted per the accounting-is-canon ruling, say)
  leaves `membership_id` null -- the money fact is still recorded.
- A `class-fee` line links to a `class_enrollments` row sharing this transaction's `Payment ID` as
  `stripe_ref`, but ONLY when exactly one such enrollment exists for this transaction's household
  (a multi-seat group purchase, several enrollments sharing one `stripe_ref`, cannot be split
  across the transaction's single `class-fee` line -- the invariant that a line touches at most
  one domain row forbids it). A group purchase's `class-fee` line is written with `enrollment_id`
  null in that case; the money fact and the correct amount are still recorded.

## Household resolution and refusals

`Account ID` -> `households` via the already-imported `members.mw_account_id` map. A
Membership or Event row whose account resolves to no household is REFUSED loudly (never silently
skipped) -- `mw-members.mjs` resolved every real account, so a miss here is a defect to surface,
same rule that script follows. A Donation row is exempt: `household_id` stays null, and
`payer_name`/`payer_email` snapshot the row's own `Name`/`Email` columns instead (regularized the
same way every other write path is: `normalizeNameCaps`/`normalizeEmail`,
`src/admin-club/lib/member-normalize.js`).

## Refund linking

A `refund`-kind row links to its originating charge via the same netting key
`mw-members.mjs`'s `preprocessAccounting` uses for its OWN (destructive) netting: same
`Account ID` and `Transaction Type`, plus `Reference` for an Event row, matched against the most
recent prior UNCONSUMED charge of the identical absolute amount. Unlike that script, BOTH rows
land in the ledger here -- this only records `refunds_transaction_id`, never drops either side.
An unlinkable refund (its charge predates this export, say) keeps `refunds_transaction_id` null;
the spec marks that FK "when identifiable", not mandatory.

## Idempotency key

`mw_ref`, a `sha256` hash (24 hex characters, prefixed `mw-ledger:`) of each row's own identifying
columns (`Date`, `Account ID`, `Transaction Type`, `Reference`, `Items`, `Transaction Total`,
`Payment ID`, `Discount Code`, `Note`) -- the export carries no transaction-id column of its own,
so the row's own content stands in for one. Two rows identical across every one of those columns
collide; `planMwLedgerImport` disambiguates a same-run collision with a `#n` suffix, deterministic
as long as the export's row order stays stable across runs.

A re-run against unchanged input plans **zero inserts**: every row's `mw_ref` is checked against
`transactions.mw_ref` (migration `0021`'s own partial unique index) before it is ever planned as
new.

## Refusals

Refused rows never touch the real database, reported with an account id and a plain-language
reason (never a name or email -- this script's own report stays structural, unlike
`mw-members.mjs`'s, since this backfill runs without a conductor's per-row review step):

- A Membership or Event row whose `Account ID` resolves to no household.
- A comped row whose tier or event `Reference` has no real (non-comped) price anywhere in this
  export to derive a list price from.
- A row whose line breakdown does not sum to its own `Transaction Total` (a defensive check --
  never expected to fire against well-formed real data, the last line of defense against a
  malformed source row reaching a written statement).

## Credits and the QBO fields

`qbo_ref`/`qbo_synced_at` are never populated here (born null, the `qbo-integration` initiative's
own job). No `credit_grants` row is touched by this import, same standing rule
`mw-members.mjs`'s own README names.

## How to run

```sh
node scripts/import/mw-ledger.mjs                    # dry run (default), prints the plan
node scripts/import/mw-ledger.mjs --apply             # applies it to the real asc-club
node scripts/import/mw-ledger.mjs --accounting /path --db asc-club
```

Needs `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and network
access to the real `asc-club` database; always `--remote`, there is no local-D1 mode for this
script. Run `mw-ledger.mjs` only AFTER `mw-members.mjs` has already imported the households,
members, memberships, classes, and enrollments this script links against -- an out-of-order run
still writes every row (domain links degrade to null, never a refusal on that account alone), but
a subsequent `mw-members.mjs` run does not retroactively backfill this script's already-written
`membership_id`/`enrollment_id` links.

## Partial-failure recovery, and the pre-import backup

Same shape as `mw-members.mjs`: this import applies as ONE `wrangler d1 execute --remote --file`
call with no cross-statement transaction, so a mid-run failure leaves a partial write.

**Before any real (`--apply`) run, take a backup:**

```sh
npx wrangler d1 export asc-club --remote --output /path/to/backup-$(date +%Y%m%d%H%M%S).sql
```

**Recovery after a partial failure is a plain re-run**, same command: the `mw_ref` idempotency
check treats every row this run already wrote as a no-op the second time through, so the re-run
resumes forward from wherever the prior run stopped.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file scripts/import/mw-ledger.rollback.sql
```

Deletes every `transactions` row with a non-null `mw_ref` (lines first). This import never edits
a pre-existing row, so, unlike `mw-members.rollback.sql`, this rollback has no update-reversal
caveat -- it fully undoes exactly what this script ever wrote.

## Verify

```sh
VERIFY_SQL=$(grep -v '^--' scripts/import/mw-ledger.verify.sql | grep -v '^\s*$')
npx wrangler d1 execute asc-club --remote --command "$VERIFY_SQL"
```

## Real run results

Recorded here by the conductor after Task 5's real run against `asc-club` (scratch-proof of
migration `0021`, the dry-run plan review, the real apply, `verify.sql`, a zero-change re-run). See
`docs/STATUS.md` for the current state of that run.
