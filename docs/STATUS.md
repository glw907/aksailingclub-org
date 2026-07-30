# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE ASSETS SUBSTRATE PLAN IS DONE, ALL SEVEN TASKS, AND THE RENEWAL SCREEN TOOK A
GEOFF-DIRECTED DESIGN ROUND ON TOP. DEV IS DEPLOYED AND BASELINES ARE ASSERTED. THE TRIAL
BUILD (PLAN 2) IS NEXT, IN ITS OWN SESSION (2026-07-30, Opus 5 conducting, plan
docs/plans/2026-07-29-assets-substrate.md).** What happened:

- **The live schema repair landed and did what it was for.** Migration
  `migrations/asc-club/0034_asset_type_ids` renamed the three underscore ids to the document
  vocabulary, corrected the capacities to Geoff's confirmed numbers (mooring 10, rv-parking 10,
  boat-parking NULL for no limit, small-boat-rack 9), and backfilled the 4 payment-method rows.
  **Households holding a mismatched-type asset went from 21 to 0**, the plan's own success
  criterion, verified live. The rename needed insert-repoint-delete rather than an `UPDATE`:
  three tables declare `REFERENCES asset_types(id)` with no `ON UPDATE CASCADE` and remote D1
  enforces foreign keys. Scratch-proven through all six steps first; the README records the
  live before/after. **Do not edit `forward.sql`, it has run against production.**
- **All seven tasks are on main**, four of them built in parallel isolated worktrees: the cast
  validation (`parseAssetKind`, `grep "as AssetKind" src/` now empty, drift throws at read
  time), the one shared holdings lens behind all three consumers, the retention step on
  `/my-account/renew`, the five decision-email kinds with four wired and slot-opened
  deliberately unwired, and the coexistence comment in `assets-store.ts` (**plan 2's preflight
  must verify it survives the screen rebuild**).
- **Adversarial review found 17 confirmed findings and all were folded.** The two that mattered:
  the retention list was keyed by asset type while **three live households hold more than one of
  a type** (one holds three boat-parking), which broke both the render and the model; and the
  duplicate guard only checked `pending`, so an approved request let the button return and
  create a duplicate. Both fixed and tested. Lane B's emails pointed members at
  `/my-account/gear` for denied and queued states that page filters out entirely.
- **A cross-lane defect worth remembering**: Task 2's strict parser and Task 4's captures were
  built in separate worktrees, so neither saw the other, and the parser rejected
  `portal-seed.sql`'s placeholder asset ids. Repaired, and then repaired again: the first fix
  paired the id `rv-parking` with the name "Trailered Boat Parking", a combination production
  has never held. Fixtures now match live pairings exactly, verified against the seeded replica.
- **Geoff's review drove a design round on the renewal screen**, superseding the plan's
  no-design-content boundary (his call, recorded as such): season fees on every held-asset row,
  a fixed-slot control reading "Request" that toggles in place to "Requested", quiet-action
  weight so the page keeps one filled primary, per-row accessible names via hidden text (a bare
  `aria-label` would break WCAG 2.5.3), and a reduced-motion-aware crossfade, which required
  progressively enhancing the form since a transition cannot cross a navigation. Then two
  wrapping fixes at 390, both measured: the tier price now holds line one for every tier with
  the chip yielding, and the asset rows stack deterministically below 40rem because the longest
  real name plus price plus control needs ~370px against ~307px available.
- **BEFORE/AFTER IS READY TO READ**:
  https://claude.ai/code/artifact/6e29d1e8-1b9f-4d51-a133-9be3b8c0eecb — the full arc at both
  viewports and themes, with the wrap measurements in a table.
- **Baselines regenerated via the CI dispatch against a side branch, then asserted.** Run
  30580355396 minted exactly 8 files: 4 new `my-account-renew` and 4 changed
  `waivers-admin-rollup` (the fixture repair feeds the waiver derivation the rollup counts).
  The push to main ran the mirror image, 75 visual tests passing on the runner. **A local
  `npm run test:e2e` fails 56 visual comparisons at ratio 0.01 including untouched site pages:
  that is the workstation/CI rendering delta, not a regression.** The local run also minted 4
  workstation baselines for the new case, which were deleted.
- **SIX ENGINE-LEVEL FINDINGS FILED**, in `docs/2026-07-30-assets-substrate-harvest-findings.md`:
  optical centering of padded labels, the toggle-action control, the label-and-value row
  primitive, the D1 foreign-key rename recipe, DaisyUI's plain `.btn` rendering an invisible
  edge on a dark ground (**third local patch, the tell**), and distinct accessible names for
  repeated per-row controls. **Geoff made this a workstation-level rule covering every cairn
  site** (`~/.claude/CLAUDE.md`, "Engine-level UI mechanics, every cairn site"): a mechanic
  belongs to cairn, a choice belongs to the site, and filing them is default behavior at the end
  of any UI pass rather than something done when asked.
- **Deferred deliberately**: the chip centering fix was built and REVERTED, because it was a
  per-component patch where Geoff asked for a global default and its rationale did not survive
  measurement (the ink sits low in the pill, not high). The `asset_requests` uniqueness race
  under a genuine double-click is routed, not absorbed: closing it needs a unique index, which
  is a migration outside this plan.
- **PASS-SIZE NOTE (owed to Geoff, per his own rule)**: this pass ran well past the substrate
  plan. Seven plan tasks, 17 review folds, then five owner-directed design items on one screen.
  Each addition was small and coherent; the total was not. The plan's own boundary was
  superseded mid-pass rather than re-scoped.
- **NEXT**: the trial build per `docs/plans/2026-07-29-assets-trial-build.md`, in its own fresh
  session, under the protocol's control conditions. RESUME PROMPT: "Execute the Assets trial
  build: read docs/plans/2026-07-29-assets-trial-build.md and the protocol
  docs/plans/2026-07-29-cairn-design-trial-assets.md; the substrate landed 2026-07-30 so the
  screens build against honest data." Launch from ~/Projects/aksailingclub-org.

**THE ASSETS FUNCTIONAL BRAINSTORM IS DONE; BOTH EXECUTION PLANS ARE COMMITTED AND
REVIEWED; A FRESH OPUS 5 SESSION EXECUTES THE SUBSTRATE PLAN NEXT (2026-07-30, Fable
sitting).** What happened:

- **All nine packet questions are settled.** The rulings live in
  `docs/2026-07-29-assets-functional-design.md` (commit d15c1e9), "The nine rulings."
  Headlines: the imported capacity numbers were invented, so the migration corrects them
  (**BLOCKING INPUT: Geoff's four confirmed capacities; rv-parking probably 10**); the id
  mismatch is fixed first-task with a throwing parse on the cast; retention gets its
  creation path in `/my-account/renew`; waitlist promotion is surfaced-not-automated;
  decision emails ship; the type catalog gets a fee/capacity/label editor with ids
  immutable; the rebuild optimizes for the rare real event; one shared holdings lens; the
  legacy Stripe payment-link route stays phase-2's, with the coexistence drift documented.
- **Two plans, two sessions** (the pass-sizing lesson applied at design time). Plan 1
  `docs/plans/2026-07-29-assets-substrate.md`: seven functional-repair tasks, no new admin
  surface. Plan 2 `docs/plans/2026-07-29-assets-trial-build.md`: the eight-task screen
  rebuild under the protocol's control conditions, with the builder travel list explicit
  and the input packet marked orchestrator-only. Both were workflow-drafted (Opus
  drafters), adversarially reviewed (26 findings, 11 blockers), and the folds verified by
  the Fable conductor's own read (commit df334ed).
- **The trial protocol doc stands unamended**; deviations are findings.
- **NEXT, in order**: (1) Geoff confirms the four capacities (Task 1 blocks on them;
  tasks 3/4/5a can start without). (2) Substrate execution, fresh OPUS session — the
  /model switch saved fable as the session default, so reset it. RESUME PROMPT: "Execute
  the Assets substrate plan: read docs/plans/2026-07-29-assets-substrate.md and the spec
  docs/2026-07-29-assets-functional-design.md; follow the plan's execution order; Task 1
  blocks on the four confirmed capacities in its Blocking input section." Launch from
  ~/Projects/aksailingclub-org. (3) The trial build per its own plan, in its own session
  after the substrate lands. Geoff's before/after on the 0.91.1 baselines (artifact link
  in the entry below) is still open.

**THE HELD CHORES ARE LANDED: BASELINES REGENERATED AGAINST 0.91.1, MAIN PUSHED, DEV
DEPLOYED, AND THE ASSETS BRAINSTORM'S FUNCTIONAL INPUT IS BUILT. TWO GATES ARE OPEN:
GEOFF'S BEFORE/AFTER, AND THE BRAINSTORM ITSELF, WHICH IS A FABLE SITTING (2026-07-29,
Opus 5 conducting).** What happened:

- **The baselines are regenerated and asserted.** The five held commits went to a side
  branch first, because `update_snapshots` commits its PNGs back to whatever branch it ran
  against and `ci.yml` also fires on a push to `main`. Run 30516293343 dispatched against
  the branch; **its log was read, not its conclusion**: assert skipped, regen ran, 71
  passed, and exactly **four** files re-generated, all `waivers-admin-rollup` (both themes
  at 390 and 1440), committed by the bot as `1ff5926`. `main` fast-forwarded and pushed;
  the dev deploy went green; run 30516667787 is the mirror image (assert ran, 71 passed,
  regen skipped), so the PNGs are asserted-correct and not merely minted.
- **Nothing in `site-visual` or `portal-visual` moved, and that is a measurement.** The
  baseline set independently confirms the grammar repair and the 0.91.1 install are
  admin-only in rendering terms. The waivers rollup is still the one baselined admin
  surface, so it absorbs the whole delta.
- **GEOFF'S BEFORE/AFTER IS READY TO READ**:
  https://claude.ai/code/artifact/311f260f-7fb4-4bdc-a5ed-af2a700e9d65 — the CI-canonical
  pairs at both themes and both viewports, with an A/B/difference bench (the pairs are
  dimension-identical, so difference blacks out everything the repair left alone). Three of
  the four change classes are visible: the page h1 at 24px/700, the never-signed `0` gaining
  the quiet register's ground, and the ~9px reflow from 0.91.0's `PageHeader` fix. The
  118-site column-header move to 11px is inside eyeball tolerance and rests on the audit.
- **The Assets brainstorm's functional input is built and committed**:
  `docs/2026-07-29-assets-functional-input.md`, from six read-only discovery agents plus a
  synthesizer, every claim carrying `file:line` or a live query. **Functional only by
  construction**, since the trial's control conditions make cairn's packaged capture the
  sole sanctioned carrier of design content to a builder. Nine questions only Geoff can
  settle sit at its foot.
- **Three findings from it resize the pass.** The perimeter is bigger than the plan's two
  screens: the Members list and the household desk each compute "who holds what" from
  queries that mirror rather than reuse the Assets lens, and `/my-account/gear` is a fully
  wired member-facing counterpart. The request and waitlist machinery is **completely
  unexercised** (zero rows in `asset_requests` and `asset_waitlist` against 41 active
  assignments), so the review inbox has never run against real data. And the `asset_types`
  id mismatch is **live, not dormant**: `current_season` is `2026`, matching the six
  published waiver documents, and 21 households hold an asset whose id never matches, so
  their acknowledgement never reaches a signing list and never gates the fee.
- **Two trial-log readings were wrong about what they measured** (numbers stand,
  attribution did not; verified in source). The 1.15 chip is the **Paid** badge and the
  1.00 chip is **Outstanding**, both in `STANDING_CHIP`; the real asset-type chip is an
  unflagged `badge-neutral`. This sharpens the build item: the state invisible against its
  own row is the one saying a household owes money. The "square-cornered pagination button"
  advisory is unattributable here at all, since no Assets file imports `Pagination`.
- **NEXT, in order**: (1) Geoff's before/after on the artifact above. (2) **The Assets
  functional brainstorm as a FABLE sitting**, opening against the input packet and its nine
  questions, then a plan; execution returns to a fresh Opus 5 session per the model-boundary
  rule. (3) The trial proper. RESUME PROMPT for the Fable sitting: "Open the Assets
  functional brainstorm for the cairn design-capture trial: read
  docs/2026-07-29-assets-functional-input.md and
  docs/plans/2026-07-29-cairn-design-trial-assets.md; the nine open questions at the foot of
  the packet are the agenda." Launch from ~/Projects/aksailingclub-org.


**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):**
the Classes before/after on dev (/admin/club/classes) and the 2026-07-21 probe
verdicts, including the three riders (StatusChip palette, the never-paid 'none'
copy, the search focus ring — the latter two since CLOSED; full entry archived);
the pass-B sidebar walkthrough per role (four-group tree, badges, the two class
surfaces, Help in the foot; full entry moved to the archive);
the attorney packet send (docs/waivers/, all DRAFTs; the sitting's full entry is in
the archive — sources verified live, register/fact gates run, board-packet.md carries
the Borough records-request path);
the waivers signing-moment before/after (dev renders the no-docs state; the moment is
visible in the CI-minted baselines and locally via the e2e fixtures — full build entry
in the archive);
member-directory before/afters (/my-account/directory, /my-account/committees, edit
surfaces, public /committees); portal redesign before/after against mock D (PR #1,
merge 510b266); the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md);
the five-stop dev walkthrough; the 07-15 apology-send verification; the fragments
/members before/after and the unfiled fragments harvest
(docs/2026-07-17-fragments-harvest-findings.md); the directory pass's DX-harvest notes
(shared portal section primitive, --container-measure-list token — in the archive
entry);
the board-demo cleanup after the board meeting (`node scripts/import/demo-household.mjs --cleanup`; full entry in the archive);
the retention step's before/after on /my-account/renew (artifact link in the top entry);
the asset_requests uniqueness race (a double-click can still create two pending retention
rows; needs a unique index, so a migration, deliberately routed out of the substrate pass).
