# asc-site status

**THE FULL-SITE WALKTHROUGH LANDED (2026-07-06, three verifier chunks, every page):
docs/ORIGINAL-MANIFEST.md is the completion pass's checklist — 7 go-live blockers
(events stub, dead forms, notifications unwired, the WRONG LOGO, home news images,
bulletins missing, news wayfinding), 5 must-fixes, 4 sanction questions for Geoff.
The guides/informational pages verified strong; the design direction ratified; the
fidelity layer is the work. NOTHING ships to Geoff's eyes until every manifest line
is checked. Next action: the completion pass against the manifest.**


Rolling status for the Alaska Sailing Club's cairn rebuild. Canonical plan:
`~/Projects/cairn-cms/docs/superpowers/plans/2026-07-06-asc-phase-1-build.md`. The design contract
this build executes has a durable local copy in this repo: `docs/2026-07-06-asc-phase-1-design.md`
and the blessed home-page example, `docs/2026-07-06-asc-home-northstar.html`. Read this file first
for where the work stands before picking up the next task.

## Where things stand (2026-07-06)

**Phase 1 (build Tasks 1-5) is code-complete and deployed to dev.** All five plan tasks have
landed:

1. Scaffold on `@glw907/cairn-cms` ^0.81.0 (posts/pages/notifications concepts, D1 auth, EMAIL,
   MEDIA_BUCKET, the GitHub App backend).
2. Content migration from the Hugo site (`~/Projects/aksailingclub-org`): every public page and
   phase-1 guide, the news archive, the component-grammar findings for the shortcode gaps.
   `docs/content-migration-findings.md`.
3. The club-grounds theme built onto the north star (A1 quieting, B1 editorial pacing, C7-gold
   season taxonomy), real photography in the media library.
4. Events wired to the club's live `asc-ops` D1 (read-only), schema and taxonomy verified against
   production. `docs/events-integration-findings.md`.
5. Verification, the pixel-diff CI rider, the permalink crawl, and the dev takeover.
   `docs/verification-findings.md`.

**dev.aksailingclub.org now serves this build**, behind the same Access application volunteers
already used for the prior migration shell. The Workers Custom Domain was repointed from
`asc-staging` to the `asc-site` worker (deployed for the first time in Task 5); `asc-staging`
itself is untouched, still bound at `staging.aksailingclub.org`. **Production
(`aksailingclub.org`, the live Hugo site) is untouched**; the apex DNS cutover is a deliberate,
separate act gated on Geoff's before/after review, per the design spec.

## The completion pass (2026-07-06 full-site walkthrough against the live original)

`docs/ORIGINAL-MANIFEST.md` is the completion pass's checklist against `aksailingclub.org`
itself, worked item by item. **Item 1 / the events deep-look is done:** the events page's
D1 stub is now the full detailed listing (month sections, Off-Season, Meetings &
Governance, type and registration-status badges, descriptions, register links, per-event
photography, a real `/events/calendar.ics` feed), built against `docs/events-manifest.md`'s
exhaustive re-enumeration of the live page. `$theme/events-data.ts`, `$theme/ics.ts`,
`EventsListing.svelte`, `EventCard.svelte`; unit-tested; the site-visual e2e baseline
regenerated. The rest of the manifest's items (the dead forms, the wrong logo, the
notifications wire-up, the bulletins concept, the other go-live blockers and must-fixes)
remain open.

## The punch list (found on the dev walkthrough, not yet fixed)

- **News-card cover images render as placeholders.** The content-migration pass (Task 2, see
  `docs/content-migration-findings.md`) uploaded 29 of 31 posts' real photography into the media
  library and pushed the bytes to both the local and remote `asc-site-media` R2 bucket, and the
  `posts` concept declares an `image` field. On dev, the News & Updates cards still show the
  broken-image placeholder instead of those photos. Not yet root-caused; the fix pass should check
  the `image` field's shape against what the card component actually reads, and whether the
  deployed Worker's `/media` route resolves the content hash correctly, before assuming the R2
  bytes themselves are missing.

## What is NOT done yet

- **The punch-list fix above**, first.
- **The apex cutover.** `aksailingclub.org` still serves the old Hugo/GCE site. This is Geoff's
  call, not an engineering task: the design spec gates it on his explicit go after a live review
  of dev, and the GCE origin retires only after a soak period following that cutover.
- **A real fresh-context verification pass.** Task 5's own verification loop ran self-graded, in
  the same session as the fixes it made (dispatch was not available); every PASS in
  `docs/verification-findings.md` is flagged as such and wants an independent re-check before the
  apex cutover.
- **Phase 2: incremental ops absorption.** The events admin, the members directory, `my-account`,
  and auth beyond magic-link editors all stay on the existing ops stack (`ops.aksailingclub.org`)
  for now, migrating one small pass at a time per the design spec's coexistence strategy. Each
  such pass reconciles with the prior migration's D1 work (`~/Projects/aksailingclub-sveltekit`,
  evidence only, not a foundation) in its own scope.
- **Phase 3: the member handbook** on Topo, once Topo exists.
- **The ASC harvest review.** Queued in cairn-cms's `docs/internal/pre-beta-harvest.md`; runs once
  this build's lessons (the NOTIFICATIONS concept, the D1-beside-cairn read pattern, the A1/B1/C7
  recipes, the fixture-media gap the pixel-diff rider surfaced) are ready to triage into the
  chassis and engine.
- **GitHub Actions cannot run yet.** Both `ci.yml` and `deploy.yml` fail immediately on push
  ("recent account payments have failed or your spending limit needs to be increased"), a
  pre-existing account-billing block, not something this repo's workflows caused (Tasks 1 and 2's
  earlier pushes hit the identical failure). The CI rider is proven locally against a clean
  `.wrangler/` state (`docs/verification-findings.md`); it needs Geoff to clear GitHub's billing
  block before it runs for real.

## Next action

**Geoff's dev walkthrough first** (a live review of `dev.aksailingclub.org`, the trigger for
everything below it): the news-card image punch list above is what it has surfaced so far, and
the walkthrough may surface more. **Then the punch-list fix pass** (the image bug at minimum, plus
anything else the walkthrough finds). **Then the production apex cutover, on Geoff's explicit
go**, per the design spec's before/after-approval gate — never bundled with a routine push to
`main`. Clearing the GitHub Actions billing block is a standing prerequisite for either CI or the
deploy workflow to run automatically again, independent of the above.
