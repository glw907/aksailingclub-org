# asc-club migration 0033: the standing data tier

## What this does

Lands the Members pass's T2 (`docs/plans/2026-07-20-members-pass.md`,
`docs/2026-07-20-members-pass-design.md`'s "Standing vocabulary and the data tier"): the
member-standing vocabulary becomes three states -- Current, Overdue, Former -- replacing
current/grace/lapsed. Overdue keeps full member benefits (portal, member pricing, class access)
until Former; Former is the reminder sequence's own stated-final touch (`30_after`, 30 days past
the household's own rolling renewal boundary) ending without payment.

Adds two nullable columns to `households`:

- `former_at TEXT` -- when the household most recently transitioned to Former, `NULL` while
  Current or Overdue.
- `former_source TEXT CHECK (former_source IN ('sequence', 'manual'))` -- `'sequence'` for the
  daily renewal-reminders sweep's own mark (auto-cleared once a new payment moves the household's
  boundary back into the future); `'manual'` for the household desk's own override (T3; never
  auto-cleared by the sweep, only by another manual clear).

Then backfills: every household whose own most recently paid, non-refunded `memberships` row is
already past its renewal boundary plus 30 days at migration-apply time is marked Former now,
`former_source = 'sequence'` -- exactly what the daily sweep would mark on its own first
post-deploy tick, computed once here instead of waiting a day. A household with no paid row at
all, or one still within the 30-day window (Overdue, full benefits), is left alone.

The Former transition is RECORDED, not re-derived from a time window on every read (the design
doc's own ruling): `src/member-auth/lib/standing.ts`'s `classifyHouseholdStanding` is the one
exported classifier every consumer calls, and it reads `former_at` directly rather than
re-computing a grace-window cutoff. `renewal_grace_days` (the `settings` row `getRenewalGraceDays`
reads, migration `0009_member_auth`) is deliberately NOT touched by this migration -- see
"Why `renewal_grace_days` survives this migration" below.

## Why `renewal_grace_days` survives this migration

This task's own dispatch constraint bans a live/remote D1 write and requires the currently
DEPLOYED (pre-pass) worker to keep working unmodified until the pass closes. The deployed
worker's own `standing.ts` still reads `getRenewalGraceDays` for its grace-window math, and three
files outside this task's scope (`src/admin-club/lib/segments.ts`,
`src/admin-club/lib/households-store.ts`, `src/admin-club/lib/announcements.ts` -- the Members
pass's own T3 "consumer sweep") read it directly too. Dropping the `renewal_grace_days` `settings`
row now would not break those readers outright (`getRenewalGraceDays` falls back to its own
`DEFAULT_RENEWAL_GRACE_DAYS = 30` when the row is missing), but it WOULD silently discard whatever
value an admin may have actually configured via the Settings screen, changing behavior for code
this migration is not the one updating. The setting retires once every reader has moved off the
grace vocabulary (T3, then T8's pass close), in its own migration, not folded into this additive
one.

This migration is otherwise 100% additive (two nullable `ALTER TABLE ADD COLUMN`s plus a backfill
`UPDATE` into those same new columns): nothing here removes or renames anything the deployed
pre-pass code reads.

## Why the backfill's boundary is `+1 year, +30 days`, not `renewal_grace_days`

30 days is the reminder sequence's own fixed `30_after` touch offset
(`src/jobs/renewal-reminders.ts`'s `TOUCH_OFFSET_DAYS`), which is what actually now decides the
Former transition per the design doc's ruling ("the reminder sequence is the boundary") -- not the
separately-configurable `renewal_grace_days` setting, which this migration deliberately keeps
untouched but no longer drives this transition. The two happen to share the same default (30)
today; a future change to `renewal_grace_days` would no longer affect the Former boundary once
every module has moved onto the sequence-driven design.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0033_member_standing/forward.sql
```

**Not run against the live database by this task** -- see "Scratch-proof procedure" below.

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0033_member_standing/verify-forward.sql)"
```

Expect two column names (`former_at`, `former_source`), then a Current/Overdue/Former/None
breakdown to spot-check against known households.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0033_member_standing/rollback.sql
```

Safe only before any real Former transition (sequence or manual) has been recorded and relied on
elsewhere; a rollback after that point discards that history, not just structure.

## Scratch-proof procedure

Per the repo's standing migration discipline, and per this task's explicit ban on any `--remote`
write, this migration's scratch proof runs entirely against a local, disposable D1 replica (a
`--persist-to` directory distinct from the repo's own `.wrangler/` state), never a real
Cloudflare-hosted scratch database:

1. Create a fresh persistence directory.
2. Apply migrations `0001` through `0033` in order, `--local --persist-to <scratch dir>`.
3. **Forward** already ran as step 2's last file; confirm no error.
4. **Verify**: run `verify-forward.sql` against the scratch replica; expect the two column names
   and a standing breakdown (all `'none'` or `'current'` on a fresh scratch replica with no
   `memberships` rows seeded).
5. **Backfill proof**: insert a synthetic household plus a paid `memberships` row dated well past
   the boundary (`paid_at` more than 395 days in the past), re-run `forward.sql`'s own `UPDATE`
   statement directly, and confirm that household's `former_at`/`former_source` land as expected;
   insert a second household whose `paid_at` is only 10 days past the boundary and confirm it is
   NOT marked (still Overdue, full benefits).
6. **Rollback**: apply `rollback.sql`; confirm no error, and that the synthetic rows above still
   exist (only the two columns are gone).
7. **Verify-rollback**: run `verify-rollback.sql`; expect no rows.
8. **Forward again**: re-apply `forward.sql`; confirm no error.
9. Delete the scratch persistence directory.

Applying `forward.sql` to the live `asc-club` database, and reporting its real
former/overdue/current/none counts against the live 149 households, is a later gated step (per
this task's own dispatch constraint), not part of this task.
