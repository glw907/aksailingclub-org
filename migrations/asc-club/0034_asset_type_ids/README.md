# asc-club migration 0034: `asset_types` ids move to the hyphenated vocabulary

## What this does

Assets substrate plan (`docs/plans/2026-07-29-assets-substrate.md`, "Task 1: the schema-repair
migration"), landing three corrections in one forward step:

1. **Id rename.** `rv_parking` becomes `rv-parking`, `boat_parking` becomes `boat-parking`, and
   `small_boat` becomes `small-boat-rack`. `mooring` already matches and is left alone. The
   target vocabulary is `DocumentAudience` (`src/theme/documents.ts:26-33`) and the frontmatter
   of the six published 2026 documents under `src/content/documents/`.
2. **Capacity correction.** `asset_types.capacity` moves from the imported placeholder numbers
   (the design spec's ruling 1: these were authored examples, not club data) to Geoff's four
   confirmed numbers (2026-07-30): `mooring` 10, `rv-parking` 10, `boat-parking` NULL
   ("plenty of space to add more," a deliberate no-limit value, not a gap), `small-boat-rack` 9.
3. **Payment-method backfill.** The `asset_payments` rows still missing `method` despite carrying
   a `stripe_ref` get `method = 'card'`, the same backfill logic
   `0008_asset_payment_method/forward.sql` used, re-run because
   `scripts/import/ops-assets.mjs:640`'s insert never populated the column for every row 0008's
   own backfill missed. Confirmed live (2026-07-30): exactly 4 rows (`ops-payment-100`,
   `ops-payment-105`, `ops-payment-106`, `ops-payment-107`).

## Why the rename needs its own technique, not a plain `UPDATE`

A live schema read (`SELECT name, sql FROM sqlite_master WHERE type='table'`, run against real
`asc-club` 2026-07-30) confirms the referencing columns: `asset_assignments.asset_type`,
`asset_waitlist.asset_type`, and `asset_requests.asset_type` each carry `REFERENCES
asset_types(id)`, none with an `ON UPDATE CASCADE` clause. `asset_payments` references only
`asset_assignments(id)` through `assignment_id`; it carries no direct reference to an asset type
and needed no rename handling.

Real remote D1 enforces foreign keys (the same finding
`0006_offer_cascade_on_waitlist_delete/forward.sql`'s own header documents for a DELETE, and
SQLite's own documented behavior for parent-key UPDATEs: modifying a referenced primary key value
while child rows still hold the old value fails exactly as a DELETE would, absent `ON UPDATE
CASCADE`). A direct `UPDATE asset_types SET id = 'rv-parking' WHERE id = 'rv_parking'` therefore
fails outright with 24 live `asset_assignments` rows still pointing at `rv_parking`.

**Technique chosen: insert-repoint-delete, never a `PRAGMA foreign_keys` toggle and never a
recreate-and-copy of the three referencing tables.** For each renamed type: insert the new-id row
alongside the old one (both exist briefly, so every child row's foreign key stays valid the whole
time), repoint every child row from the old id to the new id, then delete the now-unreferenced old
row. This needs no FK pragma changes and touches only `asset_types` structurally; the three
referencing tables only ever get plain `UPDATE`s against existing rows, no `DROP`/`CREATE`/copy.
Rollback runs the identical technique in reverse.

## Live pre-migration state (confirmed 2026-07-30, `--remote` read-only)

```
asset_types:      mooring/12  rv_parking/5  boat_parking/15  small_boat/NULL
asset_assignments: boat_parking 43, mooring 17, rv_parking 24, small_boat 6  (by asset_type)
asset_waitlist:    0 rows
asset_requests:    0 rows
asset_payments:    4 rows with method IS NULL AND stripe_ref IS NOT NULL
                   (ops-payment-100, -105, -106, -107)
```

`asset_waitlist` and `asset_requests` are genuinely empty live (matches
`docs/2026-07-29-assets-functional-input.md`'s "completely unexercised" finding), so the scratch
proof below seeds one synthetic row in each to prove the rename's referential fan-out actually
moves, since the live rename touches zero rows in either table.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0034_asset_type_ids/forward.sql
```

**Not run against the live database by this task** — the orchestrator runs the live `--remote`
apply after reviewing this migration's SQL (a deliberate deviation from the plan's own task
boundary, which has the implementer run it; see the plan-execution note below). See "Scratch-proof
procedure" for what has actually been proven, and "Live apply sequence" for the exact commands to
run next.

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0034_asset_type_ids/verify.sql)"
```

Expect: query 1 (any underscore `asset_types.id`) no rows; query 2 (any referencing column still
underscore) no rows; query 3 lists the four hyphenated ids with capacities `10 / 10 / NULL / 9`;
query 4 (`asset_payments` still missing `method`) `0`; query 5, the waiver-requirements
derivation's own proxy — a household counts as mismatched exactly when it holds an active
assignment whose `asset_type` is outside the four canonical hyphenated ids, which is precisely the
condition `waiver-requirements.ts:182-195,234-240`'s cast silently mismatches on today — returns
`0`, down from the live pre-migration `21` (confirmed live 2026-07-30 with the same query, see
below).

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0034_asset_type_ids/rollback.sql
```

Restores the underscore ids, the prior imported capacities (`mooring` 12, `rv_parking` 5,
`boat_parking` 15, `small_boat` NULL), and reverts the four specific `asset_payments` rows this
migration backfilled (`ops-payment-100`, `-105`, `-106`, `-107`, identified by their live ids
rather than by the `method`/`stripe_ref` predicate `forward.sql` used) back to `method = NULL`.

**That literal-id choice is deliberate, not a shortcut.** `0008_asset_payment_method`'s own
backfill already set `method = 'card'` on every pre-existing row with a `stripe_ref`, so a blanket
`UPDATE ... WHERE method = 'card' AND stripe_ref IS NOT NULL` would revert those rows too, not just
the four this migration touched. Recording the four ids at authoring time and reverting only those
is the same reasoning `0033_member_standing`'s own README applies to its Former backfill: rollback
undoes exactly what forward did, not everything that happens to look the same afterward.

**Safe only before any post-migration write depends on the hyphenated ids.** A new
`asset_assignments`/`asset_waitlist`/`asset_requests` row created after `forward.sql` runs, using
the hyphenated form, is still correctly repointed back to the underscore form by rollback's
blanket `UPDATE`s (so rollback discards no rows) — but Task 2's cast validation and any signing
list built against the hyphenated vocabulary in the meantime breaks the moment the ids move back.

## Scratch-proof procedure

Per the repo's standing migration discipline
(`migrations/asc-club/0033_member_standing/README.md`'s own "Scratch-proof procedure"), run
entirely against a local, disposable D1 replica (`--persist-to` distinct from the repo's own
`.wrangler/` state), never a real Cloudflare-hosted scratch database. One deviation from 0033's own
step order, required by this migration's own constraint: 0033's last migration (0033 itself) could
run as part of "apply 0001 through N in order," because it needed no pre-seeding. 0034 does — no
prior migration populates `asset_types` — so seeding happens between "apply through 0033" and
"apply 0034's forward.sql," not folded into the same batch.

1. **Fresh persistence directory**, distinct from the repo's `.wrangler/` state.
2. **Apply migrations 0001 through 0033 in order**, `--local --persist-to <scratch dir>` (combined
   into one file for a single `wrangler d1 execute`, since 33 separate invocations each pay
   D1's local-instance startup cost). Result: **all 33 statements batches returned
   `"success": true`**; a direct check confirmed `asset_types` empty (0 rows) and all five asset
   tables present, matching the plan's own stated pre-condition.
3. **Seed the scratch replica to the live condition.** The four live `asset_types` rows in their
   underscore form with their live capacities/fees, plus one household/member/membership, one
   active `asset_assignments` row per type (so the rename's referential fan-out has something to
   move in every referencing table, since live `asset_waitlist`/`asset_requests` are both
   genuinely empty), one `asset_waitlist` row and one `asset_requests` row, and `asset_payments`
   rows mirroring the real live ids the rollback proof needs to exercise: the four
   method-NULL/stripe_ref-set rows (using the real live ids `ops-payment-100/105/106/107`, so
   `rollback.sql`'s own literal id list is tested for real), one pre-existing `method = 'card'`
   row (proving forward's blanket predicate, and rollback's literal-id list, both leave it alone),
   and one outstanding `method = NULL, stripe_ref = NULL` row (proving the backfill predicate
   never touches a genuinely unpaid invoice). Result: **all seed statements returned
   `"success": true`**.
4. **Forward.** `forward.sql` applied. Result: **`"success": true`**. Direct row checks confirmed:
   `asset_types` now `mooring/10, rv-parking/10, boat-parking/NULL, small-boat-rack/9`;
   `asset_assignments`/`asset_waitlist`/`asset_requests` all repointed to the new hyphenated ids;
   `asset_payments` — the four target rows now `method = 'card'`, the pre-existing card row and
   the outstanding NULL row unchanged.
5. **Verify.** `verify.sql` run. Result: query 1 (underscore `asset_types.id`) no rows; query 2
   (underscore value in any referencing column) no rows; query 3 the four hyphenated ids with
   capacities `10/10/NULL/9`; query 4 (`still_missing_method`) `0`; query 5
   (`mismatched_households`, the waiver-requirements proxy) `0`.
6. **Rollback.** `rollback.sql` applied. Result: **`"success": true`**. Direct row checks
   confirmed: `asset_types` back to `mooring/12, rv_parking/5, boat_parking/15, small_boat/NULL`;
   all three referencing tables back to the underscore ids; `asset_payments` — the four target
   rows back to `method = NULL`, `ops-payment-existing` still `'card'` (untouched, proving the
   literal-id choice above), the outstanding row still `NULL`.
7. **Verify-rollback.** `verify.sql` run again (same file; there is no separate rollback-verify
   query, since the same five checks read either state correctly). Result: query 1 lists the three
   underscore ids; query 2 lists the three referencing-table rows still underscore; query 3 shows
   the four ids at their prior capacities `12/5/15/NULL`; query 4 (`still_missing_method`) `4`;
   query 5 (`mismatched_households`) `1` (the scratch replica seeds one household, so the proxy
   query correctly counts it as mismatched again once the rename is undone — this is the same
   query as the live 21-household check, just against one synthetic household instead of 21 real
   ones).
8. **Forward again.** `forward.sql` re-applied. Result: **`"success": true`**. `verify.sql` run a
   third time reproduced step 5's results exactly: no underscore ids anywhere, capacities
   `10/10/NULL/9`, `still_missing_method` `0`, `mismatched_households` `0`.
9. Scratch persistence directory deleted.

No error at any step. Every check above resolved to its expected value.

## Live apply sequence (for the orchestrator)

In order, after this migration's SQL has been reviewed:

```sh
# 1. Apply forward.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0034_asset_type_ids/forward.sql

# 2. Verify structurally: no underscore ids anywhere, capacities correct, payment backfill closed.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0034_asset_type_ids/verify.sql)"

# 3. Confirm the capacity numbers directly against Geoff's four confirmed values.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT id, capacity FROM asset_types ORDER BY sort_order;"

# 4. Confirm the payment-method backfill closed.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS still_missing_method FROM asset_payments WHERE method IS NULL AND stripe_ref IS NOT NULL;"

# 5. Confirm the waiver-requirements derivation itself: 21 mismatched households before, 0 after.
#    (This exact query returned 21 live on 2026-07-30, before this migration; expect 0 after step 1.)
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(DISTINCT m.household_id) AS mismatched_households FROM asset_assignments aa JOIN memberships m ON m.id = aa.membership_id WHERE aa.status = 'active' AND aa.asset_type NOT IN ('mooring', 'rv-parking', 'boat-parking', 'small-boat-rack');"
```

Step 1 must complete with no error before Task 2 (the cast-validation task) starts, per the plan's
own execution-order dependency.

## Live apply record (2026-07-30, orchestrator)

`forward.sql` was applied to live `asc-club` with `--remote` on 2026-07-30. It completed with
`success: true`, 86 changes, 162 rows written, `changed_db: true`.

Pre-apply live state, read immediately before:

| measure | before | after |
| --- | --- | --- |
| `asset_types` ids in underscore form | 3 | 0 |
| `asset_assignments` rows in underscore form | 73 | 0 |
| `asset_waitlist` / `asset_requests` rows in underscore form | 0 / 0 | 0 / 0 |
| `asset_payments` missing `method` despite a `stripe_ref` | 4 | 0 |
| households holding a mismatched-type active asset | **21** | **0** |

The 21-to-0 move is the plan's own success criterion for this migration. Live `asset_types` after
the apply reads `mooring` 10, `rv-parking` 10, `boat-parking` NULL, `small-boat-rack` 9, matching
Geoff's four confirmed capacities.

A pre-apply scan of `sqlite_master` for every object mentioning `asset_types` or an old id returned
only the four tables this migration handles. No view, trigger, or other table referenced them.

The committed SQL is byte-identical to what was applied. Do not edit `forward.sql` now that it has
run against live: the file is the record of what happened, and a later correction takes its own
migration.

## Plan-execution note

The plan's own text (`docs/plans/2026-07-29-assets-substrate.md`, "Task 1: the schema-repair
migration") has the implementer run the live `--remote` apply. This task's actual dispatch
deliberately narrowed that boundary: the implementer stops after the scratch proof, `npm run
check`, and `npm test` are all green, and the orchestrator runs the live apply after reviewing the
SQL. Recorded here so a later reader does not read the plan's own text as contradicting what
actually happened.
