# asc-club migration 0036: `events` indexes and the date-shape decision

## What this does

The events-admin build pass's reviewer fan-out (`docs/plans/2026-08-22-events-admin.md`; the fix
brief's "Migration (commit A)" section) asked for two indexes:

1. **`idx_events_series_season` (UNIQUE, `series_id, season`)** enforces "at most one `events` row
   per series per season" at the database layer. Today that invariant lives only in application
   code: `linkEventToSeries`'s own conflict `SELECT` before a move, and `rollForwardSeason`'s
   `NOT EXISTS` guard on the insert. Both callers keep working exactly as before; the index is a
   backstop against a bug or a future write path that skips one of those checks.
2. **`idx_events_slug_season` (`slug, season DESC`)** covers the slug lookup task 3's
   `EVENT_BY_SLUG_QUERY` already performs (`... WHERE slug = ?1 ORDER BY season DESC LIMIT 1`),
   the public `/events/{slug}` and `.ics` route's own read.

## Why no recreate, and no CHECK constraint

The security review that produced this fix round also asked for a date-shape backstop:
`start_date`/`end_date`/`start_time`/`end_time` as real `YYYY-MM-DD` / `HH:MM` strings, not
arbitrary text a form could otherwise post. Adding a `CHECK` to an *existing* column needs the
same recreate-and-copy technique `0035_event_series` used, because SQLite has no `ALTER TABLE ...
ADD CONSTRAINT`. This migration deliberately avoids that: a bare `CREATE INDEX` needs no table
copy at all, "prefer no recreate" from the fix brief wins, and the two indexes above are genuinely
independent of the CHECK question.

The date-shape rule is enforced in code instead: `parseEventForm`
(`src/routes/admin/club/events/event-form-input.ts`) validates `startDate`/`endDate` against the
`YYYY-MM-DD` pattern and `startTime`/`endTime` against `HH:MM` before either ever reaches a write
(the same fix round's "Input and actions" section). That is a strictly narrower guarantee than a
database `CHECK` -- it only holds while every write goes through the row form's own action, never
against a hand-run `UPDATE` -- but every write to `events.start_date`/`end_date`/`start_time`/
`end_time` in this codebase already does go through that one parser (`save` and `create` both
call it; `setDate`/`rollForwardSeason` write dates the store itself derives or nulls, never
free-form user text), so the code-side rule covers every real path. A future migration can add
the `CHECK` via a proper recreate if this ever needs a harder guarantee (e.g. a script that writes
`events` directly).

## Live pre-migration state (confirmed 2026-08-22, `--remote` read-only)

```
events: 12 rows total
Duplicate (series_id, season) pairs: none
```

Read with:

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT series_id, season, COUNT(*) FROM events GROUP BY 1,2 HAVING COUNT(*) > 1"
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS n FROM events;"
```

No live row is at risk of violating the new `UNIQUE (series_id, season)` index; each of the 12
live events belongs to its own single-row series (confirmed by the empty result above), the
expected state since `0035_event_series`'s own live apply record shows every row landed as its
own series with no roll-forward having run yet.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0036_event_indexes/forward.sql
```

**Not run against the live database by this task.** The conductor applies it after the SQL has
been reviewed, the same boundary `0034_asset_type_ids/README.md` and
`0035_event_series/README.md` both record.

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0036_event_indexes/verify.sql)"
```

Expect: query 1 no rows (no series holds two rows in the same season); query 2 both index names
(`idx_events_series_season`, `idx_events_slug_season`); queries 3-8 reproduce
`0035_event_series/verify.sql`'s own six expected answers unchanged (`events_count` ==
`series_count`, `orphan_series_id` 0, no duplicate `(season, slug)`, `bad_season` 0, the unchanged
`events` schema text, `undated_count` matching the live pre-migration read) -- this migration adds
no columns and touches no rows, so nothing about 0035's own invariants moves.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0036_event_indexes/rollback.sql
```

Drops both indexes. No row data changes either direction, so this rollback carries none of
`0035`'s "safe only before the first roll-forward" precondition -- it is safe to run at any time,
including after a roll-forward has created a second season's copy of a series, since a plain
`DROP INDEX` never touches row data.

## Scratch-proof procedure

Run entirely against a local, disposable D1 replica (`--persist-to` distinct from the repo's own
`.wrangler/` state), never a real Cloudflare-hosted scratch database.

1. **Fresh persistence directory**, distinct from the repo's `.wrangler/` state.
2. **Applied migrations `0001` through `0035` in order**, one `wrangler d1 execute --local
   --persist-to <scratch dir> --file <dir>/forward.sql` invocation per migration. Result: **every
   migration returned `"success": true`**.
3. **Seeded one series with two seasons' rows** (`series-regatta`: `regatta-2026` at season 2026,
   `regatta-2025` at season 2025 -- distinct seasons, so no conflict), reproducing the live shape
   where a series can legitimately hold rows across seasons. Result: **all seed statements
   returned `"success": true`**.
4. **Forward.** `forward.sql` applied. Result: **all 3 statement batches returned `"success":
   true`**.
5. **Confirmed the UNIQUE index actually rejects a real duplicate**: attempted `INSERT INTO
   events (..., series_id, season, ...) VALUES (..., 'series-regatta', 2026, ...)` (a second row
   for the same series in the same season as the existing `regatta-2026`). Result: **rejected**,
   `UNIQUE constraint failed: events.series_id, events.season: SQLITE_CONSTRAINT (extended:
   SQLITE_CONSTRAINT_UNIQUE)`.
6. **Verify.** `verify.sql` run. Result:
   - Query 1: no rows (no duplicate `(series_id, season)`).
   - Query 2: `idx_events_series_season`, `idx_events_slug_season`, both present.
   - Query 3: `events_count` 2, `series_count` 1 (one series, its two legitimate seasonal rows).
   - Query 4: `orphan_series_id` 0.
   - Query 5: no rows (no duplicate `(season, slug)`).
   - Query 6: `bad_season` 0.
   - Query 7: the unchanged `events` schema (`series_id`, `season`, `UNIQUE (season, slug)`, no
     column-level `UNIQUE` on `slug` -- 0035's own shape, untouched).
   - Query 8: `undated_count` 0.
7. **Rollback.** `rollback.sql` applied. Result: **both `DROP INDEX` statements and the audit
   insert returned `"success": true`**.
8. **Verify-after-rollback.** `verify.sql` run again (same file). Result: query 1 still no rows
   (row data untouched); **query 2 returns no rows** (both indexes gone, the expected proof that
   rollback actually removed them); queries 3-8 reproduce step 6's results exactly (row data was
   never touched by either direction).
9. **Forward again.** `forward.sql` re-applied. Result: **all 3 statement batches returned
   `"success": true`**. `verify.sql` run a third time reproduced step 6's results exactly,
   including both index names present again.
10. Scratch persistence directory deleted.

No error at any step outside the expected step-5 constraint-violation error (itself the proof the
index enforces what it claims to) and the expected step-8 empty-index-list result. Every other
check resolved to its expected value.

## Live apply sequence (for the orchestrator)

In order, after this migration's SQL has been reviewed:

```sh
# 1. Apply forward.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0036_event_indexes/forward.sql

# 2. Verify: no duplicate (series_id, season), both index names present, 0035's own six checks unchanged.
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0036_event_indexes/verify.sql)"

# 3. Confirm the row count is still 12 (this migration writes no events row).
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS n FROM events;"
```

This repo applies `asc-club` migrations by `wrangler d1 execute --remote --file`; there is no
`wrangler d1 migrations` usage anywhere in it and none is introduced here.

## Live apply record (2026-08-22, conductor)

Applied after the scratch proof and the read-only duplicate check above. `forward.sql` is now
the record of what ran and must not be edited. Pre-apply: no duplicate `(series_id, season)`
pair. Post-apply verify: both indexes present in `sqlite_master`; the 0035 checks unchanged
(12 events, 12 series, 0 orphans, no duplicate `(season, slug)`, 0 bad seasons, 0 undated).
