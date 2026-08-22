# asc-auth migration 0002: share-a-draft preview tokens

## What this does

Adds `preview_tokens` to `AUTH_DB` (database `cairn-asc-auth`, this site's own magic-link auth
store, distinct from `asc-club`, which `migrations/asc-club/` owns): the schema cairn's
share-a-draft preview feature needs to serve a minted link at `/preview/[token]`. Adopted
verbatim from cairn's own `node_modules/@glw907/cairn-cms/migrations/0003_preview.sql`, renumbered
into this repo's own `asc-auth` migration sequence (`0001_role_rename` is this site's first
`asc-auth` migration, a data-only `UPDATE`; this is the first schema change since the frozen
`0000_auth.sql` seed).

`token_hash` stores only the SHA-256 digest of the minted token (`hashToken`, the same idiom
`magic_token` already uses), never the plaintext; `expires_at`/`created_at` are epoch
milliseconds, matching `magic_token` and `session`. `concept`/`entry_id` name the draft the token
shares, `editor` the minting editor's email.

This is part of the cairn 0.95.0 adoption pass's T4
(`docs/plans/2026-08-21-cairn-0.95-adoption.md`): the release ships the "Share preview" control in
every editor's single-mount facade regardless of whether a site has mounted the route, so shipping
the engine bump without this migration and the `/preview/[token]` route
(`src/routes/(site)/preview/[token]/`) would hand an editor a control that mints a link nothing
resolves.

## Why this is a schema migration, not a data migration

`preview_tokens` is a wholly new table with no prior shape to reconcile; `CREATE TABLE`/`CREATE
INDEX`, no rewrite of `editor`/`magic_token`/`session`.

## Deploy order

Apply this **after** the code that mounts `/preview/[token]` and the "Share preview" mint action
has deployed and is serving, not before. `previewLoad` itself degrades safely ahead of that:
a missing `AUTH_DB` binding (impossible here, already bound) or a missing `preview_tokens` table
(the pre-migration state) both resolve to the same 404/503 a bad or expired token already
produces, so there is no unsafe window on this side. Applying the migration before the route
deploys is also harmless (an unused table sits idle); the stated order is a matter of not minting
a link an unreleased route cannot yet serve, not a lockout risk.

## How to run

```sh
source ~/.local/secrets && npx wrangler d1 execute cairn-asc-auth --remote --file migrations/asc-auth/0002_preview/forward.sql
```

## Verify

```sh
source ~/.local/secrets && npx wrangler d1 execute cairn-asc-auth --remote --command "$(grep -v '^--' migrations/asc-auth/0002_preview/verify-forward.sql)"
```

Expect three rows: the `preview_tokens` table and its two indexes.

## Applied to the real database (2026-08-21)

Applied with the `How to run` command above against the live `cairn-asc-auth` database, then
confirmed with `Verify`: `verify-forward.sql` returned the expected three rows,
`idx_preview_tokens_concept_entry` (index), `idx_preview_tokens_expires_at` (index), and
`preview_tokens` (table). No prior `preview_tokens` table existed (checked first via `SELECT
name FROM sqlite_master WHERE type IN ('table','index') AND name LIKE '%preview%'`, which
returned no rows), so this was a clean first application, not a re-run.

## Rollback

```sh
npx wrangler d1 execute cairn-asc-auth --remote --file migrations/asc-auth/0002_preview/rollback.sql
```

Safe any time before a real preview link is minted against the table; once a link is live,
rolling back drops every outstanding token along with the table.

## Scratch-proof procedure

Per the repo's standing migration discipline (mirroring `migrations/asc-auth/0001_role_rename/README.md`'s
own recipe):

1. Fresh, disposable `--persist-to` directory, distinct from the repo's own `.wrangler/` state.
2. Apply the root `migrations/0000_auth.sql` (the frozen seed), then cairn's own
   `node_modules/@glw907/cairn-cms/migrations/0001_roles.sql` and `0002_audit.sql` (reproducing
   the live shape this migration targets, both `--local --persist-to <scratch dir>`).
3. Apply `forward.sql`.
4. **Verify**: run `verify-forward.sql`; expect three rows (`preview_tokens`,
   `idx_preview_tokens_expires_at`, `idx_preview_tokens_concept_entry`).
5. **Rollback**: apply `rollback.sql`; confirm no error.
6. **Verify-rollback**: run `verify-rollback.sql`; expect zero rows.
7. **Forward again**: re-apply `forward.sql`; confirm no error.
8. Delete the scratch persistence directory.

See the task report for the full transcript.
