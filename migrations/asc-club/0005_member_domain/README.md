# asc-club migration 0005: the member domain

## What this does

Lands five tables from the ratified DDL's "THE MEMBER CORE (pass 2.2)" section
(`cairn-cms/docs/superpowers/specs/assets/phase-2-reference/asc-club-schema.sql`), verbatim in
structure, no seed rows: `households`, `members`, `memberships`, `credit_grants`,
`credit_redemptions`. Full pass-2.2 behavior (the join flow, the member portal, the credit
ledger's redemption UI) is still a later pass; this migration only lands the structure, ahead of
its own pass, because pass 2.1's own write paths need a real `members` table to reference today.

## Why this lands now, inside pass 2.1

`0004_waitlist_integrity`'s README documents the adjacent finding that forced this: real (remote)
D1 enforces that a `REFERENCES` target table exists at write time, refusing an insert outright
with `no such table: main.members` when it does not, confirmed directly against the live
`asc-club` database. `class_waitlist`, `class_enrollments`, and `class_instructors`
(`0001_substrate`) all declare `member_id TEXT ... REFERENCES members(id)` columns; with no
`members` table to reference, every real write through those columns has been failing, working
only against the `fakeD1` test double every existing unit test uses. This migration is the
minimal fix: land the table the FK already points at, not defer the whole member domain to pass
2.2.

## `class_instructors.member_name`'s comment, retired

`0002_instructor_display_name` reused `class_instructors.member_id` as the instructor's own
email, an interim natural key standing in for a `members.id` that did not exist yet. That
migration's own header called this workaround out explicitly and named its retirement condition:
"2.2's own migration can backfill a real `member_id` once one exists, keyed by matching email."
This migration is that arrival. `src/admin-club/lib/classes-store.ts`'s instructor-assignment path
(Part 3 of this pass) now resolves a real `members.id` through `ensureMember`
(`src/admin-club/lib/people.ts`) before writing `class_instructors.member_id`, so new rows carry a
real id, not an email. `member_name` itself is untouched and keeps its job as the display-name
cache the assignment form collects alongside the id; only the meaning of the sibling `member_id`
column changes, from "the instructor's email" to "the instructor's real member id."

No existing `class_instructors` rows carry an email-shaped `member_id` in production yet (see
"Proved safe" below), so no backfill of existing data is needed alongside this migration.

## Why `households` before `members` is safe despite the circular reference

`households.primary_member_id REFERENCES members(id)` and `members.household_id REFERENCES
households(id)` reference each other. SQLite does not require a `REFERENCES` target to exist at
`CREATE TABLE` time (`0001_substrate`'s own header makes the same point about `class_instructors`
et al. referencing the not-yet-created `members`), so creating `households` first, the same order
the ratified DDL itself uses, is safe. A household row is always written with
`primary_member_id` initially `NULL`, then set once its first member's id is known, in the same
`db.batch()` (the "deferred-not-null dance" the ratified DDL's own comment names). This is exactly
what `ensureMember` (Part 2 of this pass, `src/admin-club/lib/people.ts`) does on the create path.

## How to run

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0005_member_domain/forward.sql
```

## Verify

```sh
npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0005_member_domain/verify.sql)"
```

The `grep -v '^--'` strips this file's own leading comment lines before handing the string to
`--command`: a value that itself starts with `--` (this migration's own scratch proof, below,
found it the hard way) makes wrangler's flag parser mistake the SQL for a bare `--` flag
terminator, dropping `--command`'s value entirely and failing with "You must provide either
--command or --file". `0004_waitlist_integrity/README.md`'s own documented recipe (`$(cat
...)` with no stripping) carries the same latent bug; not fixed here, out of this migration's
scope, but worth flagging for whoever next copies that recipe.

Expect five rows: `households`, `members`, `memberships`, `credit_grants`, `credit_redemptions`.

## Proved safe before landing (2026-07-07)

The real `asc-club` `class_instructors`, `class_enrollments`, and `class_waitlist` tables were all
confirmed empty (`SELECT COUNT(*)` returned 0 for each) before this migration ran: the public
signup/waitlist forms and the instructor-assignment action have never yet completed a real write
against remote D1 (the very failure this migration fixes), so there is no existing data for the
member-domain arrival, or Part 3's `ensureMember`-based rewrite of the write paths, to reconcile.

A scratch database (`asc-club-scratch-0005`, created and deleted for this proof only) confirmed
the fix end to end: `0001`-`0005` applied forward in order, then (1) an insert into
`class_waitlist` with `member_id` `NULL` and a real `applicant_email` succeeded (the table's own
`CHECK` and the nullable FK both allow it), (2) an insert into `class_enrollments` with a bogus,
non-existent `member_id` failed with a `FOREIGN KEY constraint failed` (not the earlier
`no such table` error: the target table now exists, and the FK is live), and (3) an insert into
`class_enrollments` with a `member_id` naming a real, just-inserted `members` row succeeded. Full
transcript in the pass's own dispatch report.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0005_member_domain/rollback.sql
```

Safe only before any real member/household/membership/credit data exists (see `rollback.sql`'s own
header): a rollback after that point discards rows, not just structure, and reopens the
`no such table: main.members` failure this migration exists to fix.
