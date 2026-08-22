# asc-site history

> The per-pass ledger, newest first. Read on demand at a post-mortem or a "when did this
> change" question, never at session start. Each entry carries what landed, what the gate
> caught, and what a later pass would be wrong to rediscover from scratch. Entries older
> than the ones here live in `docs/status-archive.md` (the pre-2026-08-21 rolling status,
> moved whole).

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

