// /my-account/classes's own `?/register` action: member-waivers T5b's own wiring proof -- when
// `registerForClass` (member-portal-classes.test.ts's own thorough coverage of the gate itself)
// answers the unsigned-edge pivot, this action redirects into the signing moment rather than
// returning a plain refusal.
import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';

vi.mock('$member-portal/lib/classes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$member-portal/lib/classes')>();
  return { ...actual, registerForClass: vi.fn().mockResolvedValue({ pivot: 'sign' }) };
});

const { actions } = await import('../routes/(site)/my-account/classes/+page.server');
const { fakeD1 } = await import('./_fake-d1');

const MEMBER_ROW = { id: 'mem-1', household_id: 'hh-1', name: 'Scratch Member', email: 'scratch@example.com', archived_at: null };

function fakeEvent(form: Record<string, string>, db: unknown) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/classes'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    platform: { env: { CLUB_DB: db } },
  };
}

async function catchThrown(value: unknown): Promise<unknown> {
  try {
    return await value;
  } catch (err) {
    return err;
  }
}

describe('?/register: the unsigned-edge pivot (member-waivers T5b)', () => {
  it('redirects into the signing moment, deep-linking back to class signup, rather than returning a plain refusal', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM member_sessions': MEMBER_ROW, 'FROM households WHERE id': { primary_member_id: 'mem-1' } } });
    const caught = await catchThrown(actions.register(fakeEvent({ classId: 'youth-basics', memberId: 'mem-kid' }, db) as never));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toBe('/my-account/sign?context=class-signup&next=%2Fmy-account%2Fclasses');
  });
});
