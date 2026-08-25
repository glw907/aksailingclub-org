# asc-club migration 0037: `asset_requests` unique pending-request guard

## What this does

Assets register plan (`docs/plans/2026-08-24-assets-register.md`, "Task 6: the `asset_requests`
unique-index migration"). Adds one **partial** unique index:

```sql
CREATE UNIQUE INDEX uq_asset_requests_pending_household_type
  ON asset_requests(household_id, asset_type) WHERE status = 'pending';
```

At most one `pending` `asset_requests` row per `(household_id, asset_type)` pair. Column names
confirmed against the live table definition (`migrations/asc-club/0011_member_portal/forward.sql`
`CREATE TABLE asset_requests`; no later migration alters its shape besides 0034's id-rename data
move, which touches no column name).

## Why: the double-click race an app-level guard cannot close

`src/member-portal/lib/assets.ts`'s `createAssetRequest` is the one insert path
(`/my-account/storage`'s `requestAsset` action for a first-time ask, `/my-account/renew`'s
`retainAsset` action for a year-to-year retention ask). Before this migration, neither caller's
own guard was backed by a real constraint:

- `requestAsset` (`storage/+page.server.ts`) had **no pre-check at all**.
- `retainAsset` (`renew/+page.server.ts`) runs a SELECT-then-insert
  (`listHouseholdRequests`, then `createAssetRequest`, guarding against
  `OPEN_RETENTION_STATUSES`).

Two concurrent submissions for the same household/asset-type pair (a double-clicked button, the
same page open in two tabs, an `enhance` retry) can both pass the SELECT, or skip it entirely,
before either INSERT lands, leaving two `pending` rows for what the admin's review inbox
(`listPendingAssetRequests`) and the retention step's "already requested" flag both assume is at
most one open ask per household/asset-type. This is the same shape `0004_waitlist_integrity`
closed for `class_waitlist` and `0032_signature_uniqueness` closed for `waiver_acceptances`: a
real index backing an app-level check, not replacing it.

## Why a PARTIAL index, not a plain `UNIQUE(household_id, asset_type)`

`asset_requests` is a state machine (0011's own header: `pending -> queued | assigned | denied |
cancelled | approved_awaiting_payment`), and a household's full history for one asset type
legitimately holds many resolved rows over the years — an assigned mooring released and requested
again the next season, a denied ask followed by a fresh one. Only a currently-`pending` row is the
double-click hazard this migration closes; scoping to `WHERE status = 'pending'` leaves every
resolved row, at any count, untouched.

## The app-side error mapping (this task's own second half)

`createAssetRequest` now wraps its `INSERT` in a `try`/`catch` and maps a `UNIQUE` violation
against `asset_requests` to the one friendly refusal (`isUniqueViolation`, the same
substring-match convention `enrollments.ts`, `household-surgery.ts`, and `member-portal/lib/
profile.ts` each keep their own copy of):

```
{ error: 'You already have a pending request for this asset type.' }
```

Both call sites now check the result: `requestAsset` (`storage/+page.server.ts`) returns
`fail(400, { error })`; `retainAsset` (`renew/+page.server.ts`) returns `fail(400, { retainError:
error })`, its own distinct form-error key (finding 5's own precedent, `?/renew`'s `error` vs.
`?/retainAsset`'s `retainError`). Neither path can now let a raw D1 constraint error escape as an
unhandled 500.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0037_asset_request_unique/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0037_asset_request_unique/verify.sql)"
```

Expect: query 1 returns exactly one row naming `uq_asset_requests_pending_household_type` with the
partial `WHERE status = 'pending'` clause in its `sql` text; query 2 (any household/asset-type
pair holding more than one `pending` row) returns no rows.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0037_asset_request_unique/rollback.sql
```

Safe any time: dropping an index never discards data. Once dropped, the app-level guards
(`requestAsset`'s now-restored lack of one, `retainAsset`'s SELECT-then-insert) are the only thing
standing between a race and a duplicate `pending` row again.

## Scratch-proof procedure (run before any live apply, per the repo's standing migration
discipline)

Run entirely against a local, disposable D1 replica (`--persist-to` distinct from the repo's own
`.wrangler/` state), never a real Cloudflare-hosted scratch database.

1. **Fresh persistence directory** in the scratchpad, distinct from the repo's `.wrangler/` state.
2. **Apply migrations 0001 through 0036 in order** (combined into one file), `--local
   --persist-to <scratch dir>`. Result: **143 statement batches, all `"success": true`, zero
   errors.**
3. **Seed** one `asset_types` row (`mooring`), one `households`/`members` pair, and one `pending`
   `asset_requests` row (`req-1`, household `hh-1`, type `mooring`). All seed statements
   `"success": true`.
4. **Pre-migration duplicate insert** (`req-1b`, same household/type, `pending`): **succeeds** —
   confirms no constraint exists yet, so the race this migration closes is real.
5. **`forward.sql` against the now-dirty data (two pending rows for the same pair)**: **fails**
   with `UNIQUE constraint failed: asset_requests.household_id, asset_requests.asset_type:
   SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)` — proves `CREATE UNIQUE INDEX` itself
   refuses to build over an existing violation, and gives the exact error-message text
   `isUniqueViolation`'s substring match needs to catch. `req-1b` deleted to clean up.
6. **`forward.sql` against clean data**: **succeeds.**
7. **`verify.sql`**: query 1 returns the one index row with the expected DDL text; query 2 (any
   pending-duplicate pair) returns no rows.
8. **Enforcement proof, three cases**:
   - Same household + same type, `pending` (`req-2`): **rejected** with the identical
     `SQLITE_CONSTRAINT_UNIQUE` error.
   - Same household + same type, `cancelled` (`req-3`): **succeeds** — the partial index never
     sees a non-`pending` row.
   - Same household, a DIFFERENT type (`rv-parking`), `pending` (`req-4`): **succeeds** — the
     index is scoped per type, not per household alone.
9. **Rollback** (`rollback.sql`): **succeeds.** `verify.sql` re-run: query 1 empty (index gone).
10. **Post-rollback duplicate insert** (`req-2` again, same household/type, `pending`):
    **succeeds** — proves the constraint really is gone, not just hidden from `verify.sql`.
    Deleted to clean up.
11. **Forward again**: **succeeds.** `verify.sql` re-run: identical results to step 7.
12. Scratch persistence directory deleted.

No unexpected error at any step; every check resolved to its expected value, both directions.

## Live apply record (2026-08-24, Alaska time)

Pre-apply live read (`--remote`): `SELECT status, COUNT(*) FROM asset_requests GROUP BY status`
returned **zero rows** — `asset_requests` is genuinely empty live, confirming the plan's own
"currently zero live rows, so the apply is trivially safe" claim (matches
`0034_asset_type_ids/README.md`'s own 2026-07-30 live-state table, which recorded the same table
as 0 rows and is still true).

`forward.sql` applied to live `asc-club` with `--remote`: `success: true`, 1 row written, `num_tables:
37`, `changed_db: true`. No error.

Post-apply `verify.sql` (`--remote`):

- Query 1: one row, `uq_asset_requests_pending_household_type`, DDL text
  `CREATE UNIQUE INDEX uq_asset_requests_pending_household_type\n  ON asset_requests(household_id, asset_type) WHERE status = 'pending'`.
- Query 2: no rows (no pending-duplicate pair exists — trivially true over an empty table).

The index existed BEFORE this migration was applied only in the scratch replica; it now exists
live before any real member traffic has ever inserted an `asset_requests` row, which is the plan's
own stated ordering requirement.

The repo's own local `.wrangler/` replica also received `forward.sql` (no `--persist-to` flag), so
`e2e/fixtures/bootstrap-club-db.mjs` picks up the new index on its next `test:e2e` run without a
separate step.

The committed SQL is byte-identical to what was applied to both the scratch replica and live.
