// Pass-B sidebar-build T6: proves the ratified four-group navLayout tree
// (docs/plans/2026-07-19-asc-sidebar-build.md, icons/order/defaults settled by the T1 probe
// round, docs/design-benchmark/decisions.md "Admin sidebar round 2") through cairn's own
// resolveNavLayout, the same primitive the admin shell resolves a request's sidebar with, and the
// real `access` map (not a hand table -- `roles-matrix.test.ts` already drift-guards the map
// itself; this file proves the tree renders correctly *against* it).
import { describe, expect, it } from 'vitest';
import { resolveNavLayout, type ResolvedLayoutChild, type ResolvedLayoutNode, type ResolvedLayoutSection } from '@glw907/cairn-cms/sveltekit';
import type { Role } from '@glw907/cairn-cms';
import { access, navLayout } from '$theme/cairn.config.js';
import { applyNavDefaults } from '$theme/nav-defaults.js';
import { editorWithRole } from './_editor';

/** The context resolveNavLayout needs beyond the tree itself, matching the site's real concepts
 *  and configured nav menu so the resolved tree matches what the real admin build renders.
 *  `label` on each concept stub is chosen to equal the real `cairn.config.ts` concept label,
 *  since an engine ref with no relabel falls back to `concept.label` -- these are not arbitrary
 *  test fixtures, they pin the exact string the unlabeled Posts/Pages/Bulletins/Fragments doors
 *  resolve to. */
function opts(role: Role) {
  return {
    layout: navLayout,
    adminNav: [],
    concepts: [
      { id: 'posts', label: 'Posts', routing: { dated: true } },
      { id: 'pages', label: 'Pages', routing: { dated: false } },
      { id: 'bulletins', label: 'Bulletins', routing: { dated: true } },
      { id: 'fragments', label: 'Fragments', routing: { dated: false } },
      { id: 'documents', label: 'Signable documents', routing: { dated: false } },
    ],
    navMenuLabel: 'Navigation',
    access,
    editor: editorWithRole(role),
  };
}

function sectionLabels(items: ReturnType<typeof resolveNavLayout>['items']): string[] {
  return items.map((item) => item.label);
}

function isSection(item: ResolvedLayoutNode): item is ResolvedLayoutSection {
  return 'children' in item;
}

function findSection(items: ResolvedLayoutNode[], label: string): ResolvedLayoutSection {
  const section = items.find((item) => item.label === label);
  if (!section || !isSection(section)) {
    throw new Error(`expected a "${label}" section in the resolved tree`);
  }
  return section;
}

function childLabels(section: ResolvedLayoutSection): string[] {
  return section.children.map((child) => child.label);
}

function childHrefs(section: ResolvedLayoutSection): string[] {
  return section.children.map((child) => child.href);
}

// The engine's own default glyph for a screen an override never touches, sourced from the
// installed package's internal (unexported) tables -- `dist/components/admin-nav-icons.js`'s
// `ENGINE_NAV_ICONS`/`ENGINE_CONCEPT_DATED_ICON`/`ENGINE_NAV_FALLBACK_ICON`, and the exact
// selection order `dist/components/CairnAdminShell.svelte` applies them in (an override's
// `iconName` first, then the screen-keyed engine table, then the dated/undated fallback). Neither
// entrypoint is re-exported through `@glw907/cairn-cms`'s public surface, so this is a small,
// version-pinned local mirror rather than a live import; it only needs to cover the screens this
// tree references with no icon override.
const ENGINE_DEFAULT_ICON: Partial<Record<string, string>> = {
  media: 'image',
  fragments: 'layers',
  settings: 'settings',
  help: 'circle-help',
};
const ENGINE_DATED_DEFAULT_ICON = 'newspaper';

/** The glyph a resolved child actually renders, site entry or engine reference alike. */
function effectiveIcon(child: ResolvedLayoutChild): string {
  if (!('screen' in child)) {
    return child.iconName;
  }
  if (child.iconName) {
    return child.iconName;
  }
  return ENGINE_DEFAULT_ICON[child.screen] ?? (child.dated ? ENGINE_DATED_DEFAULT_ICON : 'file-text');
}

function flattenChildren(nodes: ResolvedLayoutNode[]): ResolvedLayoutChild[] {
  return nodes.flatMap((node) => (isSection(node) ? node.children : [node]));
}

describe('the ratified navLayout tree', () => {
  it('resolves the four groups, in order, for an Administrator', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    expect(sectionLabels(resolved.items)).toEqual(['Club', 'Events & Classes', 'Communication', 'Website']);
  });

  it('orders the Club group as ratified', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    const club = findSection(resolved.items, 'Club');
    expect(childLabels(club)).toEqual([
      'Overview',
      'Members',
      'Committees',
      'Assets',
      'Asset requests',
      'Money',
      'Waivers',
      'Club settings',
      'Admin access',
    ]);
    expect(childHrefs(club)).toEqual([
      '/admin/club',
      '/admin/club/members',
      '/admin/club/committees',
      '/admin/club/assets',
      '/admin/club/asset-requests',
      '/admin/club/money',
      '/admin/club/documents',
      '/admin/club/settings',
      '/admin/editors',
    ]);
  });

  it('orders the Events & Classes group as ratified', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    const group = findSection(resolved.items, 'Events & Classes');
    expect(childLabels(group)).toEqual(['Events', 'Classes', 'Class waitlist', 'Email class members']);
    expect(childHrefs(group)).toEqual([
      '/admin/club/events',
      '/admin/club/classes',
      '/admin/club/classes/waitlist',
      '/admin/club/email/compose?segment=class',
    ]);
  });

  it('orders the Communication group as ratified, Posts and Bulletins unlabeled', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    const group = findSection(resolved.items, 'Communication');
    expect(childLabels(group)).toEqual(['Posts', 'Bulletins', 'Email', 'Announce']);
    expect(childHrefs(group)).toEqual(['/admin/posts', '/admin/bulletins', '/admin/club/email', '/admin/club/announce']);
  });

  it('orders the Website group as ratified, only the true relabels declared', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    const group = findSection(resolved.items, 'Website');
    // Pages/Fragments carry the concept's own label (no relabel needed); Media and Nav resolve to
    // the engine's own default label ("Library", the configured nav-menu label) since neither is
    // a true relabel either -- verified against the installed package, not assumed.
    expect(childLabels(group)).toEqual(['Pages', 'Library', 'Fragments', 'Tags', 'Navigation', 'Waiver text', 'Website settings']);
    expect(childHrefs(group)).toEqual([
      '/admin/pages',
      '/admin/media',
      '/admin/fragments',
      '/admin/vocabulary',
      '/admin/nav',
      '/admin/documents',
      '/admin/settings',
    ]);
  });

  it('leaves the fallback foot holding only the deliberately unreferenced Help screen', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    expect(resolved.fallback.map((child) => child.label)).toEqual(['Help']);
    expect(sectionLabels(resolved.items).every((label) => label !== 'Help')).toBe(true);
    for (const item of resolved.items) {
      if (isSection(item)) {
        expect(childLabels(item)).not.toContain('Help');
      }
    }
  });

  it('carries no repeated glyph across the resolved tree and the Help foot (24 items + Help = 25 distinct icons)', () => {
    const resolved = resolveNavLayout(opts('Administrator'));
    const icons = [...flattenChildren(resolved.items).map(effectiveIcon), ...resolved.fallback.map(effectiveIcon)];
    expect(icons).toHaveLength(25);
    expect(new Set(icons).size).toBe(25);
  });

  it('gates Waiver text (the documents concept, legal text) to Administrator/Club manager, unlike the Waivers rollup', () => {
    const admin = findSection(resolveNavLayout(opts('Administrator')).items, 'Website');
    expect(childLabels(admin)).toContain('Waiver text');
    const webmaster = resolveNavLayout(opts('Webmaster')).items;
    // Webmaster reaches Website (below) but not the Waiver text door inside it -- the map's own
    // documents carve-out (access.ts), not this tree, is what denies it.
    const webmasterWebsite = findSection(webmaster, 'Website');
    expect(childLabels(webmasterWebsite)).not.toContain('Waiver text');
  });
});

// Two access-map facts, both pre-existing and neither introduced by this task, surface once a
// per-role test actually walks the resolved tree instead of only checking Communication/Website
// in isolation (a finding worth flagging, not silently working around, since the T6 dispatch's
// own assertion list assumed neither):
//
// 1. Publisher and Webmaster both reach exactly one Events & Classes entry. T5's "Email class
//    members" deep link (`/admin/club/email/compose?segment=class`) inherits the plain Email
//    entry's `/admin/club/email` map coverage by deepest-prefix match (T5's own header comment;
//    T5 deliberately added no new map key for it, and this task's own Webmaster widening adds
//    `/admin/club/email` to Webmaster's grants too), so both roles that reach Email also reach
//    this one Events & Classes door.
// 2. Publisher also reaches Website, holding exactly one child: Library (the `media` screen).
//    Pass A's map already admits Publisher to `media` (the "media-picker landmine": Publisher
//    edits `posts`, an image-bearing concept, so its own image picker needs `media` reachable --
//    access.ts's own comment). The round-1 tree carried the same grant under its "Site" label; no
//    prior test walked a per-role resolved tree to surface it as a visible group membership.
//
// Neither is a new map entry (both instructions -- T5's and this task's own Webmaster widening --
// said "no new map entry beyond compose's/the Communication set's own coverage"), so the tree and
// the map stay exactly as declared above; the tests below assert the real resolved shape rather
// than the dispatch's un-verified assumption.
describe('role-scoped visibility, driven by the real access map, not roles: gates on the tree', () => {
  it('Webmaster resolves the whole Communication and Website groups, plus one inherited Events & Classes entry -- no Club', () => {
    const resolved = resolveNavLayout(opts('Webmaster'));
    expect(sectionLabels(resolved.items)).toEqual(['Events & Classes', 'Communication', 'Website']);
    expect(childLabels(findSection(resolved.items, 'Events & Classes'))).toEqual(['Email class members']);
    expect(childLabels(findSection(resolved.items, 'Communication'))).toEqual(['Posts', 'Bulletins', 'Email', 'Announce']);
    expect(childLabels(findSection(resolved.items, 'Website'))).toEqual(['Pages', 'Library', 'Fragments', 'Tags', 'Navigation', 'Website settings']);
  });

  it('Publisher resolves Communication in full, one inherited Events & Classes entry, Website narrowed to Library alone -- no Club', () => {
    const resolved = resolveNavLayout(opts('Publisher'));
    expect(sectionLabels(resolved.items)).toEqual(['Events & Classes', 'Communication', 'Website']);
    expect(childLabels(findSection(resolved.items, 'Events & Classes'))).toEqual(['Email class members']);
    expect(childLabels(findSection(resolved.items, 'Communication'))).toEqual(['Posts', 'Bulletins', 'Email', 'Announce']);
    expect(childLabels(findSection(resolved.items, 'Website'))).toEqual(['Library']);
  });

  it('Instructor resolves no club groups (none capability)', () => {
    const resolved = resolveNavLayout(opts('Instructor'));
    expect(resolved.items).toEqual([]);
  });

  it('the phantom owner role resolves every group (owner-capability bypass, lockout safety)', () => {
    const resolved = resolveNavLayout(opts('owner'));
    expect(sectionLabels(resolved.items)).toEqual(['Club', 'Events & Classes', 'Communication', 'Website']);
  });
});

describe('applyNavDefaults: the role-dependent collapsed defaults (navFilter seam)', () => {
  function collapsedByLabel(items: ResolvedLayoutNode[]): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const item of items) {
      if (isSection(item)) {
        out[item.label] = item.collapsed === true;
      }
    }
    return out;
  }

  it('Administrator and Club manager open Club and Communication, Events & Classes and Website stay collapsed', () => {
    for (const role of ['Administrator', 'Club manager'] as const) {
      const resolved = resolveNavLayout(opts(role));
      const collapsed = collapsedByLabel(applyNavDefaults(resolved.items, role));
      expect(collapsed).toEqual({ Club: false, 'Events & Classes': true, Communication: false, Website: true });
    }
  });

  it('Publisher opens only Communication; Events & Classes and its narrowed Website stay collapsed (declared defaults, no override for either)', () => {
    const resolved = resolveNavLayout(opts('Publisher'));
    const collapsed = collapsedByLabel(applyNavDefaults(resolved.items, 'Publisher'));
    expect(collapsed).toEqual({ 'Events & Classes': true, Communication: false, Website: true });
    expect(collapsed.Club).toBeUndefined();
  });

  it('Webmaster opens both Communication and Website; the inherited Events & Classes entry stays collapsed (no override for it)', () => {
    const resolved = resolveNavLayout(opts('Webmaster'));
    const collapsed = collapsedByLabel(applyNavDefaults(resolved.items, 'Webmaster'));
    expect(collapsed).toEqual({ 'Events & Classes': true, Communication: false, Website: false });
    expect(collapsed.Club).toBeUndefined();
  });

  it('leaves an unrecognized role\'s items unchanged (Instructor, the phantom owner)', () => {
    const ownerResolved = resolveNavLayout(opts('owner'));
    expect(applyNavDefaults(ownerResolved.items, 'owner')).toEqual(ownerResolved.items);
  });
});
