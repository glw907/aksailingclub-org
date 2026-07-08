# Design decisions log

The design-refinement skill's persistent decisions log: every settled design question with
its reasoning. Later rounds never re-litigate a logged decision unless the owner reopens it.
Dates are 2026-07-07/08 (the home convergence arc) unless noted.

## Dose words (the owner's calibration language, quoted)

- "Don't overdo this stuff. The current design is solid. This is just **felt refinement**."
- Education: "**probably shouldn't be quite as 'designed'** [as home] since its function is
  different" … "it also shouldn't read as a well-structured formal document. It should read
  as a **fun, engaging, and informative web page**." (A program brochure done well.)
- "The general vibe should continue to be **fun, relaxed, and inviting**. But there are
  proven rules for creating exactly that effect while also remaining well organized."
- "You don't need to invent a radically new thing. You can fall back on **proven web UI/UX
  design patterns**."

## Settled decisions

- **Bands**: full-page alternating tints are HOME-ONLY. A long-form page may use ONE tinted
  band around its primary action group (education's registration+CTA is the first). Ruling
  amended by the owner 2026-07-08; both forms codified in docs/2026-07-06-asc-phase-1-design.md.
- **Full-bleed**: content blocks (photos, card rows, galleries) never stretch viewport-wide
  at wide viewports — they cap at the wide content breakout. Edge-to-edge is fine at tablet
  and below where viewport and measure converge. Background bands may bleed.
- **The triptych (What we do)**: one GROUP-rounded object — radius and clip on the band,
  square interior seams, panels abutting. Not per-panel rounding (creates divots), not sharp
  (it's a framed object among framed objects). Panel captions are true shared grid rows
  (subgrid): titles, descriptions, links at identical y at every width. Copy is the club's
  original wording (owner-supplied), deletion-only trims, description ink full white at 450.
- **The notification (bulletin)**: a bounded card below the hero spanning the full measure —
  the north star's block form wearing the pennant glyph (the pennant is the gold accent; no
  left bar). "Read more →" (non-wrapping). Present, never loud.
- **The Season**: two balanced columns (month-boundary split), hairline month caps, fixed
  date column, four dot categories (gold=classes, green=social, gray=club business,
  blue=racing) pixel-verified for separation, quiet legend row, event names at step -1 with
  dates a step below. Dots center on the name's x-height (no manual nudge — the baseline
  slot does it; em-nudges die with type changes).
- **The fleet list**: a plain spelled-out list ("Six Lido 14s") in the quiet register
  (step -1, mid-muted ink, tight rows) — the club's original sentence as outro. Not
  leader-dots, not numeral columns, no composed summary lines ("Nineteen boats…" was an
  AI-tell flourish; killed).
- **The two-list register**: fleet and facilities lists are siblings — same step, ink, and
  rhythm; device varies only where content differs (counts vs checkmarks).
- **Nav**: no hairline divider before the icon trio — the gap rhythm carries the grouping
  (an invisible spacer preserves the approved distances). Members→Contact spacing has an
  optical correction. Hover dropdowns with enter/exit intent delays.
- **Link idiom** (site-wide tokens): rest underline at 35% translucent primary, hover
  strengthens to full color, focus ring 2px solid primary offset 2 on EVERY link family,
  selection = 28% navy wash.
- **The Questions close (education)**: a short warm text close with the action inline, set
  as the full-width closing card — never a bare centered button.
- **TOC standard**: in-flow jump list for medium pages; gutter rail for long pages, quiet
  register (wayfinding furniture, never a content peer); collapses to an accordion on mobile.
- **Photography**: image identity = asset + crop (content decisions, never free variables);
  derived crops fix focal problems and push to BOTH local and production R2; original-site
  copy and image selections are the specification (typos and defects always fixed, recorded).

## Benchmark provenance

Pinned by the owner 2026-07-08 ("that's our new design benchmark"): the home page at commit
9b0f415, re-captured at a681023 after the nav-divider removal. Captures in this directory.
