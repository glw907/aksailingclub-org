// The public join door's remote functions (Task 3), following `class-signup.remote.ts` as the
// family precedent: the actual schema and handler logic live in `join-apply-form.ts` (a
// `.remote.ts` file may only export remote functions), so this file is just the thin wiring.
import * as v from 'valibot';
import { form, query, getRequestEvent } from '$app/server';
import { joinApplySchema, handleJoinApply } from './join-apply-form';
import { normalizeEmail } from '$admin-club/lib/member-normalize.js';

export const applyJoin = form(joinApplySchema, async (input) => {
  const { platform, getClientAddress, url } = getRequestEvent();
  return handleJoinApply(input, platform?.env, getClientAddress(), url.origin);
});

/** The email-blur pivot check (used on this page for a welcome-back hint, and by the class door's
 *  own early pivot, Task 4): answers whether a normalized email already belongs to a member,
 *  without ever revealing anything else about them. */
export const checkKnownEmail = query(v.pipe(v.string(), v.trim()), async (email) => {
  const db = getRequestEvent().platform?.env.CLUB_DB;
  if (!db) return { known: false };
  const normalized = normalizeEmail(email);
  const row = await db.prepare('SELECT id FROM members WHERE email = ?1 LIMIT 1').bind(normalized).first<{ id: string }>();
  return { known: row !== null };
});
