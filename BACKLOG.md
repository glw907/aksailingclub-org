# BACKLOG

> Project issue tracker. Managed by `/log-issue`. Moved here from `ROADMAP.md` on 2026-10-14
> by the repo-organization pass; each entry's full text, with its rulings and history, is the
> last committed `ROADMAP.md` on `main` before that pass's merge (`git log --diff-filter=D -- ROADMAP.md`).

## High

- [ ] **#1** Admin screen redesign series (`admin-screen-passes`) `#initiative:asc-cutover` `#admin` *(2026-10-14)*
  The admin screens taken one at a time, each a full pass that opens with its own functional
  brainstorm. Shipped: Members, Classes, Events, Assets and asset requests, Email and Announce.
  Remaining: Settings (rides `season-rollover`), Committees (a light retrofit), and Money, later,
  once the table and form vocabulary exists. The apex cutover waits on this series (Geoff, 2026-08-22).
  Evidence: `docs/2026-07-20-admin-toolkit-catalog.md`.
- [ ] **#2** Payments hardening and live smoke (`payments-live-smoke`) `#initiative:asc-cutover` `#data` *(2026-10-14)*
  A named cutover blocker. The hardening half is on dev (Turnstile on the public POSTs, the
  rate-limit layer, the smoke memo). Open, on Geoff's go: his before/after on dev, the sandbox
  dry-smoke, then the live charge, refund, and revert. Spec `docs/2026-07-15-payments-live-smoke-design.md`,
  plan `docs/plans/2026-07-15-payments-live-smoke.md`.
- [ ] **#3** Go-live: apex cutover and MW retirement (`mw-cutover`) `#initiative:asc-cutover` `#infra` *(2026-10-14)*
  The final act: a fresh MW delta import, content pointed at the real join and renewal flows, the
  reminder cron re-enabled behind its blast guard, a fresh-context verification pass, Geoff's
  before/after, the apex flip, a two-week quiet soak, then the MW cancel and GCE retirement.
  Runbook: `docs/2026-07-15-mw-cutover-runbook.md`. Margin item: file Cloudflare's Email Sending
  Limit Increase form before cutover (200/day measured). Waits on #1 and #2.

## Medium

- [ ] **#4** Member directory brainstorm and pass (`member-directory`) `#feature` `#member-portal` *(2026-10-14)*
  The member-requested feature ranked first. Brainstormed 2026-07-17: spec
  `docs/2026-07-17-member-directory-design.md`, plan `docs/plans/2026-07-17-member-directory.md`.
  Opus-conducted, composed inside the portal design language.
- [ ] **#5** Member waivers and digital signing (`member-waivers`) `#feature` `#member-portal` *(2026-10-14)*
  Liability, mooring, and storage releases, re-signed each season, with a typed-name signature
  record. Brainstormed 2026-07-17: spec `docs/2026-07-17-member-waivers-design.md`, plan
  `docs/plans/2026-07-17-member-waivers.md`. Two units: a Fable sitting for the legal drafts and
  signing UX, then an Opus build after the directory. The club's attorney is the legal gate.
- [ ] **#6** Club notifications: announce-on-publish and SMS (`club-notifications`) `#feature` `#admin` *(2026-10-14)*
  The on-publish hook (cairn's `newlyPublishedEntries` seam) and an SMS channel: provider
  integration, A2P 10DLC registration (Geoff-attended, weeks of lead time), the STOP/HELP webhook,
  an SMS delivery log, and a portal Notifications row. Head-of-household by default with per-member
  opt-in. Groundwork: `docs/2026-08-25-email-announce-design.md`.
- [ ] **#7** Fragments migration and the DX/contract harvest (`fragments-migration`) `#improvement` `#site` *(2026-10-14)*
  Move repeated content onto cairn's Fragments (`::include{fragment="<id>"}`), starting from the
  nine ready cases in `docs/fragment-candidates.md`, verified against today's content. Drop a
  candidate that has one real consumer. Doubles as the first real fragments-consumer test, so it
  logs DX and contract failures tied to the capability. Check whether it already ran before scheduling.
- [ ] **#8** Class management (`class-management`) `#feature` `#admin` *(2026-10-14)*
  In-season tooling: attendance and check-in, roster exports, instructor self-serve rosters
  (check-in writes only), and class-fee refunds through the ledger, following the club's refund
  policy. Not a cutover blocker. Needs a live brainstorm, not an unattended run.
- [ ] **#9** Season rollover (`season-rollover`) `#feature` `#admin` *(2026-10-14)*
  The annual transition as one guarded, owner-only admin operation (preview, confirm, execute, with
  a per-season audit row): `current_season`, new class instances, the registration gate, renewal
  season assignment, seasonal storage re-up, the `waiver_text_version` review, and season-stamped
  copy. Precedent: the legacy ops `startNewSeason`. Needs a live brainstorm.

## Low

- [ ] **#10** Design propagation and continuing rounds (`design-propagation`) `#improvement` `#site` *(2026-10-14)*
  Page-by-page confirmation against the design contract, grouped by template kind, with the
  `.page-cta` rollout to its five queued pages, the posts and bulletins composition spec, and the
  polish backlog (`docs/2026-07-07-polish-backlog.md`). Ledger: `docs/design-benchmark/page-confirmations.md`.
- [ ] **#11** QuickBooks Online integration (`qbo-integration`) `#feature` `#data` *(2026-10-14)*
  Sync ledger rows to QuickBooks: `qbo_ref`, entity mapping, OAuth and API plumbing. Phase 2,
  after the MW replacement program.

## Closed
