# Invisible-polish fix list (adjudicated 2026-07-15)

The conductor's adjudication of the four audit streams (mechanical audit + three optical
lenses) run under `docs/2026-07-15-asc-invisible-polish-brief.md`. Ranked by perceptual
leverage. Everything here is look-preserving except the two flagged items, which conform
inconsistent surfaces to the site's own convention and are called out in Geoff's
before/after. Source ledgers live in the session scratchpad (`mechanical-audit.md`,
`optical-typography.md`, `optical-color.md`, `optical-micro.md`); their durable verdicts
fold into `docs/design-benchmark/ledger.md` at settle.

Execution is three sequential batches (shared-file and e2e-port discipline: one gate-running
executor at a time). Every batch clears the full gate and regenerates any legitimately
diffing baselines in its own commit.

## Batch A: interaction and rhythm (theme CSS, home/events routes, SiteHeader)

1. **`:active` press states** (mechanical #1, high). The ruling: active is one step past
   hover on the same axis, applied instantly. Solid CTA tier: background steps to
   `color-mix(... fireweed, black 12%)` (hover is 8%). Quiet tier: wash steps to 16%
   (hover is 12%). Nav links, arrow-links, footer links: ink deepens one step. Form
   submits and ghost buttons: same one-step rule. `transition: none` under `:active` so the
   press acknowledges within a frame. No transforms, no new colors: every value is a
   color-mix step of the element's existing hover formula. Calibration from the prior
   ledger stands: subtle, "don't overdo this."
2. **Six link families get the standard focus ring** (mechanical #2, high):
   `.search-result-link`, `.spine-row-title`, `.events-toc-link`, `.ics-link` /
   `.event-detail-nav-link`, `.calendar-subscribe-link`, `.back-link` — the site recipe
   verbatim (2px solid `var(--color-primary)`, 2px offset; footer-context variants follow
   the footer's documented contrast swap if any of these sit there).
3. **`.nav-caret` hit area** (mechanical #3, high): the same documented `::before` inset
   expansion its three icon siblings use, to the same ~44px target.
4. **Facts/steps collapsed top margin** (micro #1, medium — verify first): reproduce in a
   live browser before editing; if the `margin: 0` co-declaration really out-specifies the
   chassis owl selector, fix at `asc-components.css:155,252` so `--flow-space` governs, and
   explain why `::::table`'s identical pattern measured fine. Chassis files are not edited.
5. **Donate dark preset-amount contrast** (color lens flag, medium): measure the rendered
   contrast, then bring the preset buttons up using existing tokens/steps only.
6. **Eyebrow tracking token conformance** (typography #8, low): `:::related` eyebrow
   (`asc-components.css:228`) and availability chip (`:528`) move from 0.06em/0.03em to
   `var(--tracking-eyebrow)`.
7. **Drop the dead `icon="anchor"` attribute** from `moorings.md:7` (micro #2, no render
   change). Callout icon *support* is raised as backlog, not built.

## Batch B: forms and portal (join/apply, my-account routes)

1. **Join/apply purchaser fields get real labels** (mechanical #4, high): the same
   fieldset/legend convention the household-member fields in the same file already use.
   FLAGGED as a visible change: labels appear on three fields; conforms the form to its own
   file's convention.
2. **Portal "Sign out" / "Leave the club" affordance** (color lens flag, medium): style with
   the portal's existing action vocabulary (match whatever the portal already uses for
   buttons; "Leave the club" additionally reads as consequential, so it must not gain
   primary weight). FLAGGED as a visible change on an unaudited portal surface.
3. **Portal receipts `tabular-nums`** (mechanical #6, low): the one digit column missing it.
4. **`/my-account/classes/` empty state** (micro #3, medium): an `{:else}` state in the
   site's existing empty-state idiom instead of sections vanishing.

## Batch C: standing gates (`scripts/design-probe.mjs` only)

Per the watch-item doctrine, the durable wins from mechanical #10: (1) hover/focus-visible
selector parity, (2) `:active`-existence on the named button families (guards batch A's
work), (3) a pseudo-element-aware touch-target check. Match the probe's existing check
style; low-false-positive or it doesn't ship.

## Raised, not applied

- Callout `icon` attribute support (feature, backlog).
- Portal dark-mode captures and audit (next round; no dark portal renders exist).
- Brief correction at settle: its "known-open" section is stale on `::selection` and
  `text-wrap` (both landed since the 2026-07-08 ledger).

## Register round (Geoff-opened mid-pass; recovered after the 2026-07-15 session crash)

Geoff's live education notes: itinerary day descriptions, plain disc-bullet lists, and the
Class Dates schedule rows all render at page-prose register and don't differentiate. The
ruling, "component register": component body text one step below page prose, row hierarchy
by weight and ink rather than size, en-dash list markers sitewide. Probed on dev via CSS
injection; the probe page and captures died with the crashed session's scratchpad, so the
page is being regenerated from this spec for Geoff's verdict. The round is NOT landed.

The five probe regions, all against `https://dev.aksailingclub.org` (Access service-token
headers), before/after at 1440 and 390:

1. **Itinerary read layer** (`/education/`, course weekend):
   `.prose .course-day p:not(.course-day-label) { font-size: var(--text-step--1); }`
2. **En-dash list markers** (`/education/`, What to Expect): replicate the home fleet
   dash-list idiom (`+page.svelte` `::before` en-dash rule) onto `.prose ul:not([class])`.
3. **Schedule rows** (`/education/`, Class Dates & Openings): row title `--text-step--1`
   weight 600; date muted, tabular-nums, step--1; row vertical padding one spacing step
   down; status chip untouched.
4. **Same anatomy: `/events/` listing rows** (after-only, 1440): titles 600 at the smaller
   step, muted tabular dates.
5. **Same anatomy: event-detail facts slab** (after-only, 1440): same compaction.

Prior conductor read (pre-crash) endorsed all five. On Geoff's verdict the round lands as
ONE commit (education regions + events + event-detail anatomy, baselines regenerated
in-change); a region that reads wrong iterates while the others land.

## Settle list (carried through the crash)

State at recovery: batches A (cbbaee/aef22f9), B (4b757af), C (d3e73e7) plus the CTA
grammar (e6145a7) are committed, pushed, and live on dev. Remaining, in order:

1. Clean-bootstrap e2e re-run to clear the Batch B KNOWN-FAILING flag (warm-replica state
   pollution, unrelated to the diff).
2. Geoff's register-round verdict, then the one-commit landing above.
3. The expert coherence read (Geoff's mandate, the pass's closing gate): a fresh-context
   expert-designer lens, no builder context, reads the FINISHED pages whole at 390/1440
   with one charge — would an expert see tells this was assembled rather than designed?
   Findings get one final fix round before the gallery.
4. Settle artifacts: fold the audit verdicts into `docs/design-benchmark/ledger.md`
   (source ledgers died with the scratchpad; recover from the crashed session's subagent
   transcripts under `~/.claude/projects/.../9ebebc97-*/subagents/`), correct the brief's
   stale known-open section, STATUS entry plus archive trim.
5. Fix the stale `docs/content-guide.md` pointer in CLAUDE.md (file does not exist; found
   by the Batch B agent).
6. Geoff's final before/after gallery.
