// A generic read-only query against the local CLUB_DB (asc-club) D1 replica the e2e webServer
// serves against -- the same database e2e/helpers/member-session.ts and
// e2e/fixtures/bootstrap-club-db.mjs already write to, factored out here since more than one
// waivers spec needs a plain SELECT (e.g. asserting a `waiver_acceptances` row actually landed
// after a signing action, which no page render on its own proves).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const CLUB_DB_NAME = 'asc-club';

/** Runs `sql` against the local CLUB_DB replica and returns its result rows. Read-only by
 *  convention (every caller in this suite uses it to assert, never to seed -- seeding stays in
 *  `e2e/fixtures/*.sql`), though nothing here refuses a write statement. */
export function queryClubDb<T = Record<string, unknown>>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', CLUB_DB_NAME, '--local', '--json', '--command', sql],
    { cwd: repoRoot },
  ).toString();
  const [first] = JSON.parse(out) as [{ results: T[] }];
  return first.results;
}
