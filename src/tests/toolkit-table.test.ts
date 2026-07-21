import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import ExpandableRow from '$admin-club/toolkit/ExpandableRow.svelte';

/** A snippet with no render-time params, e.g. a header row or a fixed body. */
function staticSnippet(html: string) {
  return createRawSnippet(() => ({ render: () => html }));
}

// AdminTable itself graduated to `@glw907/cairn-cms/admin-toolkit` in cairn 0.89.0 (Classes pass
// Task 2); its own contract tests live in cairn-cms's suite now. ExpandableRow stays local (see
// this repo's toolkit README), so its tests stay here.
describe('ExpandableRow', () => {
  const summary = staticSnippet('<td>Alvarez</td><td>Current</td>');
  // Svelte's generated type for a generic component (`generics="T"`) resolves T to `unknown`
  // when the component is referenced from a .ts test file rather than a .svelte template (the
  // compiler infers T from bound props only inside a template); the datum shape is cast back at
  // the one point this test needs it, mirroring how the component's own consumer narrows it.
  const panel = createRawSnippet<[unknown]>((getDatum) => ({
    render: () => `<p>Panel for ${(getDatum() as { name: string }).name}</p>`,
  }));

  it('renders the collapsed state with aria-expanded=false and no panel row', () => {
    const { body } = render(ExpandableRow, {
      props: {
        expanded: false,
        onToggle: () => {},
        datum: { name: 'Alvarez' },
        colspan: 3,
        summary,
        panel,
        triggerLabel: 'Expand the Alvarez household',
      },
    });
    expect(body).toContain('aria-expanded="false"');
    expect(body).toContain('aria-label="Expand the Alvarez household"');
    expect(body).not.toContain('Panel for Alvarez');
    expect(body).toContain('▸');
  });

  it('renders the expanded state with aria-expanded=true and the panel row carrying the datum and colspan', () => {
    const { body } = render(ExpandableRow, {
      props: {
        expanded: true,
        onToggle: () => {},
        datum: { name: 'Alvarez' },
        colspan: 3,
        summary,
        panel,
        triggerLabel: 'Collapse the Alvarez household',
      },
    });
    expect(body).toContain('aria-expanded="true"');
    expect(body).toContain('colspan="3"');
    expect(body).toContain('Panel for Alvarez');
    expect(body).toContain('▾');
  });

  it('renders the summary cells inside the summary row regardless of expanded state', () => {
    const { body } = render(ExpandableRow, {
      props: {
        expanded: false,
        onToggle: () => {},
        datum: { name: 'Alvarez' },
        colspan: 3,
        summary,
        panel,
        triggerLabel: 'Expand the Alvarez household',
      },
    });
    expect(body).toContain('<td>Alvarez</td><td>Current</td>');
  });

  it('uses a real button as the trigger control, so Enter/Space activation is native rather than reimplemented', () => {
    const { body } = render(ExpandableRow, {
      props: {
        expanded: false,
        onToggle: () => {},
        datum: { name: 'Alvarez' },
        colspan: 3,
        summary,
        panel,
        triggerLabel: 'Expand the Alvarez household',
      },
    });
    expect(body).toMatch(/<button[^>]*aria-expanded="false"[^>]*>/);
  });
});
