# Content migration: the shortcode inventory and its findings

Plan Task 2 (`2026-07-06-asc-phase-1-build.md`) migrates every public page and phase-1 member
guide from the Hugo repo (`~/Projects/aksailingclub-org`) to cairn content, and asks that every
Hugo shortcode map onto cairn's component grammar with a recorded finding per fought schema. This
is that inventory: what each shortcode became, why, and which gaps are real engine or theme work
for a later task rather than a content decision this pass could make alone.

## Resolved without new engine or theme work

These shortcodes had a plain-markdown or already-declared-component answer, so migrating them was
a content decision, not a schema fight.

- **`{{< sb "text" >}}`** (a generic semi-bold span, used almost entirely for Discord channel and
  handle names like `#racing`, `@everyone`). Converted to an inline code span (`` `#racing` ``).
  Inline code reads as a literal token, which is a better semantic fit for a channel handle than
  bold, and needs no new directive.
- **`{{< phosphor-icon "name" >}}` inside a plain heading, standing in for a titled block of prose
  with no card chrome** (e.g. `<h3>{{< phosphor-icon "compass" >}} Big Lake, Alaska</h3>` followed
  by a paragraph, no surrounding grid). Converted to Waymark's existing `passage` directive
  (`:::passage[Title]{icon="compass"}`), the same shape ecxc already proved. No new component.
- **The Google Maps iframe embed on `contact.md`.** Cairn's sanitize floor does not allow
  `<iframe>` (a deliberate content-security boundary, not an oversight), so the embed cannot
  survive as raw HTML. Replaced with a plain link to Google Maps directions. A small site does not
  need an iframe-embed primitive for one map.
- **Hugo's `legal`/`summary` frontmatter block** on the five governance legal documents (bylaws,
  articles of incorporation, ASCCA bylaws, the IRS determination letter, the Mat-Su land
  agreement). Cairn's `pages` concept has one field (`title`); folded the plain-English summary
  into the body as a `callout` directive, and the document metadata (adopted/effective/authority/
  PDF link) into a short line above it. No schema change, just markdown structuring.
- **Section-color wrapper divs** (`.section-gray`/`.section-white`/`.section-fine-print`) purely
  used for Hugo's alternating page-band background. Dropped entirely: Task 3's theme/composition
  layer owns visual banding, and content should not carry presentation the theme will supply.
- **`.guide-item` grouping divs with no icon** (a plain sub-heading and prose, e.g. "Adult & Teen
  Track"). Dropped the wrapper, kept the heading and prose as plain markdown; no visual grouping
  was lost that Task 3 cannot supply from the heading structure alone.

## Component findings (real gaps, for Task 3 or later)

Each of these Hugo shortcodes has no existing cairn or Waymark component, and content that used it
now carries an inert, unstyled `<div>` (confirmed empirically: an unregistered directive renders
its children through `rehypeDispatch`'s `if (!def) return node` fallthrough, so the content
survives, just without chrome) until a future pass registers a real component.

1. **A card grid, both as clickable navigation cards and as static feature cards.** By far the
   most common shortcode pattern on the old site: `.cta-list` (icon + title + description + arrow,
   a whole-card link) and `.card-grid.icon-cards` (icon + title + description, no link) appear on
   nearly every page as internal navigation and benefit lists. The two are visually identical
   except for the link. Content now uses one directive family for both:
   ```
   ::::cards
   :::card[Title]{icon="compass" href="/optional/path"}
   Description text.
   :::
   ::::
   ```
   `href` present makes the whole card a link (the `.cta-list` shape); `href` absent makes it a
   static feature (the `.card-grid.icon-cards` shape). Task 3 should build one component
   flexible enough for both rather than two near-duplicates, closest in spirit to ecxc's
   `programs`/`program` pair but without the `meta`/`cta` fields those don't need here.
2. **An icon set.** Every `passage` and `card` directive above carries an `icon` attribute (Phosphor
   icon names lifted straight from the Hugo shortcode calls: `compass`, `sailboat`, `anchor`,
   `graduation-cap`, `wrench`, and about twenty others). ASC's theme has no icon set yet (Task 1's
   scaffold deliberately omitted `render.ts`, since zero components were registered at scaffold
   time). Task 3 needs to pick an icon library and wire `makeIconRenderer`, the same seam ecxc
   uses, with a glyph for every name this migration used. The full name list is grep-able from
   `src/content/pages/*.md` (`icon="..."` attributes) once Task 3 starts.
3. **Post hero/feature images.** All ~30 migrated posts and several pages had a Hugo
   `featuredImage`/`heroImage` path pointing at a real photo on the live site. The `posts` and
   `pages` concepts, as scaffolded in Task 1, declare no image field. This migration dropped the
   image references rather than invent a field Task 1 did not declare; the plan's Task 3
   acceptance already owns "the real photography ... pulled from the live site's assets into the
   media library," which is the natural place to add the field and wire the uploads together.
   The source paths are recoverable from the Hugo repo's `content/**/*.md` frontmatter
   (`featuredImage`/`heroImage` keys) when that pass starts.
4. **PDF assets on the governance pages.** Five legal documents link to a PDF
   (`/uploads/2024/04/*.pdf` on the live site). Those paths do not exist in the new build; the
   links in the migrated content point at the old paths as a placeholder. Pulling the PDFs into
   the media library is the same kind of asset work as the photography above (finding 3) and
   should ride the same pass.
5. **A dynamic class-schedule table** (`{{< class-schedule >}}`, fetched client-side from
   `/api/class-schedule`, a D1-backed table). Structurally the same kind of live-data widget as
   the events calendar Task 4 owns, but for classes rather than events, and Task 4's acceptance
   only names the Season section and `/events`. `education.md` keeps its surrounding static prose
   (what the classes are, the day-by-day schedule, gear, pricing) and replaces the table itself
   with a short note pointing readers at the (forthcoming) schedule; a class-schedule surface is
   real follow-on work, parallel to Task 4 but not currently scoped to any task.
6. **Dynamic storage-waitlist/fee widgets** (`data-asset-fee`/`waitlist-names` elements on
   `seasonal-storage.md` and `waitlists.md`, populated client-side from a small ops API with no
   static fallback). The surrounding static prose already states the costs and typical wait
   patterns in words, so this migration drops the empty dynamic hooks rather than fabricate a
   fallback; a real status widget is a small follow-on data surface, not a rendering component.
7. **The `racing-events` shortcode** (an empty `.racing-events-list` div with no visible fetch
   logic in the shortcode itself; populated by a page-level script elsewhere in the old build).
   Dropped from `racing.md`; this is superseded by Task 4's D1 events surface, not a distinct gap.

## Resolved as "coming soon" (explicit phase-1 boundary, not a schema fight)

The spec's phase-1 content line is explicit: guides in, functional/data-driven surfaces wait for
phase 2 "behind a small coming soon surface." These are not component gaps, since the components
they'd need (Turnstile, a Cloudflare Worker API route, Stripe, MembershipWorks account/directory
screens) are real backend surfaces a future pass builds deliberately, not something a directive
component could stand in for.

- **Self-hosted forms** (`contact-form`, `issues-form`, `it-request-form`, `discord-invite-form`,
  `donate-form`, `class-waitlist-form`): each POSTs to a Cloudflare Worker API route
  (`/api/contact`, `/api/donate`, etc.) with Turnstile verification, none of which exist in the
  cairn build. The page the form lived on stays in scope (contact, donate, education, issues
  and support, IT request, the Discord server page); only the form itself becomes a `callout`
  explaining the interim path, routed to the most specific real, already-published address found
  in the source content (`board@aksailingclub.org`, `racing@aksailingclub.org`,
  `program-committee@aksailingclub.org`) or the Discord server, never an invented address.
- **`{{< season-calendar >}}`, `{{< recent-posts >}}`, `{{< latest-bulletin >}}`**: home-page-only
  widgets. The home page is the hand-built north star (Task 3), not migrated markdown content, so
  these are Task 3's job by construction, not a Task 2 gap.
- **MembershipWorks embeds** (`{{< mw open=... >}}`, `{{< mw-help >}}`) on `my-account.md`,
  `directory.md`, `class-registration.md`, and `class-registration-complete.md`: the spec names
  these four pages explicitly as the phase-1 boundary ("the directory, my-account ... wait for
  phase 2"), so they became short coming-soon pages regardless of the fact that the MW widget
  itself is a third-party script embed that would technically survive the sanitize floor (unlike
  the self-hosted forms above). Task 4's own acceptance criterion ("MembershipWorks pages embed
  as-is") may reintroduce the embed directly on a page in its own scope (event registration); this
  migration does not preclude that, it just does not do it for account/directory surfaces the spec
  explicitly deferred.
- `members/renewing-your-membership.md` also carries an `{{< mw open="myaccount" >}}` embed as its
  main call to action; treated the same as the account pages above.

## Schema finding: no per-page `robots` field yet

A handful of Hugo pages (`welcome.md`, `class-registration-complete.md`, `payment/confirmation.md`)
set `robots: noindex` because they are post-signup or post-payment landing pages with no reason to
rank in search. Cairn's cross-concept SEO reader (`readSeoFields`) already understands a `robots`
string, but only if the concept's own schema declares that key (an undeclared frontmatter key does
not survive the validate-once normalization). ASC's `pages` concept, as scaffolded in Task 1,
declares only `title`. This migration left the three pages indexable rather than silently drop a
frontmatter key with no effect; adding `robots: fields.text(...)` to the `pages` fieldset is a
small, self-contained follow-up whenever a page like this needs it.

## Taxonomy finding: the Hugo tag set does not fit the curated vocabulary

Task 1 declared a five-value curated tag vocabulary for `posts` (`news`, `racing`, `results`,
`education`, `club`). The Hugo posts used eight tags (`events`, `racing`, `results`, `education`,
`governance`, `safety`, `community`, `infrastructure`). The three that do not already match
(`events`, `governance`, `safety`, `community`, `infrastructure`) all collapsed onto `club`, the
vocabulary's general-purpose bucket, since none of them describes a distinct enough readership
need to justify widening the curated set on this pass's authority alone (that is a theme/editorial
call, not a migration call). The `tags` field is `creatable: true`, so nothing technically blocks
adding a value later if an editor wants a finer category.

## URL contract: two sanctioned deltas

1. **Governance and member pages flatten from two path segments to one.** Cairn's `pages` concept
   globs a single flat directory (`import.meta.glob('/src/content/pages/*.md', ...)`, no directory
   recursion), so `/governance/bylaws/` becomes `/bylaws/`, `/members/welcome/` becomes `/welcome/`,
   and so on for every nested page. This is the flat content model working as designed, not an
   oversight, and the spec's own acceptance line ("sanctioned redirects only") anticipates exactly
   this shape of change. `src/theme/redirects.ts` carries the full old-to-new map, and
   `(site)/[...path]/+page.server.ts` serves a 301 for each before falling through to content
   resolution, so an external link, a bookmark, or a search result still resolves. No slug
   collisions occurred flattening the two directories onto one namespace.
2. **One post's URL changes for a different reason: a source-site slug inconsistency, not path
   depth.** Every Hugo post except `2026-02-welcome-new-website.md` declared an explicit `slug:`
   frontmatter key that dropped the `YYYY-MM-` filename prefix; that one post omitted `slug:`, so
   Hugo fell back to the full filename (date prefix included) as its URL. Cairn's dated-concept
   `id`/`slug` split strips the date prefix uniformly for every post, with no per-entry exception,
   so the migrated post is `/posts/welcome-new-website/`, matching every sibling post's pattern
   instead of carrying forward the one inconsistent URL. Also carries a 301 in
   `src/theme/redirects.ts`.
3. **The home page (`/`) is not migrated markdown content.** The old `content/_index.md` is
   Hugo-specific hand-assembled HTML (the hero, the season calendar, the fleet/facilities
   sections); the spec's north star is a hand-built Svelte template (Task 3), not a markdown page.
   `(site)/+page.svelte` already carries a placeholder (Task 1) that Task 3 replaces; this pass
   left it untouched.

## Finding: no public archive page at `/posts/`

The live site's `/posts/` is a real browsable listing page (grouped by year, per the sitemap).
Cairn's `routing: 'feed'` shorthand (`{ routable: true, dated: true, inFeeds: true }`) gives each
post its own page and includes it in the RSS/JSON feeds, but the site resolver's `entries()` only
enumerates per-entry permalinks (`site-resolver.ts`), never a concept-level index route; there is
no `/posts/` page at all in this build. This is a real, missing feature (a public archive page,
grouped or flat), not a content-migration gap, and building one is theme/template work parallel to
the home page rather than something a markdown file can supply. The one historical post that links
to `/posts/` (`2026-02-welcome-new-website.md`, announcing the news archive at the time) keeps its
original link rather than being edited to route around a gap in the current build; it is currently
a dead link in the new site the same way its separate `/membership/` reference already was on the
live site (verified: `/membership/` 404s on `aksailingclub.org` today too), and both are historical
record, not migration regressions to paper over.

## Notifications: the current bulletin becomes the seed entry

The Hugo `bulletins` collection (rendered as a home banner via `{{< latest-bulletin >}}`, one
entry live at a time by expiry date) is a sanctioned delta on its own: `routing: 'embedded'` gives
`notifications` no public URL, dropping `/bulletins/2026-03-membership-open/` and
`/bulletins/2026-02-notice-of-race-spring-series/` from the sitemap by design (the site declared
this concept precisely so a notification is data the theme reads, not its own page). The more
recent, more general bulletin ("Membership Open for 2026") became the first `notifications` entry,
migrated with its real date and expiry rather than a fabricated forward-looking one; both source
bulletins' `bulletinExpires` dates have since passed, so the banner will not render until an editor
authors a fresh one; that is correct, honest behavior for expiry-aware content, not a migration
bug.

**A build-time bug surfaced verifying that "no public URL" claim.** `site.all()`/`site.entries()`
(the `SiteResolver` `$chassis/content.ts` builds) do not filter by concept routing, so before this
was fixed, `/notifications/2026-03-membership-open` actually prerendered as a real, visitable page
and appeared in the sitemap, contradicting the `embedded` shorthand's own contract. The engine
already ships the correct tool for the sitemap half of this, `sitemapView` (which filters by
`descriptor.routing.routable`, unlike raw `site.all()`); `src/routes/sitemap.xml/+server.ts` (a
Task 1 scaffold file) called `site.all()` directly instead, so this was a scaffold bug, not a
missing engine feature. There is no equivalent public "routable entries" view for
`createPublicRoutes.entries()`, so `src/theme/routable-concepts.ts` derives the same routable-concept
set `sitemapView` uses (via `siteDescriptors`), and `(site)/[...path]/+page.server.ts` filters its
own prerender entries and 404s a direct hit on a non-routable entry's permalink with it. Verified:
before the fix, `npm run build` prerendered `pages/notifications/2026-03-membership-open.html` and
listed it in `sitemap.xml`; after, neither exists.
