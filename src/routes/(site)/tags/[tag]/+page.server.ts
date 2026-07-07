import { error } from '@sveltejs/kit';
import type { PageServerLoad, EntryGenerator } from './$types';
import { buildSeoMeta } from '@glw907/cairn-cms/delivery';
import { extractVocabulary } from '@glw907/cairn-cms';
import { posts, ORIGIN } from '$chassis/content';
import { siteConfig } from '$theme/cairn.config';

// The Browse-by-Topic destination (completion-pass manifest item 7): one page per vocabulary
// tag, listing every post carrying it. Prerendered like the /posts archive it links from; the
// entry list is the vocabulary itself, not every tag a post happens to carry, so a stray tag
// value with no vocabulary entry never gets its own dead-end static page.
export const prerender = true;

export const entries: EntryGenerator = () => extractVocabulary(siteConfig).map((entry) => ({ tag: entry.value }));

export const load: PageServerLoad = ({ params }) => {
  const topic = extractVocabulary(siteConfig).find((entry) => entry.value === params.tag);
  if (!topic) error(404, `Not found: /tags/${params.tag}`);
  return {
    topic,
    posts: posts.byTag(params.tag),
    seo: buildSeoMeta({
      title: topic.label,
      description: `Every ${topic.label.toLowerCase()} post from ${siteConfig.siteName}.`,
      canonicalUrl: `${ORIGIN}/tags/${topic.value}/`,
      siteName: siteConfig.siteName,
    }),
  };
};
