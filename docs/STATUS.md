# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE ASSETS TRIAL BUILD IS DONE, ALL EIGHT TASKS. BOTH SCREENS REACH A UNANIMOUS PASS ON
THE COLD COHERENCE READ. THE TRIAL'S OWN CONTROL CONDITIONS WERE UNSATISFIABLE, WHICH IS THE
PASS'S LARGEST FINDING. NEXT IS THE CAIRN RATCHET PASS, IN THE CAIRN-CMS REPO (2026-07-30,
Opus 5 conducting).** What happened:

- **The measurement: asset-requests PASSES at read 2, Assets at read 3**, both unanimous with
  empty tell lists, both under the pinned grader prompt at the calibration ledger's hash, k=3,
  2-of-3 consensus, 390/1440/interaction in both themes. Against baselines of Members 2 and
  Classes 3 and a target of 1, **this pass reproduced the baselines rather than beating them.**
  Zero suppressions added across four builder sessions and three fix rounds; the asset-requests
  rebuild REMOVED the one pre-existing suppression on its own file (site-wide static 5 to 4).
- **THE CONTROL CONDITIONS WERE UNSATISFIABLE BEFORE THE FIRST DISPATCH.** `CLAUDE.md:10` is
  `@docs/STATUS.md`, so every session in this repo auto-loads STATUS, and the entry below named
  the trial's withheld measurement outright, by its `STANDING_CHIP` variable name. No dispatch
  discipline could have protected it. Two further channels compounded it: the plan and spec sit
  in `docs/`, and agent memory carried findings between supposedly uncoordinated builders. **Any
  future trial needing a withheld measurement needs a clean-room repo, or a measurement that does
  not depend on withholding.** The defect-11 capture question is unanswerable for this pass.
- **Six engine findings are filed** in `docs/2026-07-30-assets-trial-harvest-findings.md`, the
  staging file for cairn's friction log. The largest: **`cairn-admin.css` ships no user-agent
  reset layer**, with four measured symptoms (every `textarea` renders monospace and `body`
  computes to Times New Roman; a bare `<ul>` keeps the UA's 40px bullet indent; every modal
  `<dialog>` paints a 3px near-black frame around the whole viewport; and `.input`/`.select`/
  `.textarea` cap at 320px via `clamp(3rem, 20rem, 100%)` regardless of container). Also:
  `form-anatomy.md`'s own worked example prescribes `gap-x-6 gap-y-4`, which never compiles, and
  `cairn-audit` already convicts `ClassForm`/`EventForm` for using it; and the stacked field-label
  register that fixes the dominant failure mode exists inside the package but is never exported.
- **GEOFF RULED ON `one-filled-action` (2026-07-30): tighten the rule, keep the grader.** `nav` and
  `aside` partition, the topmost dialog layer partitions, `header`/`footer` nested inside `main` do
  NOT. The rule and the grader prompt disagreed about what one surface is, both shipped in the same
  package, and the rule was partitioning on a boundary that does not match the harm it prevents.
  Measured blast radius: one page (`/admin/club/members`). Full rationale in the harvest doc.
  **The ruling creates a requirement the engine cannot yet meet**: it pushes segmented controls off
  `btn-primary`, and `btn-active` is a 0.011 lightness step on a dark ground. That belongs in the
  same cairn change.
- **The pattern across three builds is that the token layer holds and the composition layer does
  not.** Across twelve captures and six independent readers, not one tell landed on type roles, gap
  values, chip registers, or color. Five of seven consensus tells clustered in composing form
  fields, on both screens, by builders who could not see each other.
- **Server side landed clean**: waitlist promotion (atomic assign-and-dequeue via `db.batch()`,
  current-season membership resolved explicitly, capacity advisory) and asset-type editing (`id`
  WHERE-only, asserted against the literal SQL). Two defects were caught in review rather than
  shipped: `sendAssetDecisionEmail`'s `slot_opened` variant went stale on its own caller's delete,
  and a blank fee coerced to `0` and silently made an asset free.
- **PASS-SIZE NOTE (owed, per the standing rule)**: this pass ran far past its plan. Eight tasks,
  a full rebuild redone because the first attempt narrowed "rebuild" to "wire two actions in",
  eighteen grader runs, three fix rounds. ~3.23M subagent tokens across 26 dispatches. Same failure
  mode as the substrate pass: a plan boundary superseded mid-flight rather than re-scoped.
- **NEXT**: the cairn ratchet pass, in `~/Projects/cairn-cms`, not this repo. Bounded: expose the
  stacked field primitive, add the UA reset layer, point `no-uncompiled-class` at the skill's own
  exemplars, implement the `one-filled-action` ruling with a visible dark-ground selected state,
  and cap the new geometry rules at three or four validated against this pass's labeled corpus
  (round-1 captures should fire, round-2/3 should not). RESUME PROMPT: "Run the cairn ratchet pass
  from the Assets trial: read aksailingclub-org/docs/2026-07-30-assets-trial-harvest-findings.md;
  Geoff's one-filled-action ruling is in it and settled." Launch from ~/Projects/cairn-cms.
- **OPEN ON GEOFF'S QUEUE**: the before/after on both rebuilt Assets screens on dev, which gates
  the apex as always.

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
