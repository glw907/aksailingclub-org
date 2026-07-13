import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidationError } from '@sveltejs/kit';
import * as v from 'valibot';
import { classSignupSchema, handleClassSignup } from '$theme/class-signup-form';
import { fakeD1 } from './_fake-d1';

/** `isValidationError`'s own declared type narrows to `ActionFailure` (the shared public shape),
 *  not the `ValidationError` class `invalid()` actually throws, so its real `.issues` array needs
 *  its own cast to read here, the same as any other place this repo casts a narrower runtime shape
 *  than the engine's public type states. */
function issueMessages(err: unknown): string[] {
  return (err as { issues: Array<{ message: string }> }).issues.map((issue) => issue.message);
}

const CLASS_ROW = {
  id: 'fleet-tune-up-weekend',
  season: 2026,
  name: 'Fleet Tune-Up Weekend',
  slug: 'fleet-tune-up-weekend',
  track: 'adult-teen',
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

function freeCapacityDb() {
  return fakeD1({
    firstResults: {
      'FROM classes WHERE id': CLASS_ROW,
      'FROM class_enrollments WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 9 }),
      'FROM class_waitlist WHERE class_id': { n: 0 },
      "'waiver_text_version'": { value: '2026-01' },
    },
  });
}

/** A full class (capacity already met): the same shape `enrollments.test.ts`'s own `fakeDbFull`
 *  uses, for the interests-answer tests below that need to exercise the waitlist branch. */
function fullClassDb() {
  return fakeD1({
    firstResults: {
      'FROM classes WHERE id': CLASS_ROW,
      'FROM class_enrollments WHERE class_id': { n: 10 },
      "COALESCE(MAX(position)": { next_position: 1 },
      'FROM class_waitlist WHERE class_id': (args: unknown[]) => (args.length === 2 ? null : { n: 0 }),
      "'waiver_text_version'": { value: '2026-01' },
    },
  });
}

const INPUT = {
  classId: CLASS_ROW.id,
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  phone: '',
  interests: '',
  waiverAccepted: true,
  'cf-turnstile-response': '',
};

describe('handleClassSignup (the Turnstile degrade path)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('proceeds to sign up when no TURNSTILE_SECRET_KEY is configured, never calling siteverify', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { db } = freeCapacityDb();

    const result = await handleClassSignup(INPUT, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks the submission when a secret is configured and siteverify reports failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ success: false }) }),
    );
    const { db } = freeCapacityDb();

    await expect(
      handleClassSignup(INPUT, { CLUB_DB: db, TURNSTILE_SECRET_KEY: 'secret' }, '203.0.113.5'),
    ).rejects.toSatisfy(
      (err: unknown) => isValidationError(err) && issueMessages(err).includes('Spam check failed. Please try again.'),
    );
  });

  it('proceeds when a secret is configured and siteverify reports success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ success: true }) }),
    );
    const { db } = freeCapacityDb();

    const result = await handleClassSignup(
      INPUT,
      { CLUB_DB: db, TURNSTILE_SECRET_KEY: 'secret' },
      '203.0.113.5',
    );
    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
  });

  it('refuses when CLUB_DB is not bound', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(handleClassSignup(INPUT, undefined, '203.0.113.5')).rejects.toSatisfy(
      (err: unknown) => isValidationError(err) && issueMessages(err).some((message) => message.includes('not available')),
    );
  });

  it('forwards DISCORD_WEBHOOK_CLASSES through to the class-filled Discord notice', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchSpy);
    const { db } = freeCapacityDb();

    const result = await handleClassSignup(
      INPUT,
      { CLUB_DB: db, DISCORD_WEBHOOK_CLASSES: 'https://discord.com/api/webhooks/classes' },
      '203.0.113.5',
    );

    // freeCapacityDb enrolls the 10th of 10 seats: this signup fills the class.
    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
    expect(fetchSpy).toHaveBeenCalledWith('https://discord.com/api/webhooks/classes', expect.anything());
  });
});

describe('the interests answer (migration 0019_enrollment_interests)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trims the answer and stores it on the enrollment row', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, calls } = freeCapacityDb();
    const parsed = v.parse(classSignupSchema, { ...INPUT, interests: '  Reefing and docking  ' });

    const result = await handleClassSignup(parsed, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
    const enrollInsert = calls.find((c) => c.sql.startsWith('INSERT INTO class_enrollments'));
    expect(enrollInsert?.args).toEqual([expect.any(String), CLASS_ROW.id, expect.any(String), 'Reefing and docking']);
  });

  it('stores NULL when the answer is left blank', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, calls } = freeCapacityDb();

    const result = await handleClassSignup(INPUT, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ outcome: 'enrolled', enrollmentId: expect.any(String) });
    const enrollInsert = calls.find((c) => c.sql.startsWith('INSERT INTO class_enrollments'));
    expect(enrollInsert?.args).toEqual([expect.any(String), CLASS_ROW.id, expect.any(String), null]);
  });

  it("lands a waitlisted signup's answer in class_waitlist.notes instead", async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, calls } = fullClassDb();
    const parsed = v.parse(classSignupSchema, { ...INPUT, interests: 'Spinnaker trim' });

    const result = await handleClassSignup(parsed, { CLUB_DB: db }, '203.0.113.5');

    expect(result).toEqual({ outcome: 'waitlisted', position: 1 });
    const waitlistInsert = calls.find((c) => c.sql.startsWith('INSERT INTO class_waitlist'));
    expect(waitlistInsert?.args).toEqual([expect.any(String), CLASS_ROW.id, INPUT.name, INPUT.email, null, 1, 'Spinnaker trim']);
  });

  it("rejects an answer over 1000 characters with the schema's friendly message", () => {
    const result = v.safeParse(classSignupSchema, { ...INPUT, interests: 'x'.repeat(1001) });

    expect(result.success).toBe(false);
    expect(result.issues?.map((issue) => issue.message)).toContain('Please keep your answer under 1000 characters.');
  });
});
