# asc-club migration 0003: class images

## What this does

Adds two nullable columns, `classes.hero_image` and `classes.hero_image_alt`, matching the
shape `events` has carried since 0001_substrate. Nothing else changes.

## Why this is here

Task 9 of the pass 2.1 plan repointed the public events/season read from asc-ops
(`EVENTS_DB`) to asc-club (`CLUB_DB`). The ratified `classes` table never carried an image
pair, so `$theme/events-data.ts`'s `CLASSES_QUERY` had to select a literal `NULL` for both
fields, and the five imported classes' cards lost the photography the live site's own
layout carries. Geoff's ruling was that the events page preserves live's shape including
per-event photography, so this is a regression, not an accepted gap. This migration is the
schema half of the fix; `scripts/import/ops-classes-images.mjs` is the data half.

## How to run

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0003_class_images/forward.sql
```

## Verify

```sh
npx wrangler d1 execute asc-club --remote --command "$(cat migrations/asc-club/0003_class_images/verify.sql)"
```

Expect two rows: `hero_image | TEXT | 0` and `hero_image_alt | TEXT | 0` (both nullable).

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0003_class_images/rollback.sql
```

Safe any time before the backfill or a later admin edit has written a real value into
either column (see `rollback.sql`'s own header).
