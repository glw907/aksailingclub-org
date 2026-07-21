// The Classes list route (`/admin/club/classes`, Classes pass Task 3 rebuild,
// docs/2026-07-21-classes-pass-design.md): the season-scoped load (roster and waitlist summary
// eager on every row, batched -- never a per-class query loop) and the `offerNext` action, which
// offers the freed seat to the head of a class's own queue. Mirrors `members-list-route.test.ts`'s
// own load-event shape and `classes-waitlist-actions.test.ts`'s own `postEvent`/fixture recipe for
// the action.
import { describe, expect, it } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import { actions, load, type ClassListRow } from '../routes/admin/club/classes/+page.server';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';
import { editorWithRole } from './_editor';

type LoadEvent = Parameters<typeof load>[0];
type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

function loadEventFor(db: unknown, search = ''): LoadEvent {
  return {
    locals: { editor: editorWithRole('Club manager') },
    platform: { env: { CLUB_DB: db } },
    url: new URL(`https://x.dev/admin/club/classes${search}`),
  } as unknown as LoadEvent;
}

async function runLoad(db: unknown, search = ''): Promise<LoadResult> {
  return (await load(loadEventFor(db, search))) as LoadResult;
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
  custom_note: null,
  hero_image: null,
  hero_image_alt: null,
  visible: 1 as const,
  drop_in: 0 as const,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  enrolled_count: 9,
  waitlist_count: 1,
};

describe('/admin/club/classes load', () => {
  it('degrades to an empty, error-carrying result when CLUB_DB is not bound', async () => {
    const result = await runLoad(undefined);
    expect(result.error).toBe('CLUB_DB is not bound.');
    expect(result.classes).toEqual([]);
    expect(result.seasons).toEqual([]);
  });

  it('defaults the season to settings.current_season with no ?season= param', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM classes WHERE classes.season': [],
        'SELECT DISTINCT season FROM classes': [{ season: 2026 }],
        'FROM class_enrollments e': [],
        'FROM class_waitlist w': [],
        'FROM class_offers WHERE resolved IS NULL': [],
      },
    });
    const result = await runLoad(db);
    expect(result.error).toBeNull();
    expect(result.season).toBe(2026);
    expect(result.currentSeason).toBe(2026);
    expect(result.seasons).toEqual([2026]);
  });

  it('a ?season= param reaches history, overriding the current-season default', async () => {
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM classes WHERE classes.season': [],
        'SELECT DISTINCT season FROM classes': [{ season: 2026 }, { season: 2025 }],
        'FROM class_enrollments e': [],
        'FROM class_waitlist w': [],
        'FROM class_offers WHERE resolved IS NULL': [],
      },
    });
    const result = await runLoad(db, '?season=2025');
    expect(result.season).toBe(2025);
    expect(result.currentSeason).toBe(2026);
    const scoped = calls.find((c) => c.sql.includes('WHERE classes.season'));
    expect(scoped?.args).toEqual([2025]);
  });

  it('always offers the current season, even with zero classes in it yet', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM classes WHERE classes.season': [],
        'SELECT DISTINCT season FROM classes': [{ season: 2025 }],
        'FROM class_enrollments e': [],
        'FROM class_waitlist w': [],
        'FROM class_offers WHERE resolved IS NULL': [],
      },
    });
    const result = await runLoad(db);
    expect(result.seasons).toEqual([2026, 2025]);
  });

  it('carries each row\'s roster, waitlist summary, and active-offer expiry eagerly, in one batch '
    + 'of queries (never a per-class loop)', async () => {
    const SECOND_CLASS = { ...CLASS_ROW, id: 'youth-racing-clinic', name: 'Youth Racing Clinic' };
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM classes WHERE classes.season': [CLASS_ROW, SECOND_CLASS],
        'SELECT DISTINCT season FROM classes': [{ season: 2026 }],
        'FROM class_enrollments e': [
          { class_id: CLASS_ROW.id, id: 'enr-1', name: 'Alex Rivera', birthdate: '2015-04-01', fee_paid: 1 },
        ],
        'FROM class_waitlist w': [
          { class_id: CLASS_ROW.id, id: 'wait-1', position: 1, applicant_name: 'Walk-up Jamie', member_name: null },
        ],
        'FROM class_offers WHERE resolved IS NULL': [
          {
            token: 'hash-a',
            waitlist_id: 'wait-1',
            class_id: CLASS_ROW.id,
            offered_by: 'admin@example.com',
            offered_at: '2026-07-01 00:00:00',
            expires_at: '2026-07-05 00:00:00',
            resolved: null,
            resolved_at: null,
          },
        ],
      },
    });
    const result = await runLoad(db);
    const [first, second] = result.classes as ClassListRow[];
    expect(first.roster).toEqual([{ enrollmentId: 'enr-1', name: 'Alex Rivera', birthdate: '2015-04-01', feePaid: true }]);
    expect(first.waitlist).toEqual({ count: 1, nextName: 'Walk-up Jamie' });
    expect(first.activeOfferExpiresAt).toBe('2026-07-05 00:00:00');
    expect(second.roster).toEqual([]);
    expect(second.waitlist).toEqual({ count: 0, nextName: null });
    expect(second.activeOfferExpiresAt).toBeNull();
    // Every query here is one shared read across the whole season's classes: the roster,
    // waitlist, and offers queries each appear exactly once, regardless of how many classes
    // the season carries.
    expect(calls.filter((c) => c.sql.startsWith('SELECT e.class_id'))).toHaveLength(1);
    expect(calls.filter((c) => c.sql.startsWith('SELECT w.class_id'))).toHaveLength(1);
    expect(calls.filter((c) => c.sql.includes('FROM class_offers WHERE resolved IS NULL ORDER BY'))).toHaveLength(1);
  });

  it('sweeps stale offers before reading, so a past-expiry offer never counts as active', async () => {
    const { db, calls } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM class_offers WHERE resolved IS NULL AND expires_at': [{ token: 'hash-a', waitlist_id: 'wait-a' }],
        'FROM classes WHERE classes.season': [],
        'SELECT DISTINCT season FROM classes': [],
        'FROM class_enrollments e': [],
        'FROM class_waitlist w': [],
        'FROM class_offers WHERE resolved IS NULL': [],
      },
    });
    await runLoad(db);
    expect(calls.some((c) => c.sql.startsWith("UPDATE class_offers SET resolved = 'expired'"))).toBe(true);
  });
});

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

type ActionEvent = Parameters<typeof actions.offerNext>[0];

function postEvent(editor: Editor | null, fields: Record<string, string>, db?: unknown): ActionEvent {
  const formData = new FormData();
  formData.set('csrf', CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const url = 'https://x.dev/admin/club/classes';
  const request = new Request(url, { method: 'POST', body: formData });
  return {
    url: new URL(url),
    request,
    cookies: {
      get: (name: string) => (name === CSRF_COOKIE_NAME ? CSRF_TOKEN : undefined),
      set: () => undefined,
      delete: () => undefined,
    },
    platform: { env: { CLUB_DB: db } },
    locals: { editor, cairnAccess: access },
  } as unknown as ActionEvent;
}

describe('offerNext action', () => {
  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.offerNext(postEvent(noRole, { classId: 'fleet-tune-up-weekend' }, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(403);
  });

  it('fails 400 when classId is missing', async () => {
    const { db } = fakeD1();
    const result = await actions.offerNext(postEvent(admin, {}, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
  });

  it('fails 404 when the class does not exist', async () => {
    const { db } = fakeD1({ firstResults: { 'FROM classes WHERE id': null } });
    const result = await actions.offerNext(postEvent(admin, { classId: 'no-such-class' }, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(404);
  });

  it('fails 400 when the class is full', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': { n: 10 },
        'FROM class_waitlist WHERE class_id': { n: 1 },
      },
    });
    const result = await actions.offerNext(postEvent(admin, { classId: CLASS_ROW.id }, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toContain('no free spot');
  });

  it('fails 400 when the waitlist is empty', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': { n: 5 },
        'FROM class_waitlist WHERE class_id': { n: 0 },
      },
    });
    const result = await actions.offerNext(postEvent(admin, { classId: CLASS_ROW.id }, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toContain('waitlist is empty');
  });

  it('fails 400 when an offer is already active for the class', async () => {
    const { db } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': { n: 5 },
        'FROM class_waitlist WHERE class_id': { n: 1 },
        'FROM class_offers WHERE class_id': { n: 1 },
      },
    });
    const result = await actions.offerNext(postEvent(admin, { classId: CLASS_ROW.id }, db));
    expect(isActionFailure(result)).toBe(true);
    expect((result as { status: number }).status).toBe(400);
    expect((result as { data: { error: string } }).data.error).toContain('already active');
  });

  it('offers the head of the queue and returns its token once', async () => {
    const { db, calls } = fakeD1({
      firstResults: {
        'FROM classes WHERE id': CLASS_ROW,
        'FROM class_enrollments WHERE class_id': { n: 5 },
        'FROM class_waitlist WHERE class_id': { n: 1 },
        'FROM class_offers WHERE class_id': null,
        'FROM class_offers WHERE waitlist_id': null,
        "'offer_window_hours'": { value: '72' },
        'FROM class_waitlist WHERE id': { class_id: CLASS_ROW.id, member_id: null, applicant_name: 'Jamie Rivera', applicant_email: 'jamie@example.com' },
      },
      allResults: {
        'FROM class_waitlist WHERE class_id': [
          { id: 'wait-1', class_id: CLASS_ROW.id, member_id: null, applicant_name: 'Jamie Rivera', applicant_email: 'jamie@example.com', applicant_phone: null, position: 1, requested_at: '2026-05-01 00:00:00', notes: null },
        ],
      },
    });
    const result = await actions.offerNext(postEvent(admin, { classId: CLASS_ROW.id }, db));
    expect(result).toEqual({
      ok: true,
      offered: { classId: CLASS_ROW.id, waitlistId: 'wait-1', token: expect.any(String), expiresAt: expect.any(String) },
    });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO class_offers'))).toBe(true);
  });
});
