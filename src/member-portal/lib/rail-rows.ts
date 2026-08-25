// The landing's "storage & moorings" list shape, shared by the desktop rail tile (`PortalRail.svelte`)
// and the mobile composition's own full-width section (T3 of the portal redesign pass,
// docs/2026-07-16-portal-redesign-design.md): both read the household's assignments and waitlist
// entries into the same stacked two-line rows (name, then detail plus chip), so the two
// compositions can never drift on which fee, waitlist position, or chip a member sees.
import type { HouseholdAssignmentRow, HouseholdWaitlistRow } from './assets';
import { displayDescription } from '$lib/assets-format';

/** One stacked two-line storage/moorings row: a name and an optional detail/chip line below it (mock
 *  D's own fix for the cramped mid-phrase wrap a single flex row produced at rail width). */
export interface RailAssetRow {
  id: string;
  name: string;
  detail: string | null;
  chip: string | null;
}

/** The household's current assignments (a "Payment due" chip on any outstanding fee) followed by
 *  its waitlist positions (a "Waitlist" chip), in that order -- assets a member already holds read
 *  before ones they are still waiting on. */
export function deriveAssetRows(assignments: HouseholdAssignmentRow[], waitlistEntries: HouseholdWaitlistRow[]): RailAssetRow[] {
  return [
    ...assignments.map((a) => ({
      id: a.id,
      name: a.assetTypeName,
      // Recased for display (contract ruling 3, fix round B, item 8): the member portal must
      // match the admin desk's own `displayDescription` treatment of the legacy shouting-case
      // import data, never show it raw.
      detail: displayDescription(a.description),
      chip: a.paymentStanding === 'outstanding' ? 'Payment due' : null,
    })),
    ...waitlistEntries.map((w) => ({
      id: w.id,
      name: w.assetTypeName,
      detail: `Position ${w.position} of ${w.queueLength}`,
      chip: 'Waitlist',
    })),
  ];
}
