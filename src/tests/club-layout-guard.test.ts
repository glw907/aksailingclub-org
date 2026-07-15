import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import type { Editor } from '@glw907/cairn-cms';
import { load } from '../routes/admin/club/+layout.server';
import { fakeD1 } from './_fake-d1';

/** The exact event type the guard's `load` expects, read off the function itself rather than
 *  hand-typed, so this stays correct if the route's generated types ever change. */
type LayoutEvent = Parameters<typeof load>[0];

function eventFor(editor: Editor | null, db: unknown): LayoutEvent {
  return { locals: { editor }, platform: { env: { CLUB_DB: db } } } as unknown as LayoutEvent;
}

const admin: Editor = { email: 'admin@example.com', displayName: 'Admin', role: 'editor', capability: 'editor' };
const owner: Editor = { email: 'owner@example.com', displayName: 'Owner', role: 'editor', capability: 'editor' };

describe('/admin/club layout guard', () => {
  it('403s a signed-in editor with no club role', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [] } });
    await expect(load(eventFor(admin, db))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 403,
    );
  });

  it('403s the same way when CLUB_DB is not bound', async () => {
    await expect(load(eventFor(admin, undefined))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 403,
    );
  });

  it('passes a club admin through', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'club-admin' }] } });
    await expect(load(eventFor(admin, db))).resolves.toEqual({ clubRole: 'admin' });
  });

  it('passes a club owner through', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'owner' }] } });
    await expect(load(eventFor(owner, db))).resolves.toEqual({ clubRole: 'owner' });
  });
});
