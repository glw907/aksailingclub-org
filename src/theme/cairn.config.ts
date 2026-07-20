// ASC's adapter: the single seam the engine consumes. The site's content concepts (posts, pages,
// bulletins, fragments, and documents), a render that runs the engine's directive registry
// (Task 3: the club-grounds chrome and the callout/passage/cards components), and the GitHub App
// backend against the asc-site repo.
import { defineAdapter, defineConcept, defineRoles, fieldset, fields, githubApp, createRenderer, parseSiteConfig } from '@glw907/cairn-cms';
import { normalizeAssets, makeMediaResolver, readCommittedManifest } from '@glw907/cairn-cms/media';
import type { NavLayout } from '@glw907/cairn-cms/sveltekit';
import { buildAccess } from './access.js';
import { ascRegistry } from './markdown/components.js';
import { ICON_PATHS } from './markdown/icons.js';
import ContactForm from './components/ContactForm.svelte';
import DonateForm from './components/DonateForm.svelte';
import ClassSchedule from './components/ClassSchedule.svelte';
import MembershipPricing from './components/MembershipPricing.svelte';
import CommitteesAtAGlance from './components/CommitteesAtAGlance.svelte';
import siteYaml from './site.config.yaml?raw';
// The ?url import resolves the compiled stylesheets to their served URLs (the hashed assets in a
// build), so the editor's preview frame can link the same sheets the (site) layout loads. They
// must stay ?url-only; see the header comment in site.css.
import themeCss from './theme.css?url';
import siteCss from './site.css?url';

// Task 3 wires the club-grounds directive vocabulary (callout, passage, cards/card): the engine's
// registry, not the bare default, so those directives dispatch to real markup instead of
// rendering inert (Task 2's migration authored the content against this vocabulary already).
// Exported so a site-owned, non-content markdown source (the events deep-look pass's D1
// `long_description` rows, `$theme/events-data.ts`) renders through the same sanitized pipeline as
// ordinary content, rather than a second, weaker renderer.
export const { renderMarkdown } = createRenderer(ascRegistry);

// The ratified four-group sidebar (pass-B sidebar-build T6,
// docs/plans/2026-07-19-asc-sidebar-build.md; icons/order/collapsed-defaults settled by the T1
// probe round, docs/design-benchmark/decisions.md "Admin sidebar round 2"). Replaces the round-1
// split-desk tree (Club/Outreach/Boats & Gear/Content/Site): Club, Events & Classes,
// Communication, and Website, cairn's own screens interleaved with the site's /admin/club/*
// routes rather than segregated by provenance. No `roles:` gate appears anywhere in this tree
// (security model point 3, docs/2026-07-18-admin-sidebar-2-design.md): visibility derives
// entirely from `src/theme/access.ts`'s map through `resolveNavLayout`/`canReach`, so an entry
// renders iff the session reaches its function and a group renders iff it has a visible child.
// `collapsed` below is only the widest-roles' starting position (Administrator/Club manager);
// every other role's per-session open/closed set is a `navFilter` rewrite over this same shape
// (src/theme/nav-defaults.ts, wired in src/chassis/cairn.server.ts), not a second declaration
// here. `{ screen: 'nav' }` is referenced (not omitted, despite the round-1 comment's caution):
// the adapter's `editor.nav` block below configures the site's nav-menu editor, so
// `navMenuConfigured` is true at construction and the screen is real; omitting it would leave it
// in the fallback foot instead of the acceptance criterion's empty fallback.
export const navLayout: NavLayout = [
  {
    label: 'Club',
    children: [
      // portal-capstone: the section's own landing, the needs-attention strip's front door
      // (pending asset requests, offers nearing expiry). First in the list: the section's
      // "home", not just another screen.
      { label: 'Overview', icon: 'anchor', href: '/admin/club' },
      { label: 'Members', icon: 'users', href: '/admin/club/members' },
      { label: 'Committees', icon: 'users-round', href: '/admin/club/committees' },
      { label: 'Assets', icon: 'package', href: '/admin/club/assets' },
      // Relabeled from "Requests" (T1 decision 5): distinct from Assets above without reading
      // the whole tree for context.
      { label: 'Asset requests', icon: 'inbox', href: '/admin/club/asset-requests' },
      { label: 'Money', icon: 'banknote', href: '/admin/club/money' },
      // The waivers rollup ("is the club protected"), not the document text itself -- that's
      // Website's "Waiver text" engine ref below, editing the signable-document markdown.
      { label: 'Waivers', icon: 'shield-check', href: '/admin/club/documents' },
      // "Club settings", not "Settings": cairn's own Settings screen already carries that name,
      // and two identical labels in one nav read as a defect (Geoff, 2026-07-07 admin review).
      { label: 'Club settings', icon: 'wrench', href: '/admin/club/settings' },
      // Relabeled from cairn's own "Editors" (T1 decision 5): `key-round` overrides the engine's
      // default `users` glyph, which would otherwise collide with Members above.
      { screen: 'editors', label: 'Admin access', icon: 'key-round' },
    ],
  },
  {
    label: 'Events & Classes',
    collapsed: true,
    children: [
      { label: 'Events', icon: 'calendar', href: '/admin/club/events' },
      { label: 'Classes', icon: 'graduation-cap', href: '/admin/club/classes' },
      // T4: the cross-class waitlist/offer overview.
      { label: 'Class waitlist', icon: 'list-ordered', href: '/admin/club/classes/waitlist' },
      // T5's deep link into the Communication group's own Email/compose screen, preselected to
      // the class segment via a query param. A distinct href (the query string) satisfies
      // navLayout's own href-uniqueness check against the plain Email entry below, and it
      // inherits the `/admin/club/email` access-map key's coverage rather than declaring a new
      // one -- which also means a Publisher session (admitted to `/admin/club/email`) reaches
      // this one Events & Classes entry, even though the rest of the group stays
      // Administrator/Club manager only (T5's own header comment on the compose route).
      { label: 'Email class members', icon: 'send', href: '/admin/club/email/compose?segment=class' },
    ],
  },
  {
    label: 'Communication',
    children: [
      // No icon override: the engine's dated-concept default glyph is unique in this tree once
      // Bulletins below takes its own override.
      { screen: 'posts' },
      // Override required: the engine's dated-concept default would otherwise collide with Posts.
      { screen: 'bulletins', icon: 'bell' },
      { label: 'Email', icon: 'mail', href: '/admin/club/email' },
      { label: 'Announce', icon: 'megaphone', href: '/admin/club/announce' },
    ],
  },
  {
    label: 'Website',
    collapsed: true,
    children: [
      { screen: 'pages', icon: 'files' },
      { screen: 'media' },
      // No icon override: `puzzle` (the editor's own component-block glyph) was declined for
      // this door (T1 probe verdict); the engine's own default glyph stays.
      { screen: 'fragments' },
      // No label override: the engine's own default label for this screen is already "Tags"
      // (0.88's own `ENGINE_SCREEN_DEFAULTS`, verified against the installed package rather than
      // assumed -- the round-1 tree's "Vocabulary" complaint no longer applies). `tags` still
      // overrides the icon: the engine's own default glyph for this door is a different,
      // singular tag outline, not the plural `tags` this allowlist name renders.
      { screen: 'vocabulary', icon: 'tags' },
      { screen: 'nav', icon: 'menu' },
      // The signable-document markdown itself, not the waivers rollup -- that's Club's "Waivers"
      // site entry above, reading the season's signed/outstanding state.
      { screen: 'documents', label: 'Waiver text', icon: 'file-pen' },
      // Relabeled from cairn's own "Settings" (T1 decision 5); the engine's default glyph fits.
      { screen: 'settings', label: 'Website settings' },
    ],
  },
];
// `help` is deliberately never referenced above (T1 probe verdict, "foot is perfect" --
// docs/2026-07-19-sidebar-build-harvest-findings.md finding 1): an unreferenced screen resolves
// into the engine's own fallback foot, open to every editor-capability session and unfilterable
// by the access map (`help` and `editors` are the two documented non-map cases in access.ts), so
// it is the one door every role reaches identically. Filing it inside a group instead would
// strand a single-group role (Publisher, say) with a second, lonely group holding only Help.

// The committed media manifest the public render resolver reads. A bare {} until an editor
// uploads. Read through import.meta.glob so a fresh site with no committed media.json degrades
// to {} rather than failing the build: a static import of a missing file is a build-time
// module-not-found, but a glob with no match returns {}, and readCommittedManifest parses that
// to an empty manifest. Exported so the home page's fixed photography placements (src/theme/
// home-images.ts) can read an entry's alt text directly, the same manifest the body resolver uses.
export const mediaManifest = readCommittedManifest(
  import.meta.glob('../content/.cairn/media.json', { eager: true, import: 'default' }),
);

// The default public media resolver, backing the public build over the committed manifest. The
// preview path injects its own resolveMedia from the edit page's mediaTargets; this default
// keeps a published `media:` reference from throwing when no per-call resolver is supplied.
const resolvedAssets = normalizeAssets({ bucketBinding: 'MEDIA_BUCKET' });
export const publicMediaResolver = makeMediaResolver(mediaManifest, resolvedAssets);

// Whether media is configured on. The public route threads it as `assetsEnabled` so the engine
// logs `media.resolver_absent` if a future edit drops the resolveMedia wiring while media stays
// on.
export const mediaEnabled = resolvedAssets.enabled;

// The site's role vocabulary (pass A of admin-sidebar-2,
// docs/2026-07-19-asc-roles-adoption.md T2; docs/2026-07-18-admin-sidebar-2-design.md decision 8):
// five plain-function names, renamed from the initiative-5 pair (`owner`/`club-admin`) plus one
// new club role and two new site roles. `owner: 'owner'` stays declared even though the site never
// grants it again: `defineRoles` reserves and hard-requires the key (throws without it, and throws
// unless it maps to owner capability -- `node_modules/@glw907/cairn-cms/dist/auth/roles.js`), so
// the literal rename the spec first reached for is not achievable. It is a phantom the engine
// forces, kept un-granted; `Administrator` is the real, granted owner-capability name from here on.
// The last-owner guard stays safe across both names: `ownerLevelRoles(roles)` (not the literal
// `'owner'` string) is the set it counts across, and it resolves to `{owner, Administrator}`
// (`src/tests/roles-vocabulary.test.ts` pins this). `Webmaster` and `Publisher` are new, both
// editor capability; `Instructor` (unchanged from initiative 5) declares no `home`: no
// instructor-reachable screen exists until class-management builds the roster, and the engine's
// signed-in welcome view is the correct landing until then. `src/app.d.ts` augments
// `CairnRolesRegister` with `typeof roles`, so `locals.editor.role` narrows to these six names
// everywhere the site reads it. DX-harvest finding filed alongside this change: the `ManageEditors`
// grant screen lists every vocabulary key as a grantable role
// (`node_modules/@glw907/cairn-cms/dist/sveltekit/editors-routes.js`'s `vocabularyList =
// Object.keys(vocabulary).map(...)`), so the phantom `owner` appears beside `Administrator` as a
// second, confusing owner-level option in both the add-editor and role-change selects.
export const roles = defineRoles({
  owner: 'owner',
  Administrator: 'owner',
  'Club manager': 'editor',
  Webmaster: 'editor',
  Publisher: 'editor',
  Instructor: { capability: 'none' },
});

// The site's access map (pass A T3, docs/plans/2026-07-19-asc-roles-adoption.md;
// src/theme/access.ts carries the map itself and the comprehensiveness/carve-out reasoning).
// Built here, immediately after `roles`, rather than imported as a top-level constant from
// access.ts: access.ts's own header comment explains the import-cycle crash that forces this
// factory shape. `access` then flows to `defineAdapter`'s `access` member below and back out to
// hooks.server.ts's `createAuthGuard`, the same "declared once in cairn.config.ts, consumed
// through it" path `roles` already takes to its own other consumers.
export const access = buildAccess(roles);

export const cairn = defineAdapter({
  roles,
  access,
  content: {
    posts: defineConcept({
      dir: 'src/content/posts',
      label: 'Posts',
      summaryFields: ['description'],
      routing: 'feed',
      fields: fieldset({
        title: fields.text({ label: 'Title', required: true }),
        date: fields.date({ label: 'Date' }),
        description: fields.textarea({ label: 'Description' }),
        // The curated tag vocabulary (site.config.yaml's `vocabulary`) marks the news, racing,
        // results, education, and club categories; a public archive filters over this data.
        tags: fields.multiselect({ label: 'Tags', creatable: true, taxonomy: true }),
        // The hero seam Task 2's migration found missing (finding #3: the old Hugo posts each had
        // a real featuredImage from the live site, dropped rather than invented at migration time).
        // createPublicRoutes derives `heroImage` from this same field with no bespoke code; the
        // catch-all template already renders it.
        image: fields.image({ label: 'Hero image', seo: true }),
      }),
    }),
    pages: defineConcept({
      dir: 'src/content/pages',
      label: 'Pages',
      routing: 'page',
      fields: fieldset({
        title: fields.text({ label: 'Title', required: true }),
        // Optional, matching the live site's own "primary" page template (donate, join): most
        // pages carry no hero at all, and createPublicRoutes derives `heroImage` from any
        // entry's `image` field with no per-concept wiring, the same free seam the posts
        // concept's own hero already uses.
        image: fields.image({ label: 'Hero image', seo: true }),
        // Optional, a one-line subtitle shown under the title (completion-pass manifest item 10,
        // restoring live's own governance-subpage description). Most pages carry none; the
        // catch-all template renders it only when a page sets it.
        description: fields.textarea({ label: 'Subtitle' }),
        // The page-template pass's promise hero (Task 3): a primary page's own short display
        // line, rendered as the promise hero's h1 in place of the plain title. Optional; most
        // pages carry none and keep the plain title hero.
        promise: fields.text({ label: 'Promise line' }),
        // Where the hero photo's 2:1 crop centers, as a CSS object-position pair ("50% 30%").
        // Optional; the crop centers when unset. Set it when the photo's subject sits high or
        // low in the frame (join's members, racing's fleet at the waterline).
        imageFocus: fields.text({ label: 'Hero crop focus (e.g. 50% 30%)' }),
        // The promise hero's fact strip, paired with `promise`. Reuses the open, creatable
        // multiselect shape posts' `tags` field already uses, without `taxonomy`: no vocabulary
        // pools across entries, each page's facts are its own short freeform list.
        facts: fields.multiselect({ label: 'Fact strip', creatable: true }),
      }),
    }),
    // The Fragments concept (0.87.0): a piece of markdown authored once and spliced into any
    // number of posts/pages/bulletins via `::include{fragment="<id>"}`. `routing: 'embedded'` is
    // required by the reserved `fragments` key (a routable fragment would publish a bare
    // permalink with no context around it). Empty for now; Stage 3 of the fragments-migration
    // pass converts the surviving candidates from docs/fragment-candidates.md.
    fragments: defineConcept({
      dir: 'src/content/fragments',
      label: 'Fragments',
      singular: 'Fragment',
      routing: 'embedded',
      fields: fieldset({
        title: fields.text({ label: 'Title', required: true }),
      }),
    }),
    // The bulletins concept: short, time-sensitive announcements with their own permalinked page
    // (the live site's `/bulletins/<slug>/`, a completion-pass restoration; the earlier content
    // migration folded these into the `notifications` banner alone and dropped the pages
    // themselves, which 404'd with no redirect). `routing: 'feed'` gives each entry a real page
    // and the default `/bulletins/:slug` permalink; the two migrated ids carry only a
    // year-month prefix (no day), which the default `day` datePrefix does not strip, so the slug
    // stays the id verbatim and matches the live URLs exactly with no redirect needed. A future
    // bulletin created through the editor gets a full day-granularity id instead, a reasonable
    // step up, not a mismatch to paper over.
    //
    // `detail` and `expires` restore production's single-concept model (pass-B sidebar T3,
    // docs/2026-07-18-admin-sidebar-2-design.md decision 4): the live Hugo site's own `bulletins`
    // already carries a short detail line and an expiry the home banner reads to pick the latest
    // still-current bulletin (`$theme/active-notification`'s `activeNotification`); the earlier
    // migration split that into this feed concept plus an invented `notifications` banner
    // concept, which duplicated entries and has now retired. Both fields are optional, matching
    // production's own optional treatment (a bulletin with neither still publishes its page, it
    // just never claims the banner), so the two already-migrated entries keep validating with no
    // backfill owed.
    bulletins: defineConcept({
      dir: 'src/content/bulletins',
      label: 'Bulletins',
      singular: 'Bulletin',
      routing: 'feed',
      fields: fieldset({
        title: fields.text({ label: 'Title', required: true }),
        date: fields.date({ label: 'Date', required: true }),
        detail: fields.text({ label: 'Detail line', help: 'A short line shown on the home banner alongside the title.' }),
        expires: fields.date({
          label: 'Expires',
          help: 'The home banner shows this bulletin through this date, then stops. Leave unset and it never claims the banner.',
        }),
      }),
    }),
    // The member-waivers document model (member-waivers T1,
    // docs/2026-07-17-member-waivers-design.md "Ratified decisions" 1/4/6): signable documents as
    // season-versioned markdown, one file per version, edited through the admin like any other
    // content. `routing: 'embedded'` (the same choice fragments already makes): a
    // document has no public page of its own, and reaches a member only through the signing flow
    // that reads its full text (T4). `document` is the stable id a document keeps across versions
    // (e.g. "general-release"); `version`/`season`/`status` are what `$theme/documents.ts`'s
    // loader resolves over, and the freeze guard (src/tests/document-freeze-guard.test.ts) holds
    // a published version's body immutable once frozen. `audience` mirrors the asset-kind ids
    // `asset_types` uses (migrations/asc-club/0007_assets_email/forward.sql) so the requirement
    // engine (T3) can match a document to what a member actually holds, plus "all-members" and
    // "dry-storage" (any of the three storage asset kinds) and "youth-class".
    documents: defineConcept({
      dir: 'src/content/documents',
      label: 'Signable documents',
      singular: 'Document',
      routing: 'embedded',
      summaryFields: ['document', 'version', 'kind', 'audience', 'season', 'status'],
      fields: fieldset({
        title: fields.text({ label: 'Title', required: true }),
        document: fields.text({ label: 'Document id', required: true, help: 'Stable across versions, e.g. "general-release".' }),
        version: fields.number({ label: 'Version', required: true, integer: true, min: 1 }),
        kind: fields.select({ label: 'Kind', required: true, options: ['release', 'acknowledgement', 'agreement'] }),
        audience: fields.select({
          label: 'Audience',
          required: true,
          options: ['all-members', 'mooring', 'rv-parking', 'boat-parking', 'small-boat-rack', 'dry-storage', 'youth-class'],
        }),
        season: fields.number({ label: 'Season', required: true, integer: true }),
        status: fields.select({ label: 'Status', required: true, options: ['draft', 'published'] }),
      }),
    }),
  },
  backend: githubApp({
    owner: 'glw907',
    repo: 'aksailingclub-org',
    branch: 'main',
    appId: '3847496',
    installationId: '135372268',
  }),
  email: { from: 'noreply@aksailingclub.org' },
  // The media R2 binding: the /media delivery route streams content-addressed bytes from here.
  media: { bucketBinding: 'MEDIA_BUCKET' },
  rendering: {
    render: ({ body, resolve, resolveMedia, resolveFragment }) =>
      renderMarkdown(body, { resolve, resolveMedia: resolveMedia ?? publicMediaResolver, resolveFragment }),
    components: ascRegistry,
    icons: ICON_PATHS,
    // The contact and donate directives' live components (completion-pass manifest item 2),
    // mounted over their build() fallback by the root layout's hydrateIslands() call.
    islands: {
      'contact-form': ContactForm,
      'donate-form': DonateForm,
      'class-schedule': ClassSchedule,
      'membership-pricing': MembershipPricing,
      'committees-at-a-glance': CommitteesAtAGlance,
    },
  },
  editor: {
    nav: { configPath: 'src/theme/site.config.yaml', menuName: 'primary', label: 'Navigation', maxDepth: 2 },
    // The preview knob: the (site) layout renders entries inside <main class="site-main">
    // (site.css), so the frame links the same theme/site sheets and reproduces that container.
    preview: { stylesheets: [themeCss, siteCss], containerClass: 'site-main' },
    // A stuck editor's Help hand-off (pass-B sidebar-build T6, Geoff-approved): an explicit
    // address stops cairn's own hosted-help default (`https://cairn.pub/help`) from standing in
    // for a real club contact.
    supportContact: 'geoff.wright@aksailingclub.org',
    navLayout,
    // The publish-actions seam: a published post lands beside the Announce screen's own
    // detail route (`/admin/club/announce/[id]`, a path param, not the doc example's query-string
    // shape) so the member who just published can jump straight into notifying the club.
    // Restricted to posts: pages have no Announce screen.
    publishActions: [{ label: 'Announce this post', href: '/admin/club/announce/{id}', concepts: ['posts'] }],
  },
});

export const siteConfig = parseSiteConfig(siteYaml);
