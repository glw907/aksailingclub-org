# The chassis

The boundary rule, per cairn-cms's canonical statement
(`examples/showcase/src/chassis/README.md` in the `cairn-cms` repo): **a theme is everything that
isn't chassis.** `src/chassis/` holds the genre-free layer ASC's theme (living in `src/theme/`,
plus the route files under `src/routes/` that SvelteKit's filesystem routing pins in place)
mounts onto: the plumbing every site needs regardless of what it looks like. Everything outside
`src/chassis/` (the concrete adapter config, the chrome components, the home and article
composition, the theme's color and type values, the site's own directive registry) is the
theme's own content. A theme file reaches chassis only through its exported seams: the
`$chassis` alias in `.ts`/`.svelte` files, or a relative `@import` in a `.css` file (aliases do
not resolve in CSS), always naming one of the files below.

The chassis files here came from `cairn-cms`'s own showcase, the reference site the chassis
boundary was first cut against (verbatim where a file is genuinely site-agnostic; `content.ts`,
`feed.ts`, and `cairn.server.ts` carry the same shape but wire ASC's own concepts, `posts`,
`pages`, `bulletins`, `fragments`, and `documents`; `date.ts` carries the same shape with this
site's own `en-US` long-month vocabulary in place of the showcase's `en-GB` short-month one).

## What lives here

| File | What it is |
| --- | --- |
| `content.ts` | The delivery content layer: globs the markdown, builds the site/posts/pages/bulletins/fragments/documents indexes through `createSiteIndexes`. |
| `feed.ts` | Maps the posts index into `cairn-cms/delivery`'s `FeedItem` shape, shared by the RSS and JSON Feed routes. |
| `public-routes.ts` | The one `PublicRoutesConfig` literal and the one `createPublicRoutes()` instance built from it, shared by every route that renders a single content entry: the `(site)` catch-all, `/events`, and `/preview/[token]`. |
| `cairn.server.ts` | The one server-side runtime composition point (`composeRuntime`, `createCairnAdmin`); every server route that needs the runtime imports it from here (the `/admin` mount, `/healthz`, `/media`). |
| `theme-toggle.ts` | The light/dark toggle mechanism: resolve the active theme, apply a choice, persist it to a cookie, and (`toggleThemeWithTransition`) flip it under a short color cross-fade, instant under `prefers-reduced-motion`. |
| `date.ts` | This site's own date vocabulary (`en-US`, long month): `formatDate` (day, month, year) and `formatDayMonth` (day, month, no year, for a listing grouped under a year heading). |
| `tokens.css` | The token SYSTEM: Tailwind and the DaisyUI plugin activation, the design-scale keys with generic defaults, and the semantic (code-highlight, ink, elevation, CTA) bindings. |
| `prose.css` | The reading-surface foundation: every prose element bound to tokens, with the signature flourish gestures behind `[data-flourish]`. |
| `composition.css` | The composition primitives: card, band, section, hero, sidebar-layout, site-shell. Unused in ASC's current markup, same as in the showcase; the theme reaches for one instead of hand-rolling its own. |
| `render.ts` | The component-grammar wiring: `makeIconRenderer` closes a theme's icon set over the engine's glyph helpers, and `proseTypography` is the `createRenderer` `remarkPlugins` entry that smartens quotes, dashes, and ellipses in body prose. Added back in Task 3 (the theme build) once the migrated content's directives needed real icons; see the note below for the re-add path. |

## Deliberate omissions

Three showcase files stay out of this copy entirely, per the chassis's own subtractability rule
(a developer may drop an unused chassis element with no other seam depending on it):

- **`archive.ts`**: the showcase's paginated-archive helper. This site's `/posts` page groups
  entries by year with no pagination, a different enough shape that reaching for the showcase's
  helper would fight it rather than fit it.
- **`entry-data.ts`**: composes a `reference` field's cross-entry lookup. No concept this site
  declares (`posts`, `pages`, `bulletins`, `fragments`, `documents`) carries a reference field.
- **`dev-gate.ts`**: the showcase's dev-backend feature flag. This site runs no dev backend
  (`hooks.server.ts`'s own comment says so), so there is nothing to gate.

`prose.css` itself stays, but diverged from the showcase's copy through this site's own design
passes (h2 at 700, the B1 h4 subheads, the reading-size base), all locked verdicts in
`docs/design-benchmark/`; re-syncing it against the showcase is a design pass with a
before/after, never a routine chassis sync.

`render.ts` was omitted the same way at Task 1's scaffold time (zero components were registered
yet) and re-added in Task 3 by that exact path, the worked example of the doctrine this file
describes.

## Every override seam

**Adapter and delivery wiring.** `content.ts`, `feed.ts`, `public-routes.ts`, and
`cairn.server.ts` take the theme's own `cairn.config.ts` adapter (concepts, fields, backend) as
input; none of them declares any content model of its own.

**The token system (`tokens.css`).** Every design-scale key (`--font-*`, `--text-step-*`,
`--spacing-*`, `--leading-*`, `--tracking-*`, `--container-measure*`, `--color-muted`,
`--color-card-border`) is declared inside `@theme` with a generic default. `theme.css` `@import`s
`tokens.css` first, then redeclares the same keys with ASC's real numbers (the club-grounds
story: flag navy, star gold, fireweed, building sage, harbor ink).

**The prose foundation (`prose.css`).** Every element reads a token, so a re-skin carries the
reading surface forward with no edit here.

**The theme-toggle mechanism (`theme-toggle.ts`).** `resolveTheme`/`applyTheme`/`toggleTheme`
know nothing about which two DaisyUI theme names or which cookie name a theme uses;
`SiteHeader.svelte` passes its own `ThemeToggleConfig`. `toggleThemeWithTransition` wraps the
same flip in the cross-fade `theme.css`'s own `.theme-flip-transition` rule (scoped to this
site's own chrome classes) carries out.

**The date vocabulary (`date.ts`).** `formatDate`/`formatDayMonth` know nothing about which
locale or month style a theme wants; a future re-skin with a different date convention edits
this one file rather than hunting down every call site again.

**Composition primitives (`composition.css`).** `.cairn-card`, `.cairn-band`, `.cairn-section`,
`.cairn-hero`, `.cairn-sidebar-layout`, each exposing its own `--cairn-<primitive>-*` custom
properties for a per-instance override. Adopting one is a theme choice, never a requirement.

## Adding a new primitive or seam

Read this file's boundary rule first: genre-free plumbing and configurable structure belong
here; a specific look, a specific chrome, or a specific content model belongs to the theme.
