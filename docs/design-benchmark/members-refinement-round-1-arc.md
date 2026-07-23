# Members refinement, round 1 — arc log

Async probe arc (design-refinement), opened 2026-07-21 mid-Assets-brainstorm (Assets
paused at the functional-inventory question; its live findings are in the session
record). Deep dose. Geoff's calibration words: "everything should feel native, polished
and balanced." Review mode: self-contained probe pages, one landing commit batch at
settle. The durable standard lives in this repo and harvests to cairn at settle.

## Scope rulings

- Geoff's first-pass notes (2026-07-21, explicitly non-exhaustive): (1) font sizes are
  random; (2) the active form element has a very non-cairn look; (3) the standing
  indicator looks like a button; (4) phone numbers should display 111-222-3333;
  (5) filters are sprawled and the Add household button reads as part of the filter
  cluster; (6) the "Household roster, standing, and quick actions" subtitle is faded
  and strangely located — bring it into the design.
- The three open Members-pass probe items fold into this round: StatusChip palette
  mapping, the never-paid 'none' display copy, the search focus ring.
- Work list = Geoff's notes + a broader audit with adversarial review of major
  findings (his instruction), four lenses over captures + computed-style inventory.
- The toolkit components under audit live in cairn (`@glw907/cairn-cms/admin-toolkit`)
  since the Classes-pass subpath swap; ratified component treatments land upstream in
  cairn at settle, never as site-side overrides. `ExpandableRow` is still site-local.
  The engine's `OfficeList` header idiom (note 6's subject) is also cairn's.

## Strategy ruling (Geoff, 2026-07-22)

The long-term goal is that OTHERS can build admin components visually in-line with the
interface. Agreed architecture, four layers: (1) tokens as the only styling contract —
a ruled type + spacing scale joins the existing `--cairn-*` roles; sites may re-tune
palette tokens, never grammar tokens; (2) toolkit primitives cover the recurring screen
anatomy so builders compose rather than style; (3) the standard lives in cairn docs as
exemplar-plus-rules (post-round Members is the annotated canonical screen; per-component
contract blocks follow StatusChip's README idiom); (4) a shipped `cairn audit`-style
mechanical gate (off-scale sizes, non-token colors, second filled toolbar button,
focus-visible coverage) — named harvest item, generalizing the Members-pass
non-compiling-class detector want.

## Probes and verdicts

- Filter grammar (answered as a reasoned recommendation, pre-render): uniform filter
  menu-buttons with in-control applied state ("Standing: Overdue ×"), same height as
  the search field; no separate applied-pills row; the archived toggle joins the facet
  family; primary action hard right, the row's only filled control; count line beneath;
  facets wrap as a row pair at 390. **Geoff ratified A** ("A works") with the
  native/polished/balanced calibration. Probe page still renders A's execution for
  verdict on the treatment, not the grammar.

## Audit round (2026-07-22): four lenses + two adversarial refuters

Lenses (fresh-context, over live captures + computed-style inventory + source): typography
& rhythm, color/surface/depth, composition/integration, interaction mechanics (measured
live). Uncontested confirms, carried to the fix list:

- Type: content region runs 7 unrelated sizes from unreconciled component defaults;
  hierarchy inversion (name 12px < phone 14px). Ruled 6-role scale proposed (24 title /
  14-15 subtitle / 14 body weight-carried / 13 meta / 11 label+0.08em / 10 chip); body
  cells unify at 14px, "(primary)" demotes to 13, meta band unifies at 13 (absorbs the
  12 and 13.33px strays; select/search sizing is ListToolbar-owned). Headers, chip size,
  390 truncation graded already-right. Tabular-nums on phone + count lines (Classes
  already does it). Panel Contacts heading-gap 0 vs 8px siblings — unify.
- Subtitle mechanism PROVEN by direct measurement: h1 carries 16px margins, subtitle p
  14px, inside OfficeList's flex gap-0.5 — leaked prose margins, flex doesn't collapse.
  UPSTREAM cairn OfficeList defect (visible on every engine subtitle screen).
- Composition: filter sprawl is emergent from ListToolbar's rigid minmax(11rem) grid →
  flex row of intrinsic-width quiet menu-button facets; archived checkbox folds in as a
  facet (deletes the bespoke bolt-on); pills row retires (in-control state). Alignment
  rails x320/x344 clean. Anatomy fork logged: Members/Classes one-card vs engine's
  bare-toolbar + table-only card — owner call. Primary-action fork: header slot
  (= Classes + engine) vs in-toolbar (ratified A detail) — probe renders both.
- Color/surface: StatusChip reads button because badge-outline border = full body ink +
  5rem min-width (fix: currentColor ~22% hairline + drop floor, in cairn StatusChip);
  panel has NO depth story (same surface as card; fix: recessed tint + inset hairline);
  chevron sticky cell hardcodes base-100 against zebra base-200 (parity-match fix);
  'none'/never-paid copy already resolved in source ("Not billed"/"No membership") —
  open item closed. One-filled-button rule, contrast, mark/selection all already-right.
- Interaction (all measured): expander a11y fully green (aria-expanded, Enter/Space,
  focus retention); reduced-motion honored; focus-ring system is the engine's own
  two-color idiom (ink for inputs, primary for primary/links) — Members introduces no
  color of its own; the named irritant is the AUTOFOCUS making the ink ring permanent
  on load (engine Pages does not autofocus). Row is clickable with cursor:pointer but
  ZERO hover feedback (engine rows have hover:bg-base-200/60) — toolkit ExpandableRow gap.

Contested majors sent to adversarial refuters (live CSS injection + rendered evidence):
chip hairline vs the known badge-ghost zebra-melt; panel base-200 recess vs zebra
base-200 collision; row-hover base-200/60 invisible-on-stripe parity trap vs
primary-tint vs base-content-alpha; search focus (primary ring vs engine-ink vs
autofocus treatment — three candidates); single-row toolbar fit stress (long applied
values, 390 wrap, in-control layout shift, both action placements).

Refuter results (2026-07-22): chip demotion SPLIT — border softening survives (ship ~35%
of text color), min-width hug REFUTED (ragged column; keep 5rem). Panel depth REVISED —
base-200 is the zebra color (merges); base-300 full-bleed on the panel td + inset
hairline survives. Row hover: engine base-200/60 REFUTED (invisible on stripes), primary
6% REFUTED (off-idiom); base-content 5% wash survives, sticky cell included. Search
focus: ink ring IS the engine input idiom (engine search measured identical); autofocus
is the irritant; :focus-visible gating DISPROVEN in Chromium (autofocus matches it) —
recommend removing autofocus. Toolbar stress: one row holds at rest (1440, ~200px
slack); wraps composed with long applied values (14rem in-control ellipsis cap);
action-placement splits by viewport — header slot wins at 1440, but OfficeList's mobile
header stretches the action full-width at 390 (LIVE on Classes today, confirmed in the
2026-07-21 capture) — adjudicated: header slot + upstream self-start fix.

Probe page delivered (2026-07-22, scratchpad members-refinement-round-1-probe.html,
opened via xdg-open): V1 header subtitle drop-vs-earn; V2 action placement (rec: header
+ mobile fix); V3 autofocus removal (rec: remove); V4 card anatomy club-vs-engine (no
rec); confirmed-pending-sanity-check: type scale + 14px body lift, chip demotion, panel
base-300 recess, row hover wash; mechanical list riding. VERDICTS OWED.

Upstream cairn harvest list (growing): OfficeList header margin leak; "New Pages/New
Posts" pluralization; create-button color inconsistency (neutral vs primary — wants one
ruling); PageHeader adoption across engine screens; ListToolbar flex recomposition +
menu facet variant + 13px meta unification; StatusChip demotion; ExpandableRow hover +
chevron parity; count-line tabular-nums.
