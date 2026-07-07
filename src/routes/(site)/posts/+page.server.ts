import type { PageServerLoad } from './$types';
import { buildSeoMeta } from '@glw907/cairn-cms/delivery';
import { extractVocabulary } from '@glw907/cairn-cms';
import { posts, ORIGIN } from '$chassis/content';
import { siteConfig } from '$theme/cairn.config';

// The public news archive (Task 3): the home page's "View all news" link, and the migrated
// welcome-new-website post's own historical link, both point here. Task 2's content-migration
// finding recorded this as a real, missing feature (cairn's site resolver enumerates per-entry
// permalinks only, never a concept-level index route); this is that small, theme-owned companion
// page, grouped by year like the live site's own archive.
export const prerender = true;

/** One topic in the Browse-by-Topic grid: the vocabulary's display label plus its live post count. */
export interface TopicCount {
  value: string;
  label: string;
  count: number;
}

export const load: PageServerLoad = () => {
  const all = posts.all();
  const byYear = new Map<string, ReturnType<typeof posts.all>>();
  for (const entry of all) {
    const year = entry.date?.slice(0, 4) ?? 'Undated';
    const group = byYear.get(year) ?? [];
    group.push(entry);
    byYear.set(year, group);
  }
  const years = [...byYear.keys()].filter((y) => y !== 'Undated').sort();
  const yearRange = years.length === 0 ? undefined : years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`;

  // The stats bar's "topics" count and the Browse grid both read the site's curated vocabulary
  // (site.config.yaml), not the raw tag set on posts: a post's tags are validated against this
  // same vocabulary at commit time (spec: tag management), so every real tag value already has a
  // matching entry here, and a vocabulary value with zero current posts still belongs in the
  // grid as a real wayfinding destination, not a broken promise of content that never landed.
  const tagCounts = new Map(posts.allTags().map((t) => [t.tag, t.count]));
  const topics: TopicCount[] = extractVocabulary(siteConfig).map((entry) => ({
    value: entry.value,
    label: entry.label,
    count: tagCounts.get(entry.value) ?? 0,
  }));

  return {
    years: [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    stats: { postCount: all.length, topicCount: topics.length, yearRange },
    topics,
    seo: buildSeoMeta({
      title: 'News',
      description: `Every news post, race recap, and update from ${siteConfig.siteName}.`,
      canonicalUrl: `${ORIGIN}/posts/`,
      siteName: siteConfig.siteName,
    }),
  };
};
