import { describe, expect, it } from 'vitest';
import { createRenderer } from '@glw907/cairn-cms';
import { ascRegistry } from '$theme/markdown/components';

const { renderMarkdown } = createRenderer(ascRegistry);

describe(':::related cross-reference block', () => {
  it('renders a hairline block with a Related eyebrow and a link item with a note', async () => {
    const md = ['::::related', ':::ref[Moorings]{href="/moorings/"}', 'Waitlist and cost.', ':::', '::::'].join(
      '\n',
    );
    const html = await renderMarkdown(md);
    expect(html).toContain('class="asc-related"');
    expect(html).toContain('class="asc-related-eyebrow"');
    expect(html).toContain('Related');
    expect(html).toContain('class="asc-related-item"');
    expect(html).toContain('<a href="/moorings/">Moorings');
    expect(html).toContain('class="asc-related-note"');
    expect(html).toContain('Waitlist and cost.');
  });

  it('appends an aria-hidden arrow span inside the anchor, in place of the old CSS ::after arrow (a11y S1)', async () => {
    const md = ['::::related', ':::ref[Moorings]{href="/moorings/"}', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain(
      '<a href="/moorings/">Moorings<span class="asc-related-arrow" aria-hidden="true"> →</span></a>',
    );
  });

  it('renders an item with no note and no leaked note markup', async () => {
    const md = ['::::related', ':::ref[Join]{href="/join/"}', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="/join/">Join');
    expect(html).not.toContain('asc-related-note');
  });

  it('passes an in-page anchor href through unchanged', async () => {
    const md = ['::::related', ':::ref[Report an issue]{href="#report-an-issue"}', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="#report-an-issue">Report an issue');
  });

  it('passes a full external URL href through unchanged', async () => {
    const md = ['::::related', ':::ref[MembershipWorks]{href="https://example.com/join"}', ':::', '::::'].join(
      '\n',
    );
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="https://example.com/join">MembershipWorks');
  });

  it('renders multiple items in authored order', async () => {
    const md = [
      '::::related',
      ':::ref[Moorings]{href="/moorings/"}',
      ':::',
      ':::ref[Join]{href="/join/"}',
      ':::',
      '::::',
    ].join('\n');
    const html = await renderMarkdown(md);
    const mooringsIndex = html.indexOf('/moorings/');
    const joinIndex = html.indexOf('/join/');
    expect(mooringsIndex).toBeGreaterThan(-1);
    expect(joinIndex).toBeGreaterThan(-1);
    expect(mooringsIndex).toBeLessThan(joinIndex);
    expect((html.match(/class="asc-related-item"/g) ?? []).length).toBe(2);
  });
});
