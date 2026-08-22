# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-21).** The site runs cairn `^0.95.0` on `main`, merged through PR
#4 and deployed to dev.aksailingclub.org by `deploy.yml`. No initiative is in flight. The
apex cutover remains its own deliberate DNS change, never bundled with a push.

**Immediate next action (Geoff's).** Two before/afters on dev from the 0.95 pass, both
rendering changes under the one-check rule: the smartypants typography on any prose page
(curly quotes, real dashes; compare `/governance` against production), and the theme-flip
cross-fade plus the smaller DaisyUI sheet (toggle the theme on `/` and on a 404). Then a minted
preview link from any entry's editor ("Share preview"), opened in a private window.

**Open decisions.**
- `wrangler.toml` `compatibility_date` is `2026-07-06`; bumping it is a deliberate runtime
  change for its own small pass, not a ride-along.
- TypeScript 7 and `@types/node` 26 are held back on purpose (svelte-check compatibility; the
  Node 24 runtime). `@anthropic-ai/sdk` stays inside cairn's `^0.105` peer range.
- `prose.css` stays diverged from the showcase chassis by design (`src/chassis/README.md`,
  "Deliberate omissions"); re-syncing it is a design pass with a before/after.

**Carry-forwards from the 0.95 pass.** Five engine-side findings await the cairn harvest
(`docs/2026-08-21-cairn-0.95-adoption-harvest-findings.md`): the sveltekit barrel's reach into
`$app/environment`, a preview-safe `seo` from `previewLoad`, PreviewBanner's palette and expiry
formatting, and cairn's `.d.ts` importing `@cloudflare/workers-types`. Riders still open from
0.94: announce-list recency via `publishedAt`; baseline coverage for the stacked field register;
the `asset_requests` uniqueness race (needs a unique index, so a migration).

**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):**
the before/after on both rebuilt Assets screens on dev (/admin/club/assets and
/admin/club/asset-requests), which gates the apex (full entry in the archive);
the Classes before/after on dev (/admin/club/classes) and the 2026-07-21 probe
verdicts, including the three riders (StatusChip palette, the never-paid 'none'
copy, the search focus ring — the latter two since CLOSED; full entry archived);
the pass-B sidebar walkthrough per role (four-group tree, badges, the two class
surfaces, Help in the foot; full entry moved to the archive);
the attorney packet send (docs/waivers/, all DRAFTs; the sitting's full entry is in
the archive — sources verified live, register/fact gates run, board-packet.md carries
the Borough records-request path);
the waivers signing-moment before/after (dev renders the no-docs state; the moment is
visible in the CI-minted baselines and locally via the e2e fixtures — full build entry
in the archive);
member-directory before/afters (/my-account/directory, /my-account/committees, edit
surfaces, public /committees); portal redesign before/after against mock D (PR #1,
merge 510b266); the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md);
the five-stop dev walkthrough; the 07-15 apology-send verification; the fragments
/members before/after and the unfiled fragments harvest
(docs/2026-07-17-fragments-harvest-findings.md); the directory pass's DX-harvest notes
(shared portal section primitive, --container-measure-list token — in the archive
entry);
the board-demo cleanup after the board meeting (`node scripts/import/demo-household.mjs --cleanup`; full entry in the archive);
the retention step's before/after on /my-account/renew (https://claude.ai/code/artifact/6e29d1e8-1b9f-4d51-a133-9be3b8c0eecb);
the asset_requests uniqueness race (a double-click can still create two pending retention
rows; needs a unique index, so a migration, deliberately routed out of the substrate pass).
