-- Fixture data for the member-waivers e2e coverage (member-waivers T8): both
-- e2e/waivers-signing.spec.ts (the functional flows) and e2e/waivers-visual.spec.ts (the visual
-- spec, never run locally -- see that file's own header). Wired into
-- e2e/fixtures/bootstrap-club-db.mjs's own seed list, applied AFTER portal-seed.sql (this file
-- only ever touches its own `waiver-` prefixed rows, so ordering relative to that file does not
-- matter the way portal-seed.sql's own blanket deletes force after signup-seed.sql).
--
-- SEASONS: every household and document below is anchored to TEST_CURRENT_SEASON = 2025 and
-- TEST_LAST_SEASON = 2024 (e2e/helpers/waivers-season.ts's own exported constants), never the
-- suite's REAL_CURRENT_SEASON = 2026 that every OTHER e2e fixture assumes. This is the load-
-- bearing safety property this whole fixture exists for: the signable documents these households
-- sign (`src/content/documents/test-*.md`) are real, committed, PUBLISHED content -- repo-content
-- is baked into every build, dev and eventually production alike -- so they are deliberately
-- published at seasons permanently BEFORE any real production `current_season` (which only ever
-- increases), rather than at 2026, where they would risk becoming live content a real member
-- could see the instant this code deploys. `e2e/helpers/waivers-season.ts` temporarily points
-- `settings.current_season` at 2025 for the span of the functional spec's own tests (this suite
-- runs one worker, fully serial, so no other spec file's tests ever interleave with that
-- override) and restores 2026 afterward; the visual spec's own households below are pre-signed at
-- 2025 directly in this file instead, so its tests stay pure navigate-and-screenshot like every
-- other visual spec, with no override of their own to manage.
--
-- Every id is prefixed `waiver-` except the one asset type below, which intentionally uses the
-- REAL production id shape (`scripts/import/ops-assets.mjs`'s own header: "asc-ops's own stable
-- text id, e.g. `mooring`" -- unlike portal-seed.sql's and membership-admin-seed.sql's own fixture
-- asset types, which use fixture-prefixed ids that never match a real DocumentAudience and so
-- never exercise the requirement engine's asset-kind document matching at all): only this file
-- ever inserts that literal row, so its own delete is scoped by id rather than by prefix.
DELETE FROM waiver_acceptances WHERE id LIKE 'waiver-%';
DELETE FROM asset_assignments WHERE id LIKE 'waiver-%';
DELETE FROM asset_types WHERE id = 'mooring';
DELETE FROM memberships WHERE id LIKE 'waiver-%';
UPDATE households SET primary_member_id = NULL WHERE id LIKE 'waiver-%';
DELETE FROM members WHERE id LIKE 'waiver-%';
DELETE FROM households WHERE id LIKE 'waiver-%';

-- ============================================================================================
-- FUNCTIONAL fixtures (e2e/waivers-signing.spec.ts): every document below starts UNSIGNED (except
-- the season-boundary household's own deliberately-stale row), so the spec signs them live and
-- asserts on the real write path.
-- ============================================================================================

-- 1. Solo flow: one adult, nothing signed. Sign flow end-to-end (outstanding rows -> sign each ->
-- completion, records written).
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-solo', 'Waiver Solo household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-solo', 'waiver-hh-solo', 'Sasha Wavefixture', 'e2e-waiver-solo@aksailingclub.org', NULL, NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-solo' WHERE id = 'waiver-hh-solo';

-- 2. Household-complete gate: two adults, an unpaid join membership for TEST_CURRENT_SEASON, both
-- adults' documents unsigned. `findUnpaidJoinMembership` (finish-joining/+page.server.ts) reads
-- this row to prove the household-complete gate really locks (and later unlocks) the join
-- payment door.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-family', 'Waiver Family household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-parent-a', 'waiver-hh-family', 'Alex Wavefixture', 'e2e-waiver-parent-a@aksailingclub.org', NULL, NULL, 'visible'),
  ('waiver-mem-parent-b', 'waiver-hh-family', 'Riley Wavefixture', 'e2e-waiver-parent-b@aksailingclub.org', NULL, NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-parent-a' WHERE id = 'waiver-hh-family';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('waiver-ms-family', 'waiver-hh-family', 2025, 'individual', 250, NULL);

-- 3. Minors path: one adult, one minor household member (birthdate makes them a child under
-- AS 09.65.292 at any point this suite runs -- computeAge compares against the real clock, not
-- the season override). No household-loop context needed here; the spec visits with
-- ?context=class-signup, which never enters the join/renewal household-complete loop, so the
-- test can isolate the Part Two act itself.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-minor', 'Waiver Minor household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-minor-parent', 'waiver-hh-minor', 'Drew Wavefixture', 'e2e-waiver-minor-parent@aksailingclub.org', NULL, NULL, 'visible'),
  ('waiver-mem-minor-child', 'waiver-hh-minor', 'Casey Wavefixture', NULL, NULL, '2015-06-01', 'partial');
UPDATE households SET primary_member_id = 'waiver-mem-minor-parent' WHERE id = 'waiver-hh-minor';

-- 4. Season-boundary re-sign: one adult with an EXISTING signature for `test-release` recorded
-- under TEST_LAST_SEASON (2024) -- decision 6 (fresh signatures every season) means this must
-- read as OUTSTANDING once the season override moves "now" to TEST_CURRENT_SEASON (2025), since
-- matching is by document id plus season, never by version. `content_hash`/`content_snapshot`
-- below are fixture placeholders (this row is never read by the freeze guard, which only ever
-- hashes the real content on disk); they exist only to satisfy the column's own CHECK/NOT NULL.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-boundary', 'Waiver Boundary household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-boundary', 'waiver-hh-boundary', 'Jordan Wavefixture', 'e2e-waiver-boundary@aksailingclub.org', NULL, NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-boundary' WHERE id = 'waiver-hh-boundary';
INSERT INTO waiver_acceptances
  (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context, signed_at, member_id, minor_member_id)
  VALUES (
    'waiver-sig-boundary-2024', 'test-release', 1, 2024, 'release',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2024 text this household actually signed.',
    'Jordan Wavefixture', 'e2e-waiver-boundary@aksailingclub.org', 'renewal',
    '2024-06-01 00:00:00', 'waiver-mem-boundary', NULL
  );

-- ============================================================================================
-- VISUAL fixtures (e2e/waivers-visual.spec.ts): pre-signed directly here so that spec's own tests
-- stay pure navigate-and-screenshot, matching e2e/portal-visual.spec.ts's own idiom, and so its
-- states never depend on whether e2e/waivers-signing.spec.ts happened to run first in the same
-- suite invocation.
--
-- Fix round (finding 4, fresh-context coherence read 2026-07-19): fixture 8 below adds the
-- household device its own visual coverage was missing -- a parent whose own personal documents
-- are already signed, so the moment lands directly on their minor's own Part Two entry (the
-- per-child attestation radios plus the "type once, sign each" prefilled name).
-- ============================================================================================

-- 5. The signing moment mid-flow: `test-release` already signed, `test-acknowledgement` still
-- outstanding -- one receipt, one expanded current document.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-visual-midflow', 'Waiver Visual Midflow household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-visual-midflow', 'waiver-hh-visual-midflow', 'Morgan Wavefixture', 'e2e-waiver-visual-midflow@aksailingclub.org', NULL, NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-visual-midflow' WHERE id = 'waiver-hh-visual-midflow';
INSERT INTO waiver_acceptances
  (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context, signed_at, member_id, minor_member_id)
  VALUES (
    'waiver-sig-visual-midflow-release', 'test-release', 2, 2025, 'release',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-release text.',
    'Morgan Wavefixture', 'e2e-waiver-visual-midflow@aksailingclub.org', 'renewal',
    '2025-05-01 00:00:00', 'waiver-mem-visual-midflow', NULL
  );

-- 6. The waiting state: two adults, the primary's own two documents already signed, the other
-- adult's own two still outstanding.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-visual-waiting', 'Waiver Visual Waiting household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-visual-parent-a', 'waiver-hh-visual-waiting', 'Taylor Wavefixture', 'e2e-waiver-visual-parent-a@aksailingclub.org', NULL, NULL, 'visible'),
  ('waiver-mem-visual-parent-b', 'waiver-hh-visual-waiting', 'Reese Wavefixture', 'e2e-waiver-visual-parent-b@aksailingclub.org', NULL, NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-visual-parent-a' WHERE id = 'waiver-hh-visual-waiting';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('waiver-ms-visual-waiting', 'waiver-hh-visual-waiting', 2025, 'individual', 250, NULL);
INSERT INTO waiver_acceptances
  (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context, signed_at, member_id, minor_member_id)
  VALUES
  (
    'waiver-sig-visual-waiting-release', 'test-release', 2, 2025, 'release',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-release text.',
    'Taylor Wavefixture', 'e2e-waiver-visual-parent-a@aksailingclub.org', 'join',
    '2025-05-01 00:00:00', 'waiver-mem-visual-parent-a', NULL
  ),
  (
    'waiver-sig-visual-waiting-ack', 'test-acknowledgement', 1, 2025, 'acknowledgement',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-acknowledgement text.',
    'Taylor Wavefixture', 'e2e-waiver-visual-parent-a@aksailingclub.org', 'join',
    '2025-05-01 00:00:00', 'waiver-mem-visual-parent-a', NULL
  );

-- 7. The contact-confirm card: one adult, a held `mooring` asset, every personal AND household
-- document already signed, so the moment lands directly on "Can the club reach you?".
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-visual-contact', 'Waiver Visual Contact household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-visual-contact', 'waiver-hh-visual-contact', 'Quinn Wavefixture', 'e2e-waiver-visual-contact@aksailingclub.org', '907-555-0100', NULL, 'visible');
UPDATE households SET primary_member_id = 'waiver-mem-visual-contact' WHERE id = 'waiver-hh-visual-contact';
INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at)
  VALUES ('waiver-ms-visual-contact', 'waiver-hh-visual-contact', 2025, 'individual', 250, '2025-05-01 00:00:00');
INSERT INTO asset_types (id, name, fee, capacity, sort_order) VALUES ('mooring', 'Mooring', 150, NULL, 10);
INSERT INTO asset_assignments (id, asset_type, membership_id, description, status)
  VALUES ('waiver-aa-visual-mooring', 'mooring', 'waiver-ms-visual-contact', 'Test Sailboat', 'active');
INSERT INTO waiver_acceptances
  (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context, signed_at, member_id, minor_member_id)
  VALUES
  (
    'waiver-sig-visual-contact-release', 'test-release', 2, 2025, 'release',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-release text.',
    'Quinn Wavefixture', 'e2e-waiver-visual-contact@aksailingclub.org', 'mooring-fee',
    '2025-05-01 00:00:00', 'waiver-mem-visual-contact', NULL
  ),
  (
    'waiver-sig-visual-contact-ack', 'test-acknowledgement', 1, 2025, 'acknowledgement',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-acknowledgement text.',
    'Quinn Wavefixture', 'e2e-waiver-visual-contact@aksailingclub.org', 'mooring-fee',
    '2025-05-01 00:00:00', 'waiver-mem-visual-contact', NULL
  ),
  (
    'waiver-sig-visual-contact-mooring', 'test-mooring-ack', 1, 2025, 'acknowledgement',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-mooring-ack text.',
    'Quinn Wavefixture', 'e2e-waiver-visual-contact@aksailingclub.org', 'mooring-fee',
    '2025-05-01 00:00:00', 'waiver-mem-visual-contact', NULL
  );

-- 8. The household device: one adult, one minor. The adult's own two personal documents
-- (`test-release`, `test-acknowledgement`) are already signed, so the only outstanding item is
-- the minor's own `test-release` Part Two -- the moment lands directly on it, expanded, with the
-- AS 09.65.292 attestation radios and the "type once, sign each" name prefilled from the adult's
-- own last signature above.
INSERT INTO households (id, name, primary_member_id) VALUES ('waiver-hh-visual-family', 'Waiver Visual Family household', NULL);
INSERT INTO members (id, household_id, name, email, phone, birthdate, directory_visibility) VALUES
  ('waiver-mem-visual-family-parent', 'waiver-hh-visual-family', 'Sam Wavefixture', 'e2e-waiver-visual-family-parent@aksailingclub.org', NULL, NULL, 'visible'),
  ('waiver-mem-visual-family-child', 'waiver-hh-visual-family', 'Robin Wavefixture', NULL, NULL, '2016-04-01', 'partial');
UPDATE households SET primary_member_id = 'waiver-mem-visual-family-parent' WHERE id = 'waiver-hh-visual-family';
INSERT INTO waiver_acceptances
  (id, document_id, version, season, kind, content_hash, content_snapshot, person_name, person_email, context, signed_at, member_id, minor_member_id)
  VALUES
  (
    'waiver-sig-visual-family-release', 'test-release', 2, 2025, 'release',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-release text.',
    'Sam Wavefixture', 'e2e-waiver-visual-family-parent@aksailingclub.org', 'renewal',
    '2025-05-01 00:00:00', 'waiver-mem-visual-family-parent', NULL
  ),
  (
    'waiver-sig-visual-family-ack', 'test-acknowledgement', 1, 2025, 'acknowledgement',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '(fixture) the season-2025 test-acknowledgement text.',
    'Sam Wavefixture', 'e2e-waiver-visual-family-parent@aksailingclub.org', 'renewal',
    '2025-05-01 00:00:00', 'waiver-mem-visual-family-parent', NULL
  );
