// A temporary override of `settings.current_season` (the SAME global row `getCurrentSeason`
// reads everywhere in the app: `club-settings.ts`), scoped to the waivers e2e specs' own
// beforeAll/afterAll -- never baked into `bootstrap-club-db.mjs`, which runs once for the WHOLE
// suite and every other fixture (`portal-seed.sql`, `membership-admin-seed.sql`, ...) is written
// against `current_season = 2026` (0001_substrate's own seed).
//
// WHY THIS EXISTS (member-waivers T8's own documented deviation): the document model is
// repo-content-only (`src/chassis/content.ts`'s `import.meta.glob`), so a PUBLISHED test document
// is baked into every build -- dev, this e2e suite, and eventually production -- the instant it is
// committed. A published test document at the site's REAL current season (2026 today, and only
// ever increasing) would be live content a real member could see. `e2e/fixtures/waivers-seed.sql`'s
// own test documents (`test-release`, `test-acknowledgement`, `test-mooring-ack`) are therefore
// published at seasons 2024/2025 -- permanently in the past relative to any real production
// `current_season`, which never decreases -- so they can never surface for a real member no matter
// when this code deploys.
//
// The signing routes (`/my-account/sign` and its money-moment gates) have no `?season=` override
// (unlike the admin rollup, `/admin/club/documents?season=`), so exercising them against those
// past-season documents means `getCurrentSeason(db)` must actually RETURN 2025 while the waivers
// spec runs. `playwright.config.ts` runs this suite with `workers: 1`/`fullyParallel: false`
// (a squatting-port lesson already forced serial execution here), so a spec file owns the whole
// webServer for the span between its own beforeAll and afterAll: no other spec file's tests are
// ever interleaved with this override, and the value is restored before Playwright moves on to the
// next file.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const CLUB_DB_NAME = 'asc-club';

/** `0001_substrate`'s own seed value, and every other e2e fixture's own assumption -- the value
 *  this helper restores once a waivers spec's own tests are done. */
export const REAL_CURRENT_SEASON = 2026;

/** `e2e/fixtures/waivers-seed.sql`'s own test-document seasons: the "this season" a household's
 *  outstanding documents resolve against, and the "last season" a season-boundary fixture's
 *  existing signature was recorded under. Both permanently precede {@link REAL_CURRENT_SEASON}. */
export const TEST_CURRENT_SEASON = 2025;
export const TEST_LAST_SEASON = 2024;

function d1Exec(args: string[]): void {
  execFileSync('npx', ['wrangler', 'd1', 'execute', CLUB_DB_NAME, '--local', ...args], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
}

/** Overwrites the single `settings` row every `getCurrentSeason(db)` call in the app reads. Call
 *  in a waivers spec's own `test.beforeAll`, and always pair with a matching
 *  `setCurrentSeason(REAL_CURRENT_SEASON)` in `test.afterAll` so the next spec file (or a rerun
 *  against a warm workstation replica) sees the ordinary value again. */
export function setCurrentSeason(season: number): void {
  d1Exec(['--command', `UPDATE settings SET value = '${season}' WHERE key = 'current_season'`]);
}
