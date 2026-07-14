-- Verifies 0022_join_emails: the widened CHECK accepts 'join' (and 'donation'), and both
-- templates are seeded with their defaults backfilled.
--
--   npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0022_join_emails/verify.sql
--
-- Expected: kind_sql's text contains both "'donation'" and "'join'"; join_welcome_present = 1;
-- board_join_notice_present = 1; join_welcome_defaults_match = 1; board_join_notice_defaults_match = 1.
SELECT sql AS kind_sql FROM sqlite_master WHERE type = 'table' AND name = 'processed_stripe_sessions';
SELECT COUNT(*) AS join_welcome_present FROM email_templates WHERE id = 'join_welcome';
SELECT COUNT(*) AS board_join_notice_present FROM email_templates WHERE id = 'board_join_notice';
SELECT (default_subject = subject AND default_body = body) AS join_welcome_defaults_match FROM email_templates WHERE id = 'join_welcome';
SELECT (default_subject = subject AND default_body = body) AS board_join_notice_defaults_match FROM email_templates WHERE id = 'board_join_notice';
