-- asc-club migration 0033: the standing data tier -- Former recorded, grace retired at the source
--
-- Members pass T2 (docs/plans/2026-07-20-members-pass.md, docs/2026-07-20-members-pass-design.md
-- "Standing vocabulary and the data tier"): the member-standing vocabulary becomes three states
-- (Current/Overdue/Former), replacing current/grace/lapsed. The Former transition is RECORDED,
-- not re-derived on every read (the design doc's own ruling): the daily renewal-reminders sweep
-- (`src/jobs/renewal-reminders.ts`) writes `former_at` once a household's own renewal boundary
-- (`renewalExpiryFrom`, `paid_at` plus one year) plus 30 days has passed unpaid -- the reminder
-- sequence's own stated-final `30_after` touch boundary -- and this migration's own one-time
-- backfill classifies the live households the same way, once, at apply time.
--
-- `former_source` distinguishes a sequence-driven mark (the daily sweep; auto-cleared once a new
-- payment moves the boundary back into the future) from a manual one (the household desk's own
-- set/clear, T3; never auto-cleared by the sweep). Both columns are additive and nullable: the
-- currently deployed (pre-pass) worker never reads either, so this migration is safe to apply
-- ahead of the pass-close code deploy.
--
-- `renewal_grace_days` itself is deliberately NOT touched here: the deployed pre-pass code's own
-- `standing.ts` still reads it for its grace-window math, and `segments.ts`/`households-store.ts`/
-- `announcements.ts` (T3's own file list) still read it directly too. It retires once every
-- reader has moved off the grace vocabulary, not in this additive migration.
ALTER TABLE households ADD COLUMN former_at TEXT;
ALTER TABLE households ADD COLUMN former_source TEXT CHECK (former_source IN ('sequence', 'manual'));

-- One-time backfill: every household whose own most recently paid, non-refunded `memberships`
-- row is already past its renewal boundary plus 30 days (the sequence's own stated-final
-- boundary) at migration-apply time is marked Former now, source 'sequence' -- exactly what the
-- daily sweep would mark on its own first post-deploy tick, computed once here instead of waiting
-- a day. A household with no paid row at all (`'none'`) or still within the 30-day window
-- (`'overdue'`, full benefits) is left alone (`former_at` stays NULL).
UPDATE households
SET former_at = datetime('now'), former_source = 'sequence'
WHERE id IN (
  SELECT m.household_id
  FROM memberships m
  WHERE m.paid_at IS NOT NULL AND m.refunded_at IS NULL
  GROUP BY m.household_id
  HAVING datetime(MAX(m.paid_at), '+1 year', '+30 days') < datetime('now')
);

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.backfill', 'households', NULL,
   '0033_member_standing: former_at/former_source added; households past the sequence boundary backfilled Former (source sequence)');
