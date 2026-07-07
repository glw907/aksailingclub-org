# ops-classes-images: backfill hero_image/hero_image_alt onto asc-club.classes

## What this does

`ops-classes.mjs` ran before migration `0003_class_images` added `classes.hero_image` and
`classes.hero_image_alt` to asc-club, so those two columns never carried forward from
asc-ops. This backfill closes that gap: it reads `asc-ops.classes` (bound as `EVENTS_DB`,
never altered by this or any other script) and copies the two columns verbatim onto the
matching `asc-club.classes` row (bound as `CLUB_DB`), keyed by the same natural `id`
`ops-classes.mjs` already established. Re-running is safe: a row whose two columns already
match is skipped, a row that differs is updated, and a source row with no matching
`asc-club` row (which should not happen, since `ops-classes.mjs` always runs first) is
counted as `missing` and left alone rather than guessed at.

## Field mapping

| asc-club `classes` column | asc-ops `classes` source | Notes |
|---|---|---|
| `hero_image` | `hero_image` | verbatim; `NULL` on Fleet Tune-Up Weekend, the one live class with no photo in asc-ops itself (see `docs/events-manifest.md`'s "Per-event images" section) |
| `hero_image_alt` | `hero_image_alt` | verbatim |

No new media upload is needed: the four real filenames this backfill copies
(`adult-intro-class-1.jpg`, `adult-intro-class-2.jpg`, `youth-intro-class-1.jpg`,
`youth-intro-class-2.jpg`) were already pulled into the site's media library by the
original events-photography migration, and `$theme/event-images.ts`'s
`EVENT_IMAGE_TOKENS` already maps every one of them to its media token.

## Audit trail

Every update is audited: `actor='import:ops-classes-images'`, `action='import.update'`,
`entity='class'`, `entity_id=<the asc-club id>`, `detail` carrying the run's batch id
(`ops-classes-images-<UTC timestamp>`) and the two changed columns. Every run, even a
complete no-op, also audits one `action='import.batch'` summary row (`entity_id=NULL`)
recording the source count and the updated/unchanged/missing totals.

## How to run

```sh
node scripts/import/ops-classes-images.mjs --dry-run   # prints the planned SQL, executes nothing
node scripts/import/ops-classes-images.mjs             # applies it to the real asc-club
```

Needs `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and
network access to the real `asc-ops` and `asc-club` databases; both are always `--remote`,
there is no local-D1 mode for this script.

## Verify

```sh
VERIFY_SQL=$(grep -v '^--' scripts/import/ops-classes-images.verify.sql | grep -v '^\s*$')
npx wrangler d1 execute asc-club --remote --command "$VERIFY_SQL"
```

Expect 5 rows total, 4 carrying a real `hero_image`, and the one `NULL` row
(`fleet_tuneup`) matching asc-ops's own documented gap, not a backfill failure.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file scripts/import/ops-classes-images.rollback.sql
```

Clears `hero_image`/`hero_image_alt` back to `NULL` on every class row this backfill has
ever touched (tracked via `audit_log`'s `actor='import:ops-classes-images'` rows), the same
audit-log-scoped reasoning `ops-classes.rollback.sql` documents for its own full-import
rollback. Only safe before a later admin edit (the classes admin's own image field is
read-only this pass, so the only other writer is a re-run of this same script) has changed
either column to something this rollback would wrongly discard.
