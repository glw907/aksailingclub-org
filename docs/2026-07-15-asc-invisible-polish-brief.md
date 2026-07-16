# ASC invisible-craft polish brief (2026-07-15)

Adapted from cairn-cms's `docs/internal/2026-07-15-admin-resolved-polish-brief.md` (the admin's
own polish brief, filed the same day) for this site's public surfaces. Geoff's framing carries
over verbatim: this is a pass for "the changes that a truly great designer does that an average
user can't see, but definitely feels." Users experience these details as gut-level judgments
(professional, trustworthy, fast, cheap, off) because they operate below conscious attention. The
target is the difference between a design being **correct** and being **resolved**.

## The look-preserving boundary

A finding that would visibly change the site's look gets **raised, not applied**. This pass makes
final refinements against the settled club-grounds system; it does not reopen the palette,
type scale, or composition decisions the design contract already locked (see the project
`CLAUDE.md`'s "club-grounds color story" section and `docs/2026-07-06-asc-phase-1-design.md`).
One exception is already carved out and tracked separately: Geoff's requested hero CTA re-style
on home, his pick pending, which is a deliberate visible change and does not belong in this pass.

## Scope (Geoff-settled 2026-07-15)

In scope:

- All six public page groups in `docs/design-benchmark/page-confirmations.md` (home + primary
  pages, members-menu children, governance/policy documents, storage pages, form/confirmation/
  system pages, news surfaces).
- Public forms: `/join/apply/`, `/classes/[id]/signup/`, `/donate/`, `/contact/`,
  `/it-request/`.
- `/my-account/` portal chrome (page-confirmations.md excludes it from the page-by-page
  confirmation sweep, but portal chrome is in scope here as member-facing UI).

`/` home and `/education/` are confirmed pages (page-confirmations.md marks both `[x]`) but stay
in scope for look-preserving items only; nothing here reopens their settled composition.

Out of scope: cairn's own `/admin` engine chrome. That is upstream's pass
(`docs/internal/2026-07-15-admin-resolved-polish-brief.md` in cairn-cms), not this repo's.

## Sequencing

This site has no admin-style reorganization/papercuts/refinement arc ahead of it the way cairn's
admin does; the shared-components pass (2026-07-15, `docs/STATUS.md`) and the ongoing
page-confirmations sweep already carry that role. This brief runs against whatever the sweep has
settled at the time it executes, same as the admin brief runs against the admin's settled system.

## Method notes

Two workstreams, split by how each item verifies:

- **Mechanical (gate-able):** auditable by grep, computed style, or a test; several can become
  standing checks in `scripts/design-probe.mjs` (which already gates image-ratio drift, stray
  fixed/absolute corner elements, horizontal overflow, and unstyled band content) rather than
  one-time fixes. Examples below: spacing values off the fluid scale, missing state variants,
  transition durations out of the 150-250ms band, missing `autocomplete`/`inputmode`, non-tabular
  numerals, faux bold.
- **Optical (eyes-required):** needs a rendered judgment at the five-viewport bar (320, 390, 768,
  1440, 2560, composed at the extremes) plus dark mode, some with Geoff (optical centering,
  padding asymmetry, rag control, shadow believability, icon optical alignment). Follows the
  visual-fidelity discipline the project `CLAUDE.md` already requires for any design change.

Several items are already-claimed and RIGHT per `docs/design-benchmark/ledger.md`'s 2026-07-08
felt audit (near-black ink, near-white grounds, tinted borders, layered `--cairn-shadow`,
radius consistency, tabular numerals, real typographic characters, focus-visible recipe, hover
timing, reduced-motion coverage; see that file for the full list). Per the ledger's own rule, a
verdict stands unless the graded code changed or Geoff reopens it, so this pass audits only what
the ledger left open or what postdates it, not what it already settled.

### Known-open items from the ledger

- **`::selection`**: no rule exists anywhere (`theme.css`, `site.css`, chassis); text selection
  renders in the OS default blue. Logged N/A in the ledger as a nice-to-have, not applied.
- **`:active` states**: no `:active` pseudo-class exists on the site; every interactive element
  relies on hover plus `:focus-visible` alone. Also logged N/A, not applied.

### Ungraded since the ledger

The 2026-07-08 audit predates the shared-components pass (2026-07-15,
`src/theme/markdown/components.ts` + `asc-components.css`): `:::facts`, `:::related`,
`:::page-cta`, `:::steps`, `::::table{variant=...}`, the category/availability chip vocabulary,
and the `requirement` callout tone are all new surfaces the felt audit never saw. Every rubric
category below applies to them as unaudited, not as already-right.

## The rubric

Every item translates cairn's admin example to this site's own tokens and files. Token values
below are read live from `src/theme/theme.css`; verify against that file before citing a number
in a fix, since it is the source of truth, not this brief.

### Spacing and rhythm

- Vertical rhythm: values drawn from the fluid `--spacing-3xs` through `--spacing-2xl` clamp
  scale (`theme.css`), never an arbitrary literal. [mechanical: grep component CSS for px/rem
  spacing literals outside the scale]
- Proximity grouping: related elements read closer than unrelated ones without borders or boxes.
  The `:::facts` dl (label/value rows, no card chrome) is the newest test case. [optical]
- Optical vs. mathematical centering: icons in the chip vocabulary (category dot, availability
  outline chip) and the `:::steps` counter rail nudged to look centered against their text
  baseline, not just centered by box math. [optical]
- Padding asymmetry: buttons (the CTA button, `.asc-cta-btn`, ghost buttons) checked for more
  horizontal than vertical padding; text containers with descenders (any label ending in
  g/j/p/q/y) checked for enough bottom padding that the glyph does not sit low. [optical]
- Whitespace as hierarchy: breathing room signals importance on its own, without leaning on size
  or color. [optical]

### Typography

- Line height tuned to line length: `--leading-body` (1.6) on paragraphs, `--leading-snug` (1.4)
  on ledes and h3, `--leading-tight` (1.12) on h1/h2 and the hero title (`theme.css`), audited for
  new surfaces (the `:::facts` value column, table captions) that might have drifted onto an
  unassigned default.
- Measure: body text at roughly 45-75ch; `--container-measure` (44rem) and
  `--container-measure-wide` (58rem) are the enforcing tokens. Audit new wide surfaces (tables,
  the facts list) for measure drift, since a definition-list value column can run wider than
  prose without anyone noticing.
- Tracking: `--tracking-tight` (-0.011em) on display headings, `--tracking-eyebrow` (0.12em) on
  all-caps labels. Audit the shared-components eyebrow-style furniture (`:::related`'s
  cross-reference lines, table captions) for a tracking value.
- Hierarchy from weight contrast (400 vs 600), not size alone, on the new definition-list and
  chip surfaces.
- Real typographic characters in UI copy: curly quotes, correct dashes, proper ellipses,
  non-breaking spaces before units (fees, class capacities). [mechanical in content strings;
  content itself follows `docs/content-guide.md`'s own dash policy, not this brief]
- Rag control: no orphans/widows, no single word stranded on a heading's last line. The ledger
  found no `text-wrap: balance`/`pretty` declaration anywhere; the only observed exposure is
  narrow-viewport heading wrap at 390px. [mechanical + optical]
- Font rendering: never faux bold or italic where the loaded weight does not exist. All three
  faces (Figtree, Source Sans 3, Source Code Pro) load as `@fontsource-variable`, so every weight
  is available; audit for a component reaching for a numeric weight the variable font does not
  cover. [mechanical]
- Tabular numerals: `font-variant-numeric: tabular-nums` already applies to the Season date
  column and SpineRow event dates (ledger, RIGHT). Audit the shared-components `::::table`
  variants (results/fees/gear) for the same rule on any numeric column, since those postdate the
  ledger. [mechanical]

### Color

- Near-black, not pure black: `--color-base-content` carries a slight navy chroma
  (`oklch(24.7% 0.029 249)` light, `oklch(92% 0.008 249)` dark), confirmed RIGHT by the ledger.
  Audit stray hexes in newer files (`components.ts`, chip CSS) that might bypass the token.
- Desaturated grays tinted with the brand hue: `--color-muted` (`oklch(51.8% 0.021 227.6)`)
  carries the same navy hue family as `--color-base-content`. Audit any new neutral literal
  against this token before treating a raw gray as acceptable.
- Borders as a slightly darker version of the ground, not generic gray: `--color-card-border`
  (`oklch(90.9% 0.011 141.3)` light, a `color-mix` transparency formula in dark) is a
  green-tinted hairline, not flat gray, confirmed RIGHT.
- Text hierarchy as lightness/opacity steps of one hue: base-content, muted, and the footer-ink
  pair all sit in the same navy family. Audit `:::facts` label text and table captions for a
  correct step rather than a new ad hoc gray.
- Contrast at WCAG 4.5:1 without reading as "high contrast mode": the `--color-star-gold-dot`
  and category-dot tokens already carry a documented contrast derivation in `theme.css`; audit
  the availability chip (introduced in the shared-components pass) for the same documented
  contrast math.
- Hover/active states shifted a consistent perceptual step, not eyeballed per element: every
  hand-written hover transition already standardizes on `0.15s ease` (ledger, RIGHT). Enumerate
  hover states on the new chip and `:::steps` surfaces and confirm they follow the same OKLCH
  step rather than a bespoke brightness filter.

### Depth and surfaces

- Layered shadows: `--cairn-shadow` is a two-layer shadow (`0 1px 2px` close, `0 6px 20px -8px`
  ambient in light; deeper black-based layers in dark), confirmed RIGHT by the ledger. Audit the
  `:::facts`/table figure treatments (deliberately "no card chrome" per the shared-components
  pass) to confirm the absence of shadow is a deliberate flat-surface choice, not a missed one.
- Shadow color tinted toward the ground or brand, never pure black: light mode ties the shadow to
  `color-mix(in oklab, var(--color-base-content) ...)`; dark mode uses black at 40/55% (a
  deliberate mode-specific choice, not a lapse, per the token's own comment).
- A defined elevation logic: modals (`SearchModal.svelte`), dropdowns (the Members flyout), and
  cards each mapped to a named shadow level. [mechanical: inventory every shadow declaration,
  confirm each maps to one of a small number of levels]
- Border-radius consistency: the two-tier system (`--radius-box` 0.5rem on photos/panels,
  `--radius-field` 0.4rem on controls) is confirmed RIGHT across every photo, panel, and control
  on home (ledger). Audit the shared-components surfaces (table figure, facts dl, chip
  background) for the same two tokens rather than a new literal.
- 1px inner highlights or borders separating cards from grounds below conscious notice: audit the
  chip vocabulary and table figure for a hairline where one belongs.

### Motion and interaction

- Easing: ease-out entrances, ease-in exits, never linear. Every hand-written transition already
  reads `ease` at a flat `0.15s` (ledger, RIGHT); audit whether any transition would read better
  with a directional ease now that more interactive surfaces exist (chips, steps).
- Duration discipline: 150-250ms for most transitions; the site's own standard sits at the tight
  end (0.15s/150ms). [mechanical: grep every `transition:` declaration for a duration outside
  100-250ms]
- Choreography: slight stagger on grouped entrances (the `:::steps` counter rail, a card grid) if
  any exists; none is currently implemented. [optical]
- Hover, focus, active, and disabled states defined for every interactive element. The ledger
  found no `:active` state anywhere on the site (N/A, not applied, calibration: "don't overdo
  this"); audit whether any of the newer interactive surfaces (chips, table row links if any)
  would benefit, without contradicting that prior calibration. [mechanical: state-variant audit
  per control]
- Cursor matches interactivity: confirmed RIGHT for the header icon trio (ledger). Audit the chip
  vocabulary, since chips are not always clickable and a stray pointer cursor on a non-interactive
  chip would mislead.
- Scroll behavior: momentum, snap where earned, no scroll-jacking. No known snap surfaces exist
  today; note as N/A unless a candidate surfaces.
- Reduced-motion respected everywhere: every component with a hand-written transition carries its
  own scoped `prefers-reduced-motion` gate, plus a blanket rule in `site.css` (ledger, RIGHT).
  Audit the shared-components CSS (`asc-components.css`) for the same coverage, since it is newer
  than the audit that confirmed the rest.

### Feedback and perceived performance

- Skeletons over spinners, sized to the incoming content so nothing jumps. Public pages are
  server-rendered content, not client-fetched dashboards, so this category mostly applies to
  `/my-account/` portal actions (class enrollment, payment) and the payment/donate flows that do
  make client-side calls. [optical, portal + payment forms only]
- Layout-shift prevention: reserved space for images (the fixed aspect-ratio treatment
  `checkImageRatios` in `scripts/design-probe.mjs` already gates) and for async portal content.
  [mechanical: CLS check on portal routes, extending the existing probe]
- Optimistic UI where the model already supports it: audit the payment and enrollment forms for
  a case where the request is fire-and-forget-safe enough for an optimistic state.
- Debounced inputs: site search already debounces at 150ms (`SearchModal.svelte`); audit any
  other keystroke-triggered fetch for the same discipline.
- Press states acknowledging the click within roughly 100ms even when the action runs longer:
  audit the CTA button, payment submit, and enrollment submit for a visible pressed state before
  the network round trip resolves.

### Forms and inputs

Public forms in scope: `/join/apply/`, `/classes/[id]/signup/`, `/donate/`, `/contact/`,
`/it-request/`, plus `/my-account/` portal forms.

- 44px touch targets even when the visible element is smaller (invisible padding). [mechanical:
  measure every form control and chip on the in-scope forms]
- Persistent labels, never placeholder-only. DaisyUI v5's `<fieldset>`/`<legend>` grouping (not
  the removed v4 `form-control`/`label-text`) is the site's own idiom per the project `CLAUDE.md`;
  audit that every field keeps a visible legend or label, not a placeholder standing in for one.
  [mechanical]
- Focus rings visible but styled, never the UA default: the site-wide `:focus-visible` recipe
  (2px solid `var(--color-primary)`, 2px offset) is confirmed RIGHT by the ledger for chrome and
  prose links. Audit every form input specifically, since inputs are a different element family
  from links and cards and the ledger's confirmation did not enumerate them one by one.
  [mechanical]
- Errors near the field, at the right moment (on blur, not per keystroke). Audit the join/apply,
  signup, donate, contact, and it-request forms' validation timing.
- Correct input types for mobile keyboards (`inputmode`, `type`): `DonateForm.svelte`'s custom
  amount field is `type="number"` with no `inputmode`, so audit whether `inputmode="decimal"`
  would improve the mobile keyboard there. [mechanical]
- `autocomplete` attributes already appear on `join/apply`, `classes/[id]/signup`, `my-account`
  (confirm, root, profile), and `ContactForm.svelte`. `DonateForm.svelte` has no name/email field
  (amount plus an optional note), so `autocomplete` does not apply there; `it-request.md` carries
  no form at all, only a Discord/email callout, so treat both as N/A rather than gaps. [mechanical]

### Content and micro-details

- Deliberate truncation: ellipses, fades, or line clamps, never overflow chaos. The
  shared-components pass already fixed events mid-word truncation; audit any remaining
  fixed-width surface (chip labels, table cells) for the same discipline.
- Empty states designed, never blank: audit the news index, topic archive, and portal "no
  classes enrolled" case for a designed empty state rather than a blank region.
- Icon optical alignment with adjacent text: baseline and visual weight, not just vertical
  centering, on the icon set (`src/theme/markdown/icons.ts`) wherever it sits beside a label
  (facts rows, chips, steps). [optical]
- Icon stroke weights and corner radii matching the typeface's character: audit the icon set
  against Figtree/Source Sans's own rounded, moderate-weight character. [optical]
- Shared-grid alignment: edges across unrelated components (a facts block beside a table, a chip
  row beside body prose) line up on the same measure. [optical + mechanical]
- Text selection color, scrollbar styling, favicon quality, mobile tap-highlight color: the
  ledger already logged no `::selection` rule (N/A, nice-to-have). Audit scrollbar styling,
  favicon quality, and `-webkit-tap-highlight-color` fresh, since none of those three appear in
  the ledger's 2026-07-08 pass. [mechanical]

## Output contract

The pass opens with a two-track audit (mechanical scans plus fresh-context optical review of
five-viewport-bar renders, per the visual-fidelity discipline), produces a fix list ranked by
perceptual leverage over effort, executes through the standard gates (`npm run check`,
`npm test`, `npm run build`, `npm run test:e2e`), and banks durable wins as standing checks in
`scripts/design-probe.mjs` where the trigger is machine-detectable. Any finding that would
visibly change a page's look gets raised to Geoff instead of applied, per the look-preserving
boundary above; the hero CTA re-style is the one already-known exception and stays a separate,
deliberate change.

Candidate standing gates for `scripts/design-probe.mjs`: a spacing-scale scan (literal px/rem
values outside `--spacing-3xs..2xl`), a transition-duration band check (outside 100-250ms), an
`autocomplete`/`inputmode` presence check on the five in-scope public forms plus portal forms,
and a tabular-numerals check on the shared-components table variants.
