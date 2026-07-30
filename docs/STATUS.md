# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE ASSETS PASS IS OPEN AS THE CAIRN DESIGN-CAPTURE TRIAL; THE PRE-TRIAL CHORES ARE
DONE AND THEY TURNED UP A CAIRN 0.91.0 REGRESSION, SO NO MEASUREMENT HAS RUN YET
(2026-07-29, Opus 5 conducting, plan docs/plans/2026-07-29-cairn-design-trial-assets.md).**
What happened:

- **THE HEADLINE FINDING: cairn 0.91.0 silently killed 300 ASC admin markup sites and
  shipped as non-breaking.** Its grammar migration moved cairn's own screens onto
  `type-*` roles, so Tailwind stopped emitting the named size steps into the shipped
  `cairn-admin.css` — and ASC's admin loads only that sheet. `text-sm` x239, `text-xs`
  x24, `text-lg` x23, `gap-6` x9, `text-2xl` x3, `tracking-tight` x2 all went dead on
  the bump, while the upgrade guide promises "your custom admin screens keep rendering
  exactly as they did." Cairn applied the safelist reasoning to the names it ADDED and
  not to the ones it retired. Measured off both shipped sheets and confirmed by the
  audit's own before/after; corpus C's 99-dead-token count corroborates the split.
- **Geoff's two rulings (2026-07-29):** repair ASC forward onto the roles and file the
  cairn defect rather than pause for a 0.91.1; resolve the twelve-pixel sites per
  relationship rather than by a blanket rule.
- **Chores 1-4 landed.** cairn ^0.91.0; the `cairn-admin-screens` skill installed via
  `cairn-doctor --fix` with `.claude` excluded from Tailwind scanning; 274
  pixel-identical renames onto the grammar roles across 27 files; 24 twelve-pixel sites
  split `type-label`/`type-meta` by relationship; `tracking-tight` dropped against the
  measured `page-title` norm; 21 `badge-ghost` sites onto the quiet register (the
  `base-300` hazard checked, not assumed — ASC rows hover at `bg-base-200/60`, no
  zebra); 4 off-scale documents h1s onto `type-title`; 5 counted suppressions on stat
  values whose own passes decide them. **Audit 434 errors -> 96, and the Assets pass's
  own surfaces are error-clean.**
- **The 94 remaining dead classes are ROUTED, not absorbed** — they sit on 17 other
  screens (Money 18, Members detail 18, the signature certificate 15, ...) and go to
  each screen's own pass, per the discovered-work rule. Only 5 of 99 were ever on the
  Assets perimeter.
- **Gates**: check 0/0 (1003 files), 2003 tests exit 0, build green. Full record in
  `docs/design-benchmark/2026-07-29-assets-trial-log.md`; six cairn findings staged in
  `docs/2026-07-29-assets-trial-harvest-findings.md` (paste into cairn's friction log
  when that repo is free — a `design-infra-pass-2` worktree still had live workerd).
- **COMMITTED AS 986f95c, DELIBERATELY NOT PUSHED. Do not push before regenerating the
  visual baselines.** Rendering moved (0.91.0's `PageHeader` margin fix, the four
  documents h1s, the chip register, and `HEADER_CELL` on 118 sites), so the existing
  baselines are stale and `ci.yml`'s visual suite will fail on the current PNGs. A push
  to `main` is also a dev deploy. Regenerate via `gh workflow run ci.yml -f
  update_snapshots=true` and READ the log, never a local `--update-snapshots`.
- **PASS-SIZE FLAG (Geoff): the "mechanical" pre-trial chores became a pass of their
  own** — a substrate defect, ~400 repaired sites, and a six-item harvest, before any
  measurement. The trial itself has not started.
- **NEXT, in order**: (1) the rendered audit baseline, which needs local `wrangler dev`
  + a seeded D1 session row + `CAIRN_AUDIT_COOKIES` — the same door the edit-desk
  hydration defect must be diagnosed through, so do both together; (2) regenerate the
  visual baselines via `gh workflow run ci.yml -f update_snapshots=true` and READ the
  log (0.91.0's `PageHeader` margin fix plus the h1 and chip changes all move
  rendering); (3) Geoff's before/after on the changed admin screens; (4) THEN the trial
  proper, opening with the Assets functional brainstorm. RESUME PROMPT: "Continue the
  Assets design-capture trial: read docs/design-benchmark/2026-07-29-assets-trial-log.md
  and the plan, then run the rendered audit baseline and diagnose the edit-desk
  hydration defect against local wrangler dev." Launch from ~/Projects/aksailingclub-org.


**MEMBERS REFINEMENT ROUND 1 IS LANDED: COHERENCE-PASSED, ON DEV, BASELINES REGENERATED;
GEOFF'S BEFORE/AFTER AND THREE QUEUE ITEMS ARE THE OPEN GATES (2026-07-24, third session
on the round — the 07-22 session died mid-C5 to a dead battery, its recovery session
died 07-24 00:24 with the coherence grader mid-read; this session re-ran the read,
ran the fix round on Geoff's workflow opt-in, and landed).** What shipped:

- **cairn 0.90.0 + 0.90.1 PUBLISHED.** 0.90.0 (the recovery session): C1-C6 —
  OfficeList header fixes, the ListToolbar flex recomposition + menu facet variant,
  StatusChip demotion, ExpandableRow's graduation with its three fixes, formatPhone.
  0.90.1 (this session's fix round, workflow wf_9e3dfd38-7e3 + one follow-up
  dispatch): selects un-pinned from daisy's 320px clamp to content width (C2's
  one-row acceptance MEASURED at 972px/326px), the facet border family unified via
  --input-color, both dropdown disclosures gated purely on dropdown-open
  (aria-expanded now truthful), menu options role="menuitemradio" + aria-checked
  with roving tabindex — the two confirmed ListToolbar review findings CLOSED
  upstream in the same patch. Full release ritual both times (registry verified).
- **ASC A1-A4 + pickup** (5089e0c..66949bd, ca930d67): subtitle dropped, action in
  the header slot, autofocus removed, archived folded in as a menu facet, the ruled
  type scale, formatPhone in row and panel, render-level tests.
- **Coherence: FAIL → cairn 0.90.1 → cold PASS.** Grader attempts 1-4 died with the
  connection/session (never on the merits). Read #5 (fresh Opus, full 24-render
  deck): FAIL, 3 tells, one measured root cause (the select clamp). Read #6 after
  the fix: **PASS — no expert-visible tells on any of the 16 renders**, toolbar
  one-row at rest measured (selects 149/115/89/96px, season select 74px). Full
  verdicts in the ledger; the arc log is distilled into decisions.md and removed.
- **Landed**: 9 commits pushed, deploy.yml green, dev spot-checked through Access
  (200/303); ci.yml update_snapshots dispatched and its LOG read — 71 visual tests
  green, exactly 4 waivers-admin-rollup baselines shifted (the one baselined admin
  surface rendering the toolkit toolbar), commit 0105322 pulled.
- **Round closures**: the never-paid 'none' copy (confirmed "Not billed"/"No
  membership" in source) and the search focus ring (the ink ring is the engine
  input idiom; autofocus was the irritant, removed as ratified V3) are CLOSED.
  StatusChip's palette mapping stays open.
- **NEW ON GEOFF'S QUEUE**: (1) the Members+Classes refined before/after on dev
  (/admin/club/members and /classes — toolbar at rest, a panel expanded, a filter
  applied, at 390 and 1440); (2) the facet-border contrast ruling —
  --cairn-card-border as the facet controls' only boundary measures 1.11:1 light /
  1.43:1 dark vs base-200, under WCAG 1.4.11's 3:1; it is the ratified quiet
  hairline, so it stands unless he wants a stronger --input-color mix (one-token
  cairn patch); (3) StatusChip palette mapping (the one surviving probe item).
- **Process lesson banked**: gate agents (reviewers/graders/fixers) must THROW on
  null — a dead reviewer silently filtering to "zero findings" nearly published
  unreviewed in the crashed run; this session's workflow encoded it.
- **NEXT: the cairn DESIGN-INFRASTRUCTURE BRAINSTORM, mid-flight, moved to the
  cairn-cms project (the Assets pass stays paused as that initiative's validation
  trial).** The 2026-07-24 ASC sitting settled audience (package-shipped day one),
  sequencing (full structure before the trial), scope (admin only), the composition
  (mechanics-forward minus scaffold), and the craft-capture chapter as the
  initiative's center; all banked in the seed doc's "Brainstorm state (2026-07-24)"
  section, which also carries the exact resume prompt. Launch from
  ~/Projects/cairn-cms and resume at design section 3 of 3; this repo's next own
  action remains Geoff's Members before/after and the three queue items above.


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
