import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import type { Editor, Role } from '@glw907/cairn-cms';
import { load } from '../routes/admin/club/+layout.server';

/** The exact event type the guard's `load` expects, read off the function itself rather than
 *  hand-typed, so this stays correct if the route's generated types ever change. */
type LayoutEvent = Parameters<typeof load>[0];

function eventFor(editor: Editor | null): LayoutEvent {
  return { locals: { editor } } as unknown as LayoutEvent;
}

function editorWithRole(role: Role): Editor {
  return { email: `${role}@example.com`, displayName: role, role, capability: 'editor' };
}

describe('/admin/club layout guard', () => {
  it('passes a club owner through with no D1 read', async () => {
    await expect(load(eventFor(editorWithRole('owner')))).resolves.toEqual({});
  });

  it('passes a club admin through', async () => {
    await expect(load(eventFor(editorWithRole('club-admin')))).resolves.toEqual({});
  });

  it('403s an instructor session', async () => {
    await expect(load(eventFor(editorWithRole('instructor')))).rejects.toSatisfy(
      (err: unknown) => isHttpError(err) && err.status === 403,
    );
  });

  it('403s an undeclared role name', async () => {
    const guest = { email: 'guest@example.com', displayName: 'Guest', role: 'guest', capability: 'none' } as unknown as Editor;
    await expect(load(eventFor(guest))).rejects.toSatisfy((err: unknown) => isHttpError(err) && err.status === 403);
  });
});
