# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-22).** The site runs cairn `^0.96.0` (the floors release: Node 24,
Kit 2.70, Svelte 5.56.10) on branch `cairn-0.96-adoption`, awaiting its PR onto `main`;
`main` itself carries 0.95, deployed to dev.aksailingclub.org by `deploy.yml`. No initiative is
in flight. The apex cutover remains its own deliberate DNS change, never bundled with a push.

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

**Next pass (prep, 2026-08-21; the pick is Geoff's).** Recommended: `events-redesign`, the
public events page from scratch on its own template. ROADMAP's "then converge" paragraph makes
it the last member-surface pass before the cutover queue clears (directory and waivers are
shipped). Resume prompt: "Start the events-redesign pass: read ROADMAP.md's events-redesign
entry and docs/STATUS.md, then open the functional brainstorm with Geoff
(superpowers:brainstorming) before any visual work; the current page's timeline, chips, and
season machinery are requirements evidence, not a design to keep." Alternative: the next
`admin-screen-passes` screen (Events admin, or Email + Announce as one pass), same shape:
functional brainstorm first, toolkit harvest to cairn at close. Inputs either way:
`docs/2026-07-06-asc-phase-1-design.md`, `docs/image-standard.md`, `docs/design-benchmark/`,
`docs/events-integration-findings.md` (the read-only `EVENTS_DB` shape), and the 0.95 harvest
doc's open engine findings. Launch a fresh session from this repo.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
