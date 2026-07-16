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
});
