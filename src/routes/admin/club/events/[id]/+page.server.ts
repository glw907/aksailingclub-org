// The retired Events detail route (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`): the full edit now happens in place on the ledger
// (`/admin/club/events`, `EventRowForm.svelte`), so this route carries no page and no actions of
// its own -- only a `load` that redirects a bookmarked or linked `[id]` URL to the ledger with
// that row's season selected and its panel opened, so an old link still lands somewhere useful.
// `308` (Permanent Redirect) rather than `303`: this is a URL that has permanently moved, not a
// post/redirect/get response to a write.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { getEvent } from '$admin-club/lib/events-store';

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  if (!db) redirect(308, '/admin/club/events');
  const row = await getEvent(db, event.params.id);
  if (!row) redirect(308, '/admin/club/events');
  redirect(308, `/admin/club/events?season=${row.season}&open=${row.id}`);
};
