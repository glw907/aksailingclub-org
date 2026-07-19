// /my-account/sign's own `?/sendNudge` action (member-waivers T5b, spec rule 2's own "one adult
// never signs for another" mirrored on the send side): the server-side denial for a target outside
// the acting household, the acting member themself, or an adult with nothing outstanding, plus the
// cooldown guard and the real send on a legitimate target.
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

const ADULT_A = { id: 'mem-adult-a', household_id: 'hh-1', name: 'Alex Adult', email: 'alex@example.com', archived_at: null };
const ADULT_B = { id: 'mem-adult-b', name: 'Blair Adult', email: 'blair@example.com', phone: null, birthdate: '1987-09-01', directory_visibility: 'partial', archived_at: null };
const OTHER_HOUSEHOLD_MEMBER = { id: 'mem-outsider', name: 'Casey Outsider', email: 'casey@example.com', phone: null, birthdate: '1990-01-01', directory_visibility: 'partial', archived_at: null };

const householdMemberRow = (overrides: Partial<typeof ADULT_A> = {}) => ({ id: ADULT_A.id, name: ADULT_A.name, email: ADULT_A.email, phone: null, birthdate: '1985-03-01', directory_visibility: 'partial', archived_at: null, ...overrides });

function fakeEvent(form: Record<string, string>, db: unknown, emailBinding?: { send: ReturnType<typeof vi.fn> }, context = 'renewal') {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL(`http://localhost/my-account/sign?context=${context}`),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    platform: { env: { CLUB_DB: db, ...(emailBinding ? { EMAIL: emailBinding } : {}) } },
  };
}

describe('?/sendNudge', () => {
  it('refuses to nudge the acting member themself', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM member_sessions': ADULT_A, 'FROM households WHERE id': { primary_member_id: ADULT_A.id }, "'current_season'": { value: '2026' } },
      allResults: { 'FROM members WHERE household_id = ?1 ORDER BY name': [householdMemberRow(), ADULT_B] },
    });
    const send = vi.fn();
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: ADULT_A.id }, db, { send }) as never);
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a target who has nothing of their own outstanding to sign', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM member_sessions': ADULT_A, 'FROM households WHERE id': { primary_member_id: ADULT_A.id }, "'current_season'": { value: '2026' } },
      allResults: {
        'FROM members WHERE household_id = ?1 ORDER BY name': [householdMemberRow(), ADULT_B],
        // Both adults already signed: nobody is outstanding.
        'FROM waiver_acceptances': [
          { id: 's1', document_id: 'general-release', season: 2026, member_id: ADULT_A.id, minor_member_id: null, signed_at: '2026-06-01 00:00:00' },
          { id: 's2', document_id: 'general-release', season: 2026, member_id: ADULT_B.id, minor_member_id: null, signed_at: '2026-06-01 00:00:00' },
        ],
      },
    });
    const send = vi.fn();
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: ADULT_B.id }, db, { send }) as never);
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a member id from OUTSIDE the acting household, even one with a real outstanding requirement of its own', async () => {
    const { db } = fakeD1({
      firstResults: { 'FROM member_sessions': ADULT_A, 'FROM households WHERE id': { primary_member_id: ADULT_A.id }, "'current_season'": { value: '2026' } },
      // Only ADULT_A's own household is stubbed as a member; OUTSIDER never appears in it, so the
      // gate's own `remaining` list (scoped to this household) never contains it.
      allResults: { 'FROM members WHERE household_id = ?1 ORDER BY name': [householdMemberRow()] },
    });
    const send = vi.fn();
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: OTHER_HOUSEHOLD_MEMBER.id }, db, { send }) as never);
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses outside a join/renewal context', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM member_sessions': ADULT_A } });
    const send = vi.fn();
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: ADULT_B.id }, db, { send }, 'class-signup') as never);
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the nudge to a real outstanding OTHER adult of the same household', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': ADULT_A,
        'FROM households WHERE id': { primary_member_id: ADULT_A.id },
        "'current_season'": { value: '2026' },
        'FROM members WHERE id = ?1 AND household_id = ?2 AND archived_at IS NULL': { email: ADULT_B.email },
      },
      allResults: { 'FROM members WHERE household_id = ?1 ORDER BY name': [householdMemberRow(), ADULT_B] },
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: ADULT_B.id }, db, { send }) as never);
    expect(result).toEqual({ nudgeSent: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(ADULT_B.email);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO member_tokens'))).toBe(true);
  });

  it('is a no-op (no send) within the cooldown window, but still answers success', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': ADULT_A,
        'FROM households WHERE id': { primary_member_id: ADULT_A.id },
        "'current_season'": { value: '2026' },
        'FROM email_log WHERE segment': { present: 1 },
      },
      allResults: { 'FROM members WHERE household_id = ?1 ORDER BY name': [householdMemberRow(), ADULT_B] },
    });
    const send = vi.fn();
    const result = await actions.sendNudge(fakeEvent({ targetMemberId: ADULT_B.id }, db, { send }) as never);
    expect(result).toEqual({ nudgeSent: true });
    expect(send).not.toHaveBeenCalled();
  });
});
