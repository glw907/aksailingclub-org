# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**IMMEDIATE NEXT ACTION (Geoff, 2026-07-17): RESUME THE `member-directory` PASS, OPUS-CONDUCTED,
IN A FRESH SESSION.** The roles & committees brainstorm is DONE (entry below); the pass is
unblocked. Resume prompt: "Resume the member-directory pass: read
docs/2026-07-17-member-directory-design.md, docs/2026-07-17-roles-committees-design.md, and
docs/plans/2026-07-17-member-directory.md, then continue — T0's probe verdict first, then T1."
Launch from ~/Projects/aksailingclub-org, `/model opus`. T0 state: the round-1 composition probe
was built from real asc-club rows and awaits Geoff's visual verdict on the non-roles parts; it
lived in the PAUSED session's scratchpad (session-specific, real member names never land in git),
so the resuming conductor regenerates it from real rows for the verdict if the path is gone. Arc
log: docs/design-benchmark/member-directory-round-1-arc.md. INDEPENDENTLY SCHEDULABLE, any time
Geoff's review availability suits: the FABLE waivers sitting (waivers plan T7 + the T4 signing-UX
design; must land before the waivers BUILD reaches T4; depends only on the waivers spec).

**ROLES & COMMITTEES BRAINSTORM: DONE 2026-07-17 (Fable-conducted, this sitting). Spec
docs/2026-07-17-roles-committees-design.md is committed and Geoff-approved; it SUPERSEDES the
directory spec's decision 6 (flat member_roles — never built), and the directory plan is
reshaped IN PLACE.** The model: `committees` (name, description, kind standing|established,
archive-not-delete), `committee_members` (chair|co-chair|member + pending|active; UNIQUE pair),
`member_positions` (kind officer|director|appointed — authorization hangs off kind, never
title-string matches). Ratified: request-then-approve joining (request notifies chairs via the
job-runner; decline/leave delete the row); chairs manage their own roster; board members
(kind officer/director) appoint chairs and create/edit/archive committees; site admin everything;
rosters show every active member's NAME regardless of directory_visibility (contact stays
dialed); chair titles DERIVE at render so surfaces cannot drift. Surfaces: /my-account/committees
(rights-derived affordances, probed and Geoff-verdicted before build), the probed directory
rendering (filled chip for positions/chair titles, outline for plain membership), and the public
/committees At-a-Glance table fed by a live directive (chairs/officers are public names, as the
hand table already is today). Seeds: the seven committees (five established + Finance and Board
Development standing, per bylaws) and people from the published At-a-Glance table,
verified-import, misses audited; Geoff supplies plain-director rows at import review. Plan
deltas: T1 grows to four tables, NEW T2b (committees+people seeder), T5 = boats + extended
preview only, T6 = whole-model admin CRUD, NEW T6b (portal committees page + delegation +
public directive; server-side predicate tests including denial cases), T7 adds
web-auth-security-reviewer on the new authz surface (the pass's riskiest). SITTING SCORE: 4
interaction points (committee list; bylaws redirect; one batched 4-question round; join-gate
correction + the board-powers addition folded into the same exchange) — the bylaws redirect
saved a question round that grounded three decisions. Tokens: not self-measurable; log from
/cost before clearing if the number should join the trend ledger.

**FRAGMENTS MIGRATION & DX/CONTRACT HARVEST: SHIPPED TO DEV 2026-07-17 (PR #2, Opus-conducted).
The site runs cairn ^0.87.0 with the fragments concept live. TWO THINGS ARE OPEN AND NEITHER IS
BLOCKING: Geoff's before/after on the one class-b page (/members), and the harvest is DRAFTED BUT
UNFILED (staged in docs/2026-07-17-fragments-harvest-findings.md; paste into cairn-cms's friction
log once its live branch merges, then delete the staging file). The editor seat (E1-E8) is
UNPROBED, NOT CLEAN — it runs when ASC moves to ^0.88.0. Full entry with the probe findings and
the pinned-test inventory: docs/status-archive.md.**

**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):** portal
redesign before/after against mock D (shipped to dev, merge 510b266, PR #1); the payments live
smoke (canonical steps docs/plans/2026-07-15-payments-live-smoke.md — before/after on four
public forms, real-browser Turnstile confirm, sandbox dry-smoke, go, key-swap, live smoke,
revert); the five-stop dev walkthrough; the 07-15 apology-send verification.
