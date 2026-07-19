// /my-account/sign's own `?/updateContact` and `?/confirmContact` actions (fix round, review
// finding 1): the contact-confirm step only ever RENDERS for the household's responsible adult
// (`load`'s own `assetConfirmApplies = isResponsibleAdult && ...`), but the CSRF token that
// authorizes a form POST is issued to any signed-in member regardless of `isPrimary` -- so a
// non-primary adult with a valid session and CSRF token (reached legitimately, to sign their own
// documents) could otherwise POST directly to either action. Both must refuse a non-primary
// member server-side, matching `/my-account/household`'s own `updateAddress` action on the
// identical `households` table.
import { describe, expect, it } from 'vitest';

const { actions } = await import('../routes/(site)/my-account/sign/+page.server');
const { fakeD1 } = await import('./_fake-d1');

const PRIMARY = { id: 'mem-primary', household_id: 'hh-1', name: 'Alex Primary', email: 'alex@example.com', archived_at: null };
const NON_PRIMARY = { id: 'mem-other', household_id: 'hh-1', name: 'Blair Other', email: 'blair@example.com', archived_at: null };

function fakeEvent(form: Record<string, string>, db: unknown) {
  const fd = new FormData();
  fd.append('csrf', 'token');
  for (const [key, value] of Object.entries(form)) fd.append(key, value);
  const cookies: Record<string, string> = { 'asc-member-csrf': 'token', 'asc-member': 'sess-1' };
  return {
    url: new URL('http://localhost/my-account/sign?context=renewal'),
    request: { clone: () => ({ formData: async () => fd }) } as unknown as Request,
    cookies: { get: (name: string) => cookies[name], set: () => {} },
    getClientAddress: () => '203.0.113.7',
    platform: { env: { CLUB_DB: db } },
  };
}

/** A DB whose live session resolves to `sessionMember` and whose household names `PRIMARY` as
 *  the primary -- so `ctx.isPrimary` is true only when `sessionMember` is `PRIMARY`. */
function dbFor(sessionMember: typeof PRIMARY, extra: Record<string, unknown> = {}) {
  return fakeD1({
    firstResults: {
      'FROM member_sessions': sessionMember,
      'FROM households WHERE id': { primary_member_id: PRIMARY.id },
      "'current_season'": { value: '2026' },
      ...extra,
    },
  });
}

describe('?/updateContact: the primary-only gate (fix round)', () => {
  it('refuses a non-primary member, writing nothing to members or households', async () => {
    const { db, calls } = dbFor(NON_PRIMARY);

    const result = await actions.updateContact(
      fakeEvent({ email: 'new@example.com', phone: '', addressLine1: '1 New Rd', addressLine2: '', city: '', state: '', postalCode: '' }, db) as never,
    );

    expect(result).toMatchObject({ status: 403 });
    expect(calls.some((c) => c.sql.includes('UPDATE members SET email') || c.sql.includes('UPDATE households SET address_line1'))).toBe(false);
  });

  it('allows the primary member to update the household contact info', async () => {
    const { db } = dbFor(PRIMARY);

    const result = await actions.updateContact(
      fakeEvent({ email: 'new@example.com', phone: '', addressLine1: '1 New Rd', addressLine2: '', city: '', state: '', postalCode: '' }, db) as never,
    );

    expect(result).toEqual({ saved: true });
  });
});

describe('?/confirmContact: the primary-only gate (fix round)', () => {
  it('refuses a non-primary member, recording no confirmation', async () => {
    const { db, calls } = dbFor(NON_PRIMARY, { 'SELECT email, phone FROM members': { email: NON_PRIMARY.email, phone: null } });

    const result = await actions.confirmContact(fakeEvent({}, db) as never);

    expect(result).toMatchObject({ status: 403 });
    expect(calls.some((c) => c.sql.includes('INSERT INTO contact_confirmations'))).toBe(false);
  });

  it('allows the primary member to confirm the household contact info', async () => {
    const { db } = dbFor(PRIMARY, { 'SELECT email, phone FROM members': { email: PRIMARY.email, phone: null } });

    const result = await actions.confirmContact(fakeEvent({}, db) as never);

    expect(result).toEqual({ saved: true });
  });
});
