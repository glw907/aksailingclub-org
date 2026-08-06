// The asc-club timestamp shape, split out of `crypto.ts` by the `0.94.0-rc.1` migration. These two
// helpers are not cryptography and never were; they lived beside the token generators only because
// the member-auth expiry columns were their first caller. Keeping them there became a real problem
// the moment `crypto.ts` started importing `@glw907/cairn-cms/auth-crypto`, which is a server-only
// subpath whose `browser` condition throws at import time: `standing.ts` wants `toSqliteDatetime`
// and is reachable from `/join/apply/+page.svelte`, so one client page pulled the whole member-auth
// crypto module into the browser bundle. It always had; the packaged subpath is simply the first
// thing to say so out loud, at build time.

/** A SQLite `datetime('now')`-shaped UTC string ("YYYY-MM-DD HH:MM:SS", no offset). Every
 *  timestamp this domain writes or compares uses this exact shape, so lexicographic comparison
 *  against a database-read value stays safe. */
export function toSqliteDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** {@link toSqliteDatetime}, offset forward by a duration in milliseconds: the shape every expiry
 *  column the member-auth migration writes wants. */
export function sqliteDatetimeAfter(ms: number, from: Date = new Date()): string {
  return toSqliteDatetime(new Date(from.getTime() + ms));
}
