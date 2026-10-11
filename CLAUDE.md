# asc-site

The Alaska Sailing Club's public site: guides, news, pages, and the season calendar, built on
`@glw907/cairn-cms` (see `package.json` for the current range) using the cairn chassis
structure. It replaces the club's prior Hugo/Blowfish site (now at
`~/Projects/aksailingclub-legacy`; see "The repo family" below) and its abandoned SvelteKit
rebuild (`~/Projects/aksailingclub-sveltekit`, phase-2 evidence only).

@docs/STATUS.md

## What this is

Three cairn concepts: **posts** (news, results, recaps, a curated tag vocabulary), **pages**
(stable content), and **notifications** (the home banner). Everything a member reads is
markdown edited through cairn's `/admin`; the season calendar is D1 data, not content.

`src/chassis/` carries the genre-free plumbing (content delivery, the token system, prose and
composition CSS, the runtime composition point) verbatim or near-verbatim from cairn-cms's own
showcase; `src/theme/` carries everything specific to this club: the club-grounds palette, the
Fleet/Facilities photo compositions, the Season band, the icon set, and the directive registry
(including the `membershipworks` embed directive). Read `src/chassis/README.md` before touching
anything under `src/chassis/`: a theme file reaches chassis only through its exported seams
(`$chassis` in `.ts`/`.svelte`, a relative `@import` in `.css`), never a direct reach past them.

## The design contract

This site executes a locked design spec. Durable local copies live in this repo:

- **`docs/2026-07-06-asc-phase-1-design.md`**: the phase-1 spec — the four named issues (complex
  CSS, busy pages, uneven responsiveness, heavy card use), the locked density recipes (A1 quieted
  bands, B1 editorial pacing, C7 gold-star season taxonomy), the coexistence strategy with the
  existing ops stack, and the phase boundaries.
- **`docs/2026-07-06-asc-home-northstar.html`**: the complete, Geoff-blessed home page example.
  Every locked decision in one rendered artifact; a change to the home page reads against this
  file, not against memory of what it says.

Both are frozen; a future redesign supersedes them with a new spec, never an in-place edit.

### The club-grounds color story

Roles are the contract; exact values may tune, but a color never crosses roles:

- **Flag navy** (`~#1C4670`, deep `#12294A`): links, structure, identity. The only link color.
- **Star gold** (`~#E3A008`): marks and waypoints only, never body text — the active-nav
  underline, the notification edge, and the star marking a class or clinic in the Season list
  (education is the mission; the mark encodes it).
- **Fireweed** (`~#B23A77`): the single pop color — primary CTAs, at most twice per page.
- **Building sage** (tints `~#F2F5F1`/`~#E5EBE3`): band and surface neutrals.
- **Harbor ink** (`~#16222E`) and its muted step: text.
- The semantic palette (caution/success/error) stays a separate reserved vocabulary, so the
  education category never collides with a warning color.

### The resolved-craft bar (Geoff, 2026-07-15)

Every page must feel _designed_, never assembled, across the whole site and all design work.
The rubric is the invisible-craft
catalogue in `docs/2026-07-15-asc-invisible-polish-brief.md` (spacing rhythm,
register boundaries, optical alignment, weight-built hierarchy, tinted neutrals, layered depth,
motion discipline, state coverage, micro-typography): a new surface gets the catalogue applied
at build time, not deferred to a later polish round. `scripts/design-probe.mjs` carries the
machine-detectable checks as standing gates; a fresh-context whole-page coherence read (390 and
1440, "would an expert see assembly tells?") closes any substantial design pass. Durable
verdicts live in `docs/design-benchmark/ledger.md` — a verdict stands unless the graded code
changed or Geoff reopens it.

### One-check and visual-fidelity, for any design change

**Nothing deploys to production without a full-page render read by a human's own eyes**, and
because this is a member-facing site, **Geoff's explicit before/after approval gates every
visual change before it reaches the apex**. Mechanical gates measure correctness, never
resemblance. Any non-trivial visual change follows the `visual-fidelity` skill (reference first,
screenshot-compare loop, fresh-eyes verification); the family five-viewport bar (320, 390, 768,
1440, 2560) is the responsiveness bar, and `e2e/site-visual.spec.ts` is its CI-enforced form.

A change that alters rendering regenerates its baselines in the same change. **Baselines are
CI-canonical and regenerate only via `ci.yml`'s `workflow_dispatch` `update_snapshots` mode**
(`gh workflow run ci.yml -f update_snapshots=true`), which commits the PNGs back to the branch;
never a local `--update-snapshots` run. A workstation-rendered baseline silently breaks CI on
the next run (it happened 2026-07-15). Dispatch it last, since a push after its checkout fails
it (`docs/engineering-notes.md`).

## The asc-club schema is fully evolvable — never write around it (Geoff, 2026-07-13)

`asc-club` is this application's own database, and its schema serves the application, not the
other way around. When a feature or a data fix wants a different shape, change the schema with a
real migration (scratch-proven, forward/rollback/verify, then applied to the live database) —
never absorb a schema shortcoming into application code. Writing around bad database design in
code is the named anti-pattern; optimal database design at all times is the standard. This
freedom is asc-club's alone: cairn's engine database (`AUTH_DB`, cairn-cms's own migrations)
belongs to the cairn package, and `EVENTS_DB` stays read-only per the rule below.

## Member-data imports (MembershipWorks)

Source exports are committed to this repo age-encrypted under `data/membershipworks/`
(`*.csv.age`, encrypted to the ASC age key; decrypt with `age -d -i $AGE_KEY_FILE`, the key at
`~/.config/age/asc-key.txt`, never committed). Plaintext copies live machine-local only at
`~/.local/asc-data/`; never commit a plaintext export. Import scripts live in `scripts/import/`
(dry-run plan, audit trail, verify.sql, rollback). Member data
regularizes on every write path, import and live alike: emails lowercase, phones E.164 (+1
default), names conservatively recased.

## The D1 EVENTS_DB rule — read-only, never migrate it here

`EVENTS_DB` (bound in `wrangler.toml`, database `asc-ops`) is the club's own ops stack's
database, not this site's. This site only ever `SELECT`s from it (`src/theme/season-data.ts`
carries the header comment explaining why). **Never add a migration for it in this repo.** A
schema change to `asc-ops` belongs to the phase-2 ops absorption, in the ops-owning repo, with
real migrations and verification against the live 12+ event rows; this repo's job is to read
whatever shape that data currently has. `AUTH_DB` (`cairn-asc-auth`), by contrast, is this site's
own database (cairn's magic-link auth store) and takes migrations normally.

## Access and the dev hostname

**dev.aksailingclub.org** serves this build (the `asc-site` Worker), behind the same Cloudflare
Access application volunteers already used for the prior migration shell (repointed from
`asc-staging` to `asc-site` at the dev takeover; `asc-staging` itself is untouched, still
bound at `staging.aksailingclub.org`). Non-interactive verification (curl, Playwright) uses the
`claude-capture-asc-ref` Access service token
(`ASC_ACCESS_CLIENT_ID`/`ASC_ACCESS_CLIENT_SECRET` in `~/.local/secrets`) with the
`CF-Access-Client-Id`/`CF-Access-Client-Secret` headers. **Production
(`aksailingclub.org`) is not behind Access and is not this Worker yet** — see the deploy story
below. Full Access-app inventory: `~/.claude/docs/cloudflare-estate-inventory.md`.

## Deploy story

- **Push to `main`** runs `.github/workflows/deploy.yml`, which deploys straight to the
  `asc-site` Worker. **That Worker is bound to `dev.aksailingclub.org`, not the production apex.**
  A push to `main` is a dev deploy, gated on Geoff's review only by the one-check rule above.
- **Merging and deploying to dev is default behavior until the apex cutover (Geoff,
  2026-08-22).** When a pass's PR is green on its final commit (baselines regenerated through
  CI), merge it and let `deploy.yml` run without asking; report the merge and the deploy in the
  recap. A PR run on a bot-authored baseline commit sits at `action_required` until approved
  (`gh api -X POST repos/glw907/aksailingclub-org/actions/runs/<id>/approve`). This standing
  authorization ends at the `mw-cutover` pass; the production path stays Geoff's explicit go.
- **`.github/workflows/ci.yml`** is the pull-request gate: `check`, `test`, `build`, and the
  pixel-diff `test:e2e` suite, with a `workflow_dispatch` mode to regenerate visual baselines.
- **The production apex cutover (`aksailingclub.org` itself) is a separate, deliberate DNS
  change** repointing the zone apex from the retiring Hugo/GCE origin to this Worker. It is
  **never automatic and never bundled with a routine push to `main`**; it happens only on
  Geoff's explicit go, after his own before/after review of dev. The GCE origin retires after a
  soak period.

## Build & Dev

```bash
npm install
npm run dev                                          # dev server at http://localhost:5173
npm run build                                        # build to .svelte-kit/cloudflare/
npm run build:search                                 # build + Pagefind index
npx wrangler dev --remote                            # real D1/R2 bindings
npm run check                                        # svelte-check, 0 errors/0 warnings
npm run types                                        # worker-configuration.d.ts, after any wrangler.toml change
npm test                                             # vitest
npm run test:e2e                                     # Playwright, the pixel-diff visual suite
```

`npm run cairn:manifest` regenerates `src/content/.cairn/index.json` after any content edit made
outside the admin. Type generation (`npm run types` must keep `--include-env=false`), why
`@cloudflare/workers-types` stays a devDependency, and the new-post frontmatter template live in
`docs/engineering-notes.md`.

## Worker secrets and engine-level UI mechanics

`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY_B64` (cairn's GitHub
App, committer `cairn-cms[bot]`) are Worker secrets on `asc-site`; `npx wrangler secret list`
checks them. Where values live: the workstation age store and `~/.local/secrets`
(`~/.claude/docs/bluefin-admin.md`, "Secrets: installing, receiving, and 1Password").

A UI mechanic belongs to cairn, a design choice to this site, and filing the mechanics is default
behavior at the end of any pass carrying UI work (the `site-pass` and `cairn-pass` skills carry
the rule). Findings go in the pass's own `docs/YYYY-MM-DD-<pass>-harvest-findings.md`; the
mechanically detectable half belongs in `cairn-audit`, not `scripts/design-probe.mjs`.
`docs/2026-07-30-assets-substrate-harvest-findings.md` is the worked example.

## Documentation

- `docs/STATUS.md`: current state, read first.
- `docs/design-benchmark/decisions.md`: every settled design question; never re-litigate a
  logged decision unless Geoff reopens it. A live round keeps a one-line-per-probe arc log beside it.
- `docs/image-standard.md`: the per-template image standard (hero crops, figure insets).
  BINDING for any image or figure work; consult it, never re-derive.
- `docs/2026-07-07-polish-backlog.md`: the polish backlog (carry-forwards live in STATUS).
- `docs/content-migration-findings.md`, `docs/events-integration-findings.md`,
  `docs/verification-findings.md`: the Hugo migration deltas, the `EVENTS_DB` schema and taxonomy
  rules, and the phase-1 verification and dev takeover record.
- `docs/HISTORY.md` is frozen; git history and PR bodies are the record.
- `docs/engineering-notes.md`: build, CI, CSS, and SQL gotchas, on demand.
- `docs/content-guide.md`: **does not exist yet** (verified 2026-07-16 across this repo,
  cairn-cms, and the sibling sites). Content work runs on the shared method's rubric plus
  `docs/2026-07-06-asc-phase-1-design.md` and `docs/image-standard.md`.

## The repo family (renamed 2026-07-06)

- **This repo (glw907/aksailingclub-org)** is the new cairn-based site, the club's future
  production site (the worker keeps the name `asc-site`).
- **glw907/aksailingclub-legacy** (`~/Projects/aksailingclub-legacy`) serves the LIVE site today
  (Hugo/Blowfish plus the ops/ dashboard) and stays authoritative until the cutover; it archives
  after the soak. Its ops/ dashboard runs beside this site through the phase-2 absorption.
- ~/Projects/aksailingclub-sveltekit is the retired experiment (see its RETIRED.md).
- Claude sessions for ASC work launch HERE.
