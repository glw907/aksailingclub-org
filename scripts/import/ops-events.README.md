# ops-events: import asc-ops.events into asc-club.events

## What this does

Reads every row of the read-only `asc-ops` database's `events` table (bound as
`EVENTS_DB`, never altered by this or any other script) and upserts it into `asc-club`'s
`events` table (bound as `CLUB_DB`) by natural key: asc-ops's own `slug` becomes both the
`id` and the `slug` of the asc-club row, since it is already stable and unique. Re-running
is safe: a row whose mapped columns already match is skipped, a row that differs is
updated, and no row is ever duplicated.

## Field mapping

| asc-club `events` column | asc-ops `events` source | Notes |
|---|---|---|
| `id` | `slug` | reused as the primary key; asc-ops's own numeric id is not carried forward, kept only in the audit trail for provenance |
| `title` | `title` | verbatim |
| `slug` | `slug` | verbatim |
| `category` | `event_type` | mapped: `regatta`→`racing`, `work_party`→`operations`, `social`→`social`, `meeting`→`governance`. An unmapped `event_type` fails the script loudly rather than defaulting silently. |
| `short_description` | `short_description` | verbatim |
| `long_description` | `long_description` | verbatim |
| `start_date` / `start_time` / `end_date` / `end_time` | same | verbatim, nullable |
| `location` | `location` | verbatim |
| `hero_image` / `hero_image_alt` / `thumbnail_image` | same | verbatim (filenames only; pulling the bytes into the media library is a separate pass, per `docs/events-manifest.md`'s #8) |
| `visible` | `visible` | verbatim |
| `created_at` / `updated_at` | same | preserved verbatim as genuine historical timestamps, not the import moment |

Two asc-ops columns intentionally do not carry forward, because asc-club's `events` table
has no matching column:

- `registration_url`: every live event row is `NULL` in asc-ops anyway (only classes ever
  carry an external registration link); asc-club's `events` schema has no such column.
- `date_history`: a display-only sort/bucket fallback the public events page currently
  reads for month grouping when `start_date` is unset. Not part of the new admin data
  model; the asc-site cutover (plan Task 9) decides how the site sources month bucketing
  without it.

## Audit trail

Every insert or update is audited: `actor='import:ops'`, `action='import.insert'` or
`'import.update'`, `entity='event'`, `entity_id=<the asc-club id>`, `detail` carrying the
run's batch id (`ops-events-<UTC timestamp>`) and the asc-ops source id. Every run, even a
complete no-op, also audits one `action='import.batch'` summary row (`entity_id=NULL`)
recording the source count and the inserted/updated/unchanged totals, so the run itself is
never unaudited even when nothing changed.

## How to run

```sh
node scripts/import/ops-events.mjs --dry-run   # prints the planned SQL, executes nothing
node scripts/import/ops-events.mjs             # applies it to the real asc-club
```

Needs `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and
network access to the real `asc-ops` and `asc-club` databases; both are always `--remote`,
there is no local-D1 mode for this script.

## Verify

```sh
VERIFY_SQL=$(grep -v '^--' scripts/import/ops-events.verify.sql | grep -v '^\s*$')
npx wrangler d1 execute asc-club --remote --command "$VERIFY_SQL"
```

Expect 12 rows total, the category distribution in `ops-events.verify.sql`'s own header
comment, and the three spot-checked rows matching asc-ops exactly.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file scripts/import/ops-events.rollback.sql
```

Removes every event row this importer has ever created, in full (see the rollback file's
own header for why this is not scoped to a single run's batch id). Only safe before any
later pass (the events admin screens, Task 5) has written real edits into these rows; once
real admin edits exist, a full rollback would discard them too.
