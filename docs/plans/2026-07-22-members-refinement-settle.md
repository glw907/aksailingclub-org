# Members refinement round 1 — settle plan (2026-07-22)

The ratified landing for the Members design-refinement round (arc log:
`docs/design-benchmark/members-refinement-round-1-arc.md`, which carries the audit
evidence and refuter verdicts behind every value below). Geoff ratified the probe page
2026-07-22: V1 = drop the Members subtitle; V2 = primary action moves to the header
slot with the OfficeList mobile fix; V3 = remove search autofocus; V4 = the one-card
anatomy is the club standard (research-grounded; the engine's bare-toolbar anatomy is
upstream harvest work, not a rebuild here). Calibration: "everything should feel
native, polished and balanced."

Two repos, strict order: cairn first (most fixes live in the package), publish, then
the ASC pickup. Executors: `cairn-implementer` in `~/Projects/cairn-cms`,
`site-implementer` in `~/Projects/aksailingclub-org`. Every task clears its repo's
full gate before reporting done. No task edits both repos.

## Phase C — cairn-cms (`~/Projects/cairn-cms`, base v0.89.1)

**C1. OfficeList header fixes (two proven defects).**
(a) The eyebrow/h1/subtitle stack declares `flex flex-col gap-0.5` but the h1 carries
~16px prose margins and the subtitle `<p>` ~14px, so the rendered gap is ~32px (flex
does not collapse margins; measured live). Zero the child margins inside the header
stack so the subtitle sits 4px under the h1 and the eyebrow sits tight above it.
(b) Below the `sm` breakpoint the header's action slot stretches full-width (flex
default `stretch`; live today on ASC Classes as an edge-to-edge purple "New class"
bar). Pin the action to intrinsic width (`self-start` or equivalent) on mobile.
Acceptance: rendered header stack gaps are 0-6px at 1440 and 390; a header action
button renders intrinsic-width at 390. Prove in the showcase or component test.

**C2. ListToolbar recomposition (the ratified filter grammar).**
Replace the rigid `repeat(auto-fill, minmax(11rem, 1fr))` controls grid with a flex
row: `flex-wrap: wrap`, gap 0.5rem, row-gap 0.625rem; search `flex: 1 1 240px`,
`min-width: 140px`; every control pinned to one shared 30px height (force explicit
height/min-height; do not trust daisy size math to agree between `input-sm` and
`btn-sm`). Add a `display: 'menu'` facet variant: a quiet bordered button (border
`var(--cairn-card-border)`, transparent fill, 13px label) showing the facet name at
rest ("Standing") and the applied value in-control ("Standing: Overdue ×") with an
inline clear affordance whose hit area is a separate element, not a nested button.
Applied treatment: `border-color: color-mix(in oklab, var(--color-primary) 45%,
var(--cairn-card-border)); background: color-mix(in oklab, var(--color-primary) 7%,
transparent)`; applied value capped `max-width: 14rem` with ellipsis. The menu opens
a keyboard-operable option list (daisy dropdown/menu idiom; focus rings inherit the
engine defaults; aria per the daisy a11y patterns). Retire the applied-pills row
rendering (`computeAppliedFilters` stays as the label source). The existing
`'select'` variant remains for compatibility, restyled to the shared 30px height and
13px text. Count line: 13px with `tabular-nums`. Search input text: 13px (0.8125rem),
replacing the odd 13.333px. Acceptance: at a 972px container all five ASC facets +
search + a header-less row fit one line at rest; applied long values wrap to a
composed second line; nothing exceeds the container at 326px. The refuter's surviving
recipe and measurements are in the arc log; the stress-case HTML lives in the session
scratchpad (`refuter-toolbar/`) if reference is needed.

**C3. StatusChip demotion.** Border becomes `color-mix(in oklab, currentColor 35%,
transparent)` (adversarially verified: 22% sits at the visibility floor on light
zebra; 35% is the surviving value). KEEP `min-width: 5rem` on the sm size (hugging
was refuted: ragged column). The xs size is unchanged. Both themes verified against
zebra stripes — the chip must still separate from `base-200` rows (the old
badge-ghost melt is the known failure this guards against).

**C4. ExpandableRow graduates into the admin-toolkit, carrying three fixes.**
Move ASC's `src/admin-club/toolkit/ExpandableRow.svelte` into cairn's admin-toolkit
subpath (second consumer landed; graduation was already queued). Apply while moving:
(a) row hover feedback: `tr summary:hover > td { background-color: color-mix(in
oklab, var(--color-base-content) 5%, transparent) }` INCLUDING the sticky trigger
cell (it hardcodes base-100 and will otherwise show a seam on hover);
(b) the sticky trigger cell follows zebra parity (`base-200` on striped rows) instead
of hardcoded base-100 — kills the right-edge seam;
(c) the panel `<td>` gets the depth story: `background: var(--color-base-300);
box-shadow: inset 0 1px 0 var(--cairn-card-border)` (base-200 was refuted: it is the
zebra color and the drawer merged with stripes; base-300 survived in both themes).
Preserve the component's documented contracts (colspan mechanics, the 390
column-hiding pattern, aria-expanded/keyboard behavior — all measured green; do not
regress them). Acceptance: existing ASC ExpandableRow tests pass against the cairn
import; hover/parity/panel render per the recipes in both themes.

**C5. Toolkit numerics.** Pagination's range line: 13px + `tabular-nums`. Add
`formatPhone` to admin-toolkit `format.ts`: NANP display `907-555-0100` (hyphenated,
no +1) from a stored E.164 string; non-NANP or malformed values pass through
unchanged; unit-tested.

**C6. Engine create-button label pluralization.** The concept list screens label
their create action with the plural collection title ("New Pages", "New Posts").
Route the label through the just-landed `itemNoun` `{ one, many }` machinery so it
reads "New page" / "New post". Acceptance: showcase/engine screens render singular.

**C7. Release.** Simplifier over the phase diff, full gate, CHANGELOG, version bump
(minor — new component + new variant: 0.90.0), publish per the repo's own release
ritual (read `~/.claude/skills/cairn-release/SKILL.md` and the repo's release docs;
verify `latest` on the registry afterward).

## Phase A — aksailingclub-org (after C7 publishes)

**A1. Pickup.** Bump the `@glw907/cairn-cms` range to the new version, install,
swap the ExpandableRow import to `@glw907/cairn-cms/admin-toolkit`, delete the local
copy and its README stanza.

**A2. Members screen (`src/routes/admin/club/members/+page.svelte`).**
Drop the subtitle (V1). Move Add household into the OfficeList header action slot
(V2). Remove the search `autofocus` (V3). Fold the archived toggle into the
`filters` array as a menu facet (options "Active only" / "Include archived", default
active-only); delete the bespoke label, its scoped CSS, and the daisy radius
workaround. Type scale: `.members-name-cell` and `.members-cell` to 14px
(0.875rem), name weight 600; the "(primary)" span to 13px (0.8125rem); phone cell
displays via `formatPhone` with `tabular-nums`. Panel: give the Contacts section the
same 8px heading-to-content gap as its three sibling sections.

**A3. Classes verification pass.** Classes inherits C1-C4 through the package: the
mobile action bar fix, the header gap fix, chip/hover/panel treatments, and its
season select through the recomposed ListToolbar. Verify rendering at 390/1440 both
themes; fix any layout fallout on the Classes screens only (no redesign — its
"Season 2026" subtitle is an earned scope line and KEEPS, per the V1 reasoning).

**A4. Tests.** Update e2e selectors and expectations: facet menu-buttons replace the
filter selects, no autofocus on load, header-slot action. Unit tests for the page
changes as appropriate. Do NOT run Playwright `--update-snapshots` locally and do
not commit locally-rendered baselines; rendering changed, so baselines regenerate
ONLY via the ci.yml `workflow_dispatch` `update_snapshots` mode after merge.

**A5. Gates + review.** Simplifier over the phase diff, then `npm run check` (0/0),
`npm test`, `npm run build`, `node scripts/design-probe.mjs` (no new findings beyond
the five pre-existing site findings), reviewer fan-out (svelte, daisy-a11y) over the
changed components with findings fixed or explicitly waived with reasons.

**A6. Coherence read.** Fresh-context cold read (not any context that built this):
Members and Classes at 390 + 1440, both themes, default/expanded/filter-applied
states, asking the expert-tells question. FAIL blocks the close; findings return as
a fix round.

**A7. Land.** Push main (deploys dev), trigger `gh workflow run ci.yml -f
update_snapshots=true`, READ the run log (not just its conclusion), confirm CI green
end to end.

## Close (directing context, after the workflow)

The admin design standard doc (this repo, from the arc log's ratified rulings),
decisions.md distillation, arc log removal, STATUS update, harvest filing in cairn's
ROADMAP, Geoff's before/after on dev.
