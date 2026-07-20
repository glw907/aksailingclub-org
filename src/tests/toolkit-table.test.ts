import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import AdminTable from '$admin-club/toolkit/AdminTable.svelte';
import ExpandableRow from '$admin-club/toolkit/ExpandableRow.svelte';

/** A snippet with no render-time params, e.g. a header row or a fixed body. */
function staticSnippet(html: string) {
  return createRawSnippet(() => ({ render: () => html }));
}

describe('AdminTable', () => {
  it('defaults to the sm density with no zebra stripe', () => {
    const { body } = render(AdminTable, {
      props: {
        header: staticSnippet('<th>Household</th>'),
        children: staticSnippet('<tr><td>Alvarez</td></tr>'),
        rowCount: 1,
      },
    });
    expect(body).toContain('class="table table-sm ');
    expect(body).not.toContain('table-zebra');
  });

  it('switches to the xs density and turns on zebra on request', () => {
    const { body } = render(AdminTable, {
      props: {
        density: 'xs',
        zebra: true,
        header: staticSnippet('<th>Household</th>'),
        children: staticSnippet('<tr><td>Alvarez</td></tr>'),
        rowCount: 1,
      },
    });
    expect(body).toContain('table-xs');
    expect(body).toContain('table-zebra');
  });

  it('renders the header snippet inside the thead and the body snippet inside the tbody', () => {
    const { body } = render(AdminTable, {
      props: {
        header: staticSnippet('<th>Household</th><th>Standing</th>'),
        children: staticSnippet('<tr><td>Alvarez</td><td>Current</td></tr>'),
        rowCount: 1,
      },
    });
    expect(body).toContain('<thead><tr><th>Household</th><th>Standing</th>');
    expect(body).toContain('<tr><td>Alvarez</td><td>Current</td></tr>');
  });

  it('renders the empty-state snippet instead of the body when rowCount is 0', () => {
    const { body } = render(AdminTable, {
      props: {
        header: staticSnippet('<th>Household</th>'),
        children: staticSnippet('<tr><td>Alvarez</td></tr>'),
        rowCount: 0,
        empty: staticSnippet('<p>No households match.</p>'),
        emptyColspan: 4,
      },
    });
    expect(body).not.toContain('Alvarez');
    expect(body).toContain('No households match.');
    expect(body).toContain('colspan="4"');
  });

  it('defaults the empty-state colspan to 100 (HTML clamps it to the real column count)', () => {
    const { body } = render(AdminTable, {
      props: {
        header: staticSnippet('<th>Household</th>'),
        children: staticSnippet(''),
        rowCount: 0,
        empty: staticSnippet('<p>Nothing yet.</p>'),
      },
    });
    expect(body).toContain('colspan="100"');
  });

  it('renders an empty tbody row with no content when rowCount is 0 and no empty snippet is given', () => {
    const { body } = render(AdminTable, {
      props: {
        header: staticSnippet('<th>Household</th>'),
        children: staticSnippet(''),
        rowCount: 0,
      },
    });
    expect(body).toMatch(/<td colspan="100"[^>]*><!--\[-1--><!--\]--><\/td>/);
  });
});

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
