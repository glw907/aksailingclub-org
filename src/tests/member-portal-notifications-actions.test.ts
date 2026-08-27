// The portal Notifications section's own action (Task 3,
// docs/2026-08-25-email-announce-design.md's "The opt-in surfaces"): wired through `portalAction`
// exactly the way a real request reaches it, following `my-account-committees-actions.test.ts`'s
// own `fakeEvent` shape. The forged-member-id claim is the point: `updateNotifications` never
// reads a member id from the form, so a payload carrying someone else's id still writes only the
// signed-in member's own row.
import { describe, expect, it } from 'vitest';
import { actions } from '../routes/(site)/my-account/profile/+page.server';
import { fakeD1 } from './_fake-d1';

const MEMBER_ROW = { id: 'mem-1', household_id: 'hh-1', name: 'Scratch Member', email: 'scratch@example.com', archived_at: null };

function fakeEvent(form: Record<string, string>, db: unknown) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/profile'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    platform: { env: { CLUB_DB: db } },
  };
}

describe('?/updateNotifications', () => {
  it("writes the signed-in member's own club_email_opt_in when turning it on", async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-other' },
      },
    });
    const result = await actions.updateNotifications(fakeEvent({ clubEmailOptIn: 'on' }, db) as never);
    expect(result).toEqual({ saved: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members SET club_email_opt_in'));
    expect(update?.args).toEqual([1, 'mem-1']);
  });

  it('writes off when the checkbox is unchecked (absent from the form)', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-other' },
      },
    });
    const result = await actions.updateNotifications(fakeEvent({}, db) as never);
    expect(result).toEqual({ saved: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members SET club_email_opt_in'));
    expect(update?.args).toEqual([0, 'mem-1']);
  });

  it('ignores a forged member id in the payload: the write still targets the signed-in session member', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM households WHERE id': { primary_member_id: 'mem-other' },
      },
    });
    const result = await actions.updateNotifications(fakeEvent({ clubEmailOptIn: 'on', memberId: 'mem-victim' }, db) as never);
    expect(result).toEqual({ saved: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members SET club_email_opt_in'));
    expect(update?.args).toEqual([1, 'mem-1']);
    expect(update?.args).not.toContain('mem-victim');
  });
});
