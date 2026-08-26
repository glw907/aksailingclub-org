-- asc-club migration 0039 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 returns exactly one row naming `idx_email_log_sent_at` over `email_log(sent_at)`
-- in its `sql` text; query 2 returns one row whose `detail` names that index, proving the planner
-- actually reaches for it on the send log's own read rather than the index merely existing.
SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_email_log_sent_at';

EXPLAIN QUERY PLAN SELECT id, template_id, segment, recipient, subject, status, error_detail, sent_at
FROM email_log ORDER BY sent_at DESC, id DESC LIMIT 2000;
