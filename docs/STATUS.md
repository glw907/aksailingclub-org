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

**assets-register pass (IN FLIGHT, 2026-08-24, branch `assets-register`).** Contract
`docs/2026-08-24-assets-register-design.md` (six brainstorm rulings); plan
`docs/plans/2026-08-24-assets-register.md` (five probe verdicts, six tasks). Geoff granted
proceed-to-completion, pushing, and next-pass prep (Email + Announce) with a workflow; the
before/after folds into this pass's close and still gates the apex. Ledger: T1 accepted after
a ruled fix round (`a3b3f1e`+`1c3bc0b`; outline holds the 55% hairline at a >=3:1 border
floor, tinted grounds hold the 1.16-1.47 band, warning ink carries the tone, wiring is
per-page `import '$theme/admin-chip-registers.css'`); T4 accepted (`20751e4`); T5 accepted
(`fa756d2`; four portal baselines stale by content, regenerate at close); T2 accepted after
one fix round (`e151a09`+`3684198`, heading typography restored under the toggle's
`font: inherit`); the ruled micro-change landed (`7f59fd2`); T3 accepted (`339007b`;
`displayDescription` vacuously satisfied, no description field reaches that screen, reviewer
verified); T6 accepted (`eb6d983`; index `uq_asset_requests_pending_household_type` applied
to remote asc-club, zero rows pre-apply, remote DDL verified byte-identical; the uniqueness
carry-forward is discharged). All tasks done; the close sequence is next per the plan's
"Order and close", preceded by a small cleanup dispatch for three review findings (negative
non-UNIQUE test case, stale `assets-format.ts` consumer comment, README future-date).
Close carry list from reviews: `hidden="until-found"` on collapsed groups; stripe-box
asymmetry on first/last assets rows; the rounded stripe on asset-requests rows (design call
at the render read); the 390 `scrollWidth` measurement is load-bearing against T2's
negative-margin bleed; asset-requests gets an explicit capture stop (no visual baseline);
ratify the accordion-pattern substitution (button+`aria-expanded`, not `details/summary`) in
decisions.md; harvest now records a FOURTH `isUniqueViolation` copy (consolidation trigger).
Spend ~1.35M agent tokens against the 1.5M ceiling; close will overrun, record per the
events precedent. Probe infra: seed +
captures + verify at `~/.local/asc-data/probes/assets-register/` (apply: bootstrap, then
`wrangler d1 execute asc-club --local --file .../probe-seed.sql`; capture script copy in the
session scratchpad; admin session recipe `e2e/helpers/admin-session.ts`). Sequential
implementer dispatches only, pathspec'd commits (a parallel pair raced the index once).
Resume prompt: "Resume the assets-register pass at the close: read docs/STATUS.md's
assets-register entry and the plan's 'Order and close'; run the cleanup dispatch, simplifier,
fan-out, cold read, baselines, PR/merge/deploy, artifacts." Launch from this repo.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
