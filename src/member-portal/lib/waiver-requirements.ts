// The member-waivers requirement engine (member-waivers T3, docs/2026-07-17-member-waivers-design.md
// ratified decisions 1, 6, 7, and 9, and the "Minors" section): given a household's members, the
// asset kinds it holds this season, the season's own published documents ($theme/documents.ts's T1
// loader), and the household's existing signature rows, derive who still owes a signature and who
// has one on file. `deriveHouseholdRequirements` is the pure seam (a plain object in, a plain object
// out, following `documents.ts`'s own resolve/load pairing and the directory pass's
// pure-`standingWindowFromPaidAt`-plus-bounded-queries pattern); `loadHouseholdRequirements` is the
// thin, non-pure wrapper the signing routes (T4/T5) and the household-complete gate actually call,
// built on this module's own household/asset reads (`household.ts`'s `getHouseholdInfo` and
// `listHouseholdMembers`, `assets.ts`'s `listHouseholdAssignments`) plus one bounded
// `waiver_acceptances` query, so it duplicates none of their SQL.
//
// STATED ASSUMPTION (rule 1 of this task): asset-kind and dry-storage documents are HOUSEHOLD-level
// requirements, not per-adult ones -- the schema attaches holdings to `memberships`
// (`asset_assignments.membership_id`, 0007_assets_email's own "assets attach to MEMBERSHIPS, never
// members" header), not to any individual member. One signature per household satisfies such a
// requirement, and the household's own `primary_member_id` is the natural, and only, signer this
// pass recognizes for it; every other adult's own per-person list never carries these documents.
//
// Audience 'youth-class' documents (the youth medical form) resolve but derive no requirement here
// (rule 1): the structured per-class medical-data flow is post-v1, so this engine only ever
// recognizes that such a document exists, never requires it.
import type { D1Database } from '@cloudflare/workers-types';
import type { DocumentAudience, SignableDocument } from '$theme/documents';
import { computeAge } from './age-gate';
import { getHouseholdInfo, listHouseholdMembers } from './household';
import { listHouseholdAssignments } from './assets';

/** The four holdable asset kinds (`asset_types.id`, `migrations/asc-club/0007_assets_email`): the
 *  audience vocabulary minus the three non-asset audiences. */
export type AssetKind = Exclude<DocumentAudience, 'all-members' | 'dry-storage' | 'youth-class'>;

/** The three asset kinds the single Dry Storage Agreement covers (its own drafting notes: "one
 *  agreement covering all three"), on top of each kind's own per-asset acknowledgement. */
const DRY_STORAGE_KINDS: ReadonlySet<AssetKind> = new Set(['rv-parking', 'boat-parking', 'small-boat-rack']);

/** Alaska's ordinary age of majority, the threshold AS 09.65.292's parental election in the
 *  "Minors" spec section turns on -- distinct from `age-gate.ts`'s own 8-12/13+ class tracks, which
 *  sort members into curriculum, not into this statute's adult/minor line. */
const ADULT_MIN_AGE = 18;

/** One household member, as much as this engine needs: identity, name, and the civil-date
 *  birthdate the minor determination reads (`members.birthdate`). A member with no birthdate on
 *  file reads as an adult -- the same permissive default `age-gate.ts`'s own eligibility check
 *  documents for a member who has never supplied one, rather than this engine silently requiring a
 *  Part Two signature nobody can complete. */
export interface HouseholdMemberInput {
  id: string;
  name: string;
  birthdate: string | null;
}

/** One existing `waiver_acceptances` row, the fields this engine matches against: which document
 *  (business id, not the versioned content-entry id) and season it signs, and who signed it -- the
 *  authenticated adult (`memberId`) for their own documents, or the minor the signature covers
 *  (`minorMemberId`) for a Part Two election. Rule 3: matching is by document id plus season only,
 *  never by version, so a mid-season new version never invalidates an existing same-season
 *  signature. */
export interface SignatureRecord {
  id: string;
  documentId: string;
  season: number;
  memberId: string | null;
  minorMemberId: string | null;
  signedAt: string;
}

/** One document's requirement state for the person it is attached to. `scope` names who can
 *  satisfy it: `'personal'` documents are signed by the member themself; `'household'` documents
 *  (asset-kind and dry-storage) are satisfied once by the household's primary member (this
 *  module's own stated assumption, see header) and only ever appear on the primary's own list. */
export interface DocumentRequirement {
  document: SignableDocument;
  scope: 'personal' | 'household';
  signed: boolean;
  signature: SignatureRecord | null;
}

/** One adult member's own applicable documents: their personal all-members documents, plus (when
 *  they are the household's primary member) the household's asset-kind and dry-storage documents. */
export interface PersonRequirements {
  memberId: string;
  memberName: string;
  requirements: DocumentRequirement[];
}

/** One minor's own Part Two requirement under one release document: satisfied by a signature row
 *  carrying `minorMemberId === minorMemberId`, signed by any adult (rule 2: a signer's attested
 *  relationship lives on the signature record, not gated here -- this engine only asks whether the
 *  election is on file). */
export interface MinorRequirement {
  minorMemberId: string;
  minorName: string;
  document: SignableDocument;
  signed: boolean;
  signature: SignatureRecord | null;
}

/** A household's full requirement picture for one season: every adult's own applicable documents
 *  (including, for the primary, the household-wide ones), and every minor's own Part Two
 *  requirements. */
export interface HouseholdRequirements {
  season: number;
  adults: PersonRequirements[];
  minors: MinorRequirement[];
}

export interface DeriveHouseholdRequirementsInput {
  season: number;
  /** `households.primary_member_id`; `null` only for the deferred-primary instant a household is
   *  created in (0007_assets_email's own header) -- no household-wide document attaches to anyone
   *  in that state. */
  primaryMemberId: string | null;
  /** Every household member, adults and minors alike (an archived member is the caller's own
   *  concern to exclude; this engine trusts the list it is given). */
  members: HouseholdMemberInput[];
  /** The asset kinds the household actively holds this season (rule 1: presence, not the specific
   *  assignment). */
  assetKinds: AssetKind[];
  /** The season's own published documents, keyed by document business id -- `$theme/documents.ts`'s
   *  `resolvePublishedDocuments`/`loadPublishedDocuments` output, taken as-is (rule 4: an empty map
   *  yields an empty result throughout). */
  publishedDocuments: Map<string, SignableDocument>;
  /** Every signature row relevant to this household for `season` (both members' own and any minor
   *  Part Two elections); a row for a different season never matches (rule 3, fresh per season). */
  signatures: SignatureRecord[];
  /** The instant minor status is computed as of; defaults to now. */
  asOf?: Date;
}

function isMinor(member: HouseholdMemberInput, asOf: Date): boolean {
  if (!member.birthdate) return false;
  return computeAge(member.birthdate, asOf) < ADULT_MIN_AGE;
}

function documentsForAudience(published: Map<string, SignableDocument>, audience: DocumentAudience): SignableDocument[] {
  return [...published.values()].filter((doc) => doc.frontmatter.audience === audience);
}

/** The first signature matching `documentId`/`season` and `matches` -- `signatures` is small (one
 *  household's own rows for one season), so a linear scan needs no index. */
function findSignature(signatures: SignatureRecord[], documentId: string, season: number, matches: (signature: SignatureRecord) => boolean): SignatureRecord | null {
  return signatures.find((signature) => signature.documentId === documentId && signature.season === season && matches(signature)) ?? null;
}

/**
 * Derive a household's full requirement picture for `input.season` (member-waivers T3): pure, no
 * database access. Every published 'all-members' document is a personal requirement for each adult
 * member, satisfied only by that adult's own signature (never another adult's, rule 2's own "one
 * adult never satisfies another adult's requirement"). Every held asset kind's own document, plus
 * the Dry Storage Agreement for any of the three dry kinds (deduplicated when several dry kinds are
 * held), is a household-wide requirement attached to the primary member's own list, satisfied by the
 * primary's own signature. Every 'release'-kind 'all-members' document additionally opens a Part Two
 * requirement for each minor member, satisfied by any adult's signature naming that minor.
 */
export function deriveHouseholdRequirements(input: DeriveHouseholdRequirementsInput): HouseholdRequirements {
  const asOf = input.asOf ?? new Date();
  const { season, publishedDocuments, signatures, primaryMemberId } = input;

  const adultMembers = input.members.filter((member) => !isMinor(member, asOf));
  const minorMembers = input.members.filter((member) => isMinor(member, asOf));

  const allMembersDocuments = documentsForAudience(publishedDocuments, 'all-members');

  const householdAudiences = new Set<DocumentAudience>();
  for (const kind of input.assetKinds) {
    householdAudiences.add(kind);
    if (DRY_STORAGE_KINDS.has(kind)) householdAudiences.add('dry-storage');
  }
  const householdDocuments: SignableDocument[] = [];
  const seenHouseholdDocumentIds = new Set<string>();
  for (const audience of householdAudiences) {
    for (const doc of documentsForAudience(publishedDocuments, audience)) {
      if (seenHouseholdDocumentIds.has(doc.frontmatter.document)) continue;
      seenHouseholdDocumentIds.add(doc.frontmatter.document);
      householdDocuments.push(doc);
    }
  }

  const adults: PersonRequirements[] = adultMembers.map((member) => {
    const requirements: DocumentRequirement[] = allMembersDocuments.map((doc) => {
      const signature = findSignature(signatures, doc.frontmatter.document, season, (s) => s.memberId === member.id && s.minorMemberId === null);
      return { document: doc, scope: 'personal', signed: signature !== null, signature };
    });

    if (member.id === primaryMemberId) {
      for (const doc of householdDocuments) {
        const signature = findSignature(signatures, doc.frontmatter.document, season, (s) => s.memberId === primaryMemberId && s.minorMemberId === null);
        requirements.push({ document: doc, scope: 'household', signed: signature !== null, signature });
      }
    }

    return { memberId: member.id, memberName: member.name, requirements };
  });

  const releaseDocuments = allMembersDocuments.filter((doc) => doc.frontmatter.kind === 'release');
  const minors: MinorRequirement[] = minorMembers.flatMap((minor) =>
    releaseDocuments.map((doc) => {
      const signature = findSignature(signatures, doc.frontmatter.document, season, (s) => s.minorMemberId === minor.id);
      return { minorMemberId: minor.id, minorName: minor.name, document: doc, signed: signature !== null, signature };
    }),
  );

  return { season, adults, minors };
}

interface SignatureRawRow {
  id: string;
  document_id: string;
  season: number;
  member_id: string | null;
  minor_member_id: string | null;
  signed_at: string;
}

/** Every signature row for `householdId`'s own members (either as the signer or the named minor)
 *  in `season`: one bounded query, matching this module's own `SignatureRecord` shape. A row with
 *  no `document_id` (a legacy pre-T2 row this migration left in place) never matches any document
 *  business id, so it is filtered out here rather than surfacing as a false negative downstream. */
async function loadHouseholdSignatures(db: D1Database, householdId: string, season: number): Promise<SignatureRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT id, document_id, season, member_id, minor_member_id, signed_at
       FROM waiver_acceptances
       WHERE season = ?1
         AND document_id IS NOT NULL
         AND (member_id IN (SELECT id FROM members WHERE household_id = ?2)
              OR minor_member_id IN (SELECT id FROM members WHERE household_id = ?2))`,
    )
    .bind(season, householdId)
    .all<SignatureRawRow>();
  return results.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    season: row.season,
    memberId: row.member_id,
    minorMemberId: row.minor_member_id,
    signedAt: row.signed_at,
  }));
}

/**
 * {@link deriveHouseholdRequirements} for a real household: assembles its inputs from
 * `household.ts`'s `getHouseholdInfo`/`listHouseholdMembers`, `assets.ts`'s
 * `listHouseholdAssignments` (its own active-assignment read; holding is presence, not a
 * season-scoped column, per that module's own header), and this module's own bounded signatures
 * query, then hands them to the pure derivation. Excludes an archived member from every list (an
 * archived member owes nothing further). Returns `null` only when `householdId` does not resolve.
 */
export async function loadHouseholdRequirements(
  db: D1Database,
  publishedDocuments: Map<string, SignableDocument>,
  householdId: string,
  season: number,
): Promise<HouseholdRequirements | null> {
  const household = await getHouseholdInfo(db, householdId);
  if (!household) return null;

  const [memberRows, assignments, signatures] = await Promise.all([
    listHouseholdMembers(db, householdId),
    listHouseholdAssignments(db, householdId, season),
    loadHouseholdSignatures(db, householdId, season),
  ]);

  const members: HouseholdMemberInput[] = memberRows
    .filter((row) => row.archivedAt === null)
    .map((row) => ({ id: row.id, name: row.name, birthdate: row.birthdate }));
  const assetKinds = [...new Set(assignments.map((assignment) => assignment.assetType as AssetKind))];

  return deriveHouseholdRequirements({
    season,
    primaryMemberId: household.primaryMemberId,
    members,
    assetKinds,
    publishedDocuments,
    signatures,
  });
}
