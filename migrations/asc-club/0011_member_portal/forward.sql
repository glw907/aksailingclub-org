-- asc-club migration 0011: the member portal's own two schema additions (portal-capstone),
-- landed against the ratified design (docs/2026-07-07-member-portal-design.md) and the
-- adversarial review's symmetry rule (docs/2026-07-07-requirements-adversarial-review.md).
--
-- Two additions only. Two rulings this pass's own brief expected as schema work turned out to
-- need none: "class_enrollments enrollee-is-household-member vs applicant" is already structural
-- (0005_member_domain's `class_enrollments.member_id REFERENCES members(id)` accepts ANY member
-- row, and a household's covered child already IS its own `members` row, so the portal's "who's
-- taking this class" selector just enrolls under that member's own id -- no new column); voluntary
-- asset release reuses `asset_assignments.status` (0007_assets_email), already an admin write path
-- (`releaseAssignment`) the portal calls with a member-ownership check, not a new column.
--
-- households.left_at: the lean "leave the club" flag (the symmetry rule's mirror of "join" --
-- join implies leave). Set once, by the household's primary, from the portal's own leave action:
-- stops the (future) renewal-reminder cadence for the household and surfaces on the admin's
-- needs-attention strip; archival itself stays the admin's own deliberate, reversible act
-- (`members.archived_at`, per-member, already exists) -- this column only ever records departure
-- INTENT, never performs the archive.
ALTER TABLE households ADD COLUMN left_at TEXT;

-- asset_requests: the small state machine in front of the continuous `asset_waitlist` queue the
-- design doc's own "Model note" names (pending -> queued | assigned | denied), extended two ways
-- the adversarial review's audit forced: `cancelled` (the symmetry rule: request implies
-- cancel-the-request) and `approved_awaiting_payment` (the year-to-year retention ruling's own
-- merit-gate-then-pay sequence -- approval is leadership's deliberate check BEFORE any money
-- changes hands, since payment itself is out of scope this pass, per this task's own brief).
--
-- `kind` distinguishes a first-time ask ('new': approve either assigns directly into a free slot
-- or queues) from a returning holder's year-to-year ask ('retention': approve only opens the pay
-- task, never assigns outright -- the merit gate). `assignment_id`/`waitlist_id` link back to
-- whichever real row this request ultimately became, once it has (both NULL while pending);
-- neither is NOT NULL, since a denied or cancelled request never gets either.
--
-- FK-enforcement check (the 0004/0005/0007 lesson: real remote D1 refuses an insert outright with
-- `no such table` when a REFERENCES target does not exist): `asset_types`, `households`,
-- `members`, `asset_assignments`, and `asset_waitlist` all already exist (0005_member_domain,
-- 0007_assets_email), so every REFERENCES clause below targets a real table.
CREATE TABLE asset_requests (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL REFERENCES asset_types(id),
  household_id TEXT NOT NULL REFERENCES households(id),
  requested_by TEXT NOT NULL REFERENCES members(id),  -- any adult member may request (design doc)
  kind TEXT NOT NULL CHECK (kind IN ('new','retention')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved_awaiting_payment','queued','assigned','denied','cancelled')),
  note TEXT,                       -- the member's own one-line note at request time
  deny_reason TEXT,                -- required by the admin action when status becomes 'denied'
  assignment_id TEXT REFERENCES asset_assignments(id),  -- set once assigned (new-direct or paid retention)
  waitlist_id TEXT REFERENCES asset_waitlist(id),        -- set once queued (new-request, no free slot)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT                 -- the admin editor's email, or the member's own id for a
                                   -- self-service cancel; NULL while pending
);
CREATE INDEX idx_asset_requests_household ON asset_requests(household_id);
CREATE INDEX idx_asset_requests_status ON asset_requests(status);
