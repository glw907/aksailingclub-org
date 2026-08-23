// The retired Events detail route (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`; hardened in the reviewer fan-out fix round). This route has no
// `+page.svelte` of its own -- the full edit now happens in place on the ledger
// (`/admin/club/events`, `EventRowForm.svelte`) -- so `load` must always end in a `redirect`;
// there is no fallback page to fall through to if it does not. `requireAccess`, not
// `requireSession`: this route sits under the same `/admin/club` access-map prefix every other
// Club screen checks (`/admin/club/+layout.server.ts`'s own call, mirrored here), so a signed-in
// editor the map does not admit for Club still gets refused here rather than being allowed only
// because this particular route happened to check session alone. `302` (Found), not `308`
// (Permanent Redirect): the target is DB-derived (the row's own current season), not a fixed
// rename, so a client or intermediary must not cache this redirect as permanent.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAccess } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { getEvent } from '$admin-club/lib/events-store';

export const load: PageServerLoad = async (event) => {
  requireAccess(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) redirect(302, '/admin/club/events');
  const row = await getEvent(db, event.params.id);
  if (!row) redirect(302, '/admin/club/events');
  redirect(302, `/admin/club/events?season=${row.season}&open=${encodeURIComponent(row.id)}`);
};
