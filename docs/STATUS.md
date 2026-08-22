# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-22).** The site runs cairn `^0.96.0` (the floors release: Node 24,
Kit 2.70, Svelte 5.56.10) on `main`, merged through PR #5 and deployed to dev.aksailingclub.org
by `deploy.yml`. In flight: the `events-redesign` build pass on branch `events-redesign-build`,
executing `docs/plans/2026-08-22-events-redesign.md` through the pass-execute workflow. The
apex cutover remains its own deliberate DNS change, never bundled with a push.

**Immediate next action (Geoff's).** Two before/afters on dev from the 0.95 pass, both
rendering changes under the one-check rule: the smartypants typography on any prose page
(curly quotes, real dashes; compare `/governance` against production), and the theme-flip
cross-fade plus the smaller DaisyUI sheet (toggle the theme on `/` and on a 404). Then a minted
preview link from any entry's editor ("Share preview"), opened in a private window; once the
0.96 branch deploys, the banner's expiry reads in Alaska time. Also one Tidy run after that
deploy, since its default model moved to `claude-sonnet-5`.

**Open decisions.**
- `wrangler.toml` `compatibility_date` is `2026-07-06`; bumping it is a deliberate runtime
  change for its own small pass, not a ride-along.
- TypeScript 7 and `@types/node` 26 are held back on purpose (svelte-check compatibility; the
  Node 24 runtime). `@anthropic-ai/sdk` stays on `^0.105`, inside cairn's widened `>=0.105.0 <1` peer range.
- `prose.css` stays diverged from the showcase chassis by design (`src/chassis/README.md`,
  "Deliberate omissions"); re-syncing it is a design pass with a before/after.

**Carry-forwards.** The five 0.95 engine findings shipped in cairn 0.96 and their harvest doc
is gone. Riders still open from 0.94: announce-list recency via `publishedAt`; baseline
coverage for the stacked field register; the `asset_requests` uniqueness race (needs a unique index, so a migration).

**events-redesign (in flight, 2026-08-22).** Contract ratified and committed:
`docs/2026-08-22-events-redesign-design.md` (one long anchorable season page, alternating photo
bands, quieted past events, governance coda, four-entry subscribe bar, thin link-preview detail
route; events stay D1 and the no-events-concept ruling stays closed). Probe arc settled on
probe 3 (title "The 2026 Season"); arc log `docs/design-benchmark/events-redesign-round-1-arc.md`,
probe files machine-local at `~/.local/asc-data/probes/events-redesign/`. Build plan:
`docs/plans/2026-08-22-events-redesign.md` (five tasks, ceiling 1.5M, branch
`events-redesign-build`), approved by Geoff 2026-08-22. Tasks 1 through 4 plus one
consolidated fix round are committed and pushed (`bf1097b`..`2712339`; workflow
`wf_ae294cae-ef0`; about 1.3M of the 1.5M ceiling spent). PR #6 is open and the
`update_snapshots` CI dispatch is regenerating the baselines on the branch. Remaining for
task 5, paused at the 80% line for Geoff's ceiling call: the fix round's `diff-reviewer`
read, the reviewer fan-out (svelte, a11y, workers), the fresh-context coherence read at 390
and 1440, the close docs (HISTORY, decisions.md, ledger, ROADMAP, harvest findings), then
Geoff's before/after on dev and his merge. Open data
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
