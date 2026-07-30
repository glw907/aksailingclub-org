# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

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

**THE FIVE PRE-TRIAL CHORES ARE DONE, AND THEY TURNED UP A CAIRN 0.91.0 REGRESSION
(2026-07-29, Opus 5 conducting, plan docs/plans/2026-07-29-cairn-design-trial-assets.md;
full entry in docs/status-archive.md, full record in
docs/design-benchmark/2026-07-29-assets-trial-log.md).** cairn 0.91.0's type-grammar
migration silently killed 300 ASC admin markup sites and shipped as non-breaking. ASC was
repaired forward onto the grammar roles (~400 sites across 27 files; static audit 434
errors to 96 with 5 counted suppressions), and cairn shipped the fix as 0.91.1, installed
here at `^0.91.1` and measured rendering-neutral. The 94 remaining dead classes are ROUTED
to each screen's own pass, never absorbed. The rendered audit baseline is recorded: two
runs, exit 0, zero error-tier findings, with 12 advisories on the Assets perimeter, of
which the invisible state chip is a build item. **THE EDIT-DESK HYDRATION DEFECT DOES NOT
EXIST**: corpus C configured cairn's internal route name, those paths 404, and every error
under the authed admin shell returns HTTP 200 because the shell load streams
(sveltejs/kit#12987, open). All ten staged cairn findings are folded cairn-side.
**PASS-SIZE FLAG (Geoff): the "mechanical" chores became a pass of their own.**

**MEMBERS REFINEMENT ROUND 1 IS LANDED AND COHERENCE-PASSED (2026-07-24; full entry in
docs/status-archive.md).** cairn 0.90.0 and 0.90.1 published, ASC A1-A4 landed, the cold
coherence read PASSED with no expert-visible tells across 16 renders, baselines
regenerated. **STILL OPEN ON GEOFF'S QUEUE from this round**: (1) the Members and Classes
refined before/after on dev (`/admin/club/members` and `/classes`, toolbar at rest, a panel
expanded, a filter applied, at 390 and 1440); (2) the facet-border contrast ruling, where
`--cairn-card-border` measures 1.11:1 light and 1.43:1 dark against base-200, under WCAG
1.4.11's 3:1, and stands as the ratified quiet hairline unless he wants a stronger
`--input-color` mix (a one-token cairn patch); (3) StatusChip palette mapping. Process
lesson banked: gate agents must THROW on null, since a dead reviewer silently filtering to
"zero findings" nearly published unreviewed work.

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
the asset_types underscore-vs-hyphen id defect (dry-storage document audiences never match; small fix task; full entry in the archive).
