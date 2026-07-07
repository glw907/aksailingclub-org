# asc-club migration 0011: the member portal's schema additions

## What this does

Lands the two schema additions the member portal (portal-capstone) needs beyond what
0005_member_domain, 0007_assets_email, and 0009_member_auth already carry:

- **`households.left_at`**: the lean "leave the club" flag. Set once, by the household's
  primary, when they use the portal's leave action. Stops the (future) renewal-reminder
  cadence for the household and surfaces on the admin's needs-attention strip. Deliberately
  does not touch `members.archived_at`: archival stays the admin's own deliberate,
  reversible act (`docs/2026-07-07-member-portal-design.md`'s own "the lean LEAVE-THE-CLUB
  action" section, and the household card scope item's "archival stays admin's own").
- **`asset_requests`**: the small state machine in front of the continuous `asset_waitlist`
  queue (the design doc's own "Model note"): `pending -> queued | assigned | denied`,
  extended with `cancelled` (the symmetry rule: request implies cancel-the-request) and
  `approved_awaiting_payment` (the retention ruling's merit-gate-then-pay sequence:
  approval is leadership's deliberate check before any money changes hands, and payment
  itself is out of scope this pass).

Two things the task's own brief expected as schema work turned out to need none, recorded so
the omission is a finding, not an oversight:

1. **"class_enrollments enrollee-is-household-member vs applicant"**: already structural.
   `class_enrollments.member_id REFERENCES members(id)` (0005_member_domain) accepts any
   member row, and a household's covered child already IS its own `members` row (a distinct
   id, its own `household_id`). The portal's "who's taking this class" selector enrolls
   under that child's own member id; no new column, no applicant/enrollee split needed.
2. **Voluntary asset release**: reuses `asset_assignments.status` (0007_assets_email,
   `'active' | 'released'`), already an admin write path (`releaseAssignment`,
   `src/admin-club/lib/assets-store.ts`) the portal calls with a member-ownership check. No
   new column.

## FK-enforcement check (the 0004/0005/0007 lesson)

Real remote D1 refuses an insert outright with `no such table` when a `REFERENCES` target
does not exist. `asset_types`, `households`, `members` (0005_member_domain, 0007_assets_email)
and `asset_assignments`, `asset_waitlist` (0007_assets_email) all already exist, so every
`REFERENCES` clause in `asset_requests` targets a real table.

## Verify

```
npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0011_member_portal/verify.sql | grep -v '^\s*$')"
```

## Rollback

Safe only before any real asset request or household `left_at` data exists:

```
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0011_member_portal/rollback.sql
```
