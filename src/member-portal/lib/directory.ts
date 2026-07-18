// The member directory (design doc's own "member directory" benefit, MembershipWorks absorption
// item 4; reshaped for the roles-and-committees model, docs/2026-07-17-roles-committees-design.md,
// and the directory plan's T3): one row per LISTED member (the Compact A composition ratified at
// T0 renders a row per member, not a household card), joining `households`, `boats` (by
// `boats.member_id` -- a boat shows on its OWNER only, never a household-mate), `member_positions`,
// and active `committee_members` (with their committee's name, excluding an archived committee and
// any pending request). `hidden` and archived members never leave this module, the same as before;
// LISTING NOW ALSO REQUIRES current-or-grace standing (directory spec decision 8), sourced from
// `$member-auth/lib/standing`'s own `standingWindowFromPaidAt` -- the unified-signup machinery's one
// definition of the rolling paid_at-plus-one-year-plus-grace boundary -- rather than a
// directory-local clock. Every household's standing derives from ONE set-based grounding query (a
// correlated subquery per household picks its own most recently paid, non-refunded `memberships`
// row, mirroring `admin-club/lib/households-store.ts`'s own `HOUSEHOLD_GROUNDING_SQL`) plus one
// `getRenewalGraceDays` read, never a per-member standing lookup: the directory's read stays four
// queries regardless of club size.
import type { D1Database } from '@cloudflare/workers-types';
import { getRenewalGraceDays } from '$admin-club/lib/club-settings';
import { standingWindowFromPaidAt } from '$member-auth/lib/standing';
import type { DirectoryVisibility } from './household';

/** A stored E.164 `+1` number (10 digits after the country code), the shape `profile.ts`'s own
 *  `validatePhone` (and the MW import) produce for every parseable number, and the only one this
 *  club's members have when their phone parsed at write time. */
const US_E164 = /^\+1(\d{3})(\d{3})(\d{4})$/;

/**
 * Format a stored E.164 number for human reading: `+19075550142` becomes `+1 (907) 555-0142`.
 * A number outside that one shape (a non-`+1` country code, or anything that fails to parse)
 * renders as its own raw string; the directory has no reason to reformat what it cannot parse.
 */
export function formatPhone(phone: string): string {
  const match = US_E164.exec(phone);
  if (!match) return phone;
  const [, area, prefix, line] = match;
  return `+1 (${area}) ${prefix}-${line}`;
}

/** `member_positions.kind`: authorization hangs off this column (roles spec decision 3), never a
 *  title-string match; the directory only ever displays it alongside `title`. */
export type PositionKind = 'officer' | 'director' | 'appointed';

/** `committee_members.role`. */
export type CommitteeRole = 'chair' | 'co-chair' | 'member';

/** `boats.kept_on`. */
export type BoatKeptOn = 'trailer' | 'mooring';

/** One `member_positions` row, as the directory renders it (T4's filled title chip). */
export interface DirectoryPosition {
  kind: PositionKind;
  title: string;
  sortOrder: number;
}

/** One active committee membership. `title` DERIVES here from `role` and the committee's own
 *  `name` ("{committee.name} Chair" / "Co-Chair") and is never stored (roles spec decision 2); it
 *  is `null` for a plain `'member'` row, which T4 renders as the quieter outline marker instead of
 *  a filled chip. */
export interface DirectoryCommitteeMembership {
  committeeName: string;
  role: CommitteeRole;
  title: string | null;
}

/** One boat, attributed to its owning member (never a household-mate). */
export interface DirectoryBoat {
  name: string | null;
  model: string;
  keptOn: BoatKeptOn;
}

/** A listed member's household-level address, gated the same way as `email`/`phone`: `null` for a
 *  `partial` listing, populated only at `visible` (directory spec's "Revisions" block). `city`
 *  travels here too even though it is not itself gated (see {@link DirectoryEntry.household}),
 *  since the visible tier's full postal address reads as one block. */
export interface DirectoryAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/** A listed member's contact facts, all three gated together by `directory_visibility`: `null`
 *  for a `partial` listing (name-only, per decision 7) as well as for a `visible` member who
 *  genuinely has nothing on file; the caller does not need to distinguish the two. */
export interface DirectoryContact {
  email: string | null;
  phone: string | null;
  address: DirectoryAddress | null;
}

/** One listed member, the directory's per-row unit under the ratified Compact A composition.
 *  `household.city` and `household.name` are shown for every listed member regardless of
 *  visibility (only the sensitive fields in {@link DirectoryContact} are gated); `secondary` is
 *  the row's one derived at-rest datum -- a summary of the member's own boats when they own any,
 *  else the household's city -- that the compact resting row renders directly. */
export interface DirectoryEntry {
  id: string;
  name: string;
  household: { name: string; city: string | null };
  secondary: string | null;
  positions: DirectoryPosition[];
  memberships: DirectoryCommitteeMembership[];
  boats: DirectoryBoat[];
  contact: DirectoryContact;
}

interface DirectoryGroundingRow {
  member_id: string;
  member_name: string;
  email: string | null;
  phone: string | null;
  directory_visibility: DirectoryVisibility;
  household_id: string;
  household_name: string;
  household_city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  state: string | null;
  postal_code: string | null;
  /** The household's own grounding `memberships` row's `paid_at` (most recently paid,
   *  non-refunded), or `null` when it has never had one -- the same "grounding row" concept
   *  `$member-auth/lib/standing.ts` and `$admin-club/lib/households-store.ts` each read, here via
   *  a matching correlated subquery so this stays one set-based query. */
  paid_at: string | null;
}

/** Every listed member, plus each household's own grounding row in one query: mirrors
 *  `households-store.ts`'s own `HOUSEHOLD_GROUNDING_SQL` subquery shape so the "most recently
 *  paid, non-refunded row" concept reads identically in both places. */
const DIRECTORY_GROUNDING_SQL = `
  SELECT m.id AS member_id, m.name AS member_name, m.email, m.phone, m.directory_visibility,
         h.id AS household_id, h.name AS household_name, h.city AS household_city,
         h.address_line1, h.address_line2, h.state, h.postal_code,
         gm.paid_at
  FROM members m
  JOIN households h ON h.id = m.household_id
  LEFT JOIN memberships gm ON gm.id = (
    SELECT id FROM memberships mm
    WHERE mm.household_id = h.id AND mm.paid_at IS NOT NULL AND mm.refunded_at IS NULL
    ORDER BY mm.paid_at DESC LIMIT 1
  )
  WHERE m.archived_at IS NULL AND m.directory_visibility != 'hidden'
  ORDER BY m.name
`;

interface BoatRawRow {
  member_id: string;
  name: string | null;
  model: string;
  kept_on: BoatKeptOn;
}

interface PositionRawRow {
  member_id: string;
  kind: PositionKind;
  title: string;
  sort_order: number;
}

interface CommitteeMembershipRawRow {
  member_id: string;
  role: CommitteeRole;
  committee_name: string;
}

/** Group `rows` by `keyOf(row)`, preserving each group's own relative order. */
function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = byKey.get(key);
    if (group) group.push(row);
    else byKey.set(key, [row]);
  }
  return byKey;
}

/** Chair titles derive here ("{committeeName} Chair" / "Co-Chair"), never stored (roles spec
 *  decision 2); a plain `'member'` role carries no derived title. */
function derivedCommitteeTitle(role: CommitteeRole, committeeName: string): string | null {
  if (role === 'chair') return `${committeeName} Chair`;
  if (role === 'co-chair') return `${committeeName} Co-Chair`;
  return null;
}

/**
 * Every listed member: non-archived, non-hidden (`directory_visibility != 'hidden'`), and
 * current-or-grace standing (directory spec decision 8), in member-name order. Standing is
 * derived from each household's own grounding `memberships` row via
 * {@link standingWindowFromPaidAt} -- `$member-auth/lib/standing`'s shared boundary math -- off a
 * SINGLE `getRenewalGraceDays` read, never a per-member standing lookup. A household that has
 * never had a paid row reads the same as a lapsed one for listing purposes (folding into
 * `getMemberStanding`'s own "no membership on file" convention) and is excluded.
 *
 * Boats, positions, and active committee memberships (chair titles derived, pending rows and
 * archived committees excluded) each read from one set-based query and are grouped in JS by
 * `member_id`, so the whole read costs four queries regardless of club size. A boat attributes to
 * its own owning member (`boats.member_id`) only, never a household-mate.
 */
export async function listDirectory(db: D1Database): Promise<DirectoryEntry[]> {
  const now = new Date();
  const [groundingResult, boatsResult, positionsResult, membershipsResult, graceDays] = await Promise.all([
    db.prepare(DIRECTORY_GROUNDING_SQL).all<DirectoryGroundingRow>(),
    db.prepare('SELECT member_id, name, model, kept_on FROM boats ORDER BY name').all<BoatRawRow>(),
    db
      .prepare('SELECT member_id, kind, title, sort_order FROM member_positions ORDER BY sort_order, title')
      .all<PositionRawRow>(),
    db
      .prepare(
        `SELECT cm.member_id, cm.role, c.name AS committee_name
         FROM committee_members cm
         JOIN committees c ON c.id = cm.committee_id
         WHERE cm.status = 'active' AND c.archived_at IS NULL
         ORDER BY c.name`,
      )
      .all<CommitteeMembershipRawRow>(),
    getRenewalGraceDays(db),
  ]);

  const boatsByMember = groupBy(boatsResult.results, (row) => row.member_id);
  const positionsByMember = groupBy(positionsResult.results, (row) => row.member_id);
  const membershipsByMember = groupBy(membershipsResult.results, (row) => row.member_id);

  const entries: DirectoryEntry[] = [];
  for (const row of groundingResult.results) {
    const status = row.paid_at ? standingWindowFromPaidAt(row.paid_at, graceDays, now).status : 'lapsed';
    if (status !== 'current' && status !== 'grace') continue;

    const exposesContact = row.directory_visibility === 'visible';
    const boats: DirectoryBoat[] = (boatsByMember.get(row.member_id) ?? []).map((boat) => ({
      name: boat.name,
      model: boat.model,
      keptOn: boat.kept_on,
    }));
    const positions: DirectoryPosition[] = (positionsByMember.get(row.member_id) ?? []).map((position) => ({
      kind: position.kind,
      title: position.title,
      sortOrder: position.sort_order,
    }));
    const memberships: DirectoryCommitteeMembership[] = (membershipsByMember.get(row.member_id) ?? []).map((membership) => ({
      committeeName: membership.committee_name,
      role: membership.role,
      title: derivedCommitteeTitle(membership.role, membership.committee_name),
    }));

    const secondary = boats.length > 0 ? boats.map((boat) => boat.name ?? boat.model).join(', ') : row.household_city;

    entries.push({
      id: row.member_id,
      name: row.member_name,
      household: { name: row.household_name, city: row.household_city },
      secondary,
      positions,
      memberships,
      boats,
      contact: {
        email: exposesContact ? row.email : null,
        phone: exposesContact ? row.phone : null,
        address: exposesContact
          ? {
              line1: row.address_line1,
              line2: row.address_line2,
              city: row.household_city,
              state: row.state,
              postalCode: row.postal_code,
            }
          : null,
      },
    });
  }
  return entries;
}
