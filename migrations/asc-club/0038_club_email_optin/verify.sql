-- asc-club migration 0038 verify: run via `--command` (all SELECTs, no `--file`, which silently
-- drops SELECT output; see 0005_member_domain/README.md's own Verify section for why).
--
-- Expect: query 1 returns exactly one row for `club_email_opt_in` with `type` INTEGER, `notnull`
-- 1, and `dflt_value` 0; query 2 returns one row whose `opted_in` count is 0 and whose `total`
-- is the live member count, proving the default landed on every existing row rather than a NULL
-- the NOT NULL clause would have rejected.
SELECT name, type, "notnull", dflt_value FROM pragma_table_info('members') WHERE name = 'club_email_opt_in';

SELECT COUNT(*) AS total, SUM(club_email_opt_in) AS opted_in FROM members;
