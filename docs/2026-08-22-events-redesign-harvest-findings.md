# Events redesign pass: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the assets-substrate
> precedent (`docs/2026-07-30-assets-substrate-harvest-findings.md`). Nothing writes into that
> repo from here. Paste these into the friction log when cairn is free, then delete this file.
> Each is a UI mechanic or an engine contract gap, never a site design choice.

1. **Site-wide smooth scrolling is a mechanic with a fixed correct shape.** Every cairn site
   with in-page anchors (article TOCs, the events index) wants the same three rules: `html {
   scroll-behavior: smooth }`, the `prefers-reduced-motion: reduce` override to `auto`, and
   `scroll-padding-top` equal to the sticky header's height so a target never lands under it.
   ASC carried the reduced-motion half for weeks with smooth never turned on. The chassis (or
   cairn's base sheet) should ship all three, with the header height as a token the site sets
   once. Evidence: `src/theme/site.css`, the 2026-08-22 review round.

2. **`checkHoverFocusParity` in the design probe (and cairn-audit's equivalent) skips a hover
   rule declared on a bare descendant tag** (`.ev-title a:hover`), because it keys the rule on
   the last compound's own classes, which are empty. The events band title was the one link
   family on the page without `:focus-visible`, and the gate could not see it. The mechanically
   detectable half belongs in `cairn-audit`: treat a bare-tag compound under a classed ancestor
   as a rule to check.

3. **A content entry whose body is no longer rendered still appears editable in `/admin`.**
   `src/content/pages/events.md` now renders from club records; only its `title` is read. The
   editor offers the body, a volunteer can edit it, and nothing changes on the site. cairn needs
   a way for a site to declare an entry's body as unused (a frontmatter flag the editor honors,
   or a per-slug editor mode), so the admin never presents a dead field. Engine contract gap.

4. **A copy-to-clipboard control with a timed label swap is a toolkit component.** The subscribe
   bar's "Copy feed address" needed a try/catch around `navigator.clipboard.writeText`, a
   `role="status"` region present at load, a static button label, a two-second reset with
   cleanup on destroy, and the copied value rendered beside the button as the failure fallback.
   Every site that offers a feed URL or a share link rebuilds this; it belongs in
   `admin-toolkit`'s public sibling or `/components`.

5. **A "today" for a Worker is Alaska's (the site's) calendar date, never UTC.** This repo has
   now solved it twice (`class-schedule.remote.ts`'s `anchorageTodayIso`, then the events page).
   cairn's sveltekit helpers should expose a `siteToday(timeZone)` so a consumer cannot read
   `new Date()` on a Worker and flip "past" eight hours early. Engine helper, not a site fix.

6. **Date-dependent visual baselines need a fixed-clock seam.** A page that renders "past"
   state breaks its CI baselines on a calendar day with no commit. The e2e server under test
   needs a documented env seam (`ASC_FIXED_TODAY`, read only from `platform.env`) and the
   engine's testing guide should name the pattern, since any cairn site with dated content
   hits it.

7. **`class_offers(class_id)` has no index** and the public page's registration-state CASE
   runs an `EXISTS` over it per class; the table is append-only across seasons. Not engine
   work, but a migration for this repo's backlog (`docs/2026-07-07-polish-backlog.md`).

8. **The events `ORIGIN` chassis constant is build-time and points at dev.** The stub's
   `og:image`, the canonical, and the feed URLs now read `platform.env.PUBLIC_ORIGIN` with the
   constant as fallback. The chassis should make `PUBLIC_ORIGIN` the only origin source, and the
   apex-cutover runbook should list the var flip.
