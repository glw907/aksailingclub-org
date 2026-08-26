-- Fixture data for the Assets trial build (Task 2): `asset_requests` and `asset_waitlist` hold
-- ZERO rows in production (verified 2026-07-29 against the live replica), so the admin
-- request-inbox and waitlist views have NEVER run against real data. This file is the only path
-- to their populated states for e2e/design work, since it is not this repo's job to write real
-- pending requests into production to get a screenshot.
--
-- Wired into e2e/fixtures/bootstrap-club-db.mjs's own seed list, applied after waivers-seed.sql
-- and before email-seed.sql (Email + Announce Task 11, the pipeline's own newest fixture). This
-- file's own required slot is still after waivers-seed.sql: signup-seed.sql deletes
-- `asset_requests`, `asset_waitlist`, `asset_payments`, and `asset_assignments` UNCONDITIONALLY
-- (no WHERE clause), and portal-seed.sql deletes and reinserts the three real `asset_types` rows
-- this file also touches. Any earlier slot loses this file's rows or breaks their foreign keys.
-- email-seed.sql running after this one is harmless either way: it touches only `email_log` and
-- `announcements`, two tables this file never reads or writes.
--
-- ASSET-TYPE-ID RULE (Assets substrate Task 2, `src/member-portal/lib/waiver-requirements.ts`'s
-- own `parseAssetKind`): every `asset_type` value below is one of the three REAL, unprefixed
-- production ids `mooring`, `boat-parking`, `rv-parking` -- never an `atrial-`-prefixed
-- placeholder. `portal-seed.sql`'s old `portal-at-mooring`/`portal-at-trailer`/`portal-at-rv`
-- ids were removed for exactly that reason, and a placeholder id here would throw the moment the
-- member-portal's signing gate parses it. Each id keeps the display name production actually
-- pairs it with: `boat-parking` is "Trailered Boat Parking", `rv-parking` is "Long-Term RV
-- Parking" -- crossing the two seeds a type that has never existed while every rendered
-- assertion still passes, the exact defect this repo shipped once already.
--
-- Every OTHER id (households, members, memberships, assignments, payments, requests, waitlist
-- entries) is prefixed `atrial-`, distinct from the existing `portal-`, `waiver-`, `madm-`, and
-- `signup-` sets, so this file only ever touches its own rows (scoped deletes below) and is safe
-- to re-run against a warm workstation replica. Deletes go child-before-parent through the FK
-- closure: asset_requests (references both asset_assignments and asset_waitlist) ->
-- asset_payments -> asset_waitlist/asset_assignments -> memberships -> (household's own
-- primary_member_id nulled) -> members -> households.
--
-- No baselined visual spec renders any admin asset-requests or asset-waitlist screen (checked
-- 2026-07-30), so these rows carry no baseline risk.
DELETE FROM asset_requests WHERE id LIKE 'atrial-%';
DELETE FROM asset_payments WHERE id LIKE 'atrial-%';
DELETE FROM asset_waitlist WHERE id LIKE 'atrial-%';
DELETE FROM asset_assignments WHERE id LIKE 'atrial-%';
DELETE FROM memberships WHERE id LIKE 'atrial-%';
UPDATE households SET primary_member_id = NULL WHERE id LIKE 'atrial-%';
DELETE FROM members WHERE id LIKE 'atrial-%';
DELETE FROM households WHERE id LIKE 'atrial-%';

-- Capacity: `portal-seed.sql`'s own delete-and-reinsert of the three real asset_types rows always
-- leaves `capacity` NULL (that file's own header explains why), so this file -- applied last --
-- is the only place a non-NULL capacity can be set without a later fixture nulling it back out.
-- These three UPDATEs touch ONLY `capacity`, never `name` or `id` (the orchestrator's own
-- ruling: an UPDATE of capacity is not an insert, a delete, or a re-key).
--
-- `mooring` is set to its OWN current active-assignment count, computed rather than written as a
-- literal, so it lands exactly FULL: the state in which a "new" request against it must enqueue
-- onto the waitlist rather than assign directly. Today that count is 2 (`portal-aa-mooring` +
-- `waiver-aa-visual-mooring`, both seeded by earlier fixtures in this pipeline) and this file adds
-- no mooring assignment of its own. It is computed because a literal would silently stop being
-- "full" the day an unrelated fixture adds or drops a mooring assignment, and the enqueue path
-- would then be unreachable with every acceptance query still reading plausible.
-- `boat-parking` is set to 5: its active count after this file's own retention assignment below
-- is 2 (`portal-aa-trailer` + `atrial-aa-retain-boat`), below capacity, so approving a request
-- against it assigns directly.
-- `rv-parking` is set to 3, also above its own active count of 0.
UPDATE asset_types SET capacity =
  (SELECT COUNT(*) FROM asset_assignments WHERE asset_type = 'mooring' AND status = 'active')
  WHERE id = 'mooring';
UPDATE asset_types SET capacity = 5 WHERE id = 'boat-parking';
UPDATE asset_types SET capacity = 3 WHERE id = 'rv-parking';

-- 1. The "new" request: a fresh applicant household with no current holdings, requesting a
-- mooring -- the type this file just set to FULL, so this is the realistic shape for a request
-- that must enqueue rather than assign once approved.
INSERT INTO households (id, name, primary_member_id) VALUES ('atrial-hh-newreq', 'Trial New-Request household', NULL);
INSERT INTO members (id, household_id, name, email, phone, directory_visibility) VALUES
  ('atrial-mem-newreq', 'atrial-hh-newreq', 'Jordan Trialfixture', 'e2e-atrial-newreq@aksailingclub.org', NULL, 'visible');
UPDATE households SET primary_member_id = 'atrial-mem-newreq' WHERE id = 'atrial-hh-newreq';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('atrial-ms-newreq', 'atrial-hh-newreq', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 'individual', 250, '2026-04-01 00:00:00');

INSERT INTO asset_requests (id, asset_type, household_id, requested_by, kind, status, note)
  VALUES ('atrial-req-new-mooring', 'mooring', 'atrial-hh-newreq', 'atrial-mem-newreq', 'new', 'pending',
          'Would like a mooring for the season -- first time requesting one.');

-- 2. The "retention" request: a household that already holds an active boat-parking assignment
-- (real production shape -- a paid current-season spot), requesting to retain it. `description`
-- is free text a member would actually write, never a slot identifier (the live column's own
-- shape, `portal-seed.sql`'s header). `assignment_id` on the request row below links it to this
-- exact assignment, the real shape a retention request carries.
INSERT INTO households (id, name, primary_member_id) VALUES ('atrial-hh-retain', 'Trial Retention household', NULL);
INSERT INTO members (id, household_id, name, email, phone, directory_visibility) VALUES
  ('atrial-mem-retain', 'atrial-hh-retain', 'Casey Trialfixture', 'e2e-atrial-retain@aksailingclub.org', NULL, 'visible');
UPDATE households SET primary_member_id = 'atrial-mem-retain' WHERE id = 'atrial-hh-retain';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('atrial-ms-retain', 'atrial-hh-retain', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 'individual', 250, '2026-04-01 00:00:00');

INSERT INTO asset_assignments (id, asset_type, membership_id, description, status)
  VALUES ('atrial-aa-retain-boat', 'boat-parking', 'atrial-ms-retain', '16ft aluminum skiff', 'active');
INSERT INTO asset_payments (id, assignment_id, season, amount, paid_at, method)
  VALUES ('atrial-ap-retain-boat', 'atrial-aa-retain-boat', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 150, '2026-04-15 00:00:00', 'card');

INSERT INTO asset_requests (id, asset_type, household_id, requested_by, kind, status, note, assignment_id)
  VALUES ('atrial-req-retain-boat', 'boat-parking', 'atrial-hh-retain', 'atrial-mem-retain', 'retention', 'pending',
          'Renewing the boat-parking spot for the same skiff.', 'atrial-aa-retain-boat');

-- 3. Waitlist entries in TWO different asset types, each seeded member holding a real
-- membership in the current season (criterion 4: promotion reads a waitlist member's household
-- standing, so an unresolvable member would make a later task's acceptance unreachable).
--
-- `mooring` carries no waitlist rows anywhere else in this pipeline, so these two are a fresh
-- queue: positions 1, 2.
INSERT INTO households (id, name, primary_member_id) VALUES ('atrial-hh-wait-moor-1', 'Trial Mooring Waitlist household 1', NULL);
INSERT INTO members (id, household_id, name, email, phone, directory_visibility) VALUES
  ('atrial-mem-wait-moor-1', 'atrial-hh-wait-moor-1', 'Riley Trialfixture', 'e2e-atrial-wait-moor-1@aksailingclub.org', NULL, 'visible');
UPDATE households SET primary_member_id = 'atrial-mem-wait-moor-1' WHERE id = 'atrial-hh-wait-moor-1';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('atrial-ms-wait-moor-1', 'atrial-hh-wait-moor-1', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 'individual', 250, '2026-04-01 00:00:00');

INSERT INTO households (id, name, primary_member_id) VALUES ('atrial-hh-wait-moor-2', 'Trial Mooring Waitlist household 2', NULL);
INSERT INTO members (id, household_id, name, email, phone, directory_visibility) VALUES
  ('atrial-mem-wait-moor-2', 'atrial-hh-wait-moor-2', 'Morgan Trialfixture', 'e2e-atrial-wait-moor-2@aksailingclub.org', NULL, 'visible');
UPDATE households SET primary_member_id = 'atrial-mem-wait-moor-2' WHERE id = 'atrial-hh-wait-moor-2';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('atrial-ms-wait-moor-2', 'atrial-hh-wait-moor-2', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 'individual', 250, '2026-04-01 00:00:00');

INSERT INTO asset_waitlist (id, asset_type, member_id, position, requested_at) VALUES
  ('atrial-aw-moor-1', 'mooring', 'atrial-mem-wait-moor-1', 1, '2026-03-10 00:00:00'),
  ('atrial-aw-moor-2', 'mooring', 'atrial-mem-wait-moor-2', 2, '2026-03-15 00:00:00');

-- `rv-parking` already carries one waitlist row from `portal-seed.sql` (`portal-aw-rv`, position
-- 1), which runs earlier in this pipeline and is not this file's own row to touch -- so this
-- entry is the TAIL of that same real queue, position 2, not a restart at 1 that would collide
-- with an entry another fixture already owns.
INSERT INTO households (id, name, primary_member_id) VALUES ('atrial-hh-wait-rv-1', 'Trial RV Waitlist household', NULL);
INSERT INTO members (id, household_id, name, email, phone, directory_visibility) VALUES
  ('atrial-mem-wait-rv-1', 'atrial-hh-wait-rv-1', 'Drew Trialfixture', 'e2e-atrial-wait-rv-1@aksailingclub.org', NULL, 'visible');
UPDATE households SET primary_member_id = 'atrial-mem-wait-rv-1' WHERE id = 'atrial-hh-wait-rv-1';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('atrial-ms-wait-rv-1', 'atrial-hh-wait-rv-1', (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'current_season'), 'individual', 250, '2026-04-01 00:00:00');

INSERT INTO asset_waitlist (id, asset_type, member_id, position, requested_at) VALUES
  ('atrial-aw-rv-1', 'rv-parking', 'atrial-mem-wait-rv-1', 2, '2026-03-20 00:00:00');
