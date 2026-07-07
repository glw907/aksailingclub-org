import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { updateProfile, validatePhone } from '$member-portal/lib/profile';

describe('validatePhone', () => {
  it('accepts a well-formed E.164 number', () => {
    expect(validatePhone('+19075551234')).toEqual({ ok: true, value: '+19075551234' });
  });

  it('accepts an empty string as "no phone"', () => {
    expect(validatePhone('  ')).toEqual({ ok: true, value: null });
  });

  it('refuses a number missing the country code', () => {
    expect(validatePhone('9075551234')).toEqual({ error: expect.stringContaining('country code') });
  });

  it('refuses a non-digit-shaped string', () => {
    expect(validatePhone('+1 (907) 555-1234')).toEqual({ error: expect.stringContaining('country code') });
  });
});

describe('updateProfile', () => {
  const VALID = { email: 'member@example.com', phone: '+19075551234', birthdate: '1990-05-01' };

  it('writes all three fields when every one validates', async () => {
    const { db, calls } = fakeD1();
    const result = await updateProfile(db, 'mem-1', VALID);
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members'));
    expect(update?.args).toEqual(['member@example.com', '+19075551234', '1990-05-01', 'mem-1']);
  });

  it('refuses (writing nothing) on a bad phone number before touching the database', async () => {
    const { db, calls } = fakeD1();
    const result = await updateProfile(db, 'mem-1', { ...VALID, phone: 'not-a-phone' });
    expect(result).toEqual({ error: expect.stringContaining('country code') });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it('refuses on a bad email', async () => {
    const { db } = fakeD1();
    const result = await updateProfile(db, 'mem-1', { ...VALID, email: 'not-an-email' });
    expect(result).toEqual({ error: expect.stringContaining('email') });
  });

  it('refuses on a bad birthdate', async () => {
    const { db } = fakeD1();
    const result = await updateProfile(db, 'mem-1', { ...VALID, birthdate: 'not-a-date' });
    expect(result).toEqual({ error: expect.stringContaining('date') });
  });

  it('clears email/phone/birthdate on empty input (all three are optional)', async () => {
    const { db, calls } = fakeD1();
    await updateProfile(db, 'mem-1', { email: '', phone: '', birthdate: '' });
    const update = calls.find((c) => c.sql.startsWith('UPDATE members'));
    expect(update?.args).toEqual([null, null, null, 'mem-1']);
  });

  it('turns a UNIQUE(email) collision into a plain-words refusal, not a 500', async () => {
    const { db } = fakeD1();
    db.prepare = (sql: string) => {
      const stmt = {
        sql,
        bind: () => stmt,
        run: () => Promise.reject(new Error('UNIQUE constraint failed: members.email: SQLITE_CONSTRAINT')),
        first: async () => null,
        all: async () => ({ results: [], success: true, meta: {} }),
      };
      return stmt as unknown as ReturnType<typeof db.prepare>;
    };
    const result = await updateProfile(db, 'mem-1', VALID);
    expect(result).toEqual({ error: expect.stringContaining('already on file') });
  });
});
