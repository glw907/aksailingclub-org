-- asc-club migration 0022: the `join` payment kind's own seeded emails, plus widening
-- `processed_stripe_sessions.kind` to accept it.
--
-- `join_welcome` (member-facing: the front door into the portal right after paying) and
-- `board_join_notice` (an internal FYI, no action needed) are `reconcileJoin`'s two sends
-- (`src/admin-club/lib/stripe-reconcile.ts`, this task's own work). `INSERT OR IGNORE` matches
-- migration 0014's own idempotent-seed convention: a re-run changes nothing already there, and
-- an owner who has since edited the wording keeps their edit. `default_subject`/`default_body`
-- (migration 0016) are backfilled the same two-step way that migration's own backfill worked --
-- INSERT with the columns migration 0007 knows about, then UPDATE the two migration 0016 added,
-- guarded (`WHERE default_subject = ''`) so a re-run or a since-edited row is never clobbered.
--
-- `processed_stripe_sessions.kind` (migration 0014) still only accepts
-- ('dues','class-fee','asset-fee'): `payments.ts`'s `PAYMENT_KINDS` grew a fourth kind,
-- `donation`, in the money-ledger initiative (migration 0021), and `reconcileDonation` already
-- inserts `kind='donation'` into this table -- a live CHECK-constraint violation against real D1
-- nobody has scratch-proven yet (`fakeD1`, the only harness every unit test runs against,
-- enforces no CHECK constraint at all, the same blind spot 0004_waitlist_integrity's and
-- 0006_offer_cascade_on_waitlist_delete's own READMEs already name for the identical FK/CHECK
-- gap). `PAYMENT_KINDS` now grows a fifth kind, `join` (this task): rather than leave two gaps
-- open, this migration widens the CHECK once to cover both, via the standard SQLite
-- recreate-and-copy (`0006_offer_cascade_on_waitlist_delete`'s own README already establishes
-- this exact pattern for this exact table; SQLite cannot ALTER a CHECK constraint in place).
CREATE TABLE processed_stripe_sessions_new (
  session_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('dues', 'class-fee', 'asset-fee', 'donation', 'join')),
  ref_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO processed_stripe_sessions_new (session_id, kind, ref_id, processed_at)
  SELECT session_id, kind, ref_id, processed_at FROM processed_stripe_sessions;
DROP TABLE processed_stripe_sessions;
ALTER TABLE processed_stripe_sessions_new RENAME TO processed_stripe_sessions;

INSERT OR IGNORE INTO email_templates (id, subject, reply_to, body, updated_by) VALUES
('join_welcome', 'Welcome to the Alaska Sailing Club', 'membership-committee@aksailingclub.org',
'Hi {{person_name}},

Welcome aboard! Your **{{tier_label}} Membership** for the {{season}} season is active.

{{credit_status}}

Sign in to your member portal any time to check your household, register for classes, or update your info: {{portal_url}}

Say hello on Discord: {{discord_url}}

No action needed -- you''re all set to sail.

Questions? Reply to this email or contact {{committee_email}}.

---
Alaska Sailing Club
aksailingclub.org', 'authored:unified-signup'),

('board_join_notice', 'New membership -- {{household_name}}', NULL,
'Hi board,

A new **{{tier_label}} Membership** just came in.

**Household:** {{household_name}}
**Season:** {{season}}
**Classes:** {{classes_summary}}

No action needed -- this is FYI.

---
Alaska Sailing Club
aksailingclub.org', 'authored:unified-signup');

UPDATE email_templates SET default_subject = subject, default_body = body
  WHERE id IN ('join_welcome', 'board_join_notice') AND default_subject = '';

INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES
  ('system', 'migration.seed', 'settings', NULL,
   '0022_join_emails: processed_stripe_sessions.kind widened to include donation, join'),
  ('system', 'migration.seed', 'email_template', NULL,
   '0022_join_emails: seeded join_welcome, board_join_notice');
