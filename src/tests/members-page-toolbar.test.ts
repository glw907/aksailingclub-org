// The Members-refinement-round-1 settle's three page-level UI changes (V2/V3, the archived
// facet), guarded at the render level since this screen carries no Playwright e2e coverage (the
// admin surface stays out of the pixel-diff visual suite per e2e/admin-login.spec.ts's own
// header) and the prior filter-select/autofocus/toolbar-band markup this settle replaced was
// never asserted anywhere else. Mirrors `toolkit-table.test.ts`'s own `render` idiom: a static
// SSR render is enough to check markup shape, since none of the three claims below need
// hydration or interaction.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../routes/admin/club/members/+page.svelte';
import type { PageData } from '../routes/admin/club/members/$types';

const data: PageData = {
  shell: { public: true, siteName: 'ASC', theme: 'cairn-admin' },
  households: [],
  classOptions: [],
  search: '',
  standing: 'members',
  holdings: 'all',
  role: 'all',
  classId: 'all',
  includeArchived: false,
  error: null,
};

describe('/admin/club/members screen (refinement-round-1 markup)', () => {
  it('never renders an autofocus attribute (V3: the search box no longer autofocuses)', () => {
    const { body } = render(Page, { props: { data, form: null } });
    expect(body).not.toMatch(/\bautofocus\b/);
  });

  it("renders 'Add household' inside the header, ahead of the toolbar's search box (V2: the header action slot)", () => {
    const { body } = render(Page, { props: { data, form: null } });
    const headerActionIndex = body.indexOf('Add household');
    const toolbarSearchIndex = body.indexOf('Search by name, standing, or phone');
    expect(headerActionIndex).toBeGreaterThan(-1);
    expect(toolbarSearchIndex).toBeGreaterThan(-1);
    expect(headerActionIndex).toBeLessThan(toolbarSearchIndex);
  });

  it('renders the archived filter as a menu facet, not a fifth <select> (the settle folds it into `filters`)', () => {
    const { body } = render(Page, { props: { data, form: null } });
    expect(body).toContain('toolkit-toolbar-facet');
    // Standing, Holdings, Role, Class stay `<select>`s; Archived does not add a fifth.
    expect(body.match(/<select\b/g) ?? []).toHaveLength(4);
  });
});
