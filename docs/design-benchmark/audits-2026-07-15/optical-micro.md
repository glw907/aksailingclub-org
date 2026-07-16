# Optical / micro-details ledger — invisible-craft pass (2026-07-15)

Lens: Content and micro-details, the optical halves of Spacing and rhythm (optical centering,
padding asymmetry), and Feedback. Method: pixel measurement on the render set (PIL/numpy on the
PNGs), cross-checked against `src/theme/asc-components.css`, `src/chassis/prose.css`, and
`src/theme/markdown/components.ts`. Does not repeat anything in
`scratchpad/mechanical-audit.md`. Calibration: burden of proof on the change; a mostly-right
result is expected, and most checks below confirmed already-right through measurement rather
than surfacing a new defect — that is the correct outcome for a pass this deep into the site's
polish arc, not underwork.

---

## RECOMMEND

### 1. `:::facts` and `:::steps` render with a collapsed top margin against a preceding paragraph or callout

**Measured**, moorings and visiting-the-club (both `--1440.png` and `--1440--dark.png`, same
gap in both modes):

| Transition | Token intended | Measured gap (text-to-text, px) |
|---|---|---|
| callout → facts (`moorings--1440.png`) | `--spacing-m` (~24-27px at 1440) | **17px** |
| paragraph → facts, RV parking block (`visiting-the-club--1440.png`) | `--spacing-m` | **13px** |
| paragraph → steps (`visiting-the-club--1440.png`, "Club Boat Reminders") | `--spacing-m` | **14-17px** |

Calibration points measured on the same pages, for scale:
- `h2 + *` (explicit literal `--spacing-xs`, the site's own *tightest* deliberate rhythm step):
  **26px** (`visiting-the-club--1440.png`, "Club Boat Reminders" → its paragraph).
- paragraph → `:::passage` (`--spacing-l`, no competing `margin` override): **49px**
  (`join--1440.png`, "Big Lake, Alaska" passage → "The Volunteer Culture" passage).
- paragraph → `:::related` (`--spacing-l` margin + `--spacing-m` padding-top, two tokens
  stacked): **71px** (`visiting-the-club--1440.png`, top-of-page related block).
- list → `::::table{variant="fees"}` (also `--spacing-m`, see item below): **50px**
  (`join--1440.png`).

Facts and steps land at roughly half of the *tightest* calibrated token on the page (26px) and
well under a third of what a same-token sibling (`::::table`, 50px) renders at. Source
(`src/theme/asc-components.css`): both components co-declare the flow token and a `margin: 0`
reset on the same rule —

```
.prose .asc-facts {           /* :151 */
    --flow-space: var(--spacing-m);
    ...
    margin: 0;                /* :155 */
}
.prose .asc-steps {           /* :249 */
    --flow-space: var(--spacing-m);
    ...
    margin: 0;                /* :252 */
}
```

`.prose .asc-facts`/`.prose .asc-steps` (specificity 0,2,0) out-specifies the chassis owl
selector `.prose > * + * { margin-top: var(--flow-space) }` (`src/chassis/prose.css:81-82`,
specificity 0,1,0), so the literal `margin: 0` wins on `margin-top` and the intended
`--spacing-m` gap never applies — what renders is just the preceding element's own line-height
half-leading, which is why the measured numbers (13-17px) track so closely across two unrelated
pages and two component types. **Caveat, in the interest of not overclaiming a root cause I
can't fully verify**: `.prose .asc-table` (`asc-components.css:409-412`) declares the *identical*
pattern (`--flow-space: var(--spacing-m); margin: 0;`) yet measured fine (50px, see the
not-applicable entry below) — a live-browser `getComputedStyle` check on the three selectors
would settle whether table is genuinely exempt or just coincidentally landing near the right
number on this content. Regardless of mechanism, the rendered outcome for facts/steps is
reproducibly and measurably tight across both instances checked.

**Felt impact: medium.** On moorings and visiting-the-club, the facts block and the steps list
read as glued to the paragraph or callout above them rather than as their own component with
the breathing room every sibling component (`:::related`, `:::passage`, `::::table`) gets —
inconsistent rhythm on pages that otherwise show a careful, deliberate vertical cadence.

**Fix**: drop the `margin: 0` from both rules (or replace with `margin-block-end: 0` if the
intent was only to zero the browser-default bottom margin on a `<dl>`/`<ol>`, never the top) —
`src/theme/asc-components.css:155` and `:252`. Small, spacing-only, does not reopen the
look-preserving boundary (it restores the token value already declared on the same rule, not a
new value).

---

### 2. `:::callout{icon="anchor"}` on moorings never renders — dead attribute, not a look change

**Confirmed**: `src/content/pages/moorings.md:7` authors
`:::callout[Active Participating Member status required]{tone="requirement" icon="anchor"}`.
The callout component build (`src/theme/markdown/components.ts:46-58`) reads only
`ctx.attributes.tone`; it never touches `ctx.attributes.icon`. The render
(`moorings--1440.png`, `moorings--390.png`, `moorings--320.png`, both light and dark) confirms
no icon glyph appears anywhere in the callout box — measured symmetric 24px top/bottom padding
around plain text only (see the already-right entry below). This is the one instance of
`icon=` on a callout anywhere in the content tree (grep confirms), so it's a single-page,
low-blast-radius authoring trap: `:::card` and `:::passage` both *do* honor `icon=`
(`components.ts`'s card/passage builds), so an author reasonably expects the same from
`:::callout` and gets silent nothing.

**Felt impact: low, but a genuine content-authoring trap** (the attribute reads as effective in
source but has zero effect; a future edit could easily "break" it further with no visible
signal either way). Two fixes, and per the look-preserving boundary only one is available in
this pass: (a) drop the dead `icon="anchor"` from `moorings.md:7` — no visible change, safe to
apply directly; (b) add icon-slot support to the callout component
(`components.ts:46-58`/`asc-components.css` callout-requirement block) — a new visible glyph on
the page, out of scope here per the look-preserving boundary, **raised, not applied**. Recommend
(a) now, and (b) as a Geoff-decided follow-up if the requirement tone is meant to always carry
an icon going forward.

---

### 3. `/my-account/classes/` has no designed empty state for "no classes, no waitlist"

**Confirmed**, `my-account-classes--1440.png`/`--390.png` (fixture member `e2e-current-member`):
the page renders straight from the H1 "Classes" to the "Register" section with nothing between
— no "My classes" or "My waitlist" heading, no acknowledgment that the member has zero of either.
Source (`src/routes/(site)/my-account/classes/+page.svelte:27,49`) confirms why: both sections
are wrapped in `{#if data.myClasses.length > 0}` / `{#if data.myWaitlist.length > 0}` with no
`{:else}` — the section (heading included) disappears entirely rather than rendering a designed
"you're not enrolled in anything yet" state. This is exactly the brief's named watch item
("portal my-account-classes (the fixture member's states) ... designed empty state rather than
a blank region"), and the fixture render is the one concrete case where the gap is visible
end-to-end.

**Felt impact: medium.** A first-time member landing here after registering elsewhere sees no
confirmation their account even tracks classes — the page reads as partially built rather than
intentionally minimal, especially since "My waitlist" *can* appear for the same member later,
so its permanent absence today isn't obviously "there's nothing to show," it could as easily
read as "this broke."

**Fix**: add an `{:else}` branch to each conditional (`+page.svelte:27` and `:49`) with a
one-line muted state ("You're not enrolled in any classes yet." / no waitlist equivalent needed
since waitlist is more clearly optional). Additive text only, not a composition or palette
change, so it does not trip the look-preserving boundary.

---

## ALREADY-RIGHT (measured, not just eyeballed)

- **`:::steps` counter-digit optical centering** (`join--1440.png`, step circle "1"): digit
  vertical center measured at y=3220.0 against circle vertical center y=3220.5 — 0.5px off,
  within antialiasing noise. Horizontal: digit stroke center x≈410 vs circle center x≈409, 1px
  off. `asc-components.css:265-282`'s flex-centered `::before` counter needs no nudge.
- **Category-mark dot/star vs. small-caps label baseline** (`events--1440.png`, "Test Intro
  Class" star+"Class" chip and "Test Regatta" dot+"Racing" chip): star vs. small-caps letter
  height centers matched exactly (928.5 vs 928.5, x648-664/x678-696). Dot vs. small-caps center
  matched exactly on one row (782.5 vs 782.5, "Operations") and was 1.5px off on another
  ("Racing") — within measurement noise given a fresh sample matched exactly.
  `asc-components.css:474-516` needs no optical nudge.
- **`.asc-availability-chip` padding** (`events--1440.png` "OPEN" chip, `education--390.png`
  "COMPLETED" chip): text vertically centered within 1px of the chip box's true center
  (927.5 vs 928.5); horizontal padding measured 9px/10px left/right (declared 0.5rem=8px plus
  border) — symmetric within a glyph's own right-side-bearing. No descender exposure since
  every observed availability value (`OPEN`/`FULL`/`COMPLETED`) is uppercase with no
  descenders. `asc-components.css:517-531` is fine as shipped.
- **`::::table` left-edge alignment vs. prose/heading/steps/facts left edge**
  (`join--1440.png`): the table's own box (border-bottom rule) starts at x=395, matching every
  h2/h3/step-circle/related-eyebrow left edge on the same page (x=395-396) exactly. Cell *text*
  sits ~12px right of that edge, which is the chassis default `td`/`th` padding
  (`prose.css:369,380`, `0.55rem 0.7rem`) — normal table-cell typography, not a misalignment;
  ruled out by measurement rather than assumed.
- **`.callout-requirement` box padding** (`moorings--1440.png`): interior top/bottom padding
  measured at 24px/24px around the title+body text — perfectly symmetric, no descender crowding
  despite "required," "requirements," and "Eligibility" descenders nearby in the facts list
  right below it.
- **`:::facts` row descender room** (`moorings--1440.png`, "Eligibility" row's descending 'g'):
  visual clearance to the row's hairline below is generous; no crowding at any of the four rows
  checked (Cost/Eligibility/Boat size/Waitlist reality).
- **`:::passage` icon vs. heading baseline** (`join--1440.png`, "The Volunteer Culture"
  handshake icon): icon bbox (y4331-4346) and the heading's first word bbox (y4331-4346) are
  pixel-identical — the flex `align-items: center` in `.ec-head` (`asc-components.css:17-19`)
  lands exactly on the heading's own cap-height, no icon-specific nudge needed.
- **Chip/table truncation at narrow viewports**: `events--390.png` ("★ Class [OPEN]" on one
  line, no wrap), `education--390.png` ("COMPLETED" chip, comfortable padding, no clipping) —
  no mid-word breaks or overflow found in the availability/category chip vocabulary at 390px in
  the pages sampled.
- **`::::table{variant="results"}` numeral columns and row padding**
  (`post-detail--1440.png`, the regatta results tables): tabular-nums confirmed visually aligned
  digit-under-digit across R1/R2/Total/Nett columns, row hairlines even, no descender crowding.
  Matches the mechanical audit's tabular-nums finding for this variant; nothing further to add
  optically.
- **Dark-mode parity for the requirement callout and facts list**
  (`moorings--1440--dark.png`): the callout's `background: var(--color-base-200)` reads as a
  deliberately subtle near-page-color tint in dark mode (only the border ring reads clearly),
  consistent with the site's established dark-mode restraint — not a contrast miss, matches the
  ledger's existing "dark-mode parity" RIGHT verdict extended to this new surface.

## NOT-APPLICABLE

- **`::::table{variant="fees"}` top margin** (`join--1440.png`): measured 50px gap from the
  preceding list to the table's caption, in line with (in fact matching) the passage/related
  calibration values — despite sharing the identical `margin: 0` + `--flow-space` CSS pattern
  with facts/steps (see Recommend #1's caveat). Empirically fine; not extending the facts/steps
  finding to this component without a computed-style check to explain the discrepancy.
- **`/posts/`, `/tags/education/` topic-area empty states**: the fixture data populates every
  topic (Racing 11, Results 8, Education 6, Club 22) and every tag sampled, so no empty topic
  card or empty tag page exists in this render set to judge. Nothing to measure; the brief's
  concern here is untestable against the current fixtures, not confirmed fine.
