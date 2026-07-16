# Optical audit — Typography & Spacing/Rhythm lens (2026-07-15)

Fresh-context lens over the shared-components vocabulary and portal/form surfaces. Burden of
proof is on the change; the 2026-07-08 ledger's already-right verdicts stand and are not
re-litigated. Renders read: moorings (320/390/1440/2560/dark), post-detail (320/390/1440),
education (1440 + step/gear/schedule crops), events (1440 + chip crops), join (1440 + step/fee
crops), visiting-the-club (1440), new-member-guide (1440), governance (2560), donate (390),
my-account-household (1440). Source read: `theme.css`, `asc-components.css`, `prose.css`.

Legend: verdict — file:line / render evidence — felt impact.

---

## TYPOGRAPHY

### Leading tuned to role (facts value column, table caption, step body)
**already-right.** `:::facts` value (`asc-components.css:177`) sets `--text-step-0` with no
`line-height`, inheriting `--leading-body` (1.6) from the `.prose` root — correct for a value
that can run multi-line (moorings "Boat size", "Waitlist reality" wrap comfortably at 1.6,
`moorings--1440.png`). Table `figcaption` (`:406`) and step title/body (`:295`,`:301`) likewise
inherit 1.6; captions are single-line bold labels so the loose leading is harmless. No surface
drifted onto an unassigned/tight default. No change.

### Measure / measure drift (facts value column, tables)
**already-right.** The facts value column is `1fr` of the 44rem prose measure minus an 8–12rem
label track (`asc-components.css:154`), so it maxes ~55–60ch — inside measure, never wider than
prose. Confirmed at the wide extreme: `governance--2560.png` holds body and every component at
the 44rem measure with no drift (large symmetric margins, ~70ch lines). Dense tables exceed
measure by design and fall to `.table-scroll` horizontal scroll, not measure inflation. No change.

### Tracking on eyebrow-style furniture
**recommend (raise — low).** The site has a named eyebrow token `--tracking-eyebrow: 0.12em`
(`theme.css:181`) used by the dominant, most-recently-authored uppercase chrome: every form
label (`my-account-household--1440.png` NAME / EMAIL (OPTIONAL) read crisply spaced at 0.12em),
all my-account eyebrows, the events page eyebrow, and prose.css's section eyebrow. The two new
shared-components eyebrows diverged to tighter literals instead of the token:
- `:::related` eyebrow "RELATED" — `asc-components.css:228` `letter-spacing: 0.06em` (half the
  token). Renders adequately (`moorings--1440.png`, `visiting-the-club--1440.png`) but is
  visibly less tracked than the form labels it sits near on the same pages; and it is the
  *smallest* eyebrow on the site (`--text-step--2`), where small-uppercase typographic practice
  wants *at least* as much tracking as the larger labels, not half.
- availability chip "OPEN"/"FULL" — `asc-components.css:528` `letter-spacing: 0.03em`, the
  tightest uppercase tracking on the site; reads slightly cramped in
  `crop-events-open.png`.
Recommend aligning both to `var(--tracking-eyebrow)` (or at minimum a single shared eyebrow
value) for coherence with the form/section eyebrows. RAISE, not apply — it is a small visible
change under the look-preserving boundary. **Honest caveat:** this is a low nit, not a defect.
The site already carries pre-existing eyebrow-tracking spread that predates this pass and is
not graded here (`SeasonList.svelte` 0.08em, `[...path]/+page.svelte` 0.05/0.08/0.1em,
`events/+page.svelte:109` 0.06em), so 0.06em is not a lone outlier — it is within an already-loose
range. The value of the fix is tidying the *new* components onto the token, not eliminating a
felt problem. Felt impact: **low**.

### Hierarchy from weight contrast, not size (dl / chip surfaces)
**already-right.** `:::facts` pairs a 600-weight muted label (`asc-components.css:171`) with a
400 base-content value (`:177`); `:::steps` pairs a 600 title (`:295`) with 400 body (`:301`);
chips carry a muted label beside the mark. Hierarchy reads from weight + color step, never size
alone (`crop-join-steps.png`, `moorings--1440.png`). No change.

### Tabular numerals where digits column
**already-right.** `.asc-table th/td` sets `font-variant-numeric: tabular-nums`
(`asc-components.css:424`); verified aligning in the results grids (`crop-results1.png`:
1.00/2.50/4.50/10.00/12.00 hold a rigid column) and the fees column (`crop-join-fees.png`:
$100/$300/$50 align). The step counter also sets tabular-nums (`:281`). Season/SpineRow dates
already RIGHT per ledger. No change.

### Real typographic characters
**already-right (content track).** En-dashes in date/time ranges (`crop-events-open.png`
"Jun 20–22"; `crop-edu-steps.png` "1:00–6:00 p.m."), true ellipsis ("sailing…"), curly
apostrophes throughout. Governed by the content guide, not this pass. No change.

### Rag control / widows-orphans / heading wrap at 320-390
**already-right.** `page-cta-lead` carries `text-wrap: balance` (`asc-components.css:371`); no
stranded single-word heading lines observed at 390 (`events--390`, `moorings--390`,
`post-detail--390`) or 320 (`moorings--320`, `post-detail--320`). Body cells in dense tables
wrap at word boundaries, never mid-word, at 320 (`crop-320-summary.png` "Kara / N.", "Allie and
/ Matt") — the prose.css `overflow-wrap: break-word` header fix holds. The ledger's noted 390
heading-wrap exposure is unchanged; nothing egregious surfaced. No change.

### Faux bold / weight availability
**already-right.** All three faces load as variable fonts; components request 400/600/650
(`asc-cta-btn` 650, `:334`), all covered — no synthesized weight. No change.

---

## SPACING AND RHYTHM

### Vertical rhythm from the fluid scale
**already-right (optical).** Components anchor their outer rhythm to the token scale
(`--flow-space: --spacing-m/-l`, row padding `--spacing-2xs/-3xs`). A facts block sits correctly
on the page's vertical rhythm between prose and headings (`moorings--1440.png`: requirement
callout → facts at `spacing-m` → h2 at `spacing-xl`). Intra-component geometry literals exist by
necessity (step circle 1.75rem `:270`, chip padding 0.1rem/0.5rem `:521`, cta-btn padding
`:333`, results cell padding 0.35rem/0.5rem `:441`) — these are element dimensions, not
rhythm values, and are the mechanical lens's grep target, not an optical defect here. No change.

### Proximity grouping (the :::facts dl)
**already-right.** Label/value read as bound pairs; hairline top-rules separate rows without
boxing them; at <40rem the dl collapses to label-above-value with the hairline moved to the
label so each pair still reads as one unit (`moorings--390.png`). Textbook proximity, no card
chrome. No change.

### Optical vs mathematical centering (step counter, chip mark)
**already-right (star marginal).** The `:::steps` numeral is centered in its circle via flex
`align-items/justify-content: center` + tabular-nums giving "1" a full figure width
(`crop-join-steps.png` — 1/2/3 read centered). The category dot centers on the small-caps label
baseline; the gold **star** mark (`asc-components.css:511`, 0.65rem/line-height 1) sits a hair
high against the small-caps cap-height (`crop-events-open.png`) but within tolerance — not worth
a change. No change.

### Padding asymmetry / whitespace as hierarchy / descenders
**already-right.** `.asc-cta-btn` is 0.625rem V × 1.375rem H — correctly more horizontal
(`:333`; button itself out of scope). Facts/related lean on whitespace + hairlines for hierarchy,
never boxes. Labels with descenders ("Getting there", "Waitlist reality") clear their
`--spacing-2xs` bottom padding with no glyph clipping (`visiting-the-club--1440.png`). No change.

---

## Coherence question — AI-default / template-look?

**No.** Across a single dense surface (`visiting-the-club--1440.png`: two facts blocks, two
tables, one step rail, three related lines) the vocabulary reads as one deliberately-quiet
system — hairlines and whitespace doing the structural work, no stacked card chrome, all on the
club palette and the fluid type/space scale. The results tables (`crop-results1.png`) with navy
header rule, tabular figures, styled legend, and sentence-case figcaptions read as *this* club's
tables, not a generic component-library default. Dark mode preserves every component's intent
(`moorings--1440--dark.png`). The only whiff of inconsistency is the eyebrow-tracking spread
noted above, which is a token-application tidy, not a template tell. This is resolved,
character-bearing work; the lens returns essentially all already-right, as expected of a
surface that has passed prior review.
