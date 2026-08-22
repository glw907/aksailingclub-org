// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): `/events/[id]` is no
// longer a page in its own right, since annual recurrence means the real event lives on one long
// season page. This route survives only as a thin link-preview carrier, because a URL fragment
// never reaches the server and a shared `/events#slug` would otherwise unfurl as the generic
// `/events` page. It 404s on an unknown id, builds a noindex `seo` whose canonical points at
// `/events` (a canonical cannot carry a fragment), and hands the page its scroll target.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildSeoMeta } from '@glw907/cairn-cms/delivery';
import { ORIGIN, SITE_DESCRIPTION } from '$chassis/content';
import { siteConfig } from '$theme/cairn.config';
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
  return {
    title: row.title,
    target,
    seo: buildSeoMeta({
      title: row.title,
      description: SITE_DESCRIPTION,
      canonicalUrl: `${ORIGIN}/events`,
      siteName: siteConfig.siteName,
      robots: 'noindex',
    }),
  };
};
