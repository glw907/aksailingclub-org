// buildWaiverActionRows's own coverage (member-waivers T5b, spec rule 7's between-money-moments
// row and the household-complete loop's own "Portal row while waiting"): the plain "Needs your
// attention" copy for the signer's own outstanding documents, the waiting-on-another-adult row
// once the signer's own part is done, and the `inWaitingLoop` gate that keeps a fully-active
// household from ever reading as "waiting" outside the renewal window.
import { describe, expect, it } from 'vitest';
import type { DocumentFrontmatter, SignableDocument } from '$theme/documents';
import { deriveHouseholdRequirements, type DeriveHouseholdRequirementsInput, type SignatureRecord } from '$member-portal/lib/waiver-requirements';
import { buildWaiverActionRows } from '$member-portal/lib/waiver-action-rows';

const SEASON = 2027;
const ADULT_A = { id: 'mem-adult-a', name: 'Alex Adult', birthdate: '1985-03-01' };
const ADULT_B = { id: 'mem-adult-b', name: 'Blair Adult', birthdate: '1987-09-01' };

function doc(overrides: Partial<DocumentFrontmatter> & { id: string }): SignableDocument {
  const { id, ...frontmatterOverrides } = overrides;
  const frontmatter: DocumentFrontmatter = {
    title: 'Release of Liability',
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
  return { id: crypto.randomUUID(), documentId: 'general-release', season: SEASON, memberId: null, minorMemberId: null, signedAt: '2027-06-01 12:00:00', ...overrides };
}

function requirementsWith(overrides: Partial<DeriveHouseholdRequirementsInput> = {}) {
  const release = doc({ id: 'general-release-v1' });
  return deriveHouseholdRequirements({
    season: SEASON,
    primaryMemberId: ADULT_A.id,
    members: [ADULT_A, ADULT_B],
    assetKinds: [],
    publishedDocuments: published(release),
    signatures: [],
    ...overrides,
  });
}

describe('buildWaiverActionRows', () => {
  it("names the signer's own single outstanding document by title (the between-money-moments row)", () => {
    const requirements = requirementsWith({ signatures: [signature({ memberId: ADULT_B.id })] });
    const rows = buildWaiverActionRows({ requirements, signerMemberId: ADULT_A.id, inWaitingLoop: false });
    expect(rows).toEqual([
      {
        id: 'waiver-outstanding',
        title: `The Release of Liability needs your signature for the ${SEASON} season.`,
        amountCents: null,
        actionLabel: 'Read and sign',
        kind: 'link',
        href: '/my-account/sign',
      },
    ]);
  });

  it('names the count for several outstanding documents', () => {
    const rules = doc({ id: 'rules-acknowledgement-v1', document: 'rules-acknowledgement', kind: 'acknowledgement' });
    const requirements = deriveHouseholdRequirements({
      season: SEASON,
      primaryMemberId: ADULT_A.id,
      members: [ADULT_A],
      assetKinds: [],
      publishedDocuments: published(doc({ id: 'general-release-v1' }), rules),
      signatures: [],
    });
    const rows = buildWaiverActionRows({ requirements, signerMemberId: ADULT_A.id, inWaitingLoop: false });
    expect(rows[0].title).toBe(`2 documents need your signature for the ${SEASON} season.`);
  });

  it('is empty when the signer has nothing outstanding and the household is not in the waiting loop', () => {
    const requirements = requirementsWith({ signatures: [signature({ memberId: ADULT_A.id }), signature({ memberId: ADULT_B.id })] });
    expect(buildWaiverActionRows({ requirements, signerMemberId: ADULT_A.id, inWaitingLoop: false })).toEqual([]);

    const stillWaiting = requirementsWith({ signatures: [signature({ memberId: ADULT_A.id })] });
    expect(buildWaiverActionRows({ requirements: stillWaiting, signerMemberId: ADULT_A.id, inWaitingLoop: false })).toEqual([]);
  });

  it('adds a waiting-on-the-other-adult row once the signer is done and the household is in the waiting loop', () => {
    const requirements = requirementsWith({ signatures: [signature({ memberId: ADULT_A.id })] });
    const rows = buildWaiverActionRows({ requirements, signerMemberId: ADULT_A.id, inWaitingLoop: true });
    expect(rows).toEqual([
      {
        id: `waiver-waiting-${ADULT_B.id}`,
        title: `Your family's ${SEASON} membership is waiting on Blair's signatures.`,
        amountCents: null,
        actionLabel: 'Send a sign-in link',
        kind: 'form',
        formAction: '/my-account/sign?/sendNudge&context=renewal',
        fieldName: 'targetMemberId',
        fieldValue: ADULT_B.id,
      },
    ]);
  });

  it('is empty once the household is fully signed, even inside the waiting loop', () => {
    const requirements = requirementsWith({ signatures: [signature({ memberId: ADULT_A.id }), signature({ memberId: ADULT_B.id })] });
    expect(buildWaiverActionRows({ requirements, signerMemberId: ADULT_A.id, inWaitingLoop: true })).toEqual([]);
  });
});
