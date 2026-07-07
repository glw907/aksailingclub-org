import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { findRedemptionForEnrollment, getCreditBalance, redeemCreditForEnrollment, reverseCreditForWithdrawal } from '$member-portal/lib/credits';

describe('getCreditBalance', () => {
  it('reads the balance computed by the SUM-minus-COUNT subquery', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'AS balance': { balance: 1 } } });
    await expect(getCreditBalance(db, 'hh-1')).resolves.toBe(1);
    expect(calls[0].args).toEqual(['hh-1']);
  });

  it('defaults to 0 when the query returns nothing', async () => {
    const { db } = fakeD1({ firstResults: { 'AS balance': null } });
    await expect(getCreditBalance(db, 'hh-1')).resolves.toBe(0);
  });
});

describe('redeemCreditForEnrollment', () => {
  it('inserts one credit_redemptions row', async () => {
    const { db, calls } = fakeD1();
    await redeemCreditForEnrollment(db, { householdId: 'hh-1', enrollmentId: 'enr-1', redeemedBy: 'mem-1' });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO credit_redemptions'));
    expect(insert?.args).toEqual([expect.any(String), 'hh-1', 'enr-1', 'mem-1']);
  });
});

describe('findRedemptionForEnrollment', () => {
  it('finds the redemption row for an enrollment, or null', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM credit_redemptions WHERE enrollment_id': { id: 'redeem-1' } } });
    await expect(findRedemptionForEnrollment(db, 'enr-1')).resolves.toEqual({ id: 'redeem-1' });
  });

  it('answers null when no redemption exists', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM credit_redemptions WHERE enrollment_id': null } });
    await expect(findRedemptionForEnrollment(db, 'enr-1')).resolves.toBeNull();
  });
});

describe('reverseCreditForWithdrawal', () => {
  it('appends a fresh grant against the household\'s most recent membership, never deleting the redemption', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM memberships WHERE household_id': { id: 'ms-1' } } });
    const result = await reverseCreditForWithdrawal(db, 'hh-1');
    expect(result).toEqual({ ok: true });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO credit_grants'));
    expect(insert?.args).toEqual([expect.any(String), 'hh-1', 'ms-1']);
    expect(insert?.sql).toContain('credits) VALUES (?1, ?2, ?3, 1)');
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
  });

  it('refuses when the household has no membership row to attach the reversal to', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM memberships WHERE household_id': null } });
    const result = await reverseCreditForWithdrawal(db, 'hh-1');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('No membership') });
  });
});
