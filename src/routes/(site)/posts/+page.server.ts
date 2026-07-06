import type { PageServerLoad } from './$types';
import { buildSeoMeta } from '@glw907/cairn-cms/delivery';
import { posts, ORIGIN } from '$chassis/content';
import { siteConfig } from '$theme/cairn.config';

// The public news archive (Task 3): the home page's "View all news" link, and the migrated
// welcome-new-website post's own historical link, both point here. Task 2's content-migration
// finding recorded this as a real, missing feature (cairn's site resolver enumerates per-entry
// permalinks only, never a concept-level index route); this is that small, theme-owned companion
// page, grouped by year like the live site's own archive.
export const prerender = true;

export const load: PageServerLoad = () => {
  const byYear = new Map<string, ReturnType<typeof posts.all>>();
  for (const entry of posts.all()) {
    const year = entry.date?.slice(0, 4) ?? 'Undated';
    const group = byYear.get(year) ?? [];
    group.push(entry);
    byYear.set(year, group);
  }
  return {
    years: [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    seo: buildSeoMeta({
      title: 'News',
      description: `Every news post, race recap, and update from ${siteConfig.siteName}.`,
      canonicalUrl: `${ORIGIN}/posts/`,
      siteName: siteConfig.siteName,
    }),
  };
};
