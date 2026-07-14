# asc-club migration 0022: join emails

## What this does

Two independent changes, both required for the unified-signup initiative's `join` payment kind
(`docs/2026-07-13-unified-signup-design.md`) to work against real D1:

1. Widens `processed_stripe_sessions.kind`'s CHECK constraint from
   `('dues','class-fee','asset-fee')` to `('dues','class-fee','asset-fee','donation','join')`,
   via the standard SQLite recreate-and-copy (`0006_offer_cascade_on_waitlist_delete`'s own
   README already establishes this pattern for this exact table; SQLite cannot `ALTER` a CHECK
   constraint in place).
2. Seeds two `email_templates` rows: `join_welcome` (member-facing) and `board_join_notice`
   (an internal FYI to the board), the two sends `reconcileJoin`
   (`src/admin-club/lib/stripe-reconcile.ts`) makes on a fresh join reconciliation.

## Why the CHECK widening rides along here

`processed_stripe_sessions.kind` (migration 0014) has only ever accepted `('dues','class-fee',
'asset-fee')`. `payments.ts`'s `PAYMENT_KINDS` grew a fourth kind, `donation`, in the
money-ledger initiative (migration 0021) -- `reconcileDonation` has been inserting
`kind='donation'` into this table ever since, which is a live CHECK-constraint violation against
real (remote) D1 that nobody has scratch-proven: `fakeD1`, the only harness this repo's unit
tests run against, enforces no CHECK constraint at all (the same blind spot
`0004_waitlist_integrity`'s and `0006`'s own READMEs already name for the identical gap on `FK`
constraints). `PAYMENT_KINDS` now grows a fifth kind, `join` (this task), which would hit the
identical wall. Rather than leave two gaps open (one pre-existing, one this task would add),
this migration widens the CHECK once to cover both.

## Why the two templates seed here

`join_welcome` carries the member's front door into the portal right after a successful join or
welcome-back payment (tier, season, class-credit status if any, a link to `/my-account`, a link
to `/discord-server/`). `board_join_notice` is the design's ruling 5 ("the board is notified of
each join; it never sits in the path") -- an internal, no-action-needed FYI sent to
`board@aksailingclub.org`, the same fallback address `payments.ts`'s and `enrollments.ts`'s own
copy already names. Both follow `INSERT OR IGNORE` (migration 0014's own idempotent-seed
convention: a re-run changes nothing already there, and an owner who has since edited the
wording keeps their edit), then a two-step `default_subject`/`default_body` backfill matching
migration 0016's own shape (guarded `WHERE default_subject = ''`, so a re-run or a since-edited
row is never clobbered).

## How to run

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0022_join_emails/forward.sql
```

## Verify

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0022_join_emails/verify.sql
```

Expect `kind_sql`'s text to contain both `'donation'` and `'join'`, both `*_present` counts to
read `1`, and both `*_defaults_match` flags to read `1`.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0022_join_emails/rollback.sql
```

Safe only before any real session has recorded a `donation` or `join` row in
`processed_stripe_sessions` (those rows would be silently dropped by the narrowing recreate) and
before the Email edit screen's own reset action has ever run against either seeded template (the
same caveat migration 0016's own rollback documents).

## Scratch-proof procedure (conductor-performed, not part of this task)

Per the repo's standing migration discipline:

1. `npx wrangler d1 create asc-club-scratch-0022`.
2. Apply migrations 0001 through 0021 in order to reach the current live schema.
3. **Forward**: apply `forward.sql`; confirm no error.
4. **Verify**: run `verify.sql`; expect the values this file's own header documents.
5. **Rollback**: apply `rollback.sql`; confirm the CHECK narrows back and both templates are
   gone.
6. **Verify-empty**: re-run the `email_templates` verify queries; expect both `*_present` counts
   to read `0`.
7. `npx wrangler d1 delete asc-club-scratch-0022`.

Only after this proof succeeds does the conductor apply `forward.sql` to the live `asc-club` and
run `verify.sql` against it.
