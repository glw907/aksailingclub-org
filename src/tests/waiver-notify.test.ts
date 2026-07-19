// waiver-notify.ts's own coverage (member-waivers T5b): the nudge and resumption emails send the
// exact copy from signing-framing-copy.md, mint a real sign-in link, and each degrade/cooldown
// exactly the way `committees.ts`'s own `email_log`-backed idiom does.
import { describe, expect, it, vi } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  nudgeRecentlySent,
  nudgeSegment,
  resumptionAlreadySent,
  resumptionSegment,
  sendWaiverNudgeEmail,
  sendWaiverResumptionEmail,
} from '$member-portal/lib/waiver-notify';

const ORIGIN = 'https://dev.aksailingclub.org';

describe('sendWaiverNudgeEmail', () => {
  it('sends the exact subject/body, a deep link to the signing moment, and logs the nudge segment', async () => {
    const { db, calls } = fakeD1();
    const send = vi.fn().mockResolvedValue(undefined);

    await sendWaiverNudgeEmail(db, { EMAIL: { send } }, {
      managerName: 'Alex Adult',
      target: { memberId: 'mem-blair', name: 'Blair Adult', email: 'blair@example.com' },
      season: 2027,
      context: 'renewal',
      outstandingCount: 2,
      origin: ORIGIN,
    });

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe('blair@example.com');
    expect(message.subject).toBe("Your signature is needed for your family's 2027 membership");
    expect(message.text).toContain('Alex Adult completed your family\'s 2027 renewal');
    expect(message.text).toContain('2 documents need your signature');
    expect(message.text).toContain('about 4 minutes');
    expect(message.text).toContain(`${ORIGIN}/my-account/confirm?token=`);
    expect(message.text).toContain('next=%2Fmy-account%2Fsign%3Fcontext%3Drenewal');

    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO member_tokens'));
    expect(insert?.args[1]).toBe('mem-blair');
    const logWrite = calls.find((c) => c.sql.startsWith('INSERT INTO email_log'));
    expect(logWrite?.args[2]).toBe(nudgeSegment('mem-blair', 2027));
  });

  it('names the join context in the join loop\'s own nudge', async () => {
    const { db } = fakeD1();
    const send = vi.fn().mockResolvedValue(undefined);
    await sendWaiverNudgeEmail(db, { EMAIL: { send } }, {
      managerName: 'Alex Adult',
      target: { memberId: 'mem-blair', name: 'Blair Adult', email: 'blair@example.com' },
      season: 2027,
      context: 'join',
      outstandingCount: 1,
      origin: ORIGIN,
    });
    expect(send.mock.calls[0][0].text).toContain("family's 2027 join");
  });

  it('never sends when the target has no email on file, and never throws', async () => {
    const { db, calls } = fakeD1();
    const send = vi.fn();
    await sendWaiverNudgeEmail(db, { EMAIL: { send } }, {
      managerName: 'Alex Adult',
      target: { memberId: 'mem-blair', name: 'Blair Adult', email: null },
      season: 2027,
      context: 'renewal',
      outstandingCount: 1,
      origin: ORIGIN,
    });
    expect(send).not.toHaveBeenCalled();
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO member_tokens'))).toBe(false);
  });

  it('degrades silently with no EMAIL binding', async () => {
    const { db } = fakeD1();
    await expect(
      sendWaiverNudgeEmail(db, {}, {
        managerName: 'Alex Adult',
        target: { memberId: 'mem-blair', name: 'Blair Adult', email: 'blair@example.com' },
        season: 2027,
        context: 'renewal',
        outstandingCount: 1,
        origin: ORIGIN,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('nudgeRecentlySent', () => {
  it('is true within the cooldown window and false outside it', async () => {
    const recent = fakeD1({ firstResults: { 'FROM email_log WHERE segment': { present: 1 } } });
    expect(await nudgeRecentlySent(recent.db, 'mem-blair', 2027)).toBe(true);

    const none = fakeD1();
    expect(await nudgeRecentlySent(none.db, 'mem-blair', 2027)).toBe(false);
  });
});

describe('sendWaiverResumptionEmail', () => {
  it('sends the exact subject/body deep-linking to the payment step and logs the resumption segment', async () => {
    const { db, calls } = fakeD1();
    const send = vi.fn().mockResolvedValue(undefined);

    await sendWaiverResumptionEmail(db, { EMAIL: { send } }, {
      manager: { memberId: 'mem-alex', name: 'Alex Adult', email: 'alex@example.com' },
      signerName: 'Blair Adult',
      householdId: 'hh-1',
      season: 2027,
      paymentPath: '/my-account/renew',
      origin: ORIGIN,
    });

    const message = send.mock.calls[0][0];
    expect(message.to).toBe('alex@example.com');
    expect(message.subject).toBe("Everyone has signed—finish your family's 2027 membership");
    expect(message.text).toContain('Blair Adult signed just now, so your household is complete.');
    expect(message.text).toContain(`${ORIGIN}/my-account/confirm?token=`);
    expect(message.text).toContain('next=%2Fmy-account%2Frenew');

    const logWrite = calls.find((c) => c.sql.startsWith('INSERT INTO email_log'));
    expect(logWrite?.args[2]).toBe(resumptionSegment('hh-1', 2027));
  });

  it('never sends when the manager has no email on file', async () => {
    const { db } = fakeD1();
    const send = vi.fn();
    await sendWaiverResumptionEmail(db, { EMAIL: { send } }, {
      manager: { memberId: 'mem-alex', name: 'Alex Adult', email: null },
      signerName: 'Blair Adult',
      householdId: 'hh-1',
      season: 2027,
      paymentPath: '/my-account/renew',
      origin: ORIGIN,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('resumptionAlreadySent', () => {
  it('is true only once a sent row exists for the segment, with no time bound', async () => {
    const sent = fakeD1({ firstResults: { "FROM email_log WHERE segment": { present: 1 } } });
    expect(await resumptionAlreadySent(sent.db, 'hh-1', 2027)).toBe(true);

    const none = fakeD1();
    expect(await resumptionAlreadySent(none.db, 'hh-1', 2027)).toBe(false);
  });
});
