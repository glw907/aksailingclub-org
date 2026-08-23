# asc-site history

> The per-pass ledger, newest first. Read on demand at a post-mortem or a "when did this
> change" question, never at session start. Each entry carries what landed, what the gate
> caught, and what a later pass would be wrong to rediscover from scratch. Entries older
> than the ones here live in `docs/status-archive.md` (the pre-2026-08-21 rolling status,
> moved whole).

## 2026-08-22/23: events-admin, the series ledger

Contract: `docs/2026-08-22-events-admin-design.md`. Plan: `docs/plans/2026-08-22-events-admin.md`.
Branch `events-admin`, PR #8. Harvest: `docs/2026-08-22-events-admin-harvest-findings.md` (nine
findings). Ceiling 2M; spend about 3.5M in agent tokens. Human interaction points: the
brainstorm's eight questions plus one mid-turn note, one companion-mockup pick, the design
approval, the spec approval with the workflow opt-in, and the ceiling call. Tokens ran far over
because the build was right on its contract and wrong on its mechanics: five reviewers and two
cold reads found what the plan's text-asserting tests could not (below).

**What landed.** `/admin/club/events` is a series ledger: one row per `event_series`, the two
prior seasons' dates read-only beside an inline-editable current-season date, dating publishes,
annual/once recurrence, "Start the next season" rolling annual series forward as undated
invisible copies with a counted confirmation, class rows read-only with a link to Classes, the
full form in place under the row (hero photo through a site-local picker over the committed
manifest), Hide/Show, Retire, and a confirm-gated Delete only for a never-published row. The
`[id]` route redirects; `new/` is gone. `asc-club` gained `event_series`, `events.series_id`
and `events.season` with `UNIQUE (season, slug)` (`0035`, a table recreate), then the
`(series_id, season)` unique index and a slug index (`0036`); both are live. The public queries
filter on `season`; `/events` renders unchanged; the ICS feed escapes its date and UID lines.

**What the gates caught.** The chain's diff-reviews accepted all five tasks, then the fan-out
found: the series and event created in two statements (an orphan poisoned the title for the
season); the roll-forward guard missing two of the three constraints the insert can hit; an
unbounded bind list in the ledger's year count (D1's 100-parameter cap); `save`/`create` dates
unvalidated and reaching the public page and the ICS feed; `update()` without `reset: false`
blanking the row form's CSRF field after every save; `?open=` seeded once so `create` landed
with the row closed; a 308 redirect to a DB-derived target; `--color-warning` used as ink at
1.6:1; the hero listbox dropping out of the tab order when the selection filtered out. The
first cold read failed on ten tells (a flexed name cell out of the row box, undated rows at
twice the height, a 640px row in a 356px wrapper at 390, UA bullets, Delete undemoted); the
second failed on eleven more, most bought by the 390 fit (an 84px date input under 82px of
text). Three fix rounds; the third read is in the ledger.

**What a later pass would be wrong to rediscover.** SQLite cannot drop a column-level UNIQUE or
add a NOT NULL FK to a populated table: both force the create-copy-drop-rename recreate, and
`0035`'s rollback expired the moment the first roll-forward created a second season's copy.
Slugs repeat across seasons now, so any slug lookup orders by `season DESC`. `fakeD1` asserts
SQL text and can never see a constraint or a batch's atomicity; every guard must live in the
statement (`NOT EXISTS`, `meta.changes`), never in a preceding SELECT. A bare `use:enhance` on
a form carrying `CsrfField` is a latent 403 (the email compose screen already said so). The
`*-narrow-hide` recipe drops columns but does not size a cell's own controls; the acceptance
is `scrollWidth === clientWidth` measured at 390 with a row expanded, and a native date input
needs about 112px at 12px or its value renders under the picker glyph. `ListToolbar`'s count
and trailing slots are sealed into three bands; a screen that wants count and action on one
line renders its own row. The media picker is not reachable through cairn's exports.

## 2026-08-22: events-redesign, the season page

Contract: `docs/2026-08-22-events-redesign-design.md`. Plan:
`docs/plans/2026-08-22-events-redesign.md`. Branch `events-redesign-build`, PR #6. Harvest:
`docs/2026-08-22-events-redesign-harvest-findings.md`. Ceiling 1.5M, raised to 2.2M at the
close; spend about 2.1M. Human interaction points: the brainstorm's six questions, three
probe verdicts, the plan approval, the ceiling raise, and two design asides (the title, smooth
scrolling). Tokens ran over the plan's estimate because the four domain reviews found more than
the plan anticipated (below).

**What landed.** `/events` is one long season page: the "Events" eyebrow over "The {year}
Season", a four-entry subscribe bar (Apple, Google, Outlook, a copy button with the feed URL
beside it), a month index, alternating 3:2 photo bands from live `asc-club` rows with past
events quieted in place and the page opening at the next upcoming one, and a "Meetings and
governance" coda table. `/events/[id]` is a link-preview stub (the event's own OG title,
photo, and description; noindex; meta refresh plus a client-side bounce to the anchor).
`events-data.ts` carries the band fields and the page facts; the spine components are gone.
Site-wide smooth scrolling with `scroll-padding-top` for the sticky header. The design probe
and the e2e spec cover the page; the e2e server runs on a fixed Alaska clock.

**What the gates caught.** The workflow's `diff-reviewer` caught the stub unfurling the
generic site description with no photo (the route's one purpose). The pass-end fan-out
caught more: an unguarded second D1 read that turned a blip into a 500; "past" computed on
the Worker's UTC clock (eight hours early in Alaska; this repo had already solved it in
`class-schedule.remote.ts`); the events query carrying no season bound, so a 2027 row would
render under "The 2026 Season"; the fireweed Register computed on the scroll target instead
of the first open class, so it almost never rendered; the on-load scroll moving the sequential
focus start past the skip link and the whole nav; the governance Where column dropped with
`display: none` below 48rem (reflow data loss); band titles self-linking; every band a
landmark; the star on the 2.26:1 gold rather than the 3:1 dot token; facts separators losing
their spaces to Svelte's block trimming. All fixed in two rounds.

**What a later pass should not rediscover.** Task 1's implementer overreached its file list
(deleted the spine and pre-built the stub) to keep the gate green; a data-shape task in a
data-then-UI split should name the UI it strands, or the plan should order the UI task
first with a shim. Probe 1 landed first pass because it was built inside the deployed page's
own shell with live rows (`feedback_probe_from_real_shell`); the build's defects were all in
the layers the probe does not exercise (D1 degradation, clocks, focus, landmarks), which is
where the reviewer fan-out earns its cost. Visual baselines are date-dependent on any page
that renders "past": `ASC_FIXED_TODAY` on the e2e server is the seam. A CI `update_snapshots`
run fails its push if anything lands on the branch after it checks out; dispatch it last.

## 2026-08-22: cairn 0.96.0 adoption (the floors release)

Sheet: `docs/2026-08-22-cairn-0.96-update-instructions.md`. Branch `cairn-0.96-adoption`. A
small update run straight through the gates, no plan.

**What landed.** The pin went `^0.95.0` to `^0.96.0` with the peer floors the release raises:
`@sveltejs/kit ^2.70`, `svelte ^5.56.10`, `wrangler ^4.125.0`, `engines.node >=24`. The
lockfile was regenerated from a clean install. Three 0.95 workarounds came out because the
engine fixed what they covered: the `$app/environment` wrangler alias and its shim module
(`src/jobs/wrangler-app-environment-shim.ts`; the barrel's import is now a guarded dynamic
one, proven by a dry-run deploy before the delete), `src/theme/preview-seo.ts` with its test
and `ArticleView`'s `preview` prop (`previewLoad` strips the permalink itself), and the 0.95
harvest doc (all five findings fixed upstream). `/preview/[token]` now passes `PreviewBanner`
a fixed-zone `formatExpiry` (long month plus the hour, Alaska time) so the expiry reads in the
site's vocabulary and cannot hydration-mismatch. Tidy moves to `claude-sonnet-5` by default.

**What the gates caught.** `svelte-check` found two errors the sheet did not predict: the
regenerated lockfile pulled `@types/hast` 3.0.5, which types `ariaLabelledBy` and
`ariaDescribedBy` as `string[]`; `buildTable` in `src/theme/markdown/components.ts` now
assigns the array form, and the existing table test proves the serialized attribute is
unchanged.

**What a later pass should not rediscover.** A transitive type bump rides every lockfile
regeneration; "the sheet said nothing else changes" covers cairn's contract, never
`node_modules`. `formatExpiry` is the PreviewBanner seam for a site's date vocabulary; the
chassis `date.ts` stays date-only on purpose, and an expiry wants the hour.

## 2026-08-21: cairn 0.95.0 adoption and chassis sync

Plan: `docs/plans/2026-08-21-cairn-0.95-adoption.md`. Branch `cairn-0.95-adoption`, PR #4.
Harvest: `docs/2026-08-21-cairn-0.95-adoption-harvest-findings.md`.

**What landed.** The pin went `^0.94.0` to `^0.95.0` with `@anthropic-ai/sdk` added as the
site's own dependency (the tidy action is in use and the SDK became an optional peer). The
share-a-draft preview feature is mounted: `migrations/asc-auth/0002_preview` applied to the live
`cairn-asc-auth`, the article page factored into `src/theme/components/ArticleView.svelte`, and
`/preview/[token]` rendering the same template with a preview-safe head. The chassis took the
showcase's `public-routes.ts`, `date.ts`, the prose-typography seam (smartypants on every
rendered page), the theme-flip cross-fade, and the DaisyUI component exclude list (the compiled
public sheet shrank by about a third). Tailwind 4.3.3, DaisyUI 5.7.20, and the in-range toolchain
batch (SvelteKit 2.70.3, Svelte 5.56.10, Vite 8.2.2, Playwright 1.62.1, wrangler 4.125.0, the
Fontsource 5.3 fonts) rode along; `wrangler types` now generates `worker-configuration.d.ts`; the
GitHub Actions pins moved to checkout v7, setup-node v6, upload-artifact v7.

**What the gates caught.** The `diff-reviewer` chain caught three things the implementers
reported green: the flip cross-fade left the page ground out of scope (fixed with a `site-shell`
wrapper class), excluding DaisyUI's `typography` family silently removed the inline-code padding
the prose surface renders against (kept), and the migration README omitted the live-application
record. The close workflow (four domain reviewers, two refuters per finding, 30 findings, 11
confirmed) added the error page's missing `site-shell`, the preview strip missing `jsonLd.url`,
a vacuous e2e assertion, the PreviewBanner palette keying off `prefers-color-scheme` instead of
`data-theme`, and the fact that dropping `@cloudflare/workers-types` turned every cairn-typed
binding into `any` because cairn's own `.d.ts` import it (the package stays, as a devDependency
only).

**What a later pass would be wrong to rediscover.** `wrangler deploy` bundles
`src/jobs/runner.ts` raw (the scheduled-handler append), so anything that file reaches must
resolve outside Vite; cairn 0.95's sveltekit barrel reaches `$app/environment`, hence the
`[alias]` shim in `wrangler.toml`. `wrangler types` embeds the built worker's module type when
`.svelte-kit/cloudflare/_worker.js` exists unless run with `--include-env=false`. A DaisyUI
exclude audit has to diff compiled selectors, not grep class names: a family can win a cascade
layer over a same-named site rule with no class ever written in markup. `prose.css` is
deliberately diverged from the showcase and re-syncing it is a design pass.

**Budgets.** Close workflow 4.85M subagent tokens (65 agents); task chains about 1.6M; human
interaction points: four (the workflow opt-in, the Tailwind/DaisyUI and "anything else" asks, the
workers-types call), none a correction.

## 2026-08-07: cairn 0.94.0 adoption

Merged to `main` (PR #3, merge `3e7d97d`) and deployed to dev.aksailingclub.org on the `^0.94.0`
caret range. The record as it stood in STATUS:

The immediate next action is Geoff's: the open before/afters on his queue below, or the announce
`publishedAt` rider. The apex cutover remains its own deliberate DNS change, never bundled.



- **The caret flip.** `0.94.0` stable published (npm `latest`); the pin went `0.94.0-rc.2` →
  `^0.94.0` (`8076b00`), lockfile regenerated, clean `npm ci`. The installed copy verified:
  version `0.94.0`, exports reading `types > worker > browser > default` on both `./auth-crypto`
  and `./cloudflare`, so the rc.1 Workers fix is in stable. Only the version-cut commit separates
  rc.2 from stable engine-side.
- **Gates, all green.** `check` 0/0 (1013 files), 2057 tests across 152 files, `build` clean.
  Local Playwright: all 75 specs served by a started Worker; 19 functional specs passed and the
  56 failures were all `toHaveScreenshot` pixel diffs (every failure dir carries a diff.png,
  none is a startup or request error) — the documented workstation-versus-runner delta. The
  canonical pixel gate ran on CI: PR #3's `ci` check passed in 6m47s, full visual suite included.
- **The two re-runs the rc.2 entry owed.** Rendered `cairn-audit` on the `0.94.0` install:
  12 pages measured authenticated (freshly minted local session, real admin shell rendered),
  **0 errors**, 733 advisories, 353 suppressed — the advisory mass is the known ruling-exempt
  hairline state. `cairn-doctor`: 14 PASS, the same two FAILs (Always Use HTTPS / Zone HSTS
  reads returning 403, the API token lacking Zone Settings Read, not zone findings);
  `http://` → `https://` 301 re-confirmed directly on both hosts.
- **Deployed and smoked.** Merge to `main` ran `deploy.yml` (run `31215130848`, green) to the
  `asc-site` Worker. Live smoke via the Access service token: `/`, `/events`, `/education`,
  `/join/apply`, `/admin/login`, `/events/calendar.ics` all 200 with substance — the Season band
  renders from D1, the `.ics` feed carries 17 VEVENTs, Turnstile loads on join, the sign-in card
  renders. That exercises both cairn subpaths server-side on the deployed Worker.
- **Static audit: baseline unchanged, two adjacent findings filed.** 65 `no-uncompiled-class`
  errors, exactly the recorded pre-existing baseline. Two further errors (`reduced-motion` and
  `focus-parity` on `src/routes/admin/club/+page.svelte`) are pre-existing site-side, not this
  migration's doing (rules shipped since `0.91.0`, file unchanged on the branch); filed to
  `docs/2026-07-07-polish-backlog.md` beside the 65.
- **Riders surviving the initiative**, all recorded: announce-list recency via `publishedAt`
  (picker still sorts by frontmatter `date`, `announce/+page.server.ts:26`; the seam is on this
  pin, nothing consumes it); baseline coverage for the stacked register proves the flip only on
  `/admin/club/documents`, the one field-carrying admin surface with a baseline (a coverage pass
  is Geoff's call); the `asset_requests` uniqueness race (needs a unique index, so a migration);
  the polish-backlog items above. The full adoption-pass record (seams consumed, alignment
  mechanic, approval trail) is the top entry in `docs/status-archive.md`; the engine-side record
  is cairn's migration report (`docs/internal/feedback/2026-08-05-aksailingclub-org-migration.md`).

