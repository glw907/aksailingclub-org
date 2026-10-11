# Engineering notes

Durable mechanics a session needs on demand, kept out of `CLAUDE.md` so that file stays short.
Each note names the fact and, where code already enforces it, the file that does.

## Types, `worker-configuration.d.ts`, and `@cloudflare/workers-types`

`worker-configuration.d.ts` is committed. `npm run types` runs `wrangler types
--include-env=false` and must be rerun after any `wrangler.toml` change. The flag keeps the file
machine-independent: without it wrangler embeds the built worker's module type into `GlobalProps`
whenever `.svelte-kit/cloudflare/_worker.js` exists on the regenerating machine, and that
cascades through `checkJs` into thousands of `svelte-check` errors. The flag also means the
generated `Env` interface never appears, so the site declares its bindings in `src/app.d.ts`'s
`Platform.env`; that shape also names Worker secrets (`TURNSTILE_SECRET_KEY`, `STRIPE_*`,
`DISCORD_WEBHOOK_*`) that `wrangler.toml` never lists.

`@cloudflare/workers-types` stays a devDependency although no site source imports it: cairn's
own `.d.ts` files import `D1Database`, `R2Bucket`, and `RateLimit`, and without the package they
degrade to an unresolved-import `any` that `skipLibCheck: true` hides from `svelte-check`.

A transitive type bump rides every lockfile regeneration. A cairn sheet saying nothing else
changes covers cairn's contract, never `node_modules` (the 0.96 update surfaced `@types/hast`
3.0.5 typing `ariaLabelledBy` as `string[]`).

`npm run cairn:manifest` regenerates `src/content/.cairn/index.json` after any content edit made
outside the admin. The admin's own save path regenerates it.

## New post

Create `src/content/posts/YYYY-MM-DD-slug.md` with this frontmatter:

```yaml
---
title: "Post Title"
date: YYYY-MM-DD
draft: false
description: "One sentence description."
tags: ["tag1"]
image:
  src: "media/<content-hash>"
  alt: "What the photo shows."
---
```

## CI, snapshots, and the fixed clock

- A CI `update_snapshots` dispatch fails its push if anything lands on the branch after it
  checks out. Dispatch it last.
- Visual baselines are date-dependent on any page that renders "past". `ASC_FIXED_TODAY`
  (set on the e2e server in `playwright.config.ts`, read in `src/routes/(site)/events/+page.server.ts`)
  is the seam.
- `bootstrap-club-db.mjs` and the Playwright webServer reseed the local replica; a hand-seeded
  coherence-read fixture survives neither. A warm replica needs a per-migration probe in
  `e2e/fixtures/bootstrap-club-db.mjs` (its header explains the shapes).
- Probe and e2e seeds must not violate new unique indexes.
- A probe built inside the deployed page's own shell with live rows lands first pass; the
  defects it cannot see are in the layers it does not exercise (D1 degradation, clocks, focus,
  landmarks), which is what the close-time whole-branch review is for.

## Admin CSS and layout

- The UA `<ul>` `padding-inline-start` survives `list-style: none` under the no-Preflight admin.
- Edge-padding trims and zebra stripes must be parity-scoped together.
- An unlayered scoped rule beats daisyUI's `@layer` regardless of specificity (used for the
  `.list-row` radius). A scoped `font: inherit` clobbers utility classes; only a measured render
  catches it.
- A cell whose content swaps between regimes (typeset date and edit form) needs its column
  width reserved at the widest regime's measured footprint. The acceptance is identical column
  bounding boxes before and after entering the small state.
- A wrapper span around chips blockifies as a flex item and floats its content off-center;
  `display: contents` is the fix.
- No single tint percentage lands all four theme and stripe combinations in one contrast
  band; tune per pair against the measured band. `npm run verify:chips` measures them, and its
  header explains why colors resolve through a canvas readback.
- The `*-narrow-hide` recipe drops columns but does not size a cell's own controls. The
  acceptance is `scrollWidth === clientWidth` at 390 with a row expanded; a native date input
  needs about 112px at 12px or its value renders under the picker glyph.
- `ListToolbar`'s count and trailing slots are sealed into three bands; a screen that wants
  count and action on one line renders its own row.
- A DaisyUI exclude audit has to diff compiled selectors, not grep class names: a family can win
  a cascade layer over a same-named site rule with no class written in markup.
- `prose.css` is deliberately diverged from the showcase chassis; re-syncing it is a design pass.
- `formatExpiry` is the `PreviewBanner` seam for a site's date vocabulary. The chassis `date.ts`
  stays date-only on purpose, and an expiry wants the hour.

## Data, SQL, and tests

- SQLite cannot drop a column-level `UNIQUE` or add a NOT NULL FK to a populated table; both
  force the create-copy-drop-rename recreate. `0035`'s rollback expired the moment the first
  roll-forward created a second season's copy (its `rollback.sql` header carries the precondition
  query).
- Slugs repeat across seasons, so any events slug lookup orders by `season DESC`.
- `fakeD1` (`src/tests/_fake-d1.ts`) asserts SQL text and can never see a constraint or a
  batch's atomicity. Every guard lives in the statement (`NOT EXISTS`, `meta.changes`), never
  in a preceding SELECT.
- D1's SQLite text may live on `error.cause`; match through the chain. `errorText` in
  `src/member-portal/lib/assets.ts` is the shape; `itemNoun` in `src/admin-club/lib/ui.ts`
  returns the noun only, never the count.
- The vitest setup (`environment: 'node'` plus the SSR transform) has no client `mount()`.
  Behavior worth unit-testing is extracted to a pure module (`hero-image-picker.ts`) rather than
  asserted through source strings.
- A bare `use:enhance` on a form carrying `CsrfField` is a latent 403 when `update()` resets the
  form (use `reset: false`). Only `Referrer-Policy: no-referrer` nulls `Origin`; `same-origin`
  keeps it while leaking no Referer. The CSRF remedy hangs on that Fetch-spec fact (see
  `docs/2026-08-26-csrf-referrer-prep-brief.md`).
- Playwright's accessible-name matching is substring-based: a glyph moved into `aria-hidden`
  breaks exact-name locators.
- The email default-recipient CTE is email-determined by the ruling that defined it; an SMS pass
  must decide whether "reachable on any enabled channel" replaces it (`src/admin-club/lib/segments.ts`).
- Historic `email_blasts.segment_label` values are point-in-time snapshots; pre-pass rows stay
  "Current members" by design.
- `email_log(segment)` has no index and three member-facing cooldown reads scan it; it is the
  first candidate for the next schema touch (`docs/status-archive.md`, the 2026-10-10 entry).
- The media picker is built site-local over the committed manifest
  (`src/routes/admin/club/events/HeroImageField.svelte`); it is not reachable through cairn's exports.
