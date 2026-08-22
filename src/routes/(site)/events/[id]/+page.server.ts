// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): `/events/[id]` is no
// longer a page in its own right, since annual recurrence means the real event lives on one long
// season page. This route survives only as a thin link-preview carrier, because a URL fragment
// never reaches the server and a shared `/events#slug` would otherwise unfurl as the generic
// `/events` page. It 404s on an unknown id, builds a noindex `seo` whose canonical points at
// `/events` (a canonical cannot carry a fragment), and hands the page its scroll target. It 404s
// only on a genuinely absent row; a failed database read is a 503 with a `Retry-After` instead.
// The
// unfurl itself still has to look like the real event, since that is the whole point of sharing
// the link: the description prefers the row's own `short_description`, falling back to the first
// ~160 characters of its `long_description` (`deriveExcerpt`, the same plain-text markdown strip
// `/posts` uses for its own og:description) and then the site default, and the image is the row's
// resolved hero photo, made absolute the same way a content entry's own hero does
// (`resolveImageUrl` against the public origin), or omitted entirely for a row with none.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildSeoMeta, deriveExcerpt, resolveImageUrl } from '@glw907/cairn-cms/delivery';
import { ORIGIN, SITE_DESCRIPTION } from '$chassis/content';
import { publicMediaResolver, siteConfig } from '$theme/cairn.config';
import { resolveEventImageUrl } from '$theme/event-images';
import { readEventRow } from '$theme/events-data';

export const prerender = false;

export const load: PageServerLoad = async ({ params, platform, setHeaders }) => {
  const db = platform?.env.CLUB_DB;
  if (!db) error(503, 'Events are not available right now.');

  // A row the database could not be read for is a 503 with a Retry-After, never the 404 an
  // absent row gets: telling a crawler that a live event is gone because D1 hiccuped would drop
  // a real URL out of the index over a transient failure.
  const read = await readEventRow(db, params.id);
  if (read.status === 'failed') {
    setHeaders({ 'retry-after': '60' });
    error(503, 'Events are not available right now.');
  }
  if (read.status === 'absent') error(404, 'No such event.');
  const row = read.row;

  // An hour: this stub is a link-preview carrier whose only moving part is the row's own title
  // and description, and an unfurler re-fetches it far more often than a reader does.
  setHeaders({ 'cache-control': 'public, max-age=3600' });

  // The id is already a slug-shaped segment on every real row, but it arrives from the URL, so
  // it is encoded on the way back into one rather than trusted to be fragment-safe.
  const target = `/events#${encodeURIComponent(params.id)}`;
  const description =
    deriveExcerpt(row.long_description ?? '', {
      description: row.short_description ?? undefined,
      maxChars: 160,
    }) || SITE_DESCRIPTION;

  // `PUBLIC_ORIGIN` (never a request header, per that binding's own doc comment in
  // src/jobs/registry.ts), falling back to the chassis constant: a canonical and an og:image are
  // read by machines long after the request that minted them.
  const origin = platform?.env.PUBLIC_ORIGIN ?? ORIGIN;
  const relativeImageUrl = resolveEventImageUrl(row.hero_image, publicMediaResolver);
  const image = relativeImageUrl ? resolveImageUrl(relativeImageUrl, origin) : undefined;

  return {
    title: row.title,
    target,
    seo: buildSeoMeta({
      title: row.title,
      description,
      canonicalUrl: `${origin}/events`,
      siteName: siteConfig.siteName,
      robots: 'noindex',
      ...(image ? { image, imageAlt: row.hero_image_alt ?? row.title } : {}),
    }),
  };
};
