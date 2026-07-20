// The Members list route (`/admin/club/members`, Members pass T7 rebuild): the load's own
// param parsing/defaults and current-season class-filter options, plus the `addHousehold`
// action's validation and role gate. Mirrors `class-waitlist-overview-route.test.ts`'s own
// load-event shape and `compose-actions.test.ts`'s own fake-request idiom for the action.
import { describe, expect, it } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import type { Redirect } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import { actions, load, type MembersClassFilterOption } from '../routes/admin/club/members/+page.server';
import { access } from '$theme/cairn.config.js';
import { fakeD1 } from './_fake-d1';

async function catchThrown(value: unknown): Promise<unknown> {
  try {
    return await value;
  } catch (err) {
    return err;
  }
}

type LoadEvent = Parameters<typeof load>[0];
type ActionEvent = Parameters<typeof actions.addHousehold>[0];
type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

function loadEventFor(db: unknown, search = ''): LoadEvent {
  return {
    locals: { editor: { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' } },
    platform: { env: { CLUB_DB: db } },
    url: new URL(`https://x.dev/admin/club/members${search}`),
  } as unknown as LoadEvent;
}

async function runLoad(db: unknown, search = ''): Promise<LoadResult> {
  return (await load(loadEventFor(db, search))) as LoadResult;
}

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'Club manager', capability: 'editor' };
const noRole: Editor = { email: 'no-role@example.com', displayName: 'No Role', role: 'Instructor', capability: 'none' };

const CSRF_COOKIE_NAME = '__Host-cairn_csrf';
const CSRF_TOKEN = 'test-csrf-token';

function postEvent(editor: Editor | null, fields: Record<string, string>, db?: unknown): ActionEvent {
  const formData = new FormData();
  formData.set('csrf', CSRF_TOKEN);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const url = 'https://x.dev/admin/club/members';
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

describe('/admin/club/members load', () => {
  it('degrades to an empty, error-carrying result when CLUB_DB is not bound', async () => {
    const result = await runLoad(undefined);
    expect(result.error).toBe('CLUB_DB is not bound.');
    expect(result.households).toEqual([]);
    expect(result.classOptions).toEqual([]);
    expect(result.standing).toBe('members');
  });

  it("defaults every filter param with no query string ('members' standing, 'all' everything else)", async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: { 'FROM households h': [], 'FROM members': [], 'FROM classes ORDER BY': [] },
    });
    const result = await runLoad(db);
    expect(result.error).toBeNull();
    expect(result).toMatchObject({ standing: 'members', holdings: 'all', role: 'all', classId: 'all', includeArchived: false, search: '' });
  });

  it('parses every filter param off the URL', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: { 'FROM households h': [], 'FROM members': [], 'FROM classes ORDER BY': [] },
    });
    const result = await runLoad(db, '?q=Sara&standing=former&holdings=holding&role=instructor&class=cls-1&archived=1');
    expect(result).toMatchObject({
      search: 'Sara',
      standing: 'former',
      holdings: 'holding',
      role: 'instructor',
      classId: 'cls-1',
      includeArchived: true,
    });
  });

  it('an unrecognized standing/holdings/role value falls back to its own default, never an error', async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: { 'FROM households h': [], 'FROM members': [], 'FROM classes ORDER BY': [] },
    });
    const result = await runLoad(db, '?standing=bogus&holdings=bogus&role=bogus');
    expect(result).toMatchObject({ standing: 'members', holdings: 'all', role: 'all' });
  });

  it("offers only current-season classes with at least one enrollment as class-filter options", async () => {
    const { db } = fakeD1({
      firstResults: { "'current_season'": { value: '2026' } },
      allResults: {
        'FROM households h': [],
        'FROM members': [],
        'FROM classes ORDER BY': [
          { id: 'cls-open', season: 2026, name: 'Keelboat 101', slug: 'keelboat-101', track: 'adult-teen', capacity: 10, fee: 100, start_date: null, end_date: null, location: null, description: null, instructor_notes: null, custom_note: null, hero_image: null, hero_image_alt: null, visible: 1, drop_in: 0, created_at: '2026-01-01', updated_at: '2026-01-01', enrolled_count: 3, waitlist_count: 0 },
          { id: 'cls-empty', season: 2026, name: 'Dinghy Basics', slug: 'dinghy-basics', track: 'adult-teen', capacity: 10, fee: 100, start_date: null, end_date: null, location: null, description: null, instructor_notes: null, custom_note: null, hero_image: null, hero_image_alt: null, visible: 1, drop_in: 0, created_at: '2026-01-01', updated_at: '2026-01-01', enrolled_count: 0, waitlist_count: 0 },
          { id: 'cls-old', season: 2024, name: 'Old Clinic', slug: 'old-clinic', track: 'adult-teen', capacity: 10, fee: 100, start_date: null, end_date: null, location: null, description: null, instructor_notes: null, custom_note: null, hero_image: null, hero_image_alt: null, visible: 1, drop_in: 0, created_at: '2026-01-01', updated_at: '2026-01-01', enrolled_count: 5, waitlist_count: 0 },
        ],
      },
    });
    const result = await runLoad(db);
    expect(result.classOptions.map((c: MembersClassFilterOption) => c.id)).toEqual(['cls-open']);
  });
});

describe('/admin/club/members addHousehold action', () => {
  it('refuses an editor with no club role (403)', async () => {
    const { db } = fakeD1();
    const result = await actions.addHousehold(postEvent(noRole, { name: 'The Test House', memberName: 'Test Person' }, db));
    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) expect(result.status).toBe(403);
  });

  it('fails 400 when the household name or first member name is missing', async () => {
    const { db } = fakeD1();
    const result = await actions.addHousehold(postEvent(admin, { name: '', memberName: 'Test Person' }, db));
    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) expect(result.status).toBe(400);
  });

  it('creates the household and its first, primary member, then redirects to the new desk', async () => {
    const { db } = fakeD1();
    const caught = await catchThrown(actions.addHousehold(postEvent(admin, { name: 'The Test House', memberName: 'Test Person' }, db)));
    expect(isRedirect(caught)).toBe(true);
    expect((caught as Redirect).location).toMatch(/^\/admin\/club\/members\//);
  });
});
