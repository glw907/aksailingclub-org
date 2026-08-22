import { describe, it, expect } from 'vitest';
import type { SeoMeta } from '@glw907/cairn-cms/delivery';
import { previewSafeSeo } from '$theme/preview-seo';

const seo: SeoMeta = {
  title: 'Racing',
  meta: [
    { name: 'description', content: 'A description.' },
    { property: 'og:title', content: 'Racing' },
    { property: 'og:url', content: 'https://dev.aksailingclub.org/racing' },
    { name: 'twitter:card', content: 'summary' },
  ],
  links: [
    { rel: 'canonical', href: 'https://dev.aksailingclub.org/racing' },
    { rel: 'alternate', type: 'application/rss+xml', href: 'https://dev.aksailingclub.org/feed.xml' },
  ],
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Alaska Sailing Club',
    url: 'https://dev.aksailingclub.org/racing',
  },
};

describe('previewSafeSeo', () => {
  it('removes the canonical link', () => {
    const result = previewSafeSeo(seo);
    expect(result.links.some((l) => l.rel === 'canonical')).toBe(false);
  });

  it('removes the og:url meta tag', () => {
    const result = previewSafeSeo(seo);
    expect(result.meta.some((m) => m.property === 'og:url')).toBe(false);
  });

  it('removes jsonLd.url', () => {
    const result = previewSafeSeo(seo);
    expect(result.jsonLd.url).toBeUndefined();
  });

  it('leaves title, description, and every other tag untouched', () => {
    const result = previewSafeSeo(seo);
    expect(result.title).toBe('Racing');
    expect(result.meta).toContainEqual({ name: 'description', content: 'A description.' });
    expect(result.meta).toContainEqual({ property: 'og:title', content: 'Racing' });
    expect(result.meta).toContainEqual({ name: 'twitter:card', content: 'summary' });
    expect(result.links.some((l) => l.rel === 'alternate')).toBe(true);
    expect(result.jsonLd['@type']).toBe('WebSite');
    expect(result.jsonLd.name).toBe('Alaska Sailing Club');
  });
});
