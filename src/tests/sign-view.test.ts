// Unit tests for the signing moment's pure view logic (member-waivers T4, sign-view.ts): entry
// ordering, the signed/current/upcoming state machine, the "type once, sign each" prefill
// carry-forward, the AS 09.65.292 attestation carry-forward, the welcome line, and the time
// estimate. Mirrors directory-view.test.ts's own pattern (each rule exercised on its own, no DOM,
// no database).
import { describe, expect, it } from 'vitest';
import {
  buildHouseholdSignatureRows,
  buildSigningMoment,
  buildWelcome,
  firstNameOf,
  formatSignedDate,
  framingLine,
  joinNames,
  minorFramingLine,
  orderSigningItems,
  signerOwnDone,
  timeEstimateMinutes,
  waitingIntroLine,
  type SigningItem,
} from '../routes/(site)/my-account/sign/sign-view';
import { deriveHouseholdRequirements, type DeriveHouseholdRequirementsInput } from '$member-portal/lib/waiver-requirements';
import type { DocumentFrontmatter, SignableDocument } from '$theme/documents';

function personal(overrides: Partial<SigningItem> & Pick<SigningItem, 'documentId' | 'documentKind' | 'title'>): SigningItem {
  return {
    key: overrides.key ?? overrides.documentId,
    kind: 'personal',
    version: 1,
    ...overrides,
  };
}

function minor(
  overrides: Partial<SigningItem> & Pick<SigningItem, 'documentId' | 'title'> & { minor: NonNullable<SigningItem['minor']> },
): SigningItem {
  return {
    key: overrides.key ?? `${overrides.documentId}:${overrides.minor.memberId}`,
    kind: 'minor',
    version: 1,
    documentKind: 'release',
    ...overrides,
  };
}

describe('timeEstimateMinutes', () => {
  it('is 2 x N, floored at 2 minutes', () => {
    expect(timeEstimateMinutes(1)).toBe(2);
    expect(timeEstimateMinutes(2)).toBe(4);
    expect(timeEstimateMinutes(3)).toBe(6);
    expect(timeEstimateMinutes(0)).toBe(2);
  });
});

describe('buildWelcome', () => {
  it('uses the single-document copy for one document', () => {
    const welcome = buildWelcome(2027, 1);
    expect(welcome.heading).toBe('A signature for the 2027 season.');
    expect(welcome.body).toContain('One document needs your signature');
    expect(welcome.body).toContain('a couple of minutes');
    expect(welcome.body).not.toContain('1 documents');
  });

  it('names the count and the estimate for several documents', () => {
    const welcome = buildWelcome(2027, 3);
    expect(welcome.heading).toBe('Signatures for the 2027 season.');
    expect(welcome.body).toContain('3 documents need your signature');
    expect(welcome.body).toContain('about 6 minutes');
  });
});

describe('framing lines', () => {
  it('gives each named document its verbatim framing line', () => {
    expect(framingLine('general-release')).toContain('This is the club');
    expect(framingLine('rules-acknowledgement')).toContain('rules every member agrees to live by');
    expect(framingLine('mooring-agreement')).toContain('comes with your mooring');
  });

  it('falls back to a plain read-it-in-full line for an unnamed document', () => {
    expect(framingLine('some-future-doc')).toBe('Read this document in full before you sign.');
  });

  it('names the child in a Part Two framing line', () => {
    expect(minorFramingLine('Robin')).toBe("You're signing this part for Robin, as their parent or guardian. Read it in full before you sign.");
  });
});

describe('formatSignedDate', () => {
  it('formats a SQLite datetime as a friendly date, reading only the date part', () => {
    expect(formatSignedDate('2026-05-14 23:59:59')).toBe('14 May 2026');
    expect(formatSignedDate('2027-01-02')).toBe('2 January 2027');
  });

  it('falls back to the raw value when it does not parse', () => {
    expect(formatSignedDate('not-a-date')).toBe('not-a-date');
  });
});

describe('orderSigningItems', () => {
  it('puts personal documents first (by kind rank, then title), then per-child minors grouped by child', () => {
    const items: SigningItem[] = [
      minor({ documentId: 'general-release', title: 'Release', minor: { memberId: 'kid-b', name: 'Sam', birthYear: 2015 } }),
      personal({ documentId: 'mooring-agreement', documentKind: 'agreement', title: 'Mooring Agreement' }),
      personal({ documentId: 'rules-acknowledgement', documentKind: 'acknowledgement', title: 'Club Rules Acknowledgement' }),
      personal({ documentId: 'general-release', documentKind: 'release', title: 'Release of Liability' }),
      minor({ documentId: 'general-release', title: 'Release', minor: { memberId: 'kid-a', name: 'Alex', birthYear: 2016 } }),
    ];
    const ordered = orderSigningItems(items);
    expect(ordered.map((i) => `${i.kind}:${i.documentKind}:${i.minor?.name ?? i.documentId}`)).toEqual([
      'personal:release:general-release',
      'personal:acknowledgement:rules-acknowledgement',
      'personal:agreement:mooring-agreement',
      'minor:release:Alex',
      'minor:release:Sam',
    ]);
  });
});

describe('buildSigningMoment', () => {
  const releaseItem = personal({ documentId: 'general-release', documentKind: 'release', title: 'Release of Liability' });
  const rulesItem = personal({ documentId: 'rules-acknowledgement', documentKind: 'acknowledgement', title: 'Club Rules Acknowledgement' });
  const mooringItem = personal({ documentId: 'mooring-agreement', documentKind: 'agreement', title: 'Mooring Agreement' });

  it('marks the first outstanding entry current, the rest upcoming, and none signed on a fresh moment', () => {
    const moment = buildSigningMoment([releaseItem, rulesItem, mooringItem], { season: 2027 });
    expect(moment.entries.map((e) => e.state)).toEqual(['current', 'upcoming', 'upcoming']);
    expect(moment.entries[0].progressLabel).toBe('Document 1 of 3');
    expect(moment.entries[1].progressLabel).toBeNull();
    expect(moment.signedCount).toBe(0);
    expect(moment.allSigned).toBe(false);
  });

  it('collapses a signed entry to a receipt and advances current to the next outstanding one', () => {
    const signedRelease = { ...releaseItem, signature: { personName: 'Dana Rivers', signerRelationship: null, signedAt: '2026-05-14 10:00:00' } };
    const moment = buildSigningMoment([signedRelease, rulesItem, mooringItem], { season: 2027 });
    expect(moment.entries.map((e) => e.state)).toEqual(['signed', 'current', 'upcoming']);
    expect(moment.entries[0].receiptText).toBe('Signed 14 May 2026 as Dana Rivers.');
    expect(moment.entries[1].progressLabel).toBe('Document 2 of 3');
    expect(moment.signedCount).toBe(1);
  });

  it('reports allSigned when every entry has a signature', () => {
    const withSig = (item: SigningItem, name: string): SigningItem => ({
      ...item,
      signature: { personName: name, signerRelationship: null, signedAt: '2026-05-14 10:00:00' },
    });
    const moment = buildSigningMoment([withSig(releaseItem, 'Dana'), withSig(rulesItem, 'Dana')], { season: 2027 });
    expect(moment.allSigned).toBe(true);
    expect(moment.entries.every((e) => e.state === 'signed')).toBe(true);
  });

  it('carries the typed name forward: empty on the first sign, the last-used name on the next current entry', () => {
    // Fresh: first current entry has no prefill (typed fresh).
    const fresh = buildSigningMoment([releaseItem, rulesItem], { season: 2027 });
    expect(fresh.entries[0].prefillName).toBe('');

    // After the release is signed, the next current entry prefills with the name just used.
    const afterFirst = buildSigningMoment(
      [{ ...releaseItem, signature: { personName: 'Dana Rivers', signerRelationship: null, signedAt: '2026-05-14 10:00:00' } }, rulesItem],
      { season: 2027 },
    );
    expect(afterFirst.entries[1].prefillName).toBe('Dana Rivers');
  });

  it('leaves the first child unselected and carries the attested relationship forward to the next child', () => {
    const kidA = minor({ documentId: 'general-release', title: 'Release', minor: { memberId: 'kid-a', name: 'Alex', birthYear: 2016 } });
    const kidB = minor({ documentId: 'general-release', title: 'Release', minor: { memberId: 'kid-b', name: 'Sam', birthYear: 2015 } });

    // First child, none signed: the current minor entry preselects nothing.
    const fresh = buildSigningMoment([kidA, kidB], { season: 2027 });
    expect(fresh.entries[0].kind).toBe('minor');
    expect(fresh.entries[0].carriedRelationship).toBeNull();

    // After the first child is signed as 'parent', the next child's current entry carries it.
    const afterFirst = buildSigningMoment(
      [{ ...kidA, signature: { personName: 'Dana Rivers', signerRelationship: 'parent', signedAt: '2026-05-14 10:00:00' } }, kidB],
      { season: 2027 },
    );
    expect(afterFirst.entries[1].carriedRelationship).toBe('parent');
  });

  it('attaches the child framing line and identity to a minor entry', () => {
    const kid = minor({ documentId: 'general-release', title: 'Release of Liability', minor: { memberId: 'kid-a', name: 'Alex', birthYear: 2016 } });
    const moment = buildSigningMoment([kid], { season: 2027 });
    expect(moment.entries[0].framingLine).toContain('signing this part for Alex');
    expect(moment.entries[0].minor).toEqual({ memberId: 'kid-a', name: 'Alex', birthYear: 2016 });
  });
});

describe('signerOwnDone', () => {
  it('is true when there was nothing to sign at all, or when everything is signed', () => {
    expect(signerOwnDone({ total: 0, allSigned: false })).toBe(true);
    expect(signerOwnDone({ total: 2, allSigned: true })).toBe(true);
  });

  it('is false while anything remains', () => {
    expect(signerOwnDone({ total: 2, allSigned: false })).toBe(false);
  });
});

describe('firstNameOf', () => {
  it('takes the first token of a full name', () => {
    expect(firstNameOf('Blair Adult')).toBe('Blair');
  });

  it('falls back to the whole (trimmed) name for a single token', () => {
    expect(firstNameOf('  Cher  ')).toBe('Cher');
  });
});

describe('joinNames', () => {
  it('joins one, two, and three-or-more names naturally', () => {
    expect(joinNames(['Blair'])).toBe('Blair');
    expect(joinNames(['Blair', 'Casey'])).toBe('Blair and Casey');
    expect(joinNames(['Blair', 'Casey', 'Devon'])).toBe('Blair, Casey, and Devon');
  });

  it('is empty for no names', () => {
    expect(joinNames([])).toBe('');
  });
});

describe('waitingIntroLine', () => {
  it("names the remaining adult(s) and reads verbatim from signing-framing-copy.md", () => {
    expect(waitingIntroLine(['Blair Adult'])).toBe("Your signatures are done. Blair's are needed before payment.");
    expect(waitingIntroLine(['Blair Adult', 'Casey Adult'])).toBe("Your signatures are done. Blair and Casey's are needed before payment.");
  });
});

describe('buildHouseholdSignatureRows', () => {
  const SEASON = 2027;
  const ADULT_A = { id: 'mem-adult-a', name: 'Alex Adult', birthdate: '1985-03-01' };
  const ADULT_B = { id: 'mem-adult-b', name: 'Blair Adult', birthdate: '1987-09-01' };

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

  function requirementsWith(overrides: Partial<DeriveHouseholdRequirementsInput> = {}) {
    const release = doc({ id: 'general-release-v1', document: 'general-release', kind: 'release' });
    return deriveHouseholdRequirements({
      season: SEASON,
      primaryMemberId: ADULT_A.id,
      members: [ADULT_A, ADULT_B],
      assetKinds: [],
      publishedDocuments: new Map([[release.frontmatter.document, release]]),
      signatures: [],
      ...overrides,
    });
  }

  it('always leads with the "You" row, from the signer\'s own signed/total', () => {
    const requirements = requirementsWith();
    const rows = buildHouseholdSignatureRows({ signerMemberId: ADULT_A.id, signerSignedCount: 2, signerTotal: 2, minorNames: [], requirements });
    expect(rows[0]).toEqual({ key: 'you', label: 'You', statusText: '2 of 2 signed', nudgeMemberId: null, nudgeButtonLabel: null, waitingCardTitle: null, waitingCardLine: null });
  });

  it('lists the household\'s minors as covered once present', () => {
    const requirements = requirementsWith();
    const rows = buildHouseholdSignatureRows({ signerMemberId: ADULT_A.id, signerSignedCount: 1, signerTotal: 1, minorNames: ['Casey Child'], requirements });
    expect(rows.find((r) => r.key === 'children')).toEqual({
      key: 'children',
      label: 'Casey Child',
      statusText: 'covered by your Part Two signatures above',
      nudgeMemberId: null,
      nudgeButtonLabel: null,
      waitingCardTitle: null,
      waitingCardLine: null,
    });
  });

  it("adds one row per OTHER outstanding adult, with its own nudge target, button label, and waiting-card copy, and never a row for the signer themself", () => {
    const requirements = requirementsWith();
    const rows = buildHouseholdSignatureRows({ signerMemberId: ADULT_A.id, signerSignedCount: 1, signerTotal: 1, minorNames: [], requirements });
    const blairRow = rows.find((r) => r.key === ADULT_B.id);
    expect(blairRow).toEqual({
      key: ADULT_B.id,
      label: 'Blair Adult',
      statusText: "1 of their own to sign—payment and membership wait on these",
      nudgeMemberId: ADULT_B.id,
      nudgeButtonLabel: 'Email Blair a sign-in link',
      waitingCardTitle: 'Waiting on Blair',
      waitingCardLine:
        "1 documents need Blair's own signature—a signature is personal, so no one else can sign them. Payment and your family's 2027 membership unlock when everyone has signed.",
    });
    expect(rows.some((r) => r.key === ADULT_A.id)).toBe(false);
  });

  it('carries no other-adult row once every adult has signed', () => {
    const requirements = requirementsWith({
      signatures: [
        { id: 's1', documentId: 'general-release', season: SEASON, memberId: ADULT_A.id, minorMemberId: null, signedAt: '2027-06-01 12:00:00' },
        { id: 's2', documentId: 'general-release', season: SEASON, memberId: ADULT_B.id, minorMemberId: null, signedAt: '2027-06-01 12:00:00' },
      ],
    });
    const rows = buildHouseholdSignatureRows({ signerMemberId: ADULT_A.id, signerSignedCount: 1, signerTotal: 1, minorNames: [], requirements });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('you');
  });
});
