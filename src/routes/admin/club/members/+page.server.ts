// The Club section's Members screen (household-grouped list; Members pass T7 rebuild,
// docs/2026-07-20-members-pass-design.md): reads `listHouseholds` off the live `asc-club`
// CLUB_DB, search/standing/holdings/role/class/archived filtering all happening server-side
// (`households-store.ts`'s own header explains why: a matched member's phone/name never reaches
// the client in a form a client-side re-filter could reproduce, since search highlighting needs
// the server's own `matchedSearch` flag). The `q`/`standing`/`holdings`/`role`/`class`/`archived`
// URL params are that query's own inputs; `+page.svelte` pushes a new URL on every control change
// (`goto`, no full page reload) rather than filtering an already-loaded array. Pagination stays
// client-side over whatever `listHouseholds` already returned (the toolkit's own `Pagination`),
// since it needs no further server knowledge once the filtered set is in hand.
//
// `addHousehold` is the walk-up-join entry point (a household plus its first, primary member),
// landing on the household desk so a manual payment can follow immediately -- ported unchanged
// from the fixture-era screen's own Task 5.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSession } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { clubAdminAction } from '$admin-club/lib/club-action';
import { getCurrentSeason } from '$admin-club/lib/club-settings';
import { listClassesWithCounts } from '$admin-club/lib/classes-store';
import { createHousehold, listHouseholds, type HouseholdListRow } from '$admin-club/lib/households-store';

/** One current-season class the toolbar's own "class" filter offers -- a class with at least one
 *  enrollment (an empty roster has nothing to filter by), current season only (the design spec's
 *  own "class filter is current-season only" ruling, T7's self-review notes). */
export interface MembersClassFilterOption {
  id: string;
  name: string;
}

/** The four values `load` actually ever returns for `standing` -- a narrower type than the store's
 *  own `ListHouseholdsOptions['standing']` (which also allows `'all'`, the Money screen's own
 *  household-picker need, never this screen's), so `+page.svelte`'s own filter state stays typed
 *  to exactly what a URL param here can produce. */
type StandingParam = 'members' | 'current' | 'overdue' | 'former';
type HoldingsParam = 'all' | 'holding';
type RoleParam = 'all' | 'instructor';

function parseStanding(value: string | null): StandingParam {
  return value === 'current' || value === 'overdue' || value === 'former' ? value : 'members';
}

function parseHoldings(value: string | null): HoldingsParam {
  return value === 'holding' ? 'holding' : 'all';
}

function parseRole(value: string | null): RoleParam {
  return value === 'instructor' ? 'instructor' : 'all';
}

export const load: PageServerLoad = async (event) => {
  requireSession(event);
  const db = resolveClubDb(event.platform?.env);
  const search = event.url.searchParams.get('q') ?? '';
  const standing = parseStanding(event.url.searchParams.get('standing'));
  const holdings = parseHoldings(event.url.searchParams.get('holdings'));
  const role = parseRole(event.url.searchParams.get('role'));
  const classId = event.url.searchParams.get('class') ?? 'all';
  const includeArchived = event.url.searchParams.get('archived') === '1';

  if (!db) {
    return {
      households: [] as HouseholdListRow[],
      classOptions: [] as MembersClassFilterOption[],
      search,
      standing,
      holdings,
      role,
      classId,
      includeArchived,
      error: 'CLUB_DB is not bound.',
    };
  }

  try {
    const [households, currentSeason, classes] = await Promise.all([
      listHouseholds(db, { search: search || undefined, standing, holdings, role, classId, includeArchived }),
      getCurrentSeason(db),
      listClassesWithCounts(db),
    ]);
    const classOptions: MembersClassFilterOption[] = classes
      .filter((cls) => cls.season === currentSeason && cls.enrolledCount > 0)
      .map((cls) => ({ id: cls.id, name: cls.name }));
    return {
      households,
      classOptions,
      search,
      standing,
      holdings,
      role,
      classId,
      includeArchived,
      error: null as string | null,
    };
  } catch (err) {
    console.error('admin/club/members: CLUB_DB read failed', err);
    return {
      households: [] as HouseholdListRow[],
      classOptions: [] as MembersClassFilterOption[],
      search,
      standing,
      holdings,
      role,
      classId,
      includeArchived,
      error: 'Could not read the households table.',
    };
  }
};

export const actions: Actions = {
  addHousehold: clubAdminAction(
    async ({ form, ctx }) => {
      const name = form.get('name');
      const memberName = form.get('memberName');
      if (typeof name !== 'string' || !name.trim() || typeof memberName !== 'string' || !memberName.trim()) {
        ctx.audit({ action: 'add', entity: 'household', detail: 'rejected: missing household or member name' });
        return fail(400, { error: "A household name and its first member's name are both required." });
      }
      const city = form.get('city');
      const email = form.get('memberEmail');
      const phone = form.get('memberPhone');
      const birthdate = form.get('memberBirthdate');
      const { householdId } = await createHousehold(ctx.db, {
        name: name.trim(),
        city: typeof city === 'string' && city.trim() ? city.trim() : null,
        member: {
          name: memberName.trim(),
          email: typeof email === 'string' && email.trim() ? email.trim() : null,
          phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          birthdate: typeof birthdate === 'string' && birthdate.trim() ? birthdate.trim() : null,
        },
      });
      ctx.audit({ action: 'add', entity: 'household', entityId: householdId });
      redirect(303, `/admin/club/members/${householdId}`);
    },
    { action: 'add', entity: 'household', deniedMessage: 'A club role is required to add a household.' },
  ),
};
