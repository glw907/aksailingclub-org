# The page review protocol (before anything reaches Geoff)

Adopted 2026-07-07 on Geoff's directive after the completion pass shipped a content-verified
but design-raw homepage. Evidence-grounded (the multi-agent UI-review research, same date):
Nielsen's evaluator curve says one reviewer finds ~35% of problems and three to five
independent ones find 75-85%, scoped single-lens prompts beat open-ended review, and
same-model majority voting amplifies shared blind spots, so aggregation uses a refuter, not
votes. This file is the operating checklist; the reasoning stays in the research report.

## Stage 0 — the deterministic net (free; failure blocks everything downstream)

`npm run probe:design` (scripts/design-probe.mjs): image rendered-vs-natural aspect
divergence, stray corner paint, horizontal overflow at 320/390/1440, UA-default-styled
elements inside designed bands, band-alternation WARN. Plus the existing e2e/visual
baselines and `npm run check`/`npm test`. Add axe-core to the probe when 2.1's admin
surfaces go under the gate.

## Stage 1 — capture

Full-page screenshots at 390 / 768 / 1440. Any page taller than ~4000px ALSO gets
viewport-height tiles (downsampling erases exactly the detail the lenses judge). Zoomed
crops on demand for any flagged region; the crop is the confirmation instrument.

## Stage 2 — the lens fan-out (fresh-context agents, one narrow lens each)

Four to six independent passes, absolute findings (never scores), coverage over precision:
1. Layout and spacing rhythm (tiles + crops).
2. Typography and hierarchy.
3. Accessibility judgment beyond the mechanical scan (focus order, alt quality, contrast
   in context).
4. The first-visit walkthrough, task-framed ("join the club", "find the class schedule").
5. Copy and content honesty.
6. Reference fidelity, only when a reference exists (side-by-side composites).

## Stage 3 — aggregation

Merge and dedupe (keep the highest severity per cluster). One fresh-context skeptic per
surviving finding, prompted to refute it against the screenshot evidence; a convincingly
refuted finding dies. No majority voting.

## Stage 4 — the conductor's own eyes, then Geoff

The main loop reads the final renders itself (the one-check rule), then Geoff receives the
surviving ranked list with evidencing crops, never the raw fan-out output.
