# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-25).** The site runs cairn `^0.96.0`. The `assets-register` pass is
complete: PR #10 merged and deployed to dev, both Assets admin screens at the events register
bar, the storage rename live, migration `0037` (pending-request unique index) applied to
remote. The record: `docs/design-benchmark/decisions.md` (the 2026-08-25 settle),
`docs/HISTORY.md` (2026-08-25), harvest `docs/2026-08-24-assets-register-harvest-findings.md`.
Events-admin and its probe round (PRs #8/#9) are likewise settled and on dev. The apex
cutover remains its own deliberate DNS change. Next initiative: the Email + Announce pass,
prepped — the brief is `docs/2026-08-25-email-announce-prep-brief.md` (five screens mapped,
the 471-row email_log cluster is one CLOSED 2026-07-14 quota incident, not a backlog; two
probe subjects; nine-task first cut; the split fork if announce-on-publish or a Compose
rework enters). Resume prompt for a fresh session: "Start the Email + Announce pass: read
docs/STATUS.md and docs/2026-08-25-email-announce-prep-brief.md, then run the functional
brainstorm with Geoff (the brief's section 5 holds the eight open questions)."

**Immediate next action (Geoff's).** The assets before/after (delivered 2026-08-25 as a
machine-local HTML file in the session; ask for a re-send if lost) — it gates the apex, and
carries one explicit call: the 10px StatusChip payment-standing ink, graded legible-but-at-
the-floor. Then the standing dev queue: `/admin/club/events` and `/events` at 1440/390,
smartypants on `/governance`, the theme-flip cross-fade on `/` and a 404, a minted "Share
preview" link in a private window, one Tidy run.

**Open decisions.**
- `wrangler.toml` `compatibility_date` is `2026-07-06`; bumping it is a deliberate runtime
  change for its own small pass, not a ride-along.
- TypeScript 7 and `@types/node` 26 are held back on purpose (svelte-check compatibility; the
  Node 24 runtime). `@anthropic-ai/sdk` stays on `^0.105`, inside cairn's widened `>=0.105.0 <1` peer range.
- `prose.css` stays diverged from the showcase chassis by design (`src/chassis/README.md`,
  "Deliberate omissions"); re-syncing it is a design pass with a before/after.

**Carry-forwards.** From 0.94: announce-list recency via `publishedAt` (rides the Email +
Announce pass); baseline coverage for the stacked field register. From assets-register's
reviews, deferred deliberately: `payForApprovedRequest`'s three-write money path wants
`db.batch()` atomicity; the review inbox's per-row prior-holding query is N+1; the household
desk's asset chip is still hand-rolled (migrates when StatusChip absorbs the register,
harvest finding 1); the four `isUniqueViolation` copies consolidate onto the `errorText`
shape; the committees subtitle still carries a "(s)" plural; the two Assets admin screens
have no visual-baseline coverage. Probe infra for future Assets work:
`~/.local/asc-data/probes/assets-register/` (bootstrap, then the seed; admin session recipe
`e2e/helpers/admin-session.ts`).

**events-redesign (merged and deployed to dev, 2026-08-22).** PRs #6 and #7 are on dev;
contract `docs/2026-08-22-events-redesign-design.md`, ledger entry in `docs/HISTORY.md`.
Geoff's steps: the before/after (`/events` at 1440 and 390; Register shows only on a real open
class) and the owed fresh-context coherence read. Harvest:
`docs/2026-08-22-events-redesign-harvest-findings.md`.

**Geoff's review queue (full entries in docs/status-archive.md).** Before/afters on dev: the
rebuilt Assets screens (gates the apex), Classes, the pass-B sidebar walkthrough per role, the
waivers signing moment, member directory and committees, the portal redesign against mock D,
the retention step on /my-account/renew, the fragments /members page. Also: the attorney packet
send (docs/waivers/), the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md),
the five-stop dev walkthrough, the 07-15 apology-send verification, the unfiled fragments
harvest (docs/2026-07-17-fragments-harvest-findings.md), the directory pass's DX notes, and the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
