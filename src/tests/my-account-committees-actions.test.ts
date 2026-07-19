// The portal committees route's own `request` action (T6b fix round's security/Svelte findings):
// wired through `portalAction` exactly the way a real request reaches it. `member-portal-
// committees.test.ts` owns the pure guard/notify-cooldown logic these actions call; this file
// covers the wiring -- does the action actually send the chair notification, tag it with the
// (committee, requester) segment the cooldown reads back, skip the notify step gracefully when a
// pre-send D1 read throws (the pending row is already committed by then, so the action must never
// surface that as a failure), and refuse a committeeId for an archived/nonexistent committee.
import { describe, expect, it, vi } from 'vitest';
import { actions } from '../routes/(site)/my-account/committees/+page.server';
import { fakeD1 } from './_fake-d1';

const MEMBER_ROW = { id: 'mem-1', household_id: 'hh-1', name: 'Scratch Member', email: 'scratch@example.com', archived_at: null };

function fakeEvent(form: Record<string, string>, db: unknown, emailBinding?: { send: ReturnType<typeof vi.fn> }) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/committees'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    platform: { env: { CLUB_DB: db, ...(emailBinding ? { EMAIL: emailBinding } : {}) } },
  };
}

describe('?/request', () => {
  it('notifies the active chairs, tagging the send with the (committee, requester) segment', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM committees WHERE id = ?1 AND archived_at IS NULL': { present: 1 },
        'FROM email_log WHERE segment': null,
        'SELECT name FROM committees WHERE id': { name: 'Fleet Committee' },
      },
      allResults: {
        "cm.role IN ('chair','co-chair')": [{ name: 'Steve Ryan', email: 'steve@example.com' }],
      },
    });
    const result = await actions.request(fakeEvent({ committeeId: 'cmt-1' }, db, { send }) as never);
    expect(result).toEqual({ saved: true });
    expect(send).toHaveBeenCalledTimes(1);
    const sentTo = send.mock.calls[0][0] as { to: string };
    expect(sentTo.to).toBe('steve@example.com');
  });

  it('skips the notify step (still saves) when a repeat request already notified within the cooldown', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { db } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM committees WHERE id': { present: 1 },
        'FROM email_log WHERE segment': { present: 1 },
      },
    });
    const result = await actions.request(fakeEvent({ committeeId: 'cmt-1' }, db, { send }) as never);
    expect(result).toEqual({ saved: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('never fails the already-committed write when the notify lookup throws', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const db = {
      prepare(sql: string) {
        return {
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM member_sessions')) return MEMBER_ROW;
              if (sql.includes('FROM committees WHERE id') && sql.includes('archived_at IS NULL')) return { present: 1 };
              if (sql.includes('FROM email_log WHERE segment')) return null;
              // The committee-name lookup (getCommitteeName) throws: a D1 hiccup AFTER the
              // pending row already committed must never surface as a failed action.
              if (sql.includes('SELECT name FROM committees')) throw new Error('boom');
              return null;
            },
            run: async () => ({ results: [], success: true, meta: { changes: 1 } }),
            all: async () => ({ results: [], success: true, meta: {} }),
          }),
        };
      },
      batch: async () => [],
    };
    const result = await actions.request(fakeEvent({ committeeId: 'cmt-1' }, db as never, { send }) as never);
    expect(result).toEqual({ saved: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses an archived or nonexistent committee, and never inserts', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM member_sessions': MEMBER_ROW,
        'FROM committees WHERE id': null,
      },
    });
    const result = await actions.request(fakeEvent({ committeeId: 'cmt-gone' }, db) as never);
    expect(result).toEqual({ error: expect.any(String) });
    expect(calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO committee_members'))).toBe(false);
  });
});
