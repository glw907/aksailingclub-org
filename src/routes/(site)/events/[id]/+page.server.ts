// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): `/events/[id]` is no
// longer a page in its own right, since annual recurrence means the real event lives on one long
// season page. This route survives only as a thin link-preview carrier, because a URL fragment
// never reaches the server and a shared `/events#slug` would otherwise unfurl as the generic
// `/events` page. It 404s on an unknown id, builds a noindex `seo` whose canonical points at
// `/events` (a canonical cannot carry a fragment), and hands the page its scroll target. The
// unfurl itself still has to look like the real event, since that is the whole point of sharing
// the link: the description prefers the row's own `short_description`, falling back to the first
// ~160 characters of its `long_description` (`deriveExcerpt`, the same plain-text markdown strip
// `/posts` uses for its own og:description) and then the site default, and the image is the row's
// resolved hero photo, made absolute the same way a content entry's own hero does
// (`resolveImageUrl` against `ORIGIN`), or omitted entirely for a row with none.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildSeoMeta, deriveExcerpt, resolveImageUrl } from '@glw907/cairn-cms/delivery';
import { ORIGIN, SITE_DESCRIPTION } from '$chassis/content';
import { publicMediaResolver, siteConfig } from '$theme/cairn.config';
import { resolveEventImageUrl } from '$theme/event-images';
import { readEventRows } from '$theme/events-data';
import { routeIdOf } from '$theme/season-data';

export const prerender = false;

export const load: PageServerLoad = async ({ params, platform }) => {
  const db = platform?.env.CLUB_DB;
  if (!db) error(503, 'Events are not available right now.');

  const rows = await readEventRows(db);
  const row = rows.find((candidate) => routeIdOf(candidate) === params.id);
  if (!row) error(404, 'No such event.');

  const target = `/events#${params.id}`;
  const description =
    deriveExcerpt(row.long_description ?? '', {
      description: row.short_description ?? undefined,
      maxChars: 160,
    }) || SITE_DESCRIPTION;

  const relativeImageUrl = resolveEventImageUrl(row.hero_image, publicMediaResolver);
  const image = relativeImageUrl ? resolveImageUrl(relativeImageUrl, ORIGIN) : undefined;

  return {
    title: row.title,
    target,
    seo: buildSeoMeta({
      title: row.title,
      description,
      canonicalUrl: `${ORIGIN}/events`,
      siteName: siteConfig.siteName,
      robots: 'noindex',
      ...(image ? { image, imageAlt: row.hero_image_alt ?? row.title } : {}),
    }),
  };
};
