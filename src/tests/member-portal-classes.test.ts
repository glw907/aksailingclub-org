import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  adminDropEnrollment,
  claimOfferFromPortal,
  joinWaitlist,
  leaveWaitlist,
  listEnrolleeOptions,
  listMyClasses,
  listMyWaitlistEntries,
  passOfferFromPortal,
  registerForClass,
  withdrawFromClass,
} from '$member-portal/lib/classes';

const CLASS_ROW = {
  id: 'youth-basics',
  season: 2026,
  name: 'Youth Sailing Basics',
  slug: 'youth-basics',
  track: 'youth',
  capacity: 10,
  fee: 100,
  start_date: null,
  end_date: null,
  location: null,
  description: null,
  instructor_notes: null,
  visible: 1 as const,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

describe('listEnrolleeOptions', () => {
  it('computes eligibility per household member against the track, never filtering anyone out', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM members WHERE household_id': [
          { id: 'mem-kid', name: 'Kid Scratch', birthdate: '2016-01-01' }, // ~10, eligible for youth
          { id: 'mem-adult', name: 'Adult Scratch', birthdate: '1980-01-01' }, // ineligible for youth
          { id: 'mem-nobday', name: 'No Birthdate Scratch', birthdate: null },
        ],
      },
    });
    const options = await listEnrolleeOptions(db, 'hh-1', 'youth');
    expect(options).toEqual([
      { memberId: 'mem-kid', name: 'Kid Scratch', eligible: true, needsBirthdate: false },
      { memberId: 'mem-adult', name: 'Adult Scratch', eligible: false, needsBirthdate: false },
      { memberId: 'mem-nobday', name: 'No Birthdate Scratch', eligible: false, needsBirthdate: true },
    ]);
  });
});

describe('registerForClass (the freed-spot rule applied to a signed-in member)', () => {
  it('enrolls and auto-applies a positive credit balance', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 5 }),
        'FROM class_waitlist WHERE class_id': { n: 0 },
        'AS balance': { balance: 1 },
      },
    });
    const result = await registerForClass(db, { classId: CLASS_ROW.id, memberId: 'mem-kid', householdId: 'hh-1', actorMemberId: 'mem-primary' });
    expect(result).toEqual({ enrollmentId: expect.any(String), creditApplied: true, feeDue: 0 });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO class_enrollments'));
    expect(insert?.args).toEqual([expect.any(String), CLASS_ROW.id, 'mem-kid', 1]);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO credit_redemptions'))).toBe(true);
  });

  it('enrolls with the fee due when there is no credit to apply', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 5 }),
        'FROM class_waitlist WHERE class_id': { n: 0 },
        'AS balance': { balance: 0 },
      },
    });
    const result = await registerForClass(db, { classId: CLASS_ROW.id, memberId: 'mem-kid', householdId: 'hh-1', actorMemberId: 'mem-primary' });
    expect(result).toEqual({ enrollmentId: expect.any(String), creditApplied: false, feeDue: 100 });
  });

  it('refuses (never enrolls) a technically-free spot with anyone already queued: the same freed-spot rule as the public path', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': { n: 5 },
        'FROM class_waitlist WHERE class_id': { n: 1 },
      },
    });
    const result = await registerForClass(db, { classId: CLASS_ROW.id, memberId: 'mem-kid', householdId: 'hh-1', actorMemberId: 'mem-primary' });
    expect(result).toEqual({ error: expect.stringContaining('waitlist') });
    expect(calls.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });

  it('refuses a repeat registration', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': (args: unknown[]) => (args.length === 2 ? { n: 1 } : { n: 5 }),
        'FROM class_waitlist WHERE class_id': { n: 0 },
      },
    });
    const result = await registerForClass(db, { classId: CLASS_ROW.id, memberId: 'mem-kid', householdId: 'hh-1', actorMemberId: 'mem-primary' });
    expect(result).toEqual({ error: expect.stringContaining('Already enrolled') });
  });
});

describe('joinWaitlist / leaveWaitlist', () => {
  it('joins at the tail position', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        "COALESCE(MAX(position)": { next_position: 4 },
        'FROM class_waitlist WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 0 }),
      },
    });
    const result = await joinWaitlist(db, { classId: CLASS_ROW.id, memberId: 'mem-kid' });
    expect(result).toEqual({ waitlistId: expect.any(String), position: 4 });
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO class_waitlist'));
    expect(insert?.args).toEqual([expect.any(String), CLASS_ROW.id, 'mem-kid', 4]);
  });

  it('leaveWaitlist refuses an entry that does not belong to the acting household', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM class_waitlist w JOIN members m': null } });
    const result = await leaveWaitlist(db, 'wait-1', 'hh-1');
    expect(result).toEqual({ error: expect.stringContaining('No such') });
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
  });

  it('leaveWaitlist removes an owned entry', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM class_waitlist w JOIN members m': { id: 'wait-1' } } });
    const result = await leaveWaitlist(db, 'wait-1', 'hh-1');
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM class_waitlist'))).toBe(true);
  });
});

describe('withdrawFromClass', () => {
  const ENROLLMENT_ROW = { id: 'enr-1', class_id: CLASS_ROW.id, member_name: 'Kid Scratch', household_id: 'hh-1', class_name: CLASS_ROW.name };

  it('refuses an enrollment that is not the acting household\'s own', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM class_enrollments e JOIN members m': { ...ENROLLMENT_ROW, household_id: 'hh-other' } } });
    const result = await withdrawFromClass(db, { enrollmentId: 'enr-1', householdId: 'hh-1' });
    expect(result).toEqual({ error: expect.stringContaining('No such enrollment') });
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
  });

  it('drops the enrollment; with an empty queue, no auto-offer fires', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM class_enrollments e JOIN members m': ENROLLMENT_ROW,
        'FROM credit_redemptions WHERE enrollment_id': null,
        "ORDER BY position ASC LIMIT 1": null,
      },
    });
    const result = await withdrawFromClass(db, { enrollmentId: 'enr-1', householdId: 'hh-1' });
    expect(result).toEqual({ ok: true, autoOfferedTo: null });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM class_enrollments'))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO credit_grants'))).toBe(false);
  });

  it('reverses a redeemed credit (a fresh grant, never a delete of the redemption row)', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM class_enrollments e JOIN members m': ENROLLMENT_ROW,
        'FROM credit_redemptions WHERE enrollment_id': { id: 'redeem-1' },
        'FROM memberships WHERE household_id': { id: 'ms-1' },
        "ORDER BY position ASC LIMIT 1": null,
      },
    });
    const result = await withdrawFromClass(db, { enrollmentId: 'enr-1', householdId: 'hh-1' });
    expect(result).toEqual({ ok: true, autoOfferedTo: null });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO credit_grants'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('DELETE FROM credit_redemptions'))).toBe(false);
  });

  it('auto-offers the freed spot to the first waitlisted entry by position', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM class_enrollments e JOIN members m': ENROLLMENT_ROW,
        'FROM credit_redemptions WHERE enrollment_id': null,
        "ORDER BY position ASC LIMIT 1": { id: 'wait-next' },
        // offerSpot's own preconditions:
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_waitlist WHERE id': { class_id: CLASS_ROW.id, member_id: 'mem-2', applicant_name: null, applicant_email: null },
        'FROM class_offers WHERE waitlist_id': null,
        "'offer_window_hours'": { value: '72' },
      },
    });
    const result = await withdrawFromClass(db, { enrollmentId: 'enr-1', householdId: 'hh-1' });
    expect(result).toEqual({ ok: true, autoOfferedTo: 'wait-next' });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO class_offers'))).toBe(true);
  });
});

describe('adminDropEnrollment (reuses withdrawFromClass against the enrollment\'s own real household)', () => {
  it('refuses an unknown enrollment', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM class_enrollments e JOIN members m': null } });
    await expect(adminDropEnrollment(db, { enrollmentId: 'enr-1' })).resolves.toEqual({ error: 'No such enrollment.' });
  });

  it('resolves the enrollment\'s own household, then performs the same withdrawal a member\'s own action would', async () => {
    // adminDropEnrollment's own lookup and withdrawFromClass's own (internally delegated) lookup
    // share the same table-join substring; one superset row answers both queries' own field needs
    // (a mock concern only — the real D1 driver projects exactly what each SELECT lists).
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM class_enrollments e JOIN members m': { household_id: 'hh-1', id: 'enr-1', class_id: CLASS_ROW.id, member_name: 'Kid Scratch', class_name: CLASS_ROW.name },
        'FROM credit_redemptions WHERE enrollment_id': null,
        "ORDER BY position ASC LIMIT 1": null,
      },
    });
    const result = await adminDropEnrollment(db, { enrollmentId: 'enr-1' });
    expect(result).toEqual({ ok: true, autoOfferedTo: null });
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM class_enrollments'))).toBe(true);
  });
});

describe('claimOfferFromPortal / passOfferFromPortal', () => {
  const OWNED = { id: 'wait-1', class_id: CLASS_ROW.id, member_id: 'mem-kid', household_id: 'hh-1' };

  it('claimOfferFromPortal refuses an entry that does not belong to the household', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM class_waitlist w JOIN members m': { ...OWNED, household_id: 'hh-other' } } });
    const result = await claimOfferFromPortal(db, 'wait-1', 'hh-1');
    expect(result).toEqual({ error: expect.stringContaining('No such') });
  });

  it('claimOfferFromPortal claims an owned, live offer', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM class_waitlist w JOIN members m': OWNED,
        'FROM class_offers WHERE waitlist_id': { token: 'hash-1', resolved: null, expires_at: '2999-01-01 00:00:00' },
      },
    });
    const result = await claimOfferFromPortal(db, 'wait-1', 'hh-1');
    expect(result).toEqual({ enrollmentId: expect.any(String) });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO class_enrollments'))).toBe(true);
  });

  it('passOfferFromPortal declines an owned offer', async () => {
    const { db, calls } = fakeD1({ firstResults: { 'FROM class_waitlist w JOIN members m': OWNED } });
    const result = await passOfferFromPortal(db, 'wait-1', 'hh-1');
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.sql.startsWith("UPDATE class_offers SET resolved = 'declined'"))).toBe(true);
  });
});

describe('listMyClasses / listMyWaitlistEntries', () => {
  it('maps enrolled classes across the household', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM class_enrollments e': [
          {
            enrollment_id: 'enr-1',
            class_id: CLASS_ROW.id,
            class_name: CLASS_ROW.name,
            member_id: 'mem-kid',
            member_name: 'Kid Scratch',
            start_date: '2026-08-01',
            end_date: '2026-08-03',
            location: 'The Lake',
            fee_paid: 0,
            has_redemption: 1,
          },
        ],
      },
    });
    await expect(listMyClasses(db, 'hh-1')).resolves.toEqual([
      {
        enrollmentId: 'enr-1',
        classId: CLASS_ROW.id,
        className: CLASS_ROW.name,
        memberId: 'mem-kid',
        memberName: 'Kid Scratch',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        location: 'The Lake',
        feePaid: false,
        creditRedeemed: true,
      },
    ]);
  });

  it('maps waitlist rows with the queue\'s own honest length and a live offer, when one exists', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM class_waitlist w': [
          { waitlist_id: 'wait-1', class_id: CLASS_ROW.id, class_name: CLASS_ROW.name, position: 2, queue_length: 5, offer_expires_at: '2999-01-01 00:00:00' },
        ],
      },
    });
    await expect(listMyWaitlistEntries(db, 'hh-1')).resolves.toEqual([
      { waitlistId: 'wait-1', classId: CLASS_ROW.id, className: CLASS_ROW.name, position: 2, queueLength: 5, offer: { expiresAt: '2999-01-01 00:00:00' } },
    ]);
  });
});
