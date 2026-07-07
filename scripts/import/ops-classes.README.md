# ops-classes: import asc-ops.classes into asc-club.classes

## What this does

Reads every row of the read-only `asc-ops` database's `classes` table (bound as
`EVENTS_DB`, never altered by this or any other script) and upserts it into `asc-club`'s
`classes` table (bound as `CLUB_DB`) by natural key: asc-ops's own text `id` (e.g.
`1st_adult_teen_intro`) is already stable and unique, so it carries straight over.
Re-running is safe: a row whose mapped columns already match is skipped, a row that
differs is updated, and no row is ever duplicated.

## Field mapping

| asc-club `classes` column | asc-ops `classes` source | Notes |
|---|---|---|
| `id` | `id` | verbatim reuse |
| `season` | n/a | read from asc-club's own `settings.current_season` at run time (2026 as of this import), not hardcoded |
| `name` | `name` | verbatim |
| `slug` | `slug` | verbatim |
| `track` | derived from `name` | asc-ops has no age-track field. `/youth/i` in the name → `'youth'`, else → `'adult-teen'`. Every live row names itself explicitly except Fleet Tune-Up Weekend (open to any member, no age restriction stated), which lands on the `'adult-teen'` default: this script's own documented judgment call, not real source data. |
| `capacity` | n/a | asc-ops has no capacity column (MembershipWorks managed the real registration limit externally). Every row imports with a placeholder default of **10**; confirm or edit the real cap once the classes admin screen (plan Task 6) lands, since fullness derives from this value. |
| `fee` | `fee` | every live asc-ops row is `NULL` (MembershipWorks handled the actual charge externally); imports as **0**, the schema's `NOT NULL` floor, not a real price. |
| `start_date` / `end_date` | same | verbatim, including the known data-quality anomaly on `2nd_adult_teen_intro` (`end_date: '2016-07-12'`, eighteen years off `start_date`, already recorded in `docs/events-integration-findings.md`): imported unfixed, per the read-only-source precedent. |
| `location` | `location` | verbatim |
| `description` | `short_description` + `long_description` | asc-club merges the two into one field; both are kept, joined by a blank line, rather than dropping either. |
| `instructor_notes` | n/a | `NULL`; asc-ops has no equivalent field, this is new forward-only admin data. |
| `visible` | `visible` | verbatim |
| `created_at` / `updated_at` | same | preserved verbatim as genuine historical timestamps, not the import moment |

Two asc-ops columns intentionally do not carry forward, because asc-club's `classes`
table has no matching column: `registration_url` and `registration_status`. Registration
is now the internal enrollment/waitlist/offer machine (plan Tasks 6/7), not an external
MembershipWorks link or a stored status column.

## Audit trail

Every insert or update is audited: `actor='import:ops'`, `action='import.insert'` or
`'import.update'`, `entity='class'`, `entity_id=<the asc-club id>`, `detail` carrying the
run's batch id (`ops-classes-<UTC timestamp>`) and the asc-ops source id. Every run, even
a complete no-op, also audits one `action='import.batch'` summary row (`entity_id=NULL`)
recording the source count and the inserted/updated/unchanged totals, so the run itself is
never unaudited even when nothing changed.

## How to run

```sh
node scripts/import/ops-classes.mjs --dry-run   # prints the planned SQL, executes nothing
node scripts/import/ops-classes.mjs             # applies it to the real asc-club
```

Needs `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and
network access to the real `asc-ops` and `asc-club` databases; both are always `--remote`,
there is no local-D1 mode for this script.

## Verify

```sh
VERIFY_SQL=$(grep -v '^--' scripts/import/ops-classes.verify.sql | grep -v '^\s*$')
npx wrangler d1 execute asc-club --remote --command "$VERIFY_SQL"
```

Expect 5 rows total, the track distribution in `ops-classes.verify.sql`'s own header
comment, and the three spot-checked rows matching asc-ops exactly (including the
unfixed `2016-07-12` anomaly).

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file scripts/import/ops-classes.rollback.sql
```

Removes every class row this importer has ever created, in full (see the rollback file's
own header for why this is not scoped to a single run's batch id). Only safe before any
later pass (the classes admin screens, Task 6) has written real edits into these rows;
once real admin edits exist, a full rollback would discard them too.
