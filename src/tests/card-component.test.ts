import { describe, expect, it } from 'vitest';
import { createRenderer } from '@glw907/cairn-cms';
import { ascRegistry } from '$theme/markdown/components';

const { renderMarkdown } = createRenderer(ascRegistry);

describe(':::cards / :::card grid', () => {
  it('rides the arrow inline inside the title, as an aria-hidden trailing span (basic-polish batch 1)', async () => {
    const md = [
      '::::cards',
      ':::card[Join the Club]{href="/join/"}',
      'Membership and dues.',
      ':::',
      '::::',
    ].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain(
      '<span class="asc-card-title">Join the Club<span class="asc-card-arrow" aria-hidden="true"> →</span></span>',
    );
    // No standalone block-level arrow element sits outside the title span.
    expect(html).not.toMatch(/<\/div>\s*<span class="asc-card-arrow"/);
  });

  it('renders no arrow on a static feature card with no href', async () => {
    const md = ['::::cards', ':::card[Fleet]{icon="compass"}', 'Our boats.', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).not.toContain('asc-card-arrow');
  });

  // Round 2 anatomy (Geoff, 2026-07-16: "this card idiom is a problem in all cases, and the
  // component needs a redesign"): the icon sits in its own leading column, never inline with the
  // title, and the title/description share one text column.
  it('puts the icon in its own leading column, never inline with the title', async () => {
    const md = ['::::cards', ':::card[Fleet]{icon="compass" href="/fleet/"}', 'Our boats.', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('<span class="asc-card-icon">');
    // The title span holds only the title text and its trailing arrow, never the icon.
    expect(html).not.toMatch(/<span class="asc-card-title">[^<]*<span class="asc-card-icon">/);
    // The title and its description sit together in one text column, description below title.
    expect(html).toMatch(
      /<div class="asc-card-text"><span class="asc-card-title">Fleet<span class="asc-card-arrow"[^>]*> →<\/span><\/span><div class="asc-card-body">/,
    );
  });

  it('emits no icon column at all on an icon-less card', async () => {
    const md = ['::::cards', ':::card[Fleet]{href="/fleet/"}', 'Our boats.', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).not.toContain('asc-card-icon');
  });

  // The count-aware lattice: buildCards stamps `asc-cards-N` off its own child count so
  // asc-components.css can rule each count's own grid (2-up, 3-up, 2x2, 3x2).
  it.each([1, 2, 3, 4, 5, 6])('stamps asc-cards-%i for a %i-card grid', async (count) => {
    const cards = Array.from({ length: count }, (_, i) => `:::card[Card ${i}]\nBody.\n:::`).join('\n');
    const md = ['::::cards', cards, '::::'].join('\n');
    const html = await renderMarkdown(md);
    // Rendered as an attribute-list prefix (cairn's own render pipeline can append further
    // attributes, e.g. the admin overlay's `data-rise`), so this matches the class list itself
    // rather than asserting the whole opening tag verbatim.
    expect(html).toMatch(new RegExp(`<div class="asc-cards asc-cards-${count}"`));
  });

  it('falls back to the plain auto-fill grid past the observed 1-6 count range', async () => {
    const cards = Array.from({ length: 7 }, (_, i) => `:::card[Card ${i}]\nBody.\n:::`).join('\n');
    const md = ['::::cards', cards, '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toMatch(/<div class="asc-cards"/);
    expect(html).not.toContain('asc-cards-7');
  });
});
