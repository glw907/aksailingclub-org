# asc-club migration 0038: per-member club-email opt-in

## What this does

Email + Announce plan (`docs/plans/2026-08-25-email-announce.md`, "Task 1: the audience model").
Adds one column:

```sql
ALTER TABLE members ADD COLUMN club_email_opt_in INTEGER NOT NULL DEFAULT 0;
```

Table shape confirmed against `migrations/asc-club/0005_member_domain/forward.sql`'s
`CREATE TABLE members`, plus the one later column add (`0020_mw_provenance`'s `mw_account_id`).

## Why: the head-of-household audience needs an override

The design contract's ruling 2 (`docs/2026-08-25-email-announce-design.md`) changes who a
membership-wide send reaches: one default recipient per qualifying household rather than every
member of it. The default recipient is the household's `primary_member_id` row when that member
is non-archived and carries an email, and otherwise the household's earliest-created non-archived
member with an email.

That rule alone would give a spouse, an adult child, or a co-owner no way to receive club email.
This column is the override: the member sets it themselves in the portal's Notifications section,
or an admin sets it on the member's row in the household desk. `src/admin-club/lib/segments.ts`'s
audience step reads it as `club_email_opt_in = 1 OR <is the household's default recipient>`.

## Why a column, not a preferences table

Two channels are known (email now, SMS in the `club-notifications` initiative), and the SMS pass
adds `sms` as its own later additive migration. A column per channel keeps every audience query a
plain predicate and keeps the meaning readable in a `SELECT *`; a generic key/value table for two
known keys would be speculative surgery. This is the contract's own "Groundwork for the
notifications pass" decision, taken deliberately rather than by default.

## Why INTEGER NOT NULL DEFAULT 0

SQLite has no boolean type, and every existing flag in asc-club is a 0/1 integer
(`classes.visible`, `classes.drop_in`, `class_enrollments.fee_paid`). Default 0 means the
migration changes nobody's reach on the day it lands: every existing row is opted out, and the
default-recipient rule alone decides who a membership-wide send reaches until members and admins
start setting it.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0038_club_email_optin/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0038_club_email_optin/verify.sql)"
```

Expect: query 1 returns exactly one row for `club_email_opt_in` with `type` `INTEGER`, `notnull`
`1`, and `dflt_value` `"0"`; query 2 returns one row whose `opted_in` is `0` and whose `total` is
the live member count, proving the default landed on every existing row rather than a NULL the
NOT NULL clause would have rejected.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0038_club_email_optin/rollback.sql
```

Dropping the column discards every opt-in a member or an admin has recorded, the same caveat
`0020_mw_provenance/rollback.sql` and `0023_membership_admin/rollback.sql` document for their own
added columns. Unlike `mw_account_id`, there is no committed archive to re-import from: the flag
is a member's own stated preference and exists nowhere else. Safe only before any real opt-in has
been set.

## Scratch-proof procedure (run 2026-08-25, before any live apply)

Run entirely against a local, disposable D1 replica (`--persist-to` a scratchpad directory,
distinct from the repo's own `.wrangler/` state), never a real Cloudflare-hosted scratch database.

1. **Fresh persistence directory**, `--local --persist-to <scratch dir>`.
2. **Migrations 0001 through 0037 applied in order** (combined into one file): every statement
   batch `"success": true`, zero errors.
3. **Seeded** one household with two emailed members plus two `email_log` rows, then four more
   households covering each default-recipient branch (below). All seed statements
   `"success": true`.
4. **Pre-migration probe**: `pragma_table_info('members')` returns no `club_email_opt_in` row,
   confirming the column really is absent before the apply.
5. **`forward.sql`**: **succeeds.**
6. **`verify.sql`**: query 1 returns the one row
   `{ name: club_email_opt_in, type: INTEGER, notnull: 1, dflt_value: "0" }`; query 2 returns
   `{ total: 2, opted_in: 0 }` at that point in the seed, so the NOT NULL default landed on every
   pre-existing row.
7. **Audience-query proof**, the reason this column exists: `segments.ts`'s new audience statement
   run verbatim against the seeded replica resolved every branch of the default-recipient rule in
   one pass.
   - Two-member household, no opt-in: **one row**, the primary, `is_default_recipient` 1.
   - The same household with the non-primary opted in: **both rows**, the primary still the only
     one flagged.
   - Primary archived: **falls back** to the household's earliest-created non-archived emailed
     member (`mem-2c` at `2026-02-01`, not the later `mem-2b` at `2026-03-01`), never drops the
     household.
   - Primary with a NULL email: **falls back** the same way.
   - `primary_member_id IS NULL` with one emailed member: **that member**, flagged default.
   - No emailed member at all, one phone-only member opted in: **that member alone**,
     `is_default_recipient` 0 and `email` null, so it appears in the audience and is dropped by
     the email projection.
8. **A shared email between two members is impossible live**: `members.email` carries a `UNIQUE`
   constraint (0005's own DDL), and the seed attempting it failed with
   `UNIQUE constraint failed: members.email`. The shared-email tie-break in `dedupeRecipients`
   therefore guards a case only the class-roster path (guardian routing, where two enrollees
   resolve to one guardian's address) can actually reach; it is covered in the unit tests through
   `fakeD1`, which does not enforce constraints. Recorded here rather than acted on: removing that
   guard is not this migration's business.
9. **Rollback** (`rollback.sql`): **succeeds.** `pragma_table_info` re-read: the column is gone.
10. **Forward again**: **succeeds.** Re-verified: `{ total: 9, opted_in: 0 }` — the opt-in set by
    step 7 did not survive the round trip, which is exactly the caveat the rollback header states.
11. Scratch persistence directory deleted.

No unexpected error at any step; every check resolved to its expected value, both directions.

## Local replica

The repo's own local `.wrangler/` replica also received `forward.sql` (no `--persist-to` flag), so
`e2e/fixtures/bootstrap-club-db.mjs` sees the column immediately. That file also gained a
`columnExists('members', 'club_email_opt_in')` warm-replica probe in the same task, which is what
covers a workstation replica that skipped this step.

## Live apply

Left to the pass conductor at close, per the plan's own dispatch note. The committed SQL is
byte-identical to what was applied to the scratch replica and to the repo's local replica.
