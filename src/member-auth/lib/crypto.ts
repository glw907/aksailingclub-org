// asc-club member auth: token/session id generation, hashing, and cookie naming, all delegated to
// cairn's own `@glw907/cairn-cms/auth-crypto` since the `0.94.0-rc.1` migration. Before that
// subpath existed this module reimplemented the same four primitives small, the same choice
// `offers.ts` made for its own waitlist-offer tokens; the engine now exports the cryptography its
// own login proves in production, so the copies are gone and only this domain's own naming stays.
//
// What remains site-owned, and why: the cookie BASE names (the member store and the editor store
// never blur, so they can never share a cookie), the token TTL (deliberately 15 minutes against
// cairn's 10), and the SQLite datetime helpers (this schema's timestamps are TEXT
// `datetime('now')`-shaped UTC strings, not epoch milliseconds, so a TTL is a duration in
// milliseconds converted at the call site and never stored as a number, in ./sqlite-datetime).
import { cookieName, generateToken, generateSessionId, generateCsrfToken, hashToken } from '@glw907/cairn-cms/auth-crypto';

/** The member session cookie's base name. Distinct from cairn's own `cairn_session` (the
 *  content-editor cookie): the two stores never blur. */
const SESSION_COOKIE_BASE = 'asc-member';

/** The member session cookie name. `cookieName` owns the `__Host-` prefix discipline: the prefix
 *  applies on https and drops on local http dev, where a cookie cannot set Secure. */
export function memberSessionCookieName(secure: boolean): string {
  return cookieName(SESSION_COOKIE_BASE, secure);
}

/** The member CSRF double-submit cookie's base name, with its own distinct name so the two token
 *  stores never collide. */
const CSRF_COOKIE_BASE = 'asc-member-csrf';

export function memberCsrfCookieName(secure: boolean): string {
  return cookieName(CSRF_COOKIE_BASE, secure);
}

/** Magic-link tokens live 15 minutes (this pass's own ruling; cairn's own editor tokens live 10,
 *  a deliberate difference, not a drift, which is why this is not cairn's `TOKEN_TTL_MS`). */
export const MEMBER_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Sessions live 30 days, matching cairn's own `SESSION_TTL_MS`. */
export const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A fresh 256-bit magic-link token, url-safe. */
export function generateMemberToken(): string {
  return generateToken();
}

/** A fresh 256-bit session id, url-safe. */
export function generateMemberSessionId(): string {
  return generateSessionId();
}

/** A fresh 256-bit double-submit CSRF token, url-safe. */
export function generateMemberCsrfToken(): string {
  return generateCsrfToken();
}

/** The lowercase hex SHA-256 of a token, for storage and lookup. The store keeps only this, never
 *  the plaintext token. */
export function hashMemberToken(token: string): Promise<string> {
  return hashToken(token);
}
