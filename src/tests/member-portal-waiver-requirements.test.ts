// deriveHouseholdRequirements's own coverage (member-waivers T3): all-members documents required of
// each adult individually, asset-kind/dry-storage documents required once per household and
// attributed only to the primary member, a mid-season version publish leaving a prior same-season
// signature valid while requiring the new version from anyone still unsigned, a minor's Part Two
// requirement satisfied by any adult's signature naming them, and the no-published-documents empty
// state. loadHouseholdRequirements gets one thin integration test against `fakeD1`.
import { describe, expect, it } from 'vitest';
import type { DocumentFrontmatter, SignableDocument } from '$theme/documents';
import {
  deriveHouseholdRequirements,
  hasSignedCurrentRelease,
  loadHouseholdRequirements,
  outstandingAssetDocuments,
  type DeriveHouseholdRequirementsInput,
  type SignatureRecord,
} from '$member-portal/lib/waiver-requirements';
import { fakeD1 } from './_fake-d1';

const SEASON = 2027;
const ASOF = new Date('2027-06-15T12:00:00Z');

const ADULT_A = { id: 'mem-adult-a', name: 'Alex Adult', birthdate: '1985-03-01' };
const ADULT_B = { id: 'mem-adult-b', name: 'Blair Adult', birthdate: '1987-09-01' };
const MINOR_C = { id: 'mem-minor-c', name: 'Casey Child', birthdate: '2015-01-01' }; // age 12 as of ASOF

function doc(overrides: Partial<DocumentFrontmatter> & { id: string }): SignableDocument {
  const { id, ...frontmatterOverrides } = overrides;
  const frontmatter: DocumentFrontmatter = {
    title: 'A Document',
    document: 'general-release',
    version: 1,
    kind: 'release',
    audience: 'all-members',
    season: SEASON,
    status: 'published',
    ...frontmatterOverrides,
  };
  return {
    concept: 'documents',
    id,
    slug: id,
    permalink: '',
    title: frontmatter.title,
    tags: [],
    excerpt: '',
    wordCount: 0,
    draft: false,
    fields: {},
    frontmatter,
    body: 'The signable text.',
  };
}

function published(...docs: SignableDocument[]): Map<string, SignableDocument> {
  return new Map(docs.map((d) => [d.frontmatter.document, d]));
}

function signature(overrides: Partial<SignatureRecord>): SignatureRecord {
  return {
    id: crypto.randomUUID(),
    documentId: 'general-release',
    season: SEASON,
    memberId: null,
    minorMemberId: null,
    signedAt: '2027-06-01 12:00:00',
    ...overrides,
  };
}

function baseInput(overrides: Partial<DeriveHouseholdRequirementsInput> = {}): DeriveHouseholdRequirementsInput {
  return {
    season: SEASON,
    primaryMemberId: ADULT_A.id,
    members: [ADULT_A, ADULT_B],
    assetKinds: [],
    publishedDocuments: published(),
    signatures: [],
    asOf: ASOF,
    ...overrides,
  };
}

describe('deriveHouseholdRequirements', () => {
  it('requires every all-members document of each adult individually, signed only by their own signature', () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const rules = doc({ id: 'rules-acknowledgement-v1', document: 'rules-acknowledgement', kind: 'acknowledgement' });
    const result = deriveHouseholdRequirements(
      baseInput({
        publishedDocuments: published(release, rules),
        signatures: [signature({ documentId: 'general-release', memberId: ADULT_A.id })],
      }),
    );

    expect(result.adults).toHaveLength(2);
    const [a, b] = result.adults;
    expect(a.memberId).toBe(ADULT_A.id);
    expect(a.requirements.map((r) => [r.document.frontmatter.document, r.signed])).toEqual([
      ['general-release', true],
      ['rules-acknowledgement', false],
    ]);
    // One adult's signature never satisfies another adult's own requirement.
    expect(b.requirements.map((r) => [r.document.frontmatter.document, r.signed])).toEqual([
      ['general-release', false],
      ['rules-acknowledgement', false],
    ]);
  });

  it('requires an asset-kind document, plus the dry-storage agreement, only for a household that holds it, only on the primary member', () => {
    const rv = doc({ id: 'rv-acknowledgement-v1', document: 'rv-acknowledgement', kind: 'acknowledgement', audience: 'rv-parking' });
    const storage = doc({ id: 'storage-agreement-v1', document: 'storage-agreement', kind: 'agreement', audience: 'dry-storage' });
    const mooring = doc({ id: 'mooring-agreement-v1', document: 'mooring-agreement', kind: 'agreement', audience: 'mooring' });

    const holding = deriveHouseholdRequirements(
      baseInput({ assetKinds: ['rv-parking'], publishedDocuments: published(rv, storage, mooring) }),
    );
    const [primary, other] = holding.adults;
    expect(primary.requirements.map((r) => r.document.frontmatter.document).sort()).toEqual(['rv-acknowledgement', 'storage-agreement']);
    expect(primary.requirements.every((r) => r.scope === 'household')).toBe(true);
    // The mooring agreement never applies to an rv-parking holding, and household documents never
    // attach to a non-primary adult's own list.
    expect(other.requirements).toEqual([]);

    const notHolding = deriveHouseholdRequirements(
      baseInput({ assetKinds: [], publishedDocuments: published(rv, storage, mooring) }),
    );
    expect(notHolding.adults[0].requirements).toEqual([]);
  });

  it('requires the dry-storage agreement exactly once when the household holds more than one dry kind', () => {
    const rack = doc({ id: 'rack-acknowledgement-v1', document: 'rack-acknowledgement', kind: 'acknowledgement', audience: 'small-boat-rack' });
    const rv = doc({ id: 'rv-acknowledgement-v1', document: 'rv-acknowledgement', kind: 'acknowledgement', audience: 'rv-parking' });
    const storage = doc({ id: 'storage-agreement-v1', document: 'storage-agreement', kind: 'agreement', audience: 'dry-storage' });
    const result = deriveHouseholdRequirements(
      baseInput({ assetKinds: ['small-boat-rack', 'rv-parking'], publishedDocuments: published(rack, rv, storage) }),
    );
    const documentIds = result.adults[0].requirements.map((r) => r.document.frontmatter.document);
    expect(documentIds.filter((id) => id === 'storage-agreement')).toHaveLength(1);
    expect(documentIds.sort()).toEqual(['rack-acknowledgement', 'rv-acknowledgement', 'storage-agreement']);
  });

  it('recognizes a youth-class document but derives no requirement from it', () => {
    const medical = doc({ id: 'youth-medical-form-v1', document: 'youth-medical-form', kind: 'acknowledgement', audience: 'youth-class' });
    const result = deriveHouseholdRequirements(baseInput({ publishedDocuments: published(medical) }));
    expect(result.adults.every((a) => a.requirements.length === 0)).toBe(true);
    expect(result.minors).toEqual([]);
  });

  it('leaves a prior same-season signature valid across a mid-season version publish, and requires the new version only from whoever has not signed', () => {
    const v1 = doc({ id: 'general-release-v1', document: 'general-release', version: 1 });
    const preSignature = signature({ documentId: 'general-release', memberId: ADULT_A.id });
    const beforePublish = deriveHouseholdRequirements(baseInput({ publishedDocuments: published(v1), signatures: [preSignature] }));
    expect(beforePublish.adults[0].requirements[0].signed).toBe(true);

    const v2 = doc({ id: 'general-release-v2', document: 'general-release', version: 2 });
    const afterPublish = deriveHouseholdRequirements(baseInput({ publishedDocuments: published(v2), signatures: [preSignature] }));
    const [a, b] = afterPublish.adults;
    // The same pre-existing signature (matched by document id + season, never version) still
    // satisfies adult A against the newly published version 2 entry.
    expect(a.requirements[0].signed).toBe(true);
    expect(a.requirements[0].document.id).toBe('general-release-v2');
    // Adult B, never signed, is outstanding against that same newly published version.
    expect(b.requirements[0].signed).toBe(false);
    expect(b.requirements[0].document.id).toBe('general-release-v2');
  });

  it('requires a minor\'s Part Two of a release document, satisfied by any adult\'s signature naming that minor, separate from the parent\'s own document', () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const result = deriveHouseholdRequirements(
      baseInput({
        members: [ADULT_A, ADULT_B, MINOR_C],
        publishedDocuments: published(release),
        signatures: [
          signature({ documentId: 'general-release', memberId: ADULT_B.id }),
          signature({ documentId: 'general-release', minorMemberId: MINOR_C.id }),
        ],
      }),
    );
    expect(result.minors).toHaveLength(1);
    expect(result.minors[0]).toMatchObject({ minorMemberId: MINOR_C.id, signed: true });
    // The minor is never listed as an adult, and their Part Two signature never satisfies anyone's
    // own personal requirement.
    expect(result.adults.map((a) => a.memberId)).toEqual([ADULT_A.id, ADULT_B.id]);
    expect(result.adults.find((a) => a.memberId === ADULT_A.id)?.requirements[0].signed).toBe(false);
    expect(result.adults.find((a) => a.memberId === ADULT_B.id)?.requirements[0].signed).toBe(true);
  });

  it('opens no Part Two requirement for an acknowledgement (only a release carries the minor election)', () => {
    const rules = doc({ id: 'rules-acknowledgement-v1', document: 'rules-acknowledgement', kind: 'acknowledgement' });
    const result = deriveHouseholdRequirements(baseInput({ members: [ADULT_A, MINOR_C], publishedDocuments: published(rules) }));
    expect(result.minors).toEqual([]);
  });

  it('treats a member with no birthdate on file as an adult', () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const result = deriveHouseholdRequirements(
      baseInput({ members: [{ id: 'mem-unknown', name: 'Unknown Age', birthdate: null }], publishedDocuments: published(release) }),
    );
    expect(result.adults).toHaveLength(1);
    expect(result.minors).toEqual([]);
  });

  it("falls back to the first active adult for household documents when the primary member is no longer active (the flagged held-asset edge)", () => {
    const mooring = doc({ id: 'mooring-agreement-v1', document: 'mooring-agreement', kind: 'agreement', audience: 'mooring' });
    const result = deriveHouseholdRequirements(
      baseInput({
        // ADULT_A is `primaryMemberId` but is no longer in `members` (an admin archived them
        // without reassigning the household's own primary).
        primaryMemberId: ADULT_A.id,
        members: [ADULT_B],
        assetKinds: ['mooring'],
        publishedDocuments: published(mooring),
      }),
    );
    expect(result.adults).toHaveLength(1);
    expect(result.adults[0].memberId).toBe(ADULT_B.id);
    expect(result.adults[0].requirements.map((r) => r.document.frontmatter.document)).toEqual(['mooring-agreement']);
  });

  it('produces every empty list when no document is published for the season', () => {
    const result = deriveHouseholdRequirements(baseInput({ members: [ADULT_A, MINOR_C], assetKinds: ['mooring'] }));
    expect(result.adults.every((a) => a.requirements.length === 0)).toBe(true);
    expect(result.minors).toEqual([]);
  });
});

describe('outstandingAssetDocuments', () => {
  it('names the unsigned per-asset acknowledgement and, for a dry kind, the storage agreement alongside it', () => {
    const rv = doc({ id: 'rv-acknowledgement-v1', document: 'rv-acknowledgement', kind: 'acknowledgement', audience: 'rv-parking' });
    const storage = doc({ id: 'storage-agreement-v1', document: 'storage-agreement', kind: 'agreement', audience: 'dry-storage' });
    const mooring = doc({ id: 'mooring-agreement-v1', document: 'mooring-agreement', kind: 'agreement', audience: 'mooring' });
    const requirements = deriveHouseholdRequirements(
      baseInput({ assetKinds: ['rv-parking', 'mooring'], publishedDocuments: published(rv, storage, mooring) }),
    );

    expect(outstandingAssetDocuments(requirements, 'rv-parking').map((r) => r.document.frontmatter.document).sort()).toEqual([
      'rv-acknowledgement',
      'storage-agreement',
    ]);
    expect(outstandingAssetDocuments(requirements, 'mooring').map((r) => r.document.frontmatter.document)).toEqual(['mooring-agreement']);
  });

  it('is empty once the matching documents are signed, and never counts an unrelated asset kind', () => {
    const rv = doc({ id: 'rv-acknowledgement-v1', document: 'rv-acknowledgement', kind: 'acknowledgement', audience: 'rv-parking' });
    const storage = doc({ id: 'storage-agreement-v1', document: 'storage-agreement', kind: 'agreement', audience: 'dry-storage' });
    const requirements = deriveHouseholdRequirements(
      baseInput({
        assetKinds: ['rv-parking'],
        publishedDocuments: published(rv, storage),
        signatures: [signature({ documentId: 'rv-acknowledgement', memberId: ADULT_A.id }), signature({ documentId: 'storage-agreement', memberId: ADULT_A.id })],
      }),
    );
    expect(outstandingAssetDocuments(requirements, 'rv-parking')).toEqual([]);
    expect(outstandingAssetDocuments(requirements, 'boat-parking')).toEqual([]);
  });
});

describe('hasSignedCurrentRelease', () => {
  it("is true for an adult once their own release is signed, false while it is outstanding", () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const signed = deriveHouseholdRequirements(baseInput({ members: [ADULT_A], publishedDocuments: published(release), signatures: [signature({ memberId: ADULT_A.id })] }));
    expect(hasSignedCurrentRelease(signed, ADULT_A.id)).toBe(true);

    const unsigned = deriveHouseholdRequirements(baseInput({ members: [ADULT_A], publishedDocuments: published(release) }));
    expect(hasSignedCurrentRelease(unsigned, ADULT_A.id)).toBe(false);
  });

  it("is true for a minor once any adult's Part Two names them, false while it is outstanding", () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const signed = deriveHouseholdRequirements(
      baseInput({ members: [ADULT_A, MINOR_C], publishedDocuments: published(release), signatures: [signature({ minorMemberId: MINOR_C.id })] }),
    );
    expect(hasSignedCurrentRelease(signed, MINOR_C.id)).toBe(true);

    const unsigned = deriveHouseholdRequirements(baseInput({ members: [ADULT_A, MINOR_C], publishedDocuments: published(release) }));
    expect(hasSignedCurrentRelease(unsigned, MINOR_C.id)).toBe(false);
  });

  it('is true (the pass-through) when no release is published for the season, and for a member matching neither list', () => {
    const requirements = deriveHouseholdRequirements(baseInput());
    expect(hasSignedCurrentRelease(requirements, ADULT_A.id)).toBe(true);
    expect(hasSignedCurrentRelease(requirements, 'mem-unknown')).toBe(true);
  });
});

describe('loadHouseholdRequirements', () => {
  it('assembles a real household\'s inputs and derives its requirements', async () => {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    const { db } = fakeD1({
      firstResults: {
        'FROM households WHERE id': { id: 'hh-1', name: 'The Scratches', primary_member_id: ADULT_A.id, left_at: null },
      },
      allResults: {
        // Disambiguated by bind index from `loadHouseholdSignatures`'s own `household_id = ?2`
        // subquery, which is a literal substring of the household-members listing key otherwise
        // (fakeD1 matches on `sql.includes(key)`, so a shorter key would collide with both calls).
        'FROM members WHERE household_id = ?1 ORDER BY name': [
          { id: ADULT_A.id, name: ADULT_A.name, email: null, phone: null, birthdate: ADULT_A.birthdate, directory_visibility: 'partial', archived_at: null },
        ],
        'FROM asset_assignments aa': [],
        'FROM waiver_acceptances': [{ id: 'sig-1', document_id: 'general-release', season: SEASON, member_id: ADULT_A.id, minor_member_id: null, signed_at: '2027-06-01 12:00:00' }],
      },
    });

    const result = await loadHouseholdRequirements(db, published(release), 'hh-1', SEASON);
    expect(result?.adults).toHaveLength(1);
    expect(result?.adults[0].requirements[0].signed).toBe(true);
  });

  it('resolves null for an unknown household', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM households WHERE id': null } });
    await expect(loadHouseholdRequirements(db, published(), 'no-such-household', SEASON)).resolves.toBeNull();
  });
});
