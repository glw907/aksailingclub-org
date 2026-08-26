-- Fixture data for the Email + Announce admin e2e/visual coverage (Task 11): the e2e replica has
-- no `email_log` and no `announcements` rows today (both tables land empty from every migration),
-- so the send-log and announce-list screens have never had real data to render against in this
-- suite. This file supplies both.
--
-- Wired into e2e/fixtures/bootstrap-club-db.mjs's own seed list, applied LAST, after
-- assets-seed.sql. Ordering relative to every other fixture in that pipeline does not matter:
-- this file touches only `email_log` and `announcements`, two tables no other seed file inserts
-- into, deletes from, or reads a capacity/foreign-key relationship against. It still runs last by
-- convention (matching this pipeline's own "newest fixture goes at the end" practice), not because
-- an earlier slot would break anything.
--
-- Every id is prefixed `eseed-`, distinct from every other fixture's own prefix (`portal-`,
-- `waiver-`, `madm-`, `signup-`, `atrial-`), so the deletes below only ever touch this file's own
-- rows and this file is safe to re-run against a warm workstation replica.
--
-- Template ids (`renewal_reminder`, `class_welcome`) are REAL, live `email_templates` rows
-- (migrations 0015_job_runner and 0012_class_reminders both seed them), never invented ones: a
-- fabricated template id would still render in the log's own template filter, but it would not
-- match anything `email-templates-store.ts` actually knows, which is the wrong fixture shape for a
-- screen whose filter options are read directly off the log's own distinct `template_id` values.
--
-- The announcements row's `post_id` is a REAL, published post
-- (`2026-02-27-welcome-new-website`, "Welcome to the New Website"), the site's own most recently
-- published post as of this pass (verified against `src/content/.cairn/index.json`) and so
-- guaranteed to sit inside the Announce list's own `RECENT_POST_LIMIT` (15) window for a long
-- time -- a fabricated post id would never resolve through `posts.byId`, and the announce form
-- itself (`/admin/club/announce/<id>`) reads that index directly, not this database.
DELETE FROM email_log WHERE id LIKE 'eseed-%';
DELETE FROM announcements WHERE id LIKE 'eseed-%';

-- THE INCIDENT CLUSTER: 55 failed rows, one shared `error_detail`, chained ten seconds apart
-- (`2026-07-01 09:00:00` to `09:09:00`, a nine-minute window echoing the real 2026-07-14 quota
-- incident's own nine-minute span) across the two real template ids above, alternating row by
-- row. `groupEmailLog`'s own fold (`email-log-groups.ts`) requires only that consecutive FAILED
-- rows share one `error_detail` and chain at gaps under an hour; every ten-second gap here is
-- comfortably inside that window, so all 55 rows fold into exactly one incident display unit. 55
-- rows is deliberately more than `email/+page.svelte`'s own `INCIDENT_PAGE_SIZE` (50): expanding
-- this incident always spans more than one page of its own in-incident pager, the same shape the
-- 471-row live incident has (`email-log-groups.test.ts`'s own acceptance fixture), so this e2e
-- fixture exercises the real pager rather than a toy one-page stand-in.
INSERT INTO email_log (id, template_id, segment, recipient, subject, status, error_detail, sent_at) VALUES
  ('eseed-inc-01', 'renewal_reminder', NULL, 'e2e-eml-inc-1@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:00'),
  ('eseed-inc-02', 'class_welcome', NULL, 'e2e-eml-inc-2@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:10'),
  ('eseed-inc-03', 'renewal_reminder', NULL, 'e2e-eml-inc-3@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:20'),
  ('eseed-inc-04', 'class_welcome', NULL, 'e2e-eml-inc-4@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:30'),
  ('eseed-inc-05', 'renewal_reminder', NULL, 'e2e-eml-inc-5@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:40'),
  ('eseed-inc-06', 'class_welcome', NULL, 'e2e-eml-inc-6@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:00:50'),
  ('eseed-inc-07', 'renewal_reminder', NULL, 'e2e-eml-inc-7@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:00'),
  ('eseed-inc-08', 'class_welcome', NULL, 'e2e-eml-inc-8@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:10'),
  ('eseed-inc-09', 'renewal_reminder', NULL, 'e2e-eml-inc-9@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:20'),
  ('eseed-inc-10', 'class_welcome', NULL, 'e2e-eml-inc-10@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:30'),
  ('eseed-inc-11', 'renewal_reminder', NULL, 'e2e-eml-inc-11@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:40'),
  ('eseed-inc-12', 'class_welcome', NULL, 'e2e-eml-inc-12@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:01:50'),
  ('eseed-inc-13', 'renewal_reminder', NULL, 'e2e-eml-inc-13@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:00'),
  ('eseed-inc-14', 'class_welcome', NULL, 'e2e-eml-inc-14@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:10'),
  ('eseed-inc-15', 'renewal_reminder', NULL, 'e2e-eml-inc-15@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:20'),
  ('eseed-inc-16', 'class_welcome', NULL, 'e2e-eml-inc-16@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:30'),
  ('eseed-inc-17', 'renewal_reminder', NULL, 'e2e-eml-inc-17@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:40'),
  ('eseed-inc-18', 'class_welcome', NULL, 'e2e-eml-inc-18@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:02:50'),
  ('eseed-inc-19', 'renewal_reminder', NULL, 'e2e-eml-inc-19@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:00'),
  ('eseed-inc-20', 'class_welcome', NULL, 'e2e-eml-inc-20@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:10'),
  ('eseed-inc-21', 'renewal_reminder', NULL, 'e2e-eml-inc-21@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:20'),
  ('eseed-inc-22', 'class_welcome', NULL, 'e2e-eml-inc-22@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:30'),
  ('eseed-inc-23', 'renewal_reminder', NULL, 'e2e-eml-inc-23@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:40'),
  ('eseed-inc-24', 'class_welcome', NULL, 'e2e-eml-inc-24@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:03:50'),
  ('eseed-inc-25', 'renewal_reminder', NULL, 'e2e-eml-inc-25@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:00'),
  ('eseed-inc-26', 'class_welcome', NULL, 'e2e-eml-inc-26@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:10'),
  ('eseed-inc-27', 'renewal_reminder', NULL, 'e2e-eml-inc-27@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:20'),
  ('eseed-inc-28', 'class_welcome', NULL, 'e2e-eml-inc-28@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:30'),
  ('eseed-inc-29', 'renewal_reminder', NULL, 'e2e-eml-inc-29@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:40'),
  ('eseed-inc-30', 'class_welcome', NULL, 'e2e-eml-inc-30@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:04:50'),
  ('eseed-inc-31', 'renewal_reminder', NULL, 'e2e-eml-inc-31@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:00'),
  ('eseed-inc-32', 'class_welcome', NULL, 'e2e-eml-inc-32@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:10'),
  ('eseed-inc-33', 'renewal_reminder', NULL, 'e2e-eml-inc-33@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:20'),
  ('eseed-inc-34', 'class_welcome', NULL, 'e2e-eml-inc-34@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:30'),
  ('eseed-inc-35', 'renewal_reminder', NULL, 'e2e-eml-inc-35@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:40'),
  ('eseed-inc-36', 'class_welcome', NULL, 'e2e-eml-inc-36@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:05:50'),
  ('eseed-inc-37', 'renewal_reminder', NULL, 'e2e-eml-inc-37@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:00'),
  ('eseed-inc-38', 'class_welcome', NULL, 'e2e-eml-inc-38@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:10'),
  ('eseed-inc-39', 'renewal_reminder', NULL, 'e2e-eml-inc-39@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:20'),
  ('eseed-inc-40', 'class_welcome', NULL, 'e2e-eml-inc-40@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:30'),
  ('eseed-inc-41', 'renewal_reminder', NULL, 'e2e-eml-inc-41@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:40'),
  ('eseed-inc-42', 'class_welcome', NULL, 'e2e-eml-inc-42@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:06:50'),
  ('eseed-inc-43', 'renewal_reminder', NULL, 'e2e-eml-inc-43@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:00'),
  ('eseed-inc-44', 'class_welcome', NULL, 'e2e-eml-inc-44@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:10'),
  ('eseed-inc-45', 'renewal_reminder', NULL, 'e2e-eml-inc-45@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:20'),
  ('eseed-inc-46', 'class_welcome', NULL, 'e2e-eml-inc-46@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:30'),
  ('eseed-inc-47', 'renewal_reminder', NULL, 'e2e-eml-inc-47@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:40'),
  ('eseed-inc-48', 'class_welcome', NULL, 'e2e-eml-inc-48@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:07:50'),
  ('eseed-inc-49', 'renewal_reminder', NULL, 'e2e-eml-inc-49@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:00'),
  ('eseed-inc-50', 'class_welcome', NULL, 'e2e-eml-inc-50@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:10'),
  ('eseed-inc-51', 'renewal_reminder', NULL, 'e2e-eml-inc-51@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:20'),
  ('eseed-inc-52', 'class_welcome', NULL, 'e2e-eml-inc-52@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:30'),
  ('eseed-inc-53', 'renewal_reminder', NULL, 'e2e-eml-inc-53@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:40'),
  ('eseed-inc-54', 'class_welcome', NULL, 'e2e-eml-inc-54@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:08:50'),
  ('eseed-inc-55', 'renewal_reminder', NULL, 'e2e-eml-inc-55@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'Cloudflare Email Routing: daily send quota exceeded', '2026-07-01 09:09:00');

-- A HANDFUL OF SENT ROWS, all outside the incident's own nine-minute window (before, between, and
-- after it), so the send log's ordinary chronology has real successful sends around the incident,
-- and so the outcome filter's own "failed" option has real sent rows to hide.
INSERT INTO email_log (id, template_id, segment, recipient, subject, status, error_detail, sent_at) VALUES
  ('eseed-sent-01', 'renewal_reminder', 'current', 'e2e-eml-sent-1@aksailingclub.org', 'Your Alaska Sailing Club membership', 'sent', NULL, '2026-07-01 10:15:00'),
  ('eseed-sent-02', 'class_welcome', 'current', 'e2e-eml-sent-2@aksailingclub.org', 'You''re enrolled', 'sent', NULL, '2026-07-01 10:00:00'),
  ('eseed-sent-03', 'class_welcome', NULL, 'e2e-eml-sent-3@aksailingclub.org', 'You''re enrolled', 'sent', NULL, '2026-07-01 08:30:00'),
  ('eseed-sent-04', 'renewal_reminder', 'lapsed', 'e2e-eml-sent-4@aksailingclub.org', 'Your Alaska Sailing Club membership', 'sent', NULL, '2026-06-30 20:00:00'),
  ('eseed-sent-05', 'class_welcome', NULL, 'e2e-eml-sent-5@aksailingclub.org', 'You''re enrolled', 'sent', NULL, '2026-06-01 09:00:00');

-- A SINGLETON FAILURE: its own, different `error_detail`, more than an hour from any other failed
-- row, so `groupEmailLog` never folds it into the incident above -- it stays its own display unit,
-- carrying its own Failed chip, exactly like a real one-off bounce would.
INSERT INTO email_log (id, template_id, segment, recipient, subject, status, error_detail, sent_at) VALUES
  ('eseed-single-01', 'renewal_reminder', NULL, 'e2e-eml-single-1@aksailingclub.org', 'Your Alaska Sailing Club membership', 'failed', 'SMTP timeout: connection reset', '2026-06-15 12:00:00');

-- ONE ANNOUNCEMENTS ROW, so the Announce list's chip pair renders both states: this post shows
-- the "Announced" quiet chip with real detail text, and every other recent post (real content,
-- never announced in this fixture) shows the "Not announced" hairline-outline chip alongside it.
INSERT INTO announcements (id, post_id, post_title, emailed, email_count, discord_channel, actor, created_at) VALUES
  ('eseed-ann-01', '2026-02-27-welcome-new-website', 'Welcome to the New Website', 1, 42, 'general', 'e2e-owner@aksailingclub.org', '2026-07-02 09:00:00');
