// The `committees-at-a-glance` island's pure shaping (T6b, the roles spec's decision 6 public
// surface): factored out of the remote read so the "Who" cell derivation is unit-testable without
// the island runtime, the same `*-data.ts` split `class-schedule-data.ts` and
// `membership-pricing-data.ts` establish. The public /committees At-a-Glance table publishes
// officers and each committee's derived chair/co-chair names by name (exactly what the
// hand-maintained table did), and nothing else -- no rosters, no contact.

/** One officer row: a `member_positions` kind='officer' title and the member's name. */
export interface AtAGlanceOfficer {
  title: string;
  name: string;
}

/** One active chair or co-chair of a committee, before {@link chairCell} formats the run. */
export interface AtAGlanceChair {
  name: string;
  role: 'chair' | 'co-chair';
}

/** One committee row: the committee's name and its "Who" cell (chair, then any co-chairs marked). */
export interface AtAGlanceCommittee {
  name: string;
  who: string;
}

/** The whole At-a-Glance payload the island renders as a two-column table. */
export interface AtAGlanceData {
  officers: AtAGlanceOfficer[];
  committees: AtAGlanceCommittee[];
}

/**
 * The "Who" cell for a committee: the chair first, then any co-chairs each suffixed "(co-chair)",
 * comma-joined -- exactly the shape the hand-maintained table used ("Jonathan Ramirez, Emily
 * Ramirez (co-chair)"). An empty run yields an empty string, which the island renders as a quiet
 * em dash, so a chair-less committee still gets a row.
 */
export function chairCell(chairs: AtAGlanceChair[]): string {
  return chairs
    .slice()
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'chair' ? -1 : 1))
    .map((c) => (c.role === 'co-chair' ? `${c.name} (co-chair)` : c.name))
    .join(', ');
}
