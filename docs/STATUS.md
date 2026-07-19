# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**IN FLIGHT (2026-07-18 evening, Fable session): THE WAIVERS BUILD WORKFLOW + THE
ADMIN-SIDEBAR-2 BRAINSTORM ran in one session (Geoff: "proceed with a workflow to
release").** State at save:

- **Waivers build: workflow `wf_07d3ab70-09b` running** (script:
  `~/.claude/projects/-home-glw907-Projects-aksailingclub-org/6a3016c7-c503-45a2-b8d9-f11f55af4ed4/workflows/scripts/waivers-build-wf_07d3ab70-09b.js`;
  resume with scriptPath + resumeFromRunId — completed tasks replay from cache; read
  the transcript dir's journal.jsonl first). Base SHA 3904d7d. T1–T4 LANDED green with
  per-task Opus reviews (T1 documents concept + freeze guard; T2 migration 0029 applied
  LIVE; T3 requirement engine; T4 signing flow + 0030 contact-confirm). T5 escalated
  correctly (money-critical underspec); CONDUCTOR RULING: recompute-at-unlock through
  ONE shared checkout builder extracted from handleJoinApply (nothing money-derived
  stored; metadata-equality test both ways); T5 decomposed into T5a (gate seam +
  retirement + no-published-docs pass-through — the SHIPPED state, all docs DRAFT),
  T5b (authenticated gates: renewal/asset/class + emails), T5c (join magic-link handoff
  + payment resume, Opus). Still owed in-workflow: T6 admin rollup, simplifier, the
  4-lens review gate (auth/svelte/a11y/workers, adversarial verify, fix), T8 tests,
  and a tail "prep next pass" phase whose output doc
  (docs/2026-07-18-admin-sidebar-2-prep.md) is SUPERSEDED by the ratified spec —
  DELETE it on arrival, don't keep it. AFTER the workflow: review results + full
  diff, close ritual (arc-log distill into decisions.md + remove, architecture,
  STATUS trim, memory), PUSH to main (= the dev release; main holds unpushed local
  commits — docs and build — so no push before the gate is verified), CI
  update_snapshots dispatch for the new visual baselines (READ the log), fresh-context
  coherence read at 390/1440. Geoff's queue: the signing-moment before/after on dev.
- **Admin-sidebar-2: brainstormed live with Geoff, spec DRAFT committed**
  (docs/2026-07-18-admin-sidebar-2-design.md; ratified: purpose-first 4-group tree,
  Signups screen RETIRES fully (joins are automatic; board_join_notice email is the
  notification), bulletins/notifications RE-UNIFIED to the production bulletins model,
  relabel sweep, five plain-function roles (Administrator/Club manager/Webmaster/
  Publisher/Instructor), function-first security (one permission map; categories
  cosmetic; matrix generated/tested from the map), role-scoped pending-actions
  notifications). BRAINSTORM STILL OPEN per Geoff: probe verdicts owed (open/closed
  defaults, 25-icon assignment, within-group order) + whatever he raises next.
  SEQUENCING: cairn engine pass FIRST — the handoff is
  docs/2026-07-18-cairn-sidebar-seams-consumer-brief.md (four seams; Geoff runs it in
  ~/Projects/cairn-cms; resume prompt in that brief's session note below), then the
  ASC pass rides the bump. Cairn-session resume prompt: "Start the sidebar-seams
  engine pass: read ~/Projects/aksailingclub-org/docs/2026-07-18-cairn-sidebar-seams-consumer-brief.md,
  then invoke cairn-pass to brainstorm the API shapes and plan the four seams as one
  minor release, ASC the named first consumer." ASC-session resume prompt (post-clear):
  "Continue the admin-sidebar-2 brainstorm: read docs/2026-07-18-admin-sidebar-2-design.md
  (DRAFT) and ROADMAP's admin-sidebar-2 entry; owed: probe-round verdicts (defaults/
  icons/order) and Geoff's remaining topics; then finalize the spec and plan the ASC
  pass (waits on the cairn seams release)."

**THE FABLE WAIVERS SITTING IS DONE (2026-07-18): the T7 attorney-draft packet and the
T4 signing-experience design are both delivered.** What landed:

- **The draft packet, `docs/waivers/`** (all DRAFTs for the attorney; nothing in force):
  the 2027 general release (Donahue-shaped, cold-water immersion named, AS 09.65.292
  minors Part Two), rules acknowledgement, mooring agreement (tackle split at the ball,
  assumed ground-tackle failure, zero inspection language, insurance both ways), dry
  storage agreement (no-bailment, unsecured-lot statement, Borough 72-hour covenant,
  contractual lien/abandonment, insurance both ways), three per-asset acknowledgements
  (Trailer Row / boat parking / rack — Geoff's mid-sitting note "folks accept specific
  rules per asset" is exactly these), the youth medical field set, the signing framing
  copy (finished words for the build), the Donahue pre-publish checklist, and
  `board-packet.md` (inventory, board decisions, attorney questions, discrepancy memo).
- **Sources verified, not assumed:** the current MW join-form release captured live from
  the widget (it never says "negligence" — the core defect the redraft cures); the full
  MSB006789 text confirmed to carry NO 72-hour/RV language; the 72-hour clause traces to
  the pre-2022 Borough permit ("under Borough Permit since 2013" per the Borough
  manager's Apr–Jun 2022 report), which is NOT publicly posted — the board packet
  carries the records-request path (Land & Resource Mgmt Division).
- **Review gates run:** Vale (cairn slop styles clean), the register editor (findings
  applied, e.g. "named plainly" killed across three documents), an Opus facts pass
  (every citation/figure verified; 4 low findings applied), and an independent critic on
  the framing copy (5 high findings applied — framing lines no longer characterize legal
  effect).
- **The T4 probe deck** (scratchpad/signing-probe/, arc log
  `docs/design-benchmark/waivers-signing-round-1-arc.md`): the signing moment grounded
  in the real release draft at 1440/390 both themes — sheet vs inline candidates,
  collapsed-receipt progress, filled-navy Sign, contact-confirm glance card. **BOTH
  PROBE ROUNDS ARE FULLY VERDICTED same-day** (arc log): inline text at both widths;
  round 2 added the household paths — one Part Two entry per child, "type once, sign
  each" (attorney confirms), attestation radios in the strip, and the
  HOUSEHOLD-COMPLETE GATE (spec decision 7 amended 2026-07-18): no payment, no class
  registration, no joined state until every member signs; incomplete applications
  simply remain incomplete (signatures precede payment, so nothing is held); the
  waiting state + nudge email + resumption email close the loop (copy in
  signing-framing-copy.md).

**IMMEDIATE NEXT ACTION: the waivers BUILD session (Opus-conducted), T1–T8 — the
signing design is fully ratified.** Resume prompt: "Start the waivers build: read
docs/plans/2026-07-17-member-waivers.md and docs/waivers/ (the sitting's drafts +
signing-framing-copy.md + the arc log's ratified verdicts), then execute T1–T6 and T8
with Sonnet implementers per task." Launch from ~/Projects/aksailingclub-org. The attorney packet can go out on Geoff's go — it does not
wait for the build. After the build: events-redesign, then the review-queue clear and
mw-cutover per ROADMAP.

**THE MEMBER-DIRECTORY PASS IS BUILT AND PUBLISHED TO DEV (2026-07-18, Fable-conducted
finish on Geoff's "finish and publish with a workflow"). T0–T7 are all executed; what
remains is REVIEW, not build.** The session landed, in order:

- **T2b committees seed, APPLIED LIVE + VERIFIED** (d41c7a8): 7 committees (2 standing /
  5 established, published-table sort), 4 officer positions, 8 active chair/co-chair
  rows, 0 orphans/dupes. Name resolutions at import review: stored-name lookup keys
  ("David Johnson", "Matthew Flickinger"), and the word-reversed "Stanbro TL" member row
  FIXED LIVE to "TL Stanbro" (audit actor `admin:member-name-fix`). Geoff confirmed the
  committee name **"Membership & Events"** and an EMPTY plain-director list (the four
  officers are the whole board right now).
- **T3 directory query** (b831de9): one row per listed member; standing sourced from
  `standing.ts`'s new pure `standingWindowFromPaidAt` (four bounded queries + one
  grace-days read); chair titles derive at render; partial visibility nulls email+phone+
  address together; pending/archived-committee rows excluded in SQL.
- **T4 Compact A directory screen** (c2b9f27, Opus implementer): compact rows expanding on
  a sage wash, one filled top-title chip +N, boats-else-city secondary with width-aware
  abbreviation, honest carets, ≤3-result auto-expand, three chips + one smart search,
  mobile as its own composition. Pure view logic in `directory-view.ts` (27 tests).
- **T5 edit surfaces** (3177afc): profile boat CRUD (name+model REQUIRED, picker resolves
  to stored string), household address edit, extended "what others see" preview incl. the
  roster-names-always-show statement.
- **T6 admin CRUD** (5c3fde8): /admin/club/committees covering committees/memberships/
  positions, archive-not-delete, decline-deletes-row; the queued admin-nav pass absorbs it.
- **T6b portal committees page + delegation + public directive** (08728b1): probe built
  from live rows, **Geoff-RATIFIED same day** (arc log round 3: text-action register,
  comma-flow rosters, standing captions, chair names link to directory, zero fireweed);
  /my-account/committees with request/cancel/leave + chair pending-queues + board
  management, ALL predicates enforced server-side with denial tests; chair notification
  via sendClubEmail; public /committees At-a-Glance now renders LIVE data via the
  `committees-at-a-glance` directive (hand table deleted from committees.md).
- **Reviews via two workflows** (wf_9276f60c, wf_77d050e4; 12 agents, 0 errors): svelte +
  a11y on T4-T6 (8 findings fixed, 62256aa), then security + svelte + a11y on T6b
  (d217669): join-request email spam got an email_log-backed 15-min cooldown,
  archived-committee writes refused, duplicate add-member handled, board can never mint a
  "pending chair". Declines are evidence-backed (pre-existing sitewide idioms).
- **Gate at publish**: check 0/0 (916 files), 123 test files / 1614 tests, build green.
  Pushed to main → dev deploy. e2e baselines for the two new portal specs minted via the
  ci.yml update_snapshots dispatch (8 new: directory + committees × 390/1440 × both
  themes; committees baseline is the fixture empty state — fixtures carry no committee
  rows, noted in the spec).

**OPEN ON GEOFF'S QUEUE for this pass:** the before/after on dev — /my-account/directory
(Compact A vs the old household cards), /my-account/committees, the profile/household edit
surfaces, and the public /committees live table (now says "Membership & Events") — plus
the standing accumulated queue (pointers below).

**DX-harvest notes from this pass** (fold into the next harvest filing): a shared portal
section primitive (the quiet hairline list is hand-rolled per page, third occurrence); a
`--container-measure-list` token (60rem is a raw literal in directory + committees);
`.portal-text-action` LANDED as the named text-register tier (probe's harvest note,
shipped in T6b).

**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):** portal
redesign before/after against mock D (PR #1, merge 510b266); the payments live smoke
(canonical steps docs/plans/2026-07-15-payments-live-smoke.md); the five-stop dev
walkthrough; the 07-15 apology-send verification; the fragments /members before/after and
the unfiled fragments harvest (staged in docs/2026-07-17-fragments-harvest-findings.md).
