// Role-dependent collapsed defaults for the admin sidebar (pass-B sidebar-build T6, T1 probe
// verdict #2, docs/design-benchmark/decisions.md "Admin sidebar round 2"). `NavLayoutSection.
// collapsed` in cairn.config.ts is one static declaration, but the ratified defaults are
// per-role: Administrator/Club manager open Club and Communication, Publisher opens
// Communication alone, Webmaster opens Communication and Website. cairn's escape hatch for a
// per-request rewrite is `navFilter` (wired in src/chassis/cairn.server.ts), so this module is a
// small pure function over `navFilter`'s own `items` shape: it only rewrites `collapsed` on the
// sections that survive the map's own visibility filtering, never adds or removes an item. The
// per-user `cairn-admin-nav-collapsed` cookie still wins once a visitor's first toggle sets it
// (cairn-cms's own shell behavior, untouched here).
import type { Role } from '@glw907/cairn-cms';
import type { ResolvedLayoutNode, ResolvedLayoutSection } from '@glw907/cairn-cms/sveltekit';

/** The group labels a role starts with open, keyed by the exact `NavLayoutSection.label` string
 *  cairn.config.ts declares. A role with no entry here (Instructor, the phantom `owner`, or any
 *  future role) is left alone: its sections keep the declared static defaults exactly. */
const OPEN_GROUPS_BY_ROLE: Partial<Record<Role, readonly string[]>> = {
  Administrator: ['Club', 'Communication'],
  'Club manager': ['Club', 'Communication'],
  Webmaster: ['Communication', 'Website'],
  Publisher: ['Communication'],
};

/** True for a resolved top-level node that is a named section (carries `children`) rather than a
 *  loose top-level entry or engine reference. */
function isSection(item: ResolvedLayoutNode): item is ResolvedLayoutSection {
  return 'children' in item;
}

/**
 * Rewrite each surviving section's `collapsed` flag for one session's role. Never filters an item
 * out (a section the role cannot see is already dropped by `resolveNavLayout` before this runs);
 * it only sets `collapsed: false` for the role's open groups and `collapsed: true` for every other
 * section still present. A role absent from {@link OPEN_GROUPS_BY_ROLE} returns `items` unchanged.
 */
export function applyNavDefaults(items: ResolvedLayoutNode[], role: Role): ResolvedLayoutNode[] {
  const openGroups = OPEN_GROUPS_BY_ROLE[role];
  if (!openGroups) {
    return items;
  }
  return items.map((item) => (isSection(item) ? { ...item, collapsed: !openGroups.includes(item.label) } : item));
}
