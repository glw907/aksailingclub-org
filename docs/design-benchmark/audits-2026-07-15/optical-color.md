# Optical audit ledger — Color, Surface & Depth lens (2026-07-15)

Fresh-context audit of the shared-components surfaces (post-dating the 2026-07-08 felt audit)
and dark mode against the club-grounds color contract. Burden of proof on the change; the
2026-07-08 ledger's RIGHT verdicts (near-black ink, tinted borders, layered shadow, scrims,
radius system, dark-mode parity) stand and are not re-litigated.

Renders read (light + dark where available): education (steps/cards/gear-table/availability
chip), moorings (facts + related + requirement callout, L+D), events (chip vocabulary, 390+1440),
post-detail (results-table variants, L+D), join (real :::steps rail + fees table), portal
(my-account signed-in, household), donate (form, L+D), home (L+D), posts (news index, D),
governance (document, D). Component CSS read from src/theme/asc-components.css and theme.css.

## Color knobs

- **Facts dl label ink — is it a navy-family step or an ad hoc gray?** ALREADY-RIGHT.
  `.asc-fact-label` uses `--color-muted` (oklch 51.8% 0.021 227.6 light / 72% 0.018 249 dark),
  the ledger-confirmed navy-family muted token, not a new literal. moorings--1440 + --dark:
  labels read as a correct quiet step of the value ink in both modes. No stray hex.

- **Category-chip dots — role discipline (gold only as a mark).** ALREADY-RIGHT. events--1440
  / --390: racing=blue-dot, social=green-dot, operations=business-gray-dot,
  class/clinic=gold STAR glyph (`--color-star-gold-dot`), all sourced from the C7 season-dot
  tokens. Gold appears only as the class/clinic mark, never as text or furniture. Fireweed
  appears nowhere in the chip/table/facts/steps vocabulary — its budget is untouched by the
  shared components (spent only through `.asc-cta-btn`, out of this lens's skip list).

- **Availability outline chip — documented contrast.** ALREADY-RIGHT. `.asc-availability-chip`
  text is `--color-muted` weight-600 at step--2: ~4.6:1 on white (light), higher on the dark
  ground — clears 4.5:1 for the label. Border is `color-mix(muted 35%, transparent)`, a
  deliberately faint quiet outline (decorative, no contrast floor); "OPEN"/"COMPLETED" still
  read via text + box in both events and education-class crops. Reserved semantic palette is
  correctly NOT borrowed for availability.

- **Results / fees / gear table header rule.** ALREADY-RIGHT. `.asc-table thead th` overrides
  the chassis neutral rule with `2px solid --color-primary` (navy), so every variant reads as
  this site's table. post-detail (results, L+D), join (fees), education (gear, L+D): header
  navy in light, primary-blue in dark, consistent. Tabular numerals present on all numeric
  columns (verified digit-alignment in the results grid). Scoring-code legend is muted italic,
  a correct quiet step.

- **Requirement callout tone.** ALREADY-RIGHT. `.callout-requirement` = 1px `--color-primary`
  border + `--color-base-200` ground + navy title. moorings L+D: reads as a calm prerequisite,
  never a hazard; no gold/fireweed. Dark: ground goes darker-than-page (base-200 18% < base-100
  22%) with a primary-blue border+title — consistent with the sitewide band inversion, tone
  distinction preserved.

- **Related cross-reference eyebrow.** ALREADY-RIGHT. `.asc-related-eyebrow` is muted uppercase
  tracked (0.06em); link + arrow inherit the navy prose-link color. moorings L+D: reads clean,
  arrow is part of the link color, hairline top rule present.

- **Steps rail ink.** ALREADY-RIGHT. join "How to Apply": outlined circles are transparent
  fill + 1.5px `--color-primary` border + primary numerals (tabular), hairline connector on
  `--color-card-border`. No gold, no fireweed, no fill. Pure navy-family + neutral hairline.

- **Portal status accents.** ALREADY-RIGHT. my-account signed-in uses a green (success) left-
  edge accent on the "Current through…" card and a red (error) tinted danger card on the
  household "Leave the club" zone — genuine semantic-status use of the reserved palette, not
  decoration; the education-vs-warning collision the contract warns against does not recur.

## Depth & surface knobs

- **Facts / related / steps flatness (no card chrome by design).** ALREADY-RIGHT. All three
  are hairline-and-type only, no background, no shadow — the deliberate A1 "cards mark objects"
  flat choice, confirmed absent-shadow is intentional not missed.

- **Hairlines vs the token border.** ALREADY-RIGHT. Every new surface's rule (fact row top-
  border, steps connector, related top-rule, table row rules, page-cta top-rule) uses
  `--color-card-border` (green-tinted hairline light / transparency-formula dark). In dark the
  hairlines stay visible without glowing (moorings/edu/post-detail dark crops).

- **Radius consistency on new surfaces.** ALREADY-RIGHT. Availability chip uses
  `--radius-selector`; `.asc-cta-btn` uses `--radius-field`; portal cards use `--radius-box`.
  No new literal radius introduced by the shared components.

- **Elevation logic on new surfaces.** ALREADY-RIGHT. Shared components rest flat; only the
  interactive `.asc-cta-btn` (fireweed-tinted shadow pair) and the existing link-card lift
  carry `--cairn-shadow`-family elevation. One coherent small set of levels.

- **Dark-mode photo / scrim survival.** ALREADY-RIGHT. home--1440--dark: triptych navy scrims
  read clear, fleet/facilities/news photos not washed or inverted; the aurora news thumbnail is
  bright by its own content, not a mode artifact. donate/post-detail hero photos translate
  cleanly. Season-band four-dot legend stays distinct in dark.

- **Sage-band story in dark.** ALREADY-RIGHT. base-200 bands render darker-than-paper in dark
  (the inversion) across education/join/home; the warm-band hierarchy survives translation.

## Not-applicable / coverage gaps

- **Portal pages have NO dark captures in the render set** (my-account* are light only). Portal
  dark surfaces (status card green accent, danger card red tint, form inputs) therefore remain
  UNAUDITED for dark mode — a coverage gap to note, not a defect. Worth a dark portal capture in
  a later pass.

- **`::selection` / `:active`** — N/A, unchanged from the ledger (still nice-to-have, not applied).

## Coherence question — anything reading AI-default or template-look?

No. The shared-components vocabulary reads as one deliberate system, not a component-library
drop-in: navy structure, gold reserved to the class/clinic mark, fireweed absent from these
surfaces, muted labels a true navy-family step, hairline-only flat surfaces, tabular figures,
context-tuned table density. Dark mode is coherent across all nine templates — no washed photos,
no lost or glowing hairlines, tone distinctions and the band inversion intact. This is a
mostly-already-right result, as calibrated.

Two observations OUTSIDE this color/depth lens, flagged for the interaction/forms lens, not
recommended here:
1. Portal secondary/destructive submit buttons ("Sign out", "Leave the club", "Update listing")
   render as plain bold near-black text with no button chrome and no link color — an affordance
   weakness (they don't read as clickable). Interaction lens.
2. donate--390--dark preset amount buttons ($50/$100/$250/$500) sit low-contrast dark-on-dark in
   the unselected state; legible via text + edge, but visually quiet. Borderline; interaction/
   forms lens if pursued.
