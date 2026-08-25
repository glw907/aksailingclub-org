# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-24).** The site runs cairn `^0.96.0`. The `events-admin` pass (PR #8)
and its probe round (PR #9, branch `events-probe-settle`) are complete: Geoff ruled the four
held questions (dates typeset at rest, hero picker closed at rest, category color on tinted
chip grounds toolkit-wide, the 390 prior-season drop ratified), the build's own cold read
failed on five reflow/register tells, and the fix round re-measured to a CLEAN verdict. The
record: `docs/design-benchmark/decisions.md` (both 2026-08-24 entries), the ledger entry in
`docs/HISTORY.md`, harvest `docs/2026-08-22-events-admin-harvest-findings.md` (12 findings,
finding 12 is StatusChip's tinted-ground grammar as an engine ask). Migrations `0035`/`0036`
are live from PR #8. The apex cutover remains its own deliberate DNS change.

**Immediate next action (Geoff's).** The events before/after on dev: `/admin/club/events` at
1440 and 390 (the settled ledger) and `/events` from the redesign below. Also from 0.95/0.96,
on dev: smartypants typography on a prose page (compare `/governance` against production),
the theme-flip cross-fade on `/` and a 404, a minted "Share preview" link in a private window
(the banner's expiry now reads in Alaska time), and one Tidy run (`claude-sonnet-5` default).

**Open decisions.**
- `wrangler.toml` `compatibility_date` is `2026-07-06`; bumping it is a deliberate runtime
  change for its own small pass, not a ride-along.
- TypeScript 7 and `@types/node` 26 are held back on purpose (svelte-check compatibility; the
  Node 24 runtime). `@anthropic-ai/sdk` stays on `^0.105`, inside cairn's widened `>=0.105.0 <1` peer range.
- `prose.css` stays diverged from the showcase chassis by design (`src/chassis/README.md`,
  "Deliberate omissions"); re-syncing it is a design pass with a before/after.

**Carry-forwards.** Riders still open from 0.94: announce-list recency via `publishedAt`;
baseline coverage for the stacked field register. The `asset_requests` uniqueness race (a
unique-index migration) rides the Assets pass below.

**events-redesign (merged and deployed to dev, 2026-08-22).** PRs #6 and #7 are on dev;
contract `docs/2026-08-22-events-redesign-design.md`, ledger entry in `docs/HISTORY.md`.
Geoff's steps: the before/after (`/events` at 1440 and 390; Register shows only on a real open
class) and the owed fresh-context coherence read. Harvest:
`docs/2026-08-22-events-redesign-harvest-findings.md`.

**Next pass (prep, 2026-08-24; Geoff's pick: Assets + asset-requests).** The
`admin-screen-passes` series continues with the Assets and asset-requests screens. Same shape:
functional brainstorm first (superpowers:brainstorming), probe from the real admin shell with
live rows, toolkit harvest to cairn at close. Inputs: the four 2026-07-29/30 assets docs
(functional design + input, the substrate plan, the substrate harvest),
`docs/2026-07-20-admin-toolkit-catalog.md`, and the Events pass entries in `docs/HISTORY.md`.
Riders: the `asset_requests` uniqueness race migration; the `asset_types` id defect is already
fixed (`0034`, applied live 2026-07-30). Resume prompt: "Start the
Assets admin pass: read ROADMAP.md's admin-screen-passes entry and docs/STATUS.md, then open
the functional brainstorm with Geoff before any visual work." Launch a fresh session here.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
