# Cairn admin toolkit catalog — initiative kickoff (2026-07-20)

> Handoff note for a fresh session. This initiative was scoped at the end of the pass-B
> (asc-sidebar-build) session and deliberately handed to a clean context. Nothing here is
> locked; the brainstorm had not started when this was written (first screen captured, zero
> observations recorded).

## The goal (Geoff, 2026-07-19/20)

Walk through the ASC admin interface and catalog its awkwardness, toward a **better cairn
admin starting-component toolkit** — specifically so a **future coding assistant** has an easy
time building a *polished* admin interface when extending cairn. Geoff will walk through the
rough spots ("I drive, you react" mode: the assistant spins up the admin locally and captures
each screen; Geoff reacts to what's rough on each).

This reshuffles the ROADMAP: it comes before `events-redesign` (which stays queued, resume
prompt in docs/STATUS.md's pass-B entry).

## The deliverable is a cairn-cms concern (open question to settle early)

The toolkit lands in **cairn-cms**, but the catalog evidence is the **ASC admin** (the living
consumer). Settle in the brainstorm whether this runs as a cairn-cms initiative (spec/plan in
that repo, its `cairn-pass` skill) with ASC as evidence, or whether the CATALOG is authored
ASC-side first (a harvest-style doc) and handed to a cairn build pass. Do not pre-decide;
it's a real fork. Related: the standing DX-harvest mandate already files cairn deficiencies
found while building ASC — this initiative is the deliberate, focused version of that.

## What the scouting already established (don't re-derive)

- **cairn ships ~38 admin `.svelte` components** (`node_modules/@glw907/cairn-cms/dist/
  components/`), but almost all serve cairn's OWN concept-editing screens: MarkdownEditor,
  FieldInput, EntryPicker/MediaPicker/LinkPicker/IconPicker, RepeatableField,
  ObjectGroupField, ManageEditors, VocabularyAdmin, etc.
- **For a site's OWN admin screens, cairn offers essentially two general-purpose pieces:**
  `OfficeList` (the list/table recipe) and `CsrfField`, plus dialogs (`DeleteDialog`,
  `RenameDialog`, `ConfirmPage`). That's the whole shared vocabulary a consumer gets.
- **ASC hand-rolled the rest** across its 26-page `/admin/club/*` empire (members, money,
  committees, assets, events, classes, waitlist, email, announce, settings, documents/
  waivers). The shared helpers it had to invent live in `src/admin-club/lib/ui.ts`:
  `HEADER_CELL` (the uppercase micro-label every table header and eyebrow shares),
  `ChipStyle` + `OPS_VISIBILITY_CHIP`, and the civil-date / whole-dollar / cents / Anchorage-
  timestamp formatters. Member-domain chips live in `member-format.ts`. Everything else is
  raw Tailwind against the cairn-admin tokens, inline per screen.
- **The load-bearing gap (pass-B harvest finding 5):** admin routes load ONLY cairn's
  package-compiled `cairn-admin.css`, whose class inventory is whatever cairn's own screens
  happened to use. A consumer's admin markup can therefore only rely on classes cairn already
  compiled — ASC's daisyUI `stats` strip rendered as an unstyled stack for weeks because
  `.stats/.stat-value/.text-warning` were never in the sheet. Current workaround: Svelte
  scoped `<style>` on package tokens (`--cairn-card-border`, `--cairn-warning-ink`,
  `--color-muted`). This is THE central toolkit problem: there is no supported styling surface
  for site-authored admin screens.
- **Seed material:** `docs/2026-07-19-sidebar-build-harvest-findings.md` (7 cairn findings;
  #5 above, #6 shell collapsed-group spacing, #7 "New <plural>" button copy, plus the
  Help-foot idiom, the navFilter collapsed-rewrite, the dangling-href gap, icon-name
  testability). `docs/2026-07-19-roles-adoption-harvest-findings.md` (4 more from pass A).

## The walkthrough harness recipe (reusable)

Local admin, no Access gate, real D1 bindings:
1. `node e2e/fixtures/bootstrap-club-db.mjs && npm run build` (build is likely already current).
2. `npx wrangler dev --port 4179 --local` (background). **Check first** whether one is already
   up on 4179 — a pass-B session may have left one running (one-executor discipline).
3. Mint an Administrator session straight into the local AUTH_DB replica (the same recipe as
   `e2e/helpers/admin-session.ts`): INSERT an `editor` row (role `Administrator`) and a
   `session` row into `cairn-asc-auth` `--local`, then set cookies `cairn_session=<id>` and
   `cairn-admin-theme=cairn-admin` (or `cairn-admin-dark`) on a Playwright context at
   `localhost:4179`. Screenshot `fullPage`. Pass-B's throwaway driver was
   `scratchpad/walk.mjs` (session lookup + goto + shot); re-author it, it's ~25 lines.
4. Seed a few pending rows (asset_requests, committee_members pending, class_offers) if you
   want the attention badges to render during the walk.

## Walkthrough state at handoff

- Mode chosen: **"I drive, you react."**
- First screen captured: **Members** (`/admin/club/members`) — the filter cluster, chip
  vocabularies, standing-column status cell, and pagination are all bespoke. No observations
  recorded yet; Geoff had not reacted when the session was handed off.
- Screens worth hitting next: Money (ledger/cents), Classes + Class waitlist, Assets, a
  detail/edit page (e.g. a class or event `[id]`), a form-heavy screen (compose email,
  settings), and an empty state.

## Resume prompt

> Start the cairn admin toolkit catalog: read docs/2026-07-20-admin-toolkit-catalog-kickoff.md
> and docs/2026-07-19-sidebar-build-harvest-findings.md, then continue the brainstorm
> (superpowers:brainstorming) — bring the ASC admin up locally per the harness recipe and run
> the "I drive, you react" walkthrough with Geoff, starting at Members. Design conducting is
> Fable-priority.

Launch fresh from ~/Projects/aksailingclub-org.
