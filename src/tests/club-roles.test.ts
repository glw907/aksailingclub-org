import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { getClubRole, listClubRoles, removeClubRole, setClubRole } from '$admin-club/lib/club-roles';

describe('getClubRole', () => {
  it('maps the stored "club-admin" row to the API role "admin"', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'club-admin' }] } });
    await expect(getClubRole(db, 'admin@example.com')).resolves.toBe('admin');
  });

  it('keeps "owner" as-is', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'owner' }] } });
    await expect(getClubRole(db, 'owner@example.com')).resolves.toBe('owner');
  });

  it('returns null for an email with no grant at all', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [] } });
    await expect(getClubRole(db, 'nobody@example.com')).resolves.toBeNull();
  });

  it('returns null for an instructor-only email: no admin surface per 2.2', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'instructor' }] } });
    await expect(getClubRole(db, 'instructor@example.com')).resolves.toBeNull();
  });

  it('prefers owner when an email somehow holds both grants', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'club-admin' }, { role: 'owner' }] } });
    await expect(getClubRole(db, 'both@example.com')).resolves.toBe('owner');
  });
});

describe('listClubRoles', () => {
  it('maps each stored row to the API shape', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM club_roles': [
          { email: 'owner@example.com', role: 'owner', granted_by: 'system', granted_at: '2026-07-07 00:00:00' },
          { email: 'admin@example.com', role: 'club-admin', granted_by: 'owner@example.com', granted_at: '2026-07-08 00:00:00' },
        ],
      },
    });
    await expect(listClubRoles(db)).resolves.toEqual([
      { email: 'owner@example.com', role: 'owner', grantedBy: 'system', grantedAt: '2026-07-07 00:00:00' },
      { email: 'admin@example.com', role: 'admin', grantedBy: 'owner@example.com', grantedAt: '2026-07-08 00:00:00' },
    ]);
  });
});

describe('setClubRole', () => {
  it('deletes any existing owner/admin row for the email, then inserts the new one', async () => {
    const { db, calls } = fakeD1();
    await setClubRole(db, 'admin@example.com', 'admin', 'owner@example.com');
    expect(calls.some((c) => c.sql.startsWith('DELETE FROM club_roles') && c.args[0] === 'admin@example.com')).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.sql.startsWith('INSERT INTO club_roles') &&
          c.args[0] === 'admin@example.com' &&
          c.args[1] === 'club-admin' &&
          c.args[2] === 'owner@example.com',
      ),
    ).toBe(true);
  });
});

describe('removeClubRole', () => {
  it('deletes only the owner/admin rows for the email', async () => {
    const { db, calls } = fakeD1();
    await removeClubRole(db, 'admin@example.com');
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("role IN ('owner','club-admin')");
    expect(calls[0].args).toEqual(['admin@example.com']);
  });
});
