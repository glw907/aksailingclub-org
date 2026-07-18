# asc-club migration 0027: the directory domain

## What this does

Lands the schema for the member-directory pass's T1
(`docs/plans/2026-07-17-member-directory.md`, executing
`docs/2026-07-17-roles-committees-design.md` and `docs/2026-07-17-member-directory-design.md`'s
"Revisions" block):

1. `boats` -- id, `member_id` (FK to `members`, the OWNER; a boat belongs to a member, not a
   household), `name` (nullable for legacy seed rows only), `class` (fixed picker: `'Buccaneer
   18'`, `'Laser'`, `'Other'`), `model` (required iff `class = 'Other'`, enforced by a
   table-level `CHECK`), `sail_number`, `kept_on` (`'trailer'` default, or `'mooring'`),
   timestamps.
2. `committees` -- id, `slug` (unique), `name`, `description`, `kind` (`'standing'` or
   `'established'`), `sort_order`, `archived_at`, timestamps.
3. `committee_members` -- id, `committee_id` (FK), `member_id` (FK), `role` (`'chair'` /
   `'co-chair'` / `'member'`, default `'member'`), `status` (`'pending'` / `'active'`, default
   `'pending'`), timestamps, `UNIQUE (committee_id, member_id)`.
4. `member_positions` -- id, `member_id` (FK), `kind` (`'officer'` / `'director'` /
   `'appointed'`, the field authorization reads), `title` (display text only), `sort_order`,
   timestamps.
5. `households` gains `address_line1`, `address_line2`, `state`, `postal_code` (all nullable;
   `city` already exists from `0005_member_domain`). Additive, no table recreate.

No seed rows: T2 (boats, from asset-assignment free text) and T2b (committees + people, from the
published At-a-Glance table) seed separately, each with Geoff's dry-run review before a live
apply.

## Why boats key on the member, not the household

The roles spec's own T1 entry supersedes the directory spec's original decision 4: a family with
several boats can now say who owns which, and the directory (T3) shows a boat on its owner's
entry only.

## Why `member_positions.kind` carries authorization, not `title`

The roles spec's ratified model: a board member is anyone whose `member_positions.kind` is
`'officer'` or `'director'`; `title` ("Commodore", "At-Large Director") is display text a later
screen (T6) edits freely without ever touching what a row can *do*. Chair titles similarly never
get stored anywhere -- T3's directory query derives `"{committee.name} Chair"` from
`committee_members.role` joined to `committees.name` at read time.

## How to run

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0027_directory_domain/forward.sql
```

## Verify

```sh
npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0027_directory_domain/verify-forward.sql)"
```

Expect four table names (`boats`, `committee_members`, `committees`, `member_positions`) then
four household column names (`address_line1`, `address_line2`, `postal_code`, `state`).

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0027_directory_domain/rollback.sql
```

Safe only before any real boat, committee, committee-membership, member-position, or household
address data exists: a rollback after that point discards rows, not just structure.

## Scratch-proof procedure

Per the repo's standing migration discipline, and per this task's explicit ban on any `--remote`
write, this migration's scratch proof runs entirely against a local, disposable D1 replica (a
`--persist-to` directory distinct from the repo's own `.wrangler/` state), never a real
Cloudflare-hosted scratch database:

1. Create a fresh persistence directory.
2. Apply migrations `0001` through `0027` in order, `--local --persist-to <scratch dir>`.
3. **Forward** already ran as step 2's last file; confirm no error.
4. **Verify**: run `verify-forward.sql` against the scratch replica; expect the four table names
   and four column names above.
5. **Constraint proofs**: attempt each documented `CHECK`/`UNIQUE` violation directly against the
   scratch replica and confirm each one is rejected (see the task report for the full transcript):
   a bad `boats.class`, a bad `boats.kept_on`, a `class='Other'` row with no `model`, a
   `class<>'Other'` row WITH a `model`, a bad `committee_members.role`, a bad
   `committee_members.status`, a duplicate `(committee_id, member_id)` pair, and a bad
   `member_positions.kind`. Confirm the documented defaults (`kept_on='trailer'`,
   `committee_members.role='member'`, `committee_members.status='pending'`) apply when omitted.
6. **Rollback**: apply `rollback.sql`; confirm no error.
7. **Verify-empty**: run `verify-rollback.sql`; expect no rows from either query.
8. Delete the scratch persistence directory.

This proof, plus applying `forward.sql` to the local replica the dev server and e2e suite serve
against, is as far as this task goes. Only the conductor applies `forward.sql` to the live
`asc-club` at the pass close.
