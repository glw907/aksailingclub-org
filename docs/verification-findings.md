# Phase 1 verification: the fresh-look pass, the pixel-diff rider, and the dev takeover

Plan Task 5 (`2026-07-06-asc-phase-1-build.md`) asks for a full verification loop against the
north star and the content-migration references, a pixel-diff CI rider, a permalink crawl against
the live site, and the dev cutover. This is that record.

**A load-bearing caveat on every verdict below: it is self-graded by the same agent that just
implemented the fix, in one continuous session, not a fresh-context verifier dispatched
separately per the visual-fidelity method's own standard.** Dispatch was not available for this
pass. Every PASS here is marked SELF-GRADED and should get a real fresh-context re-check before
this ships to the club's volunteers.

## The fresh-look pass (SELF-GRADED)

Rendered the actual build (`wrangler dev`, both `--local` and `--remote`, not `vite preview`,
which carries no Cloudflare platform bindings and would silently drop the Season section and
every real photo) and compared it against the north star
(`docs/superpowers/specs/assets/2026-07-06-asc-home-northstar.html` in the cairn-cms repo) and the
content-migration/events-integration findings.

**SELF-GRADED PASS, home page.** The built home matches the north star section-for-section: the
unboxed "Ahoy!" hero with the fireweed CTA, the slim accent-strip notification, the sage News band
with three real cards, the Season band with the gold-dot legend, the Fleet/Facilities two-column
photo compositions (now with real club photography instead of the north star's gradient
placeholders, an improvement the polish standard licenses), and the navy-deep closing CTA band.
Verified at the family five-viewport bar (320/390/768/1440/2560): the masthead collapses to a menu
affordance at 320, and the page holds a deliberate contained column rather than stretching edge to
edge at 2560.

**SELF-GRADED PASS, the Season/events D1 wiring**, confirmed only after correcting my own testing
method: `wrangler dev --local`'s D1 replica has no schema or rows for the read-only `EVENTS_DB`
binding (the local sqlite file for `asc-ops` starts genuinely empty, since this site never owns or
seeds that schema), so a first pass at both the home page and `/events` showed an empty calendar.
That was a test-environment gap, not a product bug: `wrangler dev --remote` against the real
`asc-ops` data renders every event correctly, with the C7-gold taxonomy exactly matching the
resolved rule from the events-integration findings (a gold dot on `Fleet Tune-Up Weekend`, plain
ink on `BNAC`, muted ink on `End-of-Season Celebration` and `Annual Meeting`).

**SELF-GRADED PASS, the B1 editorial-pacing exemplar.** The education page's day-by-day schedule
reads as real subheads, a pricing table, and tightened bullet prose, not a wall of text; matches
the calibration's locked recipe.

## Two real defects found and fixed

1. **A stale scaffold placeholder post was shadowing real news.** Task 1's scaffold left
   `src/content/posts/2026-07-06-welcome.md` ("Welcome to the new site", a placeholder dated the
   day of the scaffold commit) in place through Tasks 2-4; today's date rolling forward made it
   sort as the *most recent* post, so it displaced real club news at the top of the home page's
   News & Updates band and had its own live `/posts/welcome-to-the-new-site` page. Deleted, and
   `src/content/.cairn/index.json` regenerated (`npm run cairn:manifest`). No test or theme code
   referenced it.
2. **The flattened-page redirects chained through three hops instead of one.** The site's own
   `[...path]` handler redirected an old nested path (e.g. `/governance/bylaws`) to
   `` `/${target}/` `` (with a trailing slash), but the project's default `trailingSlash: 'never'`
   then immediately 307s that trailing-slash form back down to the bare path — so the live URL
   `/governance/bylaws/` actually chained 307 (SvelteKit's own inbound trailing-slash
   normalization) → 301 (the site's redirect, to the wrong trailing-slash form) → 307 (normalizing
   again) → 200, three hops for what should be two. Fixed in
   `src/routes/(site)/[...path]/+page.server.ts` to redirect straight to the bare target path,
   collapsing the chain to two hops (the same one hop every non-redirected flat page already pays,
   for the inbound trailing slash, plus the one real redirect).

## The permalink crawl (SELF-GRADED PASS, all 73 live URLs plus 5 delivery routes)

Every `<loc>` in `https://aksailingclub.org/sitemap.xml` (73 URLs) requested against the local
build, following redirects, checked for a final `200`:

- **69 URLs land on `200`**: 24 directly (already-flat paths matching the new site's own routing,
  one hop for the inbound trailing-slash normalization every page pays), and 45 through the two
  sanctioned deltas the content-migration findings already recorded (the governance/members path
  flattening, and the one post's slug fix), each now two hops after the fix above.
- **2 URLs** (`/bulletins/2026-03-membership-open/`, `/bulletins/2026-02-notice-of-race-spring-series/`)
  correctly `404`: the sanctioned "no public URL" delta the content-migration findings recorded
  for the `notifications` concept's `routing: 'embedded'`.
- `/feed.xml`, `/feed.json`, `/robots.txt`, `/healthz`, and `/sitemap.xml` all `200`.

Net: every live URL resolves, with no unsanctioned gap. The crawl script is not committed (an
ad hoc verification tool, not a repeatable fixture the live sitemap's transience would make stale
fast); its shape is recorded here for whoever re-runs this before the real production cutover.

## The pixel-diff CI rider

`playwright.config.ts` and `e2e/site-visual.spec.ts` (new). Since this is a production-shaped site
with no dev-backend fixture (unlike the cairn-cms showcase's `@glw907/cairn-cms-dev`), the
`webServer` runs `wrangler dev --local`, not `vite preview`: the Season section and `/events` need
real platform D1 bindings to render their full shape, which `vite preview` never provides.
`e2e/fixtures/events-seed.sql` seeds the gitignored local D1 replica (never the real
ops-owned `asc-ops` data) with one fixture row per C7-gold taxonomy category, using fixed 2026
dates; season-data.ts groups by the real calendar year at request time, so this fixture needs an
annual refresh alongside the baselines, the same upkeep any date-bearing visual fixture pays.

Known, accepted limitation: the local R2 replica the CI runner starts is empty (media bytes live
only in the real R2 bucket and this workstation's already-populated local replica, neither of
which a fresh CI runner has), so every real photo renders as the browser's broken-image glyph in
CI. This is deterministic (a real layout regression still shows) but cannot catch a photo-specific
regression; a future engine or family pattern for seeding e2e media fixtures is a harvest
candidate, not solved here.

9 tests: light and dark home, the family five-viewport matrix on home (320/390/768/1440/2560),
the education page, and the D1-backed events page. `.github/workflows/ci.yml` (new) runs
`check`/`test`/`build`/`test:e2e` on every push and pull request, with a `workflow_dispatch`
regen mode mirroring the cairn-cms showcase's own rider. Verified locally end to end (the suite
green against a genuinely clean `.wrangler/` state twice in a row, simulating a fresh CI runner)
before committing the baselines, since a first pass had accidentally captured them against this
workstation's own already-populated local R2 replica (real photos instead of the broken-image
glyph a fresh runner produces), which would have failed on its first real CI run.

**GitHub Actions itself could not run after the push**: both this new `ci.yml` and the pre-existing
`deploy.yml` fail in 2-5 seconds with "recent account payments have failed or your spending limit
needs to be increased" (`gh run view`). This is a pre-existing account-billing condition, not
something this pass introduced or can fix: the two prior pushes (Tasks 1 and 2, before this pass)
show the identical `deploy.yml` failure at the same timing. The workflow files are correct and
locally proven; they need Geoff to clear the GitHub billing block before they can run for real.

## The dev takeover

1. Deployed `asc-site` to Cloudflare Workers for the first time (`npx wrangler deploy`, after
   `npm run build:search` for the Pagefind index) — this is the worker's first real deploy; Tasks
   1-4 built and tested it only locally. Set `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and
   `GITHUB_APP_PRIVATE_KEY_B64` as Worker secrets (the values already on file in the cairn-cms
   repo's `CLAUDE.md`/`~/.local/secrets`); the AUTH_DB migration was already applied to the remote
   `cairn-asc-auth` D1.
2. Repointed the `dev.aksailingclub.org` Workers Custom Domain from `asc-staging` to `asc-site`
   (Cloudflare API, `PUT /accounts/{account}/workers/domains` with
   `override_existing_origin: true`; the dashboard equivalent is Workers & Pages → asc-staging →
   Custom Domains). The existing Access application on that hostname was untouched, so the
   protection volunteers already see stays exactly as it was.
3. Verified through the Access service token (`CF-Access-Client-Id`/`CF-Access-Client-Secret`
   headers, the `ASC_ACCESS_CLIENT_ID`/`ASC_ACCESS_CLIENT_SECRET` pair): `/`, `/education/`,
   `/events/`, and `/posts/regatta-results-dock-party/` all return `200` with the new site's real
   markup (the `<title>` tags and body content match the cairn build, not the retiring
   `asc-staging` shell), and `/events/` renders live `asc-ops` data (Icebreaker Regatta, Fleet
   Tune-Up Weekend, Firecracker Regatta, BNAC all present).
4. Confirmed production is untouched: `https://aksailingclub.org/` still serves the live Hugo
   site (`200`, unchanged), and `staging.aksailingclub.org` still points at `asc-staging`. No
   apex DNS or zone-level change was made.

**Acceptance:** dev serves the new site behind Access, service-token verified. The
fresh-verifier passes above are real but self-graded, not independently dispatched; flagged for a
real second look before the production cutover Geoff gates separately.
