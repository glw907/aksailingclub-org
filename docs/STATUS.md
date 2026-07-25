# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

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
- **NEXT: the cairn DESIGN-INFRASTRUCTURE BRAINSTORM (the Assets pass stays paused
  as that initiative's validation trial).** Seed doc:
  docs/2026-07-22-cairn-design-infrastructure-brainstorm-seed.md (Geoff's question:
  "Can we capture cairn's design language so an AI agent can reliably use and
  repeat it?"; the four-layer strategy ruling is distilled in decisions.md). RESUME
  PROMPT: "Open the cairn design-infrastructure brainstorm: read
  docs/2026-07-22-cairn-design-infrastructure-brainstorm-seed.md and docs/STATUS.md,
  then run superpowers:brainstorming with Geoff before any spec or build work."
  Launch from ~/Projects/aksailingclub-org.


**THE CLASSES PASS IS BUILT, RELEASED TO DEV, AND COHERENCE-PASSED ("designed, not
assembled", third cold read); GEOFF'S BEFORE/AFTER AND THE PROBE VERDICTS ARE THE
OPEN GATES (2026-07-21, crash-recovered session, Fable-conducted on Geoff's workflow
opt-in "continue with a workflow to release"; workflow wf_297581a0-a05 13 agents 0
errors + 5 direct dispatches; commits ecde24c..cbb79f5; cairn 0.89.1).** What shipped:

- **Tasks 1–5** (the crashed session had executed 1–4 and left Task 5 warm,
  complete, and gate-green — recovery lost nothing): cairn 0.89.1 (itemNoun/
  ItemLabel graduated), the toolkit subpath swap (five local copies deleted,
  ExpandableRow kept local), the season-scoped list rebuild (roster expand panels,
  offerNext with its three guards), the detail rebuild (roster, waitlist & offers,
  edit form on the event-detail idiom, instructors, demoted danger zone,
  recordPayment), and the transfer flow (transferEnrollment on the shared
  triggerFreedSpotOffer — same-price moves the payment, mismatch warns + explicit
  confirm, no Stripe surgery; the portal withdrawal path now shares the same
  freed-spot function).
- **The release round**: 13 findings, every medium adversarially verified (0
  refuted); 3 confirmed mediums fixed — the recordPayment DOUBLE-CHARGE race (now
  claimOffer's compare-and-set; accepted-at-club-scale residual: a D1 failure
  between the flip and the ledger batch leaves paid-without-ledger, the far-rarer
  inverse of the double-click it kills), the transfer picker offering
  already-enrolled destinations with the server refusal invisible behind the modal,
  and dead divide-y utilities (the silent-non-compile trap AGAIN — two more
  instances this pass, harvest finding 14). 7 lows fixed, 3 skipped with reasons.
  The cross-class waitlist's blank member names fixed (finding 11's follow-up).
- **Coherence: FAIL (4 tells) → fix → cold FAIL (2 tells) → fix → cold PASS** —
  full verdicts in the ledger. Carry-worthy root causes: ExpandableRow's
  panel-follows-summary-width contract recurred at its second consumer (harvest
  13); Svelte trims a literal leading space at an {#if} boundary (harvest 15).
- **Probes committed** (docs/design-benchmark/probes/2026-07-21-classes/): list row
  anatomy/density, the over-capacity voice x3, expand-panel composition, and the
  riders page carrying the three open Members items (StatusChip palette, the
  never-paid 'none' copy, the search focus ring). **GEOFF'S VERDICTS OWED.**
- **Gates**: check 0/0, 2000 tests, build green; design-probe clean (the same 5
  pre-existing site findings, none from this pass); CI green INCLUDING the visual
  suite against the EXISTING baselines — baselined rendering provably unchanged,
  so no update_snapshots dispatch (the regen rule binds only when rendering
  changes); deploy green, dev live.
- **Series ruling (Geoff, mid-pass)**: admin-screen-passes covers the ENTIRE admin
  surface until fully polished, order flexible — ROADMAP's entry now carries the
  remaining-screen map; season-rollover gained the sweep-the-ops-dashboard's-
  year-cycling-logic note.
- **Budgets**: ~1.9M subagent tokens (workflow 1.32M + five direct dispatches);
  conductor questions to Geoff: 0. Guard lesson reconfirmed: the bytes-based
  runaway alarm false-fired on the probe agent (embedded CSS + screenshots);
  stall-only detection is the right shape.
- **ON GEOFF'S QUEUE**: the Classes before/after on dev (/admin/club/classes — the
  list with a panel expanded, a detail page, the Move… dialog, at 390 and 1440)
  and the probe verdicts above.
- **NEXT PASS — ASSETS (first under the whole-surface series ruling)**: opens with
  the functional brainstorm. RESUME PROMPT: "Start the Assets pass: read
  ROADMAP.md's admin-screen-passes entry and docs/STATUS.md, then open the
  functional brainstorm with Geoff (superpowers:brainstorming) before any visual
  work. The asset_types underscore-vs-hyphen defect rides the pass; opening cairn
  task candidates: ExpandableRow's graduation (second consumer landed) and the
  destination-picker pattern." Launch from ~/Projects/aksailingclub-org.


**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):**
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
