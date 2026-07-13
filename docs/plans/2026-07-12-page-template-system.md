# Page Template System Implementation Plan

> **For agentic workers:** execute task-by-task via the repo's implementer agent; the
> orchestrator reviews each diff and confirms the gate between tasks. Tasks are serial
> T1→T6; T7's verification fans out. Spec: `docs/2026-07-12-page-template-system.md`.

**Goal:** Land the shared type spine and the home/primary/secondary tier system with the
adaptive primary hero, selected by nav rank.

**Architecture:** One pinned scale fix in the theme tokens plus a weight fix in the chassis
prose layer form the spine. A new tier-selector module derives the primary set from
`menus.primary`. The `[...path]` template generalizes its education-only gate to the tier
selector, with hero data moving from a code map into pages frontmatter.

**Tech Stack:** SvelteKit 2 / Svelte 5, cairn-cms 0.84.1, vitest, Playwright, the repo's
design-probe script.

## Global Constraints

- Bands are home-only (Geoff 2026-07-07, codified in `src/theme/site.css`); the primary
  tier never adds bands.
- Education's round-4 look is ratified: no heading size, spacing, or composition change
  beyond the two pinned spine deltas (lede size, h2 weight).
- Home is structurally untouched; it re-verifies against
  `docs/design-benchmark/home-benchmark-{390,1440}.png` before anything deploys.
- The gold active-nav underline is sanctioned; do not touch or re-flag.
- The e2e pipeline-order regression test (`e2e/site-visual.spec.ts:69-84`) stays green
  through every task.
- Gate per task: `npm run check` clean, `npm test` exit 0. Full `npm run build` at T6/T7.
- GitHub Actions is billing-blocked: all verification is local. Visual e2e baselines are
  CI-canonical, so do not regenerate PNG baselines locally; rely on the DOM assertions
  plus T7's capture-and-verify.
- This repo is public: no member PII in any file.
- Commit per task on the current branch (`design/education-round-4`); no pushes until the
  pass-end boundary.

---

### Task 1: The spine — scale and weight

**Files:**
- Modify: `src/theme/theme.css:155` (the `--text-step-1` definition)
- Modify: `src/chassis/prose.css:113-121` (the `.prose h2` rule)

**Outcome:** The type ladder is strictly separated and h2 reads a clear step above h3.

- `--text-step-1` becomes exactly `clamp(1.19rem, 1.17rem + 0.1vw, 1.25rem)`. This drops
  the lede family below h3: the ladder is then step-0 (max 1.125) < step-1 (1.19–1.25) <
  step-2 (1.27–1.33) < step-3, with no adjacent clamps overlapping at any viewport.
  `--text-step-2` and every other step are untouched (h3 and h2 sizes stay ratified).
- `.prose h2` `font-weight` goes 600 → 700. `.prose h3` stays 600. This is the arc's
  candidate-A weight move: the h2→h3 step now differs in size *and* weight.
- Update the scale's comment block (`theme.css:129-154`) to describe the corrected ladder
  and remove any text describing step-1==step-2; the comment must state that step-1 is
  the lede size sitting strictly between body and h3.

**Acceptance:** `npm run check` clean, `npm test` exit 0, both e2e education DOM tests
pass. Grep proof: no other rule change in the diff beyond the two files.

### Task 2: The tier selector

**Files:**
- Create: `src/theme/page-tiers.ts`
- Test: `src/tests/page-tiers.test.ts`

**Interfaces:**
- Consumes: `siteConfig` from `src/theme/cairn.config.ts` and `extractMenu` from
  `@glw907/cairn-cms` (the pattern `SiteHeader.svelte:41` already uses).
- Produces: `isPrimaryPage(slug: string): boolean` — true exactly for the slugs of
  top-level `menus.primary` destinations, excluding home (`/`) and excluding children.
  With today's nav that set is `education`, `racing`, `events`, `join`, `members`,
  `contact`.

**Outcome:** One source of truth for the tier. Adding a nav destination promotes its page
with no code edit. Slug normalization matches the `[...path]` route's slug shape
(`data.entry.slug`, no surrounding slashes).

**Acceptance:** Unit tests cover: each of the six current primary slugs; home excluded;
a Members child (`new-member-guide`) excluded; an arbitrary interior slug excluded.
Gate clean.

### Task 3: Hero data moves to frontmatter

**Files:**
- Modify: `src/theme/cairn.config.ts:105-120` (pages concept fields)
- Modify: `src/content/pages/education.md` (frontmatter)
- Modify: `src/routes/(site)/[...path]/+page.svelte` (the `LONG_FORM_HERO` map,
  lines 97-102, and its consumers at 159 and 449-476)

**Outcome:** The pages concept gains two optional fields: `promise` (a text field,
label "Promise line") and `facts` (label "Fact strip"; use the leanest cairn field that
yields a string list in frontmatter — the multiselect-creatable shape posts' tags use,
without `taxonomy`, or a comma-separated text field parsed in the template; the
constraint is the template receives `string[]`). Education's promise
("Come learn to sail with us.") and its four facts move verbatim into
`src/content/pages/education.md` frontmatter. The template reads
`data.entry.frontmatter.promise` / `.facts` and the `LONG_FORM_HERO` map is deleted.
The hero photo keeps using the existing `image` field via `data.heroImage`.

**Acceptance:** Education renders the identical promise hero (same h1 text, same four
facts, same photo) from frontmatter alone; grep proves `LONG_FORM_HERO` is gone; both
e2e education tests pass; gate clean. The admin edit screen shows the new fields
(`npm run dev`, spot-check `/admin` renders without error — the schema change is
consumer config, no engine change).

### Task 4: Template generalization and the adaptive hero

**Files:**
- Modify: `src/routes/(site)/[...path]/+page.svelte` (the `LONG_FORM_PAGE_SLUGS` set at
  line 88 and its nine consumption sites: 154, 159, 177, 209, 272, 381, 395, 440, 500;
  the hero branches at 449-499)

**Outcome:** The education-only gate becomes the tier gate, and the primary hero adapts:

- `LONG_FORM_PAGE_SLUGS` is deleted; every consumption site keys off
  `isPrimaryPage(data.entry.slug)` (pages concept only — posts and bulletins keep their
  existing paths untouched).
- Hero selection: **full promise hero** when primary AND `frontmatter.promise` AND
  `data.heroImage` (education's existing 449-476 branch, now fed by frontmatter);
  **light variant** when primary AND promise but no photo — eyebrow plus the italic
  promise line as h1, plus the fact strip only if facts exist, no photo slot rendered;
  **plain title hero** (the existing `isPageHero`/fallback branches) for secondary pages
  and for any primary page without a promise, so nothing breaks before Task 5's content
  lands.
- The gold waypoint rule, the primary tier's marker: a short star-gold rule rendered
  above each `.prose h2` on primary pages only, visually kin to
  `EventsListing.svelte`'s `.spine-waypoint-marker` (same gold token family:
  theme.css's "marks and waypoints only" story). Geometry tuned against that existing
  marker; applied via a tier class on the article wrapper, not per-heading markup.
- Page-specific composition data (the education `GROUP_HEADINGS`/wrap machinery) stays
  keyed by slug exactly as today — it must NOT fire on other primary pages.

**Acceptance:** Education renders identically to its Task 3 state except the gold rule
above its h2s (it is a primary page — the rule is new and expected). A secondary page
(e.g. `/bylaws/` or any interior page) renders the plain hero with no marker. Both e2e
education tests pass; gate clean. Grep proves `LONG_FORM_PAGE_SLUGS` is gone.

### Task 5: Primary-page promise lines

**Files:**
- Modify: `src/content/pages/racing.md`, `events.md`, `join.md`, `members.md`,
  `contact.md` (frontmatter only; confirm exact filenames against
  `src/content/pages/` — the slug set from Task 2 is authoritative)

**Outcome:** Each remaining primary page carries a one-line `promise` drafted in the
site's content register (the club's own voice — read two or three existing page ledes
first and match them; short, warm, concrete, no marketing words). Facts and photos only
where the page genuinely has them (do not invent facts; it is fine for all five to ship
promise-only and render the light variant).

**Acceptance:** All six primary pages render primary chrome in a local dev pass; no
empty photo slots, no fact strips without facts; the content reads in-register
(orchestrator reviews the five lines directly — they are user-facing copy). Gate clean.

### Task 6: Build proof and doc/status updates

**Files:**
- Modify: `docs/STATUS.md` (the pass banked, next action updated)
- Modify: `docs/design-benchmark/decisions.md` (distill the round-4 arc log's open
  hierarchy item as settled by this pass; per the arc-log convention, remove
  `docs/design-benchmark/education-round-4-arc.md` after distilling)
- Modify: `docs/2026-07-12-page-template-system.md` (status line → implemented)

**Outcome:** `npm run build` succeeds; the settle ritual's paper trail is complete: the
arc log distilled and removed, decisions.md carrying the scale fix, the tier system, and
the pinned constants; STATUS points at the verification results and the deploy gate as
next action.

**Acceptance:** Build exit 0; full gate clean; the arc-log file is gone and its open
item appears as a decision entry.

### Task 7: Visual verification (fan-out)

**Not an implementer task — the orchestrator runs this directly with verifier agents.**

- Capture, via the design-probe script against a local preview (media seeded with
  `npm run media:seed`): home, education, racing, contact, and one deep secondary page,
  at 390 and 1440 (spot-check 320 and 2560 on education and home for the five-viewport
  standard).
- Fresh-context visual-verifier passes, each with one narrow charge: (a) home vs the
  pinned benchmark PNGs — verdict COSMETIC/STRUCTURAL per device; (b) education vs its
  pre-pass render (capture from the dev deployment or git-stash preview BEFORE T1 runs —
  the orchestrator banks these reference captures before dispatching Task 1); (c) the
  hierarchy read on education and one secondary page: lede vs h3 vs h2 distinct at both
  widths; (d) the light-variant primary pages: composed, no orphan chrome.
- The orchestrator's own render read of every capture (the one-check rule), then
  Geoff's before/after at the deploy gate — nothing deploys from this pass without it.

**Acceptance:** No STRUCTURAL verdict on home or education; hierarchy verdict affirms
three distinct levels; my own read concurs; the before/after package is assembled for
Geoff.

---

## Self-review notes

- Spec coverage: spine (T1), selector (T2), frontmatter hero (T3), adaptive hero + gold
  marker + tier application (T4), primary content (T5), acceptance criteria 1-6 land in
  T1/T4/T7 (hierarchy, education, home, selector, posts/bulletins-on-spine via T7's
  reads since their templates consume the same tokens, secondary sweep in T7).
- Posts/bulletins composition is explicitly out of scope (spec ruling); they inherit the
  spine with no file changes, verified by T7's reads only.
- Type consistency: `isPrimaryPage(slug: string): boolean` is the one cross-task
  interface; T4 consumes exactly what T2 produces.
