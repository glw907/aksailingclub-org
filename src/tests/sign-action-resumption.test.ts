// /my-account/sign's own `?/sign` action, the household-complete loop's own closing half
// (member-waivers T5b): once a fresh signature lands in a join/renewal context and the household
// is (now) complete, the managing adult gets the resumption email -- UNLESS the signer themself IS
// the managing adult, whose own moment continues straight to payment instead.
import { describe, expect, it, vi } from 'vitest';

const PUBLISHED_RELEASE = {
  concept: 'documents',
  id: 'general-release-v1',
  slug: 'general-release-v1',
  permalink: '',
  title: 'Release of Liability',
  tags: [],
  excerpt: '',
  wordCount: 0,
  draft: false,
  fields: {},
  frontmatter: { title: 'Release of Liability', document: 'general-release', version: 1, kind: 'release', audience: 'all-members', season: 2026, status: 'published' },
  body: 'The signable text.',
};
vi.mock('$chassis/content', () => ({
  documents: { all: () => [{ id: PUBLISHED_RELEASE.id }], byId: () => PUBLISHED_RELEASE },
}));

const { actions } = await import('../routes/(site)/my-account/sign/+page.server');
const { fakeD1 } = await import('./_fake-d1');

const ADULT_A_PRIMARY = { id: 'mem-adult-a', household_id: 'hh-1', name: 'Alex Adult', email: 'alex@example.com', archived_at: null };
const ADULT_B_SIGNER = { id: 'mem-adult-b', household_id: 'hh-1', name: 'Blair Adult', email: 'blair@example.com', archived_at: null };
const householdRow = (m: typeof ADULT_A_PRIMARY) => ({ id: m.id, name: m.name, email: m.email, phone: null, birthdate: '1985-03-01', directory_visibility: 'partial', archived_at: null });

/** Both adults' own signature rows, as they would read once THIS submission has already landed
 *  (fakeD1 is a stateless, scripted double: `recordSignature`'s own INSERT never feeds back into
 *  a LATER `.all()` read in the same test, so the fixture states the post-write world directly --
 *  the same "as if it just landed" technique the sign-send-nudge tests use for the same reason). */
function completedSignatures() {
  return [
    { id: 's1', document_id: 'general-release', season: 2026, member_id: ADULT_A_PRIMARY.id, minor_member_id: null, signed_at: '2026-06-01 00:00:00' },
    { id: 's2', document_id: 'general-release', season: 2026, member_id: ADULT_B_SIGNER.id, minor_member_id: null, signed_at: '2026-06-02 00:00:00' },
  ];
}

function fakeEvent(form: Record<string, string>, db: unknown, emailBinding: { send: ReturnType<typeof vi.fn> }, sessionMember: typeof ADULT_A_PRIMARY) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/sign?context=renewal'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    getClientAddress: () => '203.0.113.7',
    platform: { env: { CLUB_DB: db, EMAIL: emailBinding } },
  };
}

const SIGN_FORM = { documentId: 'general-release', name: 'Blair Adult' };

describe('?/sign: the resumption email (member-waivers T5b)', () => {
  it("sends the managing adult the resumption email once a NON-managing adult's signature completes the household", async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': ADULT_B_SIGNER,
        'FROM households WHERE id': { primary_member_id: ADULT_A_PRIMARY.id },
        "'current_season'": { value: '2026' },
        'SELECT 1 AS present FROM waiver_acceptances': null, // not yet signed -> the write proceeds
        'SELECT name, email FROM members WHERE id = ?1': { name: ADULT_A_PRIMARY.name, email: ADULT_A_PRIMARY.email },
      },
      allResults: {
        'FROM members WHERE household_id = ?1 ORDER BY name': [householdRow(ADULT_A_PRIMARY), householdRow(ADULT_B_SIGNER)],
        'FROM waiver_acceptances': completedSignatures(),
      },
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await actions.sign(fakeEvent(SIGN_FORM, db, { send }, ADULT_B_SIGNER) as never);
    expect(result).toEqual({ saved: true });

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe(ADULT_A_PRIMARY.email);
    expect(message.subject).toContain('Everyone has signed');
    expect(message.text).toContain('Blair Adult signed just now');
    expect(message.text).toContain('next=%2Fmy-account%2Frenew');
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO email_log') && c.args[2] === `waiver-resumption:hh-1:2026`)).toBe(true);
  });

  it("sends nothing when the signer IS the managing adult (their own moment continues straight to payment)", async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': ADULT_A_PRIMARY,
        'FROM households WHERE id': { primary_member_id: ADULT_A_PRIMARY.id },
        "'current_season'": { value: '2026' },
        'SELECT 1 AS present FROM waiver_acceptances': null,
      },
      allResults: {
        'FROM members WHERE household_id = ?1 ORDER BY name': [householdRow(ADULT_A_PRIMARY), householdRow(ADULT_B_SIGNER)],
        'FROM waiver_acceptances': completedSignatures(),
      },
    });
    const send = vi.fn();
    const result = await actions.sign(fakeEvent({ documentId: 'general-release', name: 'Alex Adult' }, db, { send }, ADULT_A_PRIMARY) as never);
    expect(result).toEqual({ saved: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing when the household is still incomplete after this signature', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': ADULT_B_SIGNER,
        'FROM households WHERE id': { primary_member_id: ADULT_A_PRIMARY.id },
        "'current_season'": { value: '2026' },
        'SELECT 1 AS present FROM waiver_acceptances': null,
      },
      allResults: {
        'FROM members WHERE household_id = ?1 ORDER BY name': [householdRow(ADULT_A_PRIMARY), householdRow(ADULT_B_SIGNER)],
        // Only Blair's own signature landed; Alex (the primary) is still outstanding.
        'FROM waiver_acceptances': [{ id: 's2', document_id: 'general-release', season: 2026, member_id: ADULT_B_SIGNER.id, minor_member_id: null, signed_at: '2026-06-02 00:00:00' }],
      },
    });
    const send = vi.fn();
    const result = await actions.sign(fakeEvent(SIGN_FORM, db, { send }, ADULT_B_SIGNER) as never);
    expect(result).toEqual({ saved: true });
    expect(send).not.toHaveBeenCalled();
  });
});
