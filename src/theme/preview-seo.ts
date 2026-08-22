import type { SeoMeta } from '@glw907/cairn-cms/delivery';

/**
 * Strip the entry's eventual permalink from a page's head data: the `canonical` link, the
 * `og:url` meta tag, and `jsonLd.url`. Used on the share-a-draft preview route, never the public
 * route.
 *
 * A preview link is a bearer credential (whoever holds the URL can read the draft with no
 * session), but the URL these three fields carry is not that credential; it is the entry's
 * eventual public permalink, computed the same way whether or not the entry has published yet.
 * Rendering it into the head would let a crawler or link-unfurler consolidate the preview onto a
 * URL that is not live yet, or let the preview page self-canonicalize while it is still
 * `noindex`ed. The token's own containment is the engine's preview response headers
 * (`no-referrer`, `private, no-store`, `noindex`) and the fact the token itself is never rendered
 * into the page; this strip is a separate, narrower precaution about the permalink, not the token.
 *
 * @param seo The entry's head data, as built by `buildSeoMeta`.
 * @returns A copy of `seo` with `canonical`, `og:url`, and `jsonLd.url` removed. Every other
 *   field (title, description, the rest of the OG/Twitter tags) is unchanged.
 */
export function previewSafeSeo(seo: SeoMeta): SeoMeta {
  return {
    ...seo,
    meta: seo.meta.filter((m) => m.property !== 'og:url'),
    links: seo.links.filter((l) => l.rel !== 'canonical'),
    jsonLd: { ...seo.jsonLd, url: undefined },
  };
}
