# asc-club migration 0029: the signature record

## What this does

Evolves `waiver_acceptances` (the gap-analysis rider, `0001_substrate`) into the full signature
record `docs/2026-07-17-member-waivers-design.md`'s "The signature record" and "Minors" sections
require (member-waivers T2). A standard SQLite recreate-and-copy (`0006_offer_cascade_on_waitlist_delete`,
`0022_join_emails`, `0028_boats_model` all use the identical pattern in this directory), since
SQLite/D1 cannot alter a `CHECK`, rename a column, or relax `NOT NULL` in place.

The new columns:

| Column | Type | Notes |
| --- | --- | --- |
| `document_id` | `TEXT` | The signed document's stable id, matching `$theme/documents.ts`'s `DocumentFrontmatter.document`. Not a DB foreign key -- documents live as repo markdown, not a table. |
| `version` | `INTEGER` | That document's own version number at signing. |
| `season` | `INTEGER` | The season signed for. |
| `kind` | `TEXT` | `'release'` \| `'acknowledgement'` \| `'agreement'`, mirroring `DocumentKind`. |
| `content_hash` | `TEXT` | SHA-256 hex digest of the exact text presented (`CHECK (length(content_hash) = 64)`). |
| `content_snapshot` | `TEXT` | The full text presented, verbatim. |
| `waiver_version` | `TEXT`, now nullable | The pre-T2 global wording-version string (`$theme/waiver-text.ts`); historical only, superseded by `document_id`/`version`/`season`. |
| `signed_at` | `TEXT NOT NULL` | Renamed from `accepted_at` (same default, same values); neither existing write site names the column explicitly, so the rename is invisible to them. |
| `ip_address` | `TEXT` | The signer's IP at signing. |
| `member_id` | `TEXT` REFERENCES `members(id)` | The authenticated signer. |
| `auth_token_id` | `TEXT` REFERENCES `member_tokens(id)` | The magic-link token backing the signing session. |
| `auth_issued_at`, `auth_consumed_at` | `TEXT` | Snapshots of that token row's own `created_at`/`consumed_at` at signing time, so the record stands on its own even if the token row is later pruned. |
| `build_hash` | `TEXT` | The frontend build hash at sign time. |
| `signer_relationship` | `TEXT` | A parent's attested AS 09.65.292(c) relationship to a minor: `'parent'`, `'legal-guardian'`, `'agency-representative'`, `'power-of-attorney'`, `'qualifying-relative'`. |
| `minor_member_id` | `TEXT` REFERENCES `members(id)` | The minor signed for; name and birthdate resolve via this FK, per the spec (`members` already carries `birthdate`). |

`context`'s `CHECK` widens from `('class-signup', 'join')` to also accept `'renewal'`,
`'mooring-fee'`, `'storage-fee'`.

Every new column is nullable: none has a legacy counterpart, so no old row can populate it (the
task's own instruction). The five original columns (`id`, `person_name`, `person_email`,
`context`, `signed_at`) keep their exact values across the recreate; see `forward.sql`'s header
comment for the full column-by-column mapping.

## Why the recreate carries no data risk today

The live `asc-club` `waiver_acceptances` table was confirmed empty immediately before this
migration was written:

```
$ npx wrangler d1 execute asc-club --remote --command "SELECT COUNT(*) AS n, context FROM waiver_acceptances GROUP BY context"
[{"results": [], "success": true, ...}]
```

Zero rows, zero groups. The `INSERT ... SELECT` copy step is still written for correctness
against any row count (a scratch-proof against a non-empty table is part of this task's own
proof, below), not because today's copy has anything to reconcile.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0029_signature_record/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0029_signature_record/verify-forward.sql)"
```

Expect the 20-row column/notnull listing, `context_widened: 1`, and `row_count: 0` (see above).

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0029_signature_record/rollback.sql
```

Safe only before any real signature carries a widened `context` value or a NULL `waiver_version`
-- see `rollback.sql`'s own header.

## Scratch-proof procedure

Per the repo's standing migration discipline:

1. Create a fresh, disposable `--persist-to` directory, distinct from the repo's own `.wrangler/`
   state.
2. Apply migrations `0001` through `0029` in order, `--local --persist-to <scratch dir>`.
3. Insert a synthetic pre-migration-shaped row directly (bypassing the app), then re-run this
   migration's own `forward.sql` a second time is not meaningful (migrations are one-shot); instead
   insert one row via the OLD shape before running `0029`, to prove the copy step actually carries
   data across, not just an empty table.
4. **Verify**: run `verify-forward.sql`; expect the column/notnull listing, `context_widened: 1`,
   and the synthetic row present with `row_count: 1`, its `person_name`/`person_email`/`context`/
   `waiver_version`/`signed_at` intact and every new column NULL.
5. **Constraint proofs**: attempt each documented `CHECK` violation directly (a bad `context`, a
   bad `kind`, a bad `signer_relationship`, a `content_hash` of the wrong length) and confirm each
   is rejected; confirm a `context` value from the new vocabulary (`'renewal'`) is accepted.
6. **Rollback**: apply `rollback.sql`; confirm no error, and the synthetic row survived with its
   five legacy columns intact.
7. **Verify-rollback**: run `verify-rollback.sql`; expect the original five-column shape,
   `context_widened: 0`, `row_count: 1`.
8. **Forward again**: re-apply `forward.sql`; confirm no error (this is the "forward, verify,
   rollback, verify-rollback, forward again" cycle the task requires).
9. Delete the scratch persistence directory.

See the task report for the full transcript.
