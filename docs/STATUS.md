# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**FRAGMENTS MIGRATION & DX/CONTRACT HARVEST: PLANNED, READY TO EXECUTE (2026-07-17; the
Fable planning session brainstormed the design interactively with Geoff and he approved it).
EXECUTION IS THE IMMEDIATE NEXT ACTION, OPUS-CONDUCTED IN A FRESH SESSION (Geoff's downshift
ruling). Resume prompt: "Execute the fragments migration plan: read
docs/plans/2026-07-17-fragments-migration.md and the spec it names, then start at conductor
step 0." Launch from ~/Projects/aksailingclub-org.** The plan is the conductor runbook (steps
0-6, review gates, close ritual); fan-out stages run via
docs/plans/2026-07-17-fragments-migration.workflow.mjs (one Workflow invocation per stage,
`args {stage: 'adopt'|'probes'|'survey'|'extract'}`, conductor judgment between); the spec
docs/2026-07-17-fragments-migration-design.md carries every judgment — the ratified
decisions, the probe matrix (P1-P7 developer, E1-E8 editor), and the provisional verdict
table — so the conductor executes rather than re-derives. RATIFIED AT THE BRAINSTORM (Geoff,
2026-07-17): (1) PROBE MATRIX + DIARY — deliberate hold-it-wrong probes in throwaway
worktrees (that's where green-and-wrong lives; P2, an include silently splicing to nothing
with the gate green, is the prime candidate) plus a log-as-you-go diary from the first bump
command; (2) BLOCKS-ONLY CONVERSION BAR — a candidate converts only where every consumer
wants the SAME rendered block; voice-adapted restatements stay as prose that agrees, and a
new src/tests/content-agreement.test.ts pins dropped-but-must-agree facts (the sharpening
that produced it: AN INCLUDE IS A BLOCK SPLICE, SO A TABLE ROW IS NOT A CONSUMER — that
moved mooring-cost and storage-fees from convert to likely-drop; provisional: 2 converts, 2
partials, 5 likely-drops, Discord's inline-include gap filed as a cairn finding); (3) CLAUDE
DRIVES THE EDITOR SEAT via seeded local admin (e2e/helpers/admin-session.ts precedent).
Verified at planning: the navLayout ride-along is ONE LINE ({ screen: 'fragments' } in the
EXISTING tree, cairn.config.ts:44 — initiative 5 already declared it); sidebar arrangement
stays with admin-nav-reorg, no sequencing knot. Harvest findings go to
~/Projects/cairn-cms/docs/internal/docs-friction-log.md, perspective-tagged, its first
post-0.87.0 entries; the conductor phrases them from the agents' structured findings.

**PORTAL REDESIGN PASS: SHIPPED TO DEV 2026-07-17 (merge 510b266, PR #1). AWAITING GEOFF'S
BEFORE/AFTER against mock D — that gate is the apex's, not dev's; dev is live now.** Spec
docs/2026-07-16-portal-redesign-design.md + plan docs/plans/2026-07-16-portal-redesign.md,
visual reference docs/design-benchmark/portal-mock-d/. The landing rebuilt to mock D across all
four states (needs-you / all-clear / off-season / renewal), mobile composed as its own screen
(the action row's stacked anatomy fixes the mid-phrase wrap Geoff named on the probe), plus TWO
NEW DOORS the ratified mock left no home for and RECEIPTS REPOINTED AT THE LEDGER. Four Geoff
rulings taken live mid-pass, all logged with their grounding in docs/design-benchmark/decisions.md
(read those, never this summary): the gear door, the renewal door, Release's two-step confirm, and
the full-bleed rule reframed from "HOME-ONLY, no exception" to "considered and justified" (with
worked examples both ways, since a bright line carries information a bare standard loses).

ELEVEN DEFECTS FIXED ON THE WAY PAST, every one green on check/test/build. The adversarial review
gate (16 findings survived refutation) caught three BLOCKERS: the Pay button silently dead (the
landing never destructured `form`), portal body ink at 1.07:1 in dark mode, and the all-clear
moment rendering under the renewal CTA. The conductor's own render read caught three more: the
masthead band ignoring the dark theme (it reached for fixed --color-sage where the site bands with
--color-base-200 — identical in light, broken in dark), Sign out stranded at left=283 against
everything else's left=80, and money dropping a trailing zero ("$247.5"). One member-facing money
formatter now serves the whole portal.

THE PATTERN WORTH CARRYING FORWARD (four instances, one root): THE RATIFIED MOCK DEPICTED DATA THE
SYSTEM CANNOT PRODUCE, because a probe agent built the reference without querying the database or
the dark theme. Mock D showed a class-fee receipt the schema could not express, slot identifiers
("B-Dock slip 12") that do not exist (all 40 live assignments carry free text about the member's
BOAT: "Sailboat", "BUCC", 'Purple Buccaneer 18 "Dionysus"'), a "Gear locker" asset type the club
does not have, and a light-only palette. THE FIXTURES THEN REPRODUCED THE FICTION, so the baseline
looked right while production would have rendered gibberish — verification concealing the defect it
exists to catch. BINDING ON THE EVENTS-REDESIGN AND MEMBER-DIRECTORY PROBE ARCS: ground a probe
against real rows and both themes BEFORE ratifying it, or the ratification bakes in fiction.

ALSO FIXED, INFRASTRUCTURE: ci.yml's update_snapshots dispatch hardcoded e2e/site-visual.spec.ts
and its snapshot dir, so it SILENTLY DID NOTHING for the portal's new spec and reported success
(1912cf8 + the commit before it; both steps are now spec-agnostic, and the staging glob must be
shell-expanded — git's own pathspec globbing does not match UNTRACKED dirs, which is exactly what a
new spec's baselines are). Note for any future visual spec: PLAYWRIGHT WRITES MISSING SNAPSHOTS ON
FIRST RUN BY DEFAULT, no --update-snapshots needed — a local run mints workstation baselines that
break CI if committed. The repo rule ("never a local --update-snapshots run") is true but
incomplete. Baselines for the portal are CI-minted (a2f3198); site-visual's came back UNCHANGED,
proving the rebuild shifted no other page.

LIVE DEFECT THIS FIXES FOR REAL MEMBERS: receipts read the money ledger (migration 0021) instead of
a stale two-table union whose premise went out of date the day 0021 landed. 143 class-fee payments
and 5 donations were invisible to the members who made them. NOT a schema change; the canonical
store already existed and every write path already fed it.

OPEN / CARRY-FORWARD: Geoff's before/after against mock D (four states rendered light+dark at
390/1440 available on request). Backlog-worthy, none blocking: the portal's 44px touch-target floor
is unmet sitewide (row actions ship at .btn-sm/32px, "Manage gear & moorings" at 17px) — a
PRE-EXISTING gap this pass did not introduce and deliberately did not widen; the desktop landing
shows a tall whitespace void when the main column is short and the rail is not; the landing renders
two h1s (one display:none, benign for AT) as the cost of the not-a-collapse dual composition.

**PAYMENTS SMOKE — STILL WAITING ON GEOFF (unchanged since 2026-07-15; full entry
in docs/status-archive.md, canonical steps in docs/plans/2026-07-15-payments-live-smoke.md +
docs/2026-07-15-payments-live-smoke-design.md appendix A):** the hardening is released to dev;
his queue, in order: before/after on the four changed public forms; REAL-browser confirm of the
signup deferred-widget Turnstile fix against the live secret (payClassFee rides on it); the
sandbox dry-smoke (first-ever webhook reconcile); his go; key-swap per appendix A; live smoke
(memo `live-smoke 2026-07-XX`; the refund memo needs a direct executeRefund call, the desk UI
has no memo field); revert to sandbox keys. HELD DECISIONS (spec section 6): smoke product ($1
donation default vs $100 domain-unwind); dev-Access posture (dev is public — re-protect vs
accept). Also queued: the five-stop dev walkthrough; the 07-15 apology-send verification.**
