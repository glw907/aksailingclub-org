import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { ensureMember } from '$admin-club/lib/people';

describe('ensureMember', () => {
  it('returns an existing member/household id by email, writing nothing', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM members WHERE email': { id: 'mem-1', household_id: 'hh-1' } },
    });
    const result = await ensureMember(db, { name: 'Jamie Rivera', email: 'jamie@example.com' });
    expect(result).toEqual({ memberId: 'mem-1', householdId: 'hh-1', created: false });
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });

  it('never overwrites an existing member\'s name/phone, even when the call args differ', async () => {
    const { db, calls } = fakeD1({
      firstResults: { 'FROM members WHERE email': { id: 'mem-1', household_id: 'hh-1' } },
    });
    await ensureMember(db, { name: 'A Different Name', email: 'jamie@example.com', phone: '+19075550000' });
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it('creates a household then a member then sets the primary, all in one batch, for an unknown email', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM members WHERE email': null } });
    const result = await ensureMember(db, { name: 'Jamie Rivera', email: 'jamie@example.com', phone: '+19075551234' });
    expect(result.created).toBe(true);
    expect(result.memberId).toBeTruthy();
    expect(result.householdId).toBeTruthy();

    expect(calls).toHaveLength(4); // the pre-check SELECT, plus the 3-statement batch
    const householdInsert = calls.find((c) => c.sql.startsWith('INSERT INTO households'));
    expect(householdInsert?.args).toEqual([result.householdId, 'Jamie Rivera']);

    const memberInsert = calls.find((c) => c.sql.startsWith('INSERT INTO members'));
    expect(memberInsert?.args).toEqual([result.memberId, result.householdId, 'Jamie Rivera', 'jamie@example.com', '+19075551234']);

    const primaryUpdate = calls.find((c) => c.sql.startsWith('UPDATE households'));
    expect(primaryUpdate?.sql).toContain('primary_member_id');
    expect(primaryUpdate?.args).toEqual([result.memberId, result.householdId]);
  });

  it('stores a null phone when none is given', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM members WHERE email': null } });
    await ensureMember(db, { name: 'No Phone', email: 'nophone@example.com' });
    const memberInsert = calls.find((c) => c.sql.startsWith('INSERT INTO members'));
    expect((memberInsert?.args as unknown[])[4]).toBeNull();
  });
});
