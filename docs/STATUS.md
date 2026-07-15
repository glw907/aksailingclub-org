# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**SESSION 5 CLOSED PRE-BRAINSTORM (2026-07-14 night, deliberate clear on Geoff's call —
the session ran long and noisy: the cairn double-execution below, the calendar fix, the
docs archival). NEXT SESSION = INITIATIVE 5 EXECUTION, fresh context, launch in THIS
repo. Resume prompt: "Start initiative 5 (admin-roles + admin-nav-reorg): verify cairn
0.86.0 is on the registry (npm view @glw907/cairn-cms version — Geoff's other session
was cutting it at close), bump ^0.84.4 → ^0.86.0, then brainstorm the club_roles
collapse + sidebar arrangement. Read docs/STATUS.md, ROADMAP's admin-roles +
admin-nav-reorg entries, docs/2026-07-13-cairn-editor-roles-consumer-brief.md, and
cairn's docs/guides/organize-your-admin-nav.md + docs/reference/core.md#roles first."
The collapse surface and seam facts are in the entry below; the ledgered rulings from
this session (Fable-window spec queue, design-session series + page-confirmation ledger,
opportunistic template migration, mw-cutover in-window-if-budget) are on ROADMAP entries.
Session riders landed: the calendar season-filter fix (live on dev, verified), STATUS
archived to docs/status-archive.md with the trim rule in the preamble, the global
CLAUDE.md compressed ~25%, the one-executor-per-worktree rule globalized. Geoff's dev
walkthrough (four screens) and the 07-15 apology-send verification remain queued.**

**PRIOR: INITIATIVE 5 (admin-roles) OPENS ON CAIRN SEQUENCING (2026-07-14, Geoff's calls at
the session-5 open). The conflict found at open: cairn's STATUS (committed 16:33) ratified
an admin NAV-LAYOUT pass shipping as 0.86.0 with explicit sequencing — "the ASC session
waits for this cut so it bumps ONCE for roles + navLayout together" — while this file's
prior entry (16:47, written without that ruling) said bump ^0.85.0 now. Geoff ruled: the
cairn nav-layout pass runs first, and then directed THIS session to execute it by
workflow and proceed to the 0.86.0 release (superseding the fresh-cairn-session note;
the plan is committed in cairn at 7eac1007). The
navLayout seam is squarely inside initiative 5's surface — ASC's `filterClubNav` (wired as
the engine `navFilter` in src/chassis/cairn.server.ts) collapses to a declarative
`roles: ['owner', 'club-admin']` on the Club section — so the bump-once ruling stands.
AFTER 0.86.0 SHIPS: resume initiative 5 in a fresh ASC session — bump ^0.84.4 → ^0.86.0,
then brainstorm the collapse against BOTH shipped seams (roles + navLayout). Contract:
docs/2026-07-13-cairn-editor-roles-consumer-brief.md (0.85.0 answered its seam question —
a `none` session stays authenticated, carries typed `locals.editor`, and passes through
CairnAdminShell untouched; plus bootstrapOwner, per-role `home`, migration 0001_roles.sql,
cairn-doctor role checks). The collapse surface, verified this session: club_roles
(migration 0001_substrate), src/admin-club/lib/club-roles.ts (incl. the atomic last-owner
guard), club-action.ts's role gate, the /admin/club layout guard, the Settings
grant/revoke actions, and filterClubNav. ROADMAP's admin-roles entry updated to match.
BUG FIXED AND ON DEV (same session; commits bb1a98f + 491769f simplifier consolidation,
deployed version b187f391, verified live: zero Teen-Intro/Intro-to-Sailing/Intermediate
leaks on /events and home, 2026 classes render, home 200). Original log follows: the
calendar shows duplicate and wrong-dated class entries since the MW import. One root
cause, two symptoms: `src/theme/season-data.ts` (~line 114, home Season band) and
`src/theme/events-data.ts` (~line 93, the /events listing) both query
`FROM classes WHERE visible = 1` with NO season filter — latent while every class row
was season 2026, exposed when the import minted the 10 historical 2024/2025 instances
(all visible=1; verified live: 5 rows per season 2024/2025/2026). The historical
instances leak into the current calendar's month buckets, reading as doubles and as
wrong-dated entries (Geoff's "1st intro wasn't July 11" = the 2024 instance's real
2024-07-11 date beside the real 2026-06-18 class). The education class-schedule island
is NOT affected (class-schedule.remote.ts already filters `season = ?1` off settings
current_season — the pattern the fix should reuse). Fix shape: season-filter the class
arm of both modules keyed on current_season, + a regression test with multi-season
fixture rows. Small, well-specified; should land before Geoff's dev walkthrough.
THE FABLE-WINDOW SPEC QUEUE (Geoff, 2026-07-14, same session): while the Fable window
holds (~07-19, verify before relying), bank the judgment layer of the remaining
program as SPEC-ONLY initiatives — Fable authors the brainstorm/spec/plan in-window,
Opus conducts execution post-window. Queued in order after initiative 5 (+ the new
admin-nav-reorg entry, which rides it): payments-live-smoke spec, the mw-cutover
runbook, the season-rollover one-operation design, the class-management spec (after
admin-roles lands its instructor role). Each ruling is recorded on its ROADMAP entry;
admin-roles + admin-nav-reorg execute fully in-window (auth- and taste-critical).**

**THE CAIRN NAV-LAYOUT DOUBLE-EXECUTION (2026-07-14 evening, recorded for the post-mortem):
when Geoff directed this session to run the cairn nav-layout pass by workflow, a SECOND
live session (the fresh cairn session that cairn's own STATUS had pre-baked, running in
another terminal) was ALREADY executing the same plan via its own workflow
(wf_ea16ef00-fdb) in the same nav-layout worktree. This session's workflow
(wf_3ae128ab-ffe, ~1.23M subagent tokens) raced it; the implementer agents detected the
contention mid-pass and switched to verify-not-duplicate (their recipe is now in cairn's
agent memory), so all seven tasks landed exactly once and the worktree closed clean —
but a large fraction of this session's workflow spend was waste. THE DEFECT WAS MINE:
cairn's STATUS said "fresh session executes it" and my own Task-1 implementer found warm
uncommitted code in the worktree, and I checked for a live runner only after the fact.
Lesson for the record: before dispatching into a shared worktree, check for a live
concurrent executor (pgrep the worktree path, stat the workflow journals, ask Geoff if a
session is already on it). RESOLUTION: this session STOOD DOWN on the cairn side; the
other session was observed running the Task-8 close-ritual gate and owns close, merge,
and the 0.86.0 cut. This session watches the registry and resumes initiative 5 (the
^0.86.0 bump + brainstorm) when the cut lands.**

**PRIOR: INITIATIVE 4 (segment-email) IS COMPLETE, MERGED TO MAIN (98257fe), MIGRATION LIVE,
AND ON DEV (2026-07-14, the program's fourth session). Spec
`docs/2026-07-14-segment-email-design.md` + plan `docs/plans/2026-07-14-segment-email.md`,
both implemented. What landed: `/admin/club/email/compose` (landing = `email_blasts`
history; compose = segment picker + subject + markdown body + the 3-variable palette +
sample preview through the real render path; review = server-resolved count + roster
sample + rendered email + send-test-to-me + the count-acknowledging confirm dialog),
`segments.ts` (current INCL. GRACE / lapsed excl. never-paid / class:<id> guardian-aware
/ instructors current-season; announce's currentMemberEmails is now a thin
resolveSegment('current') caller — FLAG FOR GEOFF'S WALKTHROUGH: announce's audience
deliberately WIDENED to include grace households, the current-includes-grace ruling
applied consistently), `bulk-email.ts` (shared 50-chunk loop; blast row PRE-INSERTED
then counts updated, so the audit row survives a late D1 failure; `blast:<id>`
email_log tagging; test sends log `blast-test`, no row), and migration 0025
(email_blasts; scratch-proven, applied LIVE, verified). Build: 3-task Sonnet workflow +
3 Opus lenses — NOTE: structured-output schemas MISFIRED for review agents (the
security lens died on the retry cap, the svelte lens returned degenerate placeholder
junk); both re-ran as plain-text direct dispatches and worked. Lesson recorded: review
lenses return prose, not schemas. One conductor-triaged fix round (9 items; the two
that mattered: the update()-reset draft wipe BLOCKER that made the screen unable to
send at all, and the D1 100-bound-param cap in the household IN() that would have
broken current-segment AND announce at the live 148-household scale) + simplifier (one
consolidation). Conductor render read on the synthetic seed: PASS across 8 captures at
1440+390 including a REAL local end-to-end send (blast row 6/6/0, tagged log rows);
the review-390 "mid-page header" was the Playwright fullPage sticky artifact, verified
clean at real scroll. Rider: the e2e signup fixture now clears the FULL member FK
closure (the render read's enrollment rows exposed the latent bootstrap break). Gate
at close: check 0/0 (840 files), 1178 tests, build green, e2e 27/27. Deployed to dev
manually (version b49a515b), smoked (home 200, compose 303-to-login). Budgets: ~1.41M
subagent tokens + the Fable main loop; 3 question rounds to Geoff pre-execution, 0
corrections. Known debt: the admin e2e login helper is still owed — this session's
minted-session recipe is the seed (apply migrations/0000_auth.sql locally, INSERT an
AUTH_DB editor + session row, cookie `cairn_session=<session id>`; raw id, no hash);
Turnstile/rate-limit ride payments-live-smoke; deploys stay manual (Actions billing).
NEXT SESSION (fresh context, per the ruling): INITIATIVE 5, CUSTOM ADMIN ROLES —
Geoff's 2026-07-14 ruling made it the next move now that cairn 0.85.0 is on the
registry with the editor-roles seam. Read
docs/2026-07-13-cairn-editor-roles-consumer-brief.md + ROADMAP's admin-roles entry,
then brainstorm; the first mechanical act is the dependency bump ^0.84.4 → ^0.85.0 (a
0.x caret EXCLUDES 0.85.0, it will not drift in). Also queued: Geoff's dev walkthrough
is now FOUR screens (Members, household desk, Money & Renewals, Compose — flag the
announce grace widening), and tomorrow's apology-send verification (07-15 09:21
in-session verifier; if that session died, check the JSONL log beside
~/.local/asc-data/send-apology-2026-07-15.mjs and re-run --send if needed).**

