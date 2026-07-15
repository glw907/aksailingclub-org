import { describe, expect, it } from 'vitest';
import { createRenderer } from '@glw907/cairn-cms';
import { ascRegistry } from '$theme/markdown/components';

const { renderMarkdown } = createRenderer(ascRegistry);

describe(':::facts key-facts component', () => {
  it('renders a semantic dl containing a dt label and a dd value', async () => {
    const md = ['::::facts', ':::fact[Cost]', '$50 per season.', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('class="asc-facts"');
    expect(html).toContain('<dl');
    expect(html).toContain('<dt class="asc-fact-label">Cost</dt>');
    expect(html).toContain('<dd class="asc-fact-value">');
    expect(html).toContain('$50 per season.');
  });

  it('renders the label slot text exactly as authored', async () => {
    const md = ['::::facts', ':::fact[Boat size]', 'Up to 26 feet.', ':::', '::::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('<dt class="asc-fact-label">Boat size</dt>');
  });

  it('renders a markdown value slot with a link and inline code', async () => {
    const md = [
      '::::facts',
      ':::fact[Waitlist]',
      'See the [mooring waitlist](/moorings/) and email `moorings@aksailingclub.org`.',
      ':::',
      '::::',
    ].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="/moorings/">mooring waitlist</a>');
    expect(html).toContain('<code>moorings@aksailingclub.org</code>');
  });

  it('renders multiple fact rows in authored order', async () => {
    const md = [
      '::::facts',
      ':::fact[Cost]',
      '$50 per season.',
      ':::',
      ':::fact[Eligibility]',
      'Active Participating Members.',
      ':::',
      '::::',
    ].join('\n');
    const html = await renderMarkdown(md);
    const costIndex = html.indexOf('Cost</dt>');
    const eligibilityIndex = html.indexOf('Eligibility</dt>');
    expect(costIndex).toBeGreaterThan(-1);
    expect(eligibilityIndex).toBeGreaterThan(-1);
    expect(costIndex).toBeLessThan(eligibilityIndex);
    expect((html.match(/<dt class="asc-fact-label">/g) ?? []).length).toBe(2);
    expect((html.match(/<dd class="asc-fact-value">/g) ?? []).length).toBe(2);
  });
});
