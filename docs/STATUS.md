# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-23).** The site runs cairn `^0.96.0`; the `events-admin` pass is
complete on PR #8 (branch `events-admin`): the series ledger, roll-forward, in-place row form,
and hero picker, with migrations `0035_event_series` and `0036_event_indexes` APPLIED LIVE
(records in their READMEs; 0035's rollback is expired). Four domain reviews, three cold
coherence reads, and four fix rounds are folded in; the third read passed 1440 at a glance and
its five 390 defects are fixed and measured (`723eb56`). Held for a probe round with Geoff:
the native date inputs beside typeset columns, the hero picker's shape, the racing dot's
semantic blue, and the 390 view dropping the prior-season columns. Harvest:
`docs/2026-08-22-events-admin-harvest-findings.md` (11 findings). The apex cutover remains its
own deliberate DNS change, never bundled with a push.

**Immediate next action (Geoff's).** The events before/after (below). Also from 0.95/0.96,
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

**Carry-forwards.** The five 0.95 engine findings shipped in cairn 0.96 and their harvest doc
is gone. Riders still open from 0.94: announce-list recency via `publishedAt`; baseline
coverage for the stacked field register; the `asset_requests` uniqueness race (needs a unique index, so a migration).

**events-redesign (merged and deployed to dev, 2026-08-22).** PR #6 (`dad4821`) plus the
post-merge header round PR #7 (`f527f53`: three-element header, attached month tabs, month
chapter headings; decisions.md has the rulings) are on dev.aksailingclub.org; the record: contract `docs/2026-08-22-events-redesign-design.md`, plan
`docs/plans/2026-08-22-events-redesign.md`, ledger entry in `docs/HISTORY.md`. Gates green
(check 0/0, 2105 tests, build); the four domain reviews' findings are fixed. Geoff's steps:
(1) the before/after on dev, `/events` at 1440 and 390 (Register shows only on a real open
class); (2) the fresh-context coherence read is owed (session closed at its ceiling); (3) the
`fleet_tuneup` data call (drop-in or registration). Harvest to cairn: `docs/2026-08-22-events-redesign-harvest-findings.md` (eight
findings, incl. site-wide smooth scroll as an engine default and the dead-body content entry).

**Next pass (prep, 2026-08-22; Geoff's pick 2026-08-22: the admin series gates the cutover).**
`admin-screen-passes`, Events admin: the public page now exercises every field that screen
edits (descriptions, times, location, photos, the governance category, `drop_in`), so the
functional brainstorm has fresh evidence. Same shape as this pass: functional brainstorm first
(superpowers:brainstorming), probe from the real admin shell with live rows, toolkit harvest to
cairn at close. Inputs: `docs/2026-07-20-admin-toolkit-catalog.md`, the Members and Classes
pass entries in `docs/HISTORY.md`/`status-archive.md`, `docs/2026-08-22-events-redesign-design.md`
(what the public page needs authored). Resume prompt: "Start the Events admin pass: read
ROADMAP.md's admin-screen-passes entry and docs/STATUS.md, then open the functional brainstorm
with Geoff before any visual work." Launch a fresh session from this repo.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
