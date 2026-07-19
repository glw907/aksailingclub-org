# asc-club migration 0032: signature uniqueness

## What this does

Adds two **partial** unique indexes to `waiver_acceptances` (0029):

- `uq_waiver_acceptances_personal` on `(document_id, season, member_id) WHERE minor_member_id IS
  NULL` -- a personal signature is unique per document/season/signer.
- `uq_waiver_acceptances_minor` on `(document_id, season, minor_member_id) WHERE minor_member_id
  IS NOT NULL` -- a minor's Part Two is unique per document/season/child, matching
  `signatureExists`'s own minor lookup (the match is on the minor alone, so `member_id` is never
  part of this index).

This is a fix from the member-waivers pass close reviewer fan-out: `signatures.ts`'s
`recordSignature` guards a double submit with a check-then-insert (`signatureExists`, a plain
SELECT, then a separate INSERT) and had no real constraint backing it. Two concurrent requests for
the same signing act (a double-clicked Sign button, the same resumption deep-link opened in two
tabs, an `enhance` retry) could both pass the SELECT before either INSERT landed, leaving two rows
for what should be one signature -- permanent duplicate legal evidence. `recordSignature`'s own
INSERT now runs `ON CONFLICT DO NOTHING` and reads zero `changes` as the same clean no-op the
prior SELECT already returned, so this migration turns a real race into a refusal the code already
handles, the same shape `0004_waitlist_integrity` established for `class_waitlist`.

## Why two partial indexes, not one plain unique index

A single `UNIQUE(document_id, season, member_id)` would incorrectly block an adult who signs Part
Two for two different children in the same season: `recordSignature` binds the signing adult's own
`member_id` on every row, including Part Two rows, so two Part Two signatures for two different
kids would collide on the SAME `(document_id, season, member_id)` triple even though they are
different signing acts covering different children. Splitting the index on `minor_member_id IS
[NOT] NULL` keeps personal rows unique against each other and minor rows unique against each other,
with no cross-shape collision (SQLite's partial-index `WHERE` clause makes a row invisible to an
index it doesn't match).

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0032_signature_uniqueness/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0032_signature_uniqueness/verify-forward.sql)"
```

Expect two rows: `uq_waiver_acceptances_minor`, `uq_waiver_acceptances_personal`.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0032_signature_uniqueness/rollback.sql
```

Safe any time: dropping an index never discards data.

## Scratch-proof procedure

Per the repo's standing migration discipline:

1. Fresh, disposable `--persist-to` directory, distinct from the repo's own `.wrangler/` state.
2. Apply `0001` through `0032` in order, `--local --persist-to <scratch dir>`.
3. **Verify**: run `verify-forward.sql`; expect both index names.
4. **Constraint proof**: insert a personal signature row, then a second row with the same
   `document_id`/`season`/`member_id` and `minor_member_id IS NULL`; confirm the second is
   rejected with `SQLITE_CONSTRAINT_UNIQUE`. Insert a Part Two row for one child, then a second
   Part Two row for a DIFFERENT child under the same adult's own `member_id`; confirm it is
   ACCEPTED (the two-partial-index design's own point). Insert a second Part Two row for the SAME
   child (a different signing adult's own `member_id`, matching `signatureExists`'s "any adult's
   election satisfies the child's requirement"); confirm it is rejected too.
5. **Rollback**: apply `rollback.sql`; confirm no error and every inserted row survives.
6. **Verify-rollback**: run `verify-rollback.sql`; expect zero rows.
7. **Forward again**: re-apply `forward.sql`; confirm no error.
8. Delete the scratch persistence directory.

See the task report for the full transcript.
