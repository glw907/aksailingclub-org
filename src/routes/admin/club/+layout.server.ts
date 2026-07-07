// The club-role authorization gate for the whole /admin/club/* section (Task 4). The engine's
// own admin guard already resolved `locals.editor`, or redirected to login, before this layout
// load ever runs; `requireSession` here is defense-in-depth, the same pattern every Club screen's
// own load already uses. A club role is a SEPARATE axis from cairn's content role (owner/editor):
// a signed-in editor with no grant in asc-club's `club_roles` table gets a clean 403, never a
// redirect, since they ARE signed in, just not into this section.
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { getClubRole, resolveClubDb } from '$admin-club/lib/club-roles';

export const load: LayoutServerLoad = async (event) => {
  const editor = requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  const clubRole = db ? await getClubRole(db, editor.email) : null;
  if (!clubRole) {
    error(403, 'Your account has no club role. Ask a club owner to grant one.');
  }
  return { clubRole };
};
