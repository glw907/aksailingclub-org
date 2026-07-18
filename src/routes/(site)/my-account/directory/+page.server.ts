// /my-account/directory: the members-only directory (the membership pitch's own "Member
// directory and Discord community" line). Read-only: every write this page depends on (a
// member's own listing, or the household primary's listing for anyone in their household) is
// `$member-portal/lib/household.ts`'s existing `setDirectoryVisibility`, reached from
// /my-account/profile and /my-account/household. `entries` is `null` only when `CLUB_DB` itself
// is unavailable (a degraded state, distinct from an empty directory). One row per listed member
// (plan T3's own listing rule), not one card per household.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listDirectory, type DirectoryEntry } from '$member-portal/lib/directory';
import { resolveMemberDb } from '$member-auth/lib/db';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
  const { member } = await event.parent();
  if (!member) redirect(303, '/my-account');

  const db = resolveMemberDb(event.platform?.env);
  const entries: DirectoryEntry[] | null = db ? await listDirectory(db) : null;

  return { entries };
};
