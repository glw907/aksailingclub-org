# asc-club migration 0035: the `event_series` table

## What this does

Events admin build pass (`docs/plans/2026-08-22-events-admin.md`, "Task 1: The
`0035_event_series` migration"; `docs/2026-08-22-events-admin-design.md`, "Data model"). Adds a
new `event_series` table carrying the identity that survives across seasons (title, recurrence,
retirement), and gives `events` a required `series_id` foreign key and a real `season` column,
moving slug uniqueness from a global `UNIQUE` to `UNIQUE (season, slug)` -- matching `classes`'
own shape, because a rolled-forward event keeps its slug. `start_date` stays nullable.

Every existing `events` row gets its own series (`id = 'series-' || events.id`, `title =
events.title`, `recurrence = 'annual'`), selected `FROM events` with no hand-written list, and its
`season` derived from `start_date`'s year, falling back to `settings.current_season` for a row
with no date. Nothing in this migration guesses at series links by matching title; the officer
links years by hand through the form (`docs/plans/2026-08-22-events-admin.md`, Task 5).

## Why the recreate

Two SQLite/D1 constraints force a recreate-and-copy (`CREATE events_new` -> copy -> `DROP` ->
`RENAME`) rather than a plain `ALTER TABLE`:

1. **`events.slug` carries a column-level `UNIQUE`** (`0001_substrate`), and SQLite cannot drop a
   column-level constraint in place. The new shape needs a table-level `UNIQUE (season, slug)`
   instead.
2. **SQLite cannot add a `NOT NULL` column with no default to a populated table.** `series_id TEXT
   NOT NULL REFERENCES event_series(id)` needs a real value for every existing row before the
   constraint can hold; a plain `ALTER TABLE events ADD COLUMN series_id ... NOT NULL` with no
   `DEFAULT` is rejected outright by SQLite.

This is the same technique `0006_offer_cascade_on_waitlist_delete`, `0022_join_emails`, and
`0029_signature_record` already use for the identical situation. Unlike `0034_asset_type_ids`'s
insert-repoint-delete, this recreate needs no referential or index fan-out handling: a repo-wide
grep confirms no table anywhere declares `REFERENCES events(id)`, and `events` carries no index of
its own (`grep -rn "REFERENCES events" migrations/` and a scan of every `CREATE INDEX` in the
migration set both return nothing touching `events`). `events` itself has never been altered since
`0001_substrate` -- `grep -rln events migrations/asc-club/*/forward.sql` outside `0001_substrate`
finds only `0003_class_images` (which alters `classes`, not `events`) and `0017_announcements`
(which only names `events` in a comment) -- so `events_new` below carries the table's original
column list unchanged and in the same order, with `series_id` and `season` appended.

## Live pre-migration state (confirmed 2026-08-22, `--remote` read-only)

```
events:            12 rows total, 12 dated, 0 undated
settings.current_season: '2026'
```

Read with:

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS total, SUM(CASE WHEN start_date IS NOT NULL THEN 1 ELSE 0 END) AS dated, SUM(CASE WHEN start_date IS NULL THEN 1 ELSE 0 END) AS undated FROM events;"
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT key, value FROM settings WHERE key='current_season';"
```

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0035_event_series/forward.sql
```

**Not run against the live database by this task.** This task stops after the scratch proof,
`npm run check`, and `npm test` are green; task 6 (the conductor) runs the live `--remote` apply
after the SQL has been reviewed, the same boundary `0034_asset_type_ids/README.md` records. See
"Scratch-proof procedure" below for what has actually been proven, and "Live apply sequence" for
the exact commands to run next.

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0035_event_series/verify.sql)"
```

Expect: query 1 `events_count` equal to `series_count` (the one-series-per-row invariant); query 2
`orphan_series_id` `0`; query 3 no rows (no duplicate `(season, slug)`); query 4 `bad_season` `0`;
query 5 a human read of the new schema (`series_id`, `season`, `UNIQUE (season, slug)`, no
column-level `UNIQUE` on `slug`); query 6 `undated_count`, which must read the same before and
after the live apply (this migration invents no dates) -- expect `0`, matching the pre-migration
count above.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0035_event_series/rollback.sql
```

Restores `events` to its exact `0001_substrate` shape (a global `slug TEXT NOT NULL UNIQUE`, no
`season`, no `series_id`), copies every row back, and drops `event_series`.

**Safe only while no two `events` rows share a slug** -- that is, before the first roll-forward
(the store's `rollForwardSeason`, task 2) has created a second season's copy of any series. Once
two rows share a slug across seasons, the global `UNIQUE` this rollback restores cannot hold and
the recreate fails. Run this check before rolling back:

```sh
npx wrangler d1 execute asc-club --remote --command "SELECT slug, COUNT(*) FROM events GROUP BY slug HAVING COUNT(*) > 1;"
```

Any row returned means rollback will fail; do not run it. This is the same precondition register
`0034_asset_type_ids/README.md`'s own rollback section uses for its own irreversible-past-a-point
step.

## Scratch-proof procedure

Run entirely against a local, disposable D1 replica (`--persist-to` distinct from the repo's own
`.wrangler/` state), never a real Cloudflare-hosted scratch database, per the repo's standing
migration discipline.

1. **Fresh persistence directory**, distinct from the repo's `.wrangler/` state.
2. **Applied migrations `0001` through `0034` in order**, one `wrangler d1 execute --local
   --persist-to <scratch dir> --file <dir>/forward.sql` invocation per migration. Result: **all
   34 migrations returned `"success": true`**; a direct check confirmed `events` empty (0 rows)
   and `settings` carrying `current_season = '2026'` from `0001_substrate`'s own seed.
3. **Seeded the scratch replica to the live condition.** `settings.current_season` already reads
   `'2026'` from step 2 (matching the live value read above), so no separate settings seed was
   needed. Inserted four `events` rows directly: one dated (`Ice Breaker`, `2026-04-15`), one
   undated (`Governor's Cup`), and two sharing the title `Duplicate Title` with different slugs
   and dates -- so the "no guessing at links by title" claim is visible in the result: they must
   land as two separate series, never merged. Result: **the insert returned `"success": true`**.
4. **Forward.** `forward.sql` applied. Result: **all 7 statement batches returned `"success":
   true`**.
5. **Verify.** `verify.sql` run. Result:
   - Query 1: `events_count` 4, `series_count` 4 (equal, as expected).
   - Query 2: `orphan_series_id` 0.
   - Query 3: no rows (no duplicate `(season, slug)`).
   - Query 4: `bad_season` 0.
   - Query 5: `CREATE TABLE "events" (... series_id TEXT NOT NULL REFERENCES event_series(id),
     season INTEGER NOT NULL, UNIQUE (season, slug))`, `slug` with no column-level `UNIQUE`.
   - Query 6: `undated_count` 1 (`Governor's Cup`).

   A direct row check additionally confirmed the "no guessing at links by title" claim: `ev-dup-a`
   and `ev-dup-b` (both titled `Duplicate Title`) landed on two distinct series,
   `series-ev-dup-a` and `series-ev-dup-b`, and the undated `Governor's Cup` correctly picked up
   `season = 2026` via the `settings.current_season` fallback arm of the `COALESCE`.
6. **Rollback.** `rollback.sql` applied. Result: **all 6 statement batches returned `"success":
   true`**. A direct schema read confirmed `events` back to `CREATE TABLE "events" (... slug TEXT
   NOT NULL UNIQUE ...)` with no `series_id`/`season` column; a direct row check confirmed all
   four rows still present with their original `id`/`title`/`slug`/`start_date` values unchanged;
   a direct `sqlite_master` check confirmed `event_series` no longer exists.
7. **Verify-after-rollback.** `verify.sql` run again (same file). Result: **`SQLITE_ERROR: no
   such table: event_series`**, on query 1's `event_series` reference -- the expected outcome,
   since `verify.sql` is written for the post-`forward.sql` schema and `event_series` (along with
   `events.season`) genuinely no longer exists once `rollback.sql` has run. This failure is itself
   the proof that the rollback removed the schema it claims to, not merely reverted row values.
8. **Forward again.** `forward.sql` re-applied. Result: **all 7 statement batches returned
   `"success": true`**. `verify.sql` run a third time reproduced step 5's results exactly:
   `events_count`/`series_count` both 4, `orphan_series_id` 0, no duplicate `(season, slug)` rows,
   `bad_season` 0, the same schema text, `undated_count` 1.
9. Scratch persistence directory deleted.

No error at any step outside the expected step-7 schema-absence error. Every check resolved to
its expected value.

## Live apply sequence (for the orchestrator)

In order, after this migration's SQL has been reviewed:

```sh
# 1. Apply forward.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0035_event_series/forward.sql

# 2. Verify structurally: one series per row, no orphans, no duplicate (season, slug), a plausible season, the new schema, the undated count.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0035_event_series/verify.sql)"

# 3. Confirm the row count and undated split match the pre-migration read exactly (12 rows, 0 undated).
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS total, SUM(CASE WHEN start_date IS NULL THEN 1 ELSE 0 END) AS undated FROM events;"
```

Both public queries this migration's `season` column feeds (`src/theme/events-data.ts`,
`src/theme/season-data.ts`) change in task 3; re-read `/events` after the live apply, since a
`season` derivation gone wrong shows up there as a blank or short page.

This repo applies `asc-club` migrations by `wrangler d1 execute --remote --file`; there is no
`wrangler d1 migrations` usage anywhere in it and none is introduced here.
