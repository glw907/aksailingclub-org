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

**events-redesign (in flight, 2026-08-22).** Contract ratified and committed:
`docs/2026-08-22-events-redesign-design.md` (one long anchorable season page, alternating photo
bands, quieted past events, governance coda, four-entry subscribe bar, thin link-preview detail
route; events stay D1 and the no-events-concept ruling stays closed). Probe arc settled on
probe 3 (title "The 2026 Season"); arc log `docs/design-benchmark/events-redesign-round-1-arc.md`,
probe files machine-local at `~/.local/asc-data/probes/events-redesign/`. Build plan:
`docs/plans/2026-08-22-events-redesign.md` (five tasks, ceiling 1.5M, branch
`events-redesign-build`), awaiting Geoff's plan approval, the pass's one human gate. Open data
question for Geoff: `classes.fleet_tuneup` says `drop_in = 0` while its copy says no
registration is required.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
