// The `committees-at-a-glance` island's read (T6b): the public /committees At-a-Glance table, fed
// from live asc-club data via a content directive (the join-page price-directive pattern). A query
// rather than a form, since the island only reads. Degrades to `null` on any D1 failure or missing
// binding, which the component renders as its own fallback (a pointer to the member directory).
// Chair titles DERIVE here from the committee name and the chair row's role (roles spec decision 2),
// never stored; only chairs and officers are published (roles spec's out-of-scope note: no rosters
// on the public page).
import { query, getRequestEvent } from '$app/server';
import { chairCell, type AtAGlanceChair, type AtAGlanceData } from './committees-at-a-glance-data';

interface OfficerRow {
  title: string;
  name: string;
}

interface CommitteeRow {
  id: string;
  name: string;
}

interface ChairRow {
  committee_id: string;
  name: string;
  role: 'chair' | 'co-chair';
}

export const getCommitteesAtAGlance = query(async (): Promise<AtAGlanceData | null> => {
  const db = getRequestEvent().platform?.env.CLUB_DB;
  if (!db) return null;
  try {
    const [officers, committees, chairs] = await Promise.all([
      db
        .prepare(
          `SELECT mp.title AS title, m.name AS name
           FROM member_positions mp
           JOIN members m ON m.id = mp.member_id
           WHERE mp.kind = 'officer'
           ORDER BY mp.sort_order, mp.title`,
        )
        .all<OfficerRow>(),
      db
        .prepare('SELECT id, name FROM committees WHERE archived_at IS NULL ORDER BY sort_order, name')
        .all<CommitteeRow>(),
      db
        .prepare(
          `SELECT cm.committee_id AS committee_id, m.name AS name, cm.role AS role
           FROM committee_members cm
           JOIN members m ON m.id = cm.member_id
           WHERE cm.status = 'active' AND cm.role IN ('chair','co-chair')`,
        )
        .all<ChairRow>(),
    ]);

    const chairsByCommittee = new Map<string, AtAGlanceChair[]>();
    for (const row of chairs.results) {
      const group = chairsByCommittee.get(row.committee_id);
      const chair: AtAGlanceChair = { name: row.name, role: row.role };
      if (group) group.push(chair);
      else chairsByCommittee.set(row.committee_id, [chair]);
    }

    return {
      officers: officers.results.map((o) => ({ title: o.title, name: o.name })),
      committees: committees.results.map((c) => ({ name: c.name, who: chairCell(chairsByCommittee.get(c.id) ?? []) })),
    };
  } catch {
    return null;
  }
});
