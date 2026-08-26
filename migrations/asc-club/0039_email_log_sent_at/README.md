# asc-club migration 0039: an ordering index for the send log

## What this does

Email + Announce plan (`docs/plans/2026-08-25-email-announce.md`, "Task 1: the audience model",
which owns both of the pass's migrations so one task owns every e2e bootstrap edit). Adds one
index:

```sql
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);
```

`email_log` has carried no index of any kind since `0007_assets_email` created it. Column names
confirmed against that file's own `CREATE TABLE email_log`; no later migration alters its shape.

## Why

The Email index screen's rebuild (design contract ruling 5) reads the whole send log ordered
`sent_at DESC, id DESC` on every load rather than a page of it, because grouping the 2026-07-14
quota incident has to run over the full chronology before any filtering or paging. 750 live rows
today, 471 of them that one incident. The sort is the read's own cost, and this index is what
turns it into an index scan.

## Performance only

No query depends on this index for correctness. The read's own `ORDER BY` is what makes the log
deterministic, and the `id` tie-break is what makes it stable across a client-side page boundary
(`sent_at` is second-granular and `id` is a random UUID, so ties without one would repeat or drop
a row across the boundary). A composite index on `(sent_at, id)` would buy nothing: the ties are a
handful of rows inside one second, never the scan.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0039_email_log_sent_at/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0039_email_log_sent_at/verify.sql)"
```

Expect: query 1 returns exactly one row naming `idx_email_log_sent_at` over `email_log(sent_at)`
in its `sql` text; query 2 (an `EXPLAIN QUERY PLAN` over the send log's own read) returns a row
whose `detail` reads `SCAN email_log USING INDEX idx_email_log_sent_at`. The second query is the
one worth reading: an index that exists but that the planner declines to use would buy nothing,
and only the plan shows that.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0039_email_log_sent_at/rollback.sql
```

Safe any time: dropping an index never discards data, matching every other index-only rollback in
this directory. Nothing breaks functionally; the send-log read just sorts without it again.

## Scratch-proof procedure (run 2026-08-25, before any live apply)

Same disposable local replica as `0038_club_email_optin`'s own proof, which records steps 1
through 3 (migrations 0001 through 0037 applied clean, then seeded). Continuing there:

4. **Pre-migration probe**: `sqlite_master` returns no `idx_email_log_sent_at` row.
5. **`forward.sql`**: **succeeds.**
6. **`verify.sql`**: query 1 returns the one index row, `sql` text
   `CREATE INDEX idx_email_log_sent_at ON email_log(sent_at)`. Query 2 returns
   `SCAN email_log USING INDEX idx_email_log_sent_at` plus
   `USE TEMP B-TREE FOR LAST TERM OF ORDER BY` — the planner reaches for the index on the
   `sent_at` leg and sorts the `id` ties itself, which is exactly the split the "performance only"
   section above predicts and the reason a composite index is not worth adding.
7. **Rollback** (`rollback.sql`): **succeeds.** `sqlite_master` re-read: the index is gone.
8. **Forward again**: **succeeds.**
9. Scratch persistence directory deleted.

No unexpected error at any step; every check resolved to its expected value, both directions.

## Local replica

The repo's own local `.wrangler/` replica also received `forward.sql` (no `--persist-to` flag).
`e2e/fixtures/bootstrap-club-db.mjs` gained an `indexExists('idx_email_log_sent_at')` warm-replica
probe in the same task, which covers a workstation replica that skipped this step.

## Live apply

Left to the pass conductor at close, per the plan's own dispatch note. The committed SQL is
byte-identical to what was applied to the scratch replica and to the repo's local replica.
