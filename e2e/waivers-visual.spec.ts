import { test, expect } from '@playwright/test';
import { mintMemberSession } from './helpers/member-session';
import { mintAdminSession } from './helpers/admin-session';
import { REAL_CURRENT_SEASON, TEST_CURRENT_SEASON, setCurrentSeason } from './helpers/waivers-season';

// The member-waivers signing flow's visual coverage (member-waivers T8; the household device
// added in the fresh-context coherence read's fix round, finding 4): the signing moment
// mid-flow, the household-complete gate's waiting state, the mooring/storage contact-confirm
// card, the household device (a parent mid-moment on a minor's own Part Two entry, attestation
// radios and a prefilled name), and the admin "is the club protected" rollup -- 390/1440 x
// light/dark, following e2e/portal-visual.spec.ts's own conventions exactly (a `for` loop over
// widths and themes, one `toHaveScreenshot` per state, `page.emulateMedia({ colorScheme })` rather
// than a `data-theme` cookie, since neither surface here sets one of its own).
//
// Every household below is PRE-SIGNED directly in e2e/fixtures/waivers-seed.sql (never live-
// signed by this spec, unlike e2e/waivers-signing.spec.ts's own functional flows): these tests
// stay pure navigate-and-screenshot so their states never depend on run order relative to that
// other spec file, or on whether it happened to run first in the same suite invocation.
//
// SEASON OVERRIDE, member-facing tests only (fix round, T8 review): `/my-account/sign` resolves
// its outstanding-documents set against the LIVE `settings.current_season`
// (`getCurrentSeason(db)`), not a `?season=` param -- unlike the admin rollup below, which reads
// its own `?season=` query string. The fixture's pre-signed rows and the two test documents are
// baked in at season 2025 (`TEST_CURRENT_SEASON`, e2e/helpers/waivers-season.ts), permanently
// behind the real production season, so at the e2e default season (2026, `REAL_CURRENT_SEASON`)
// the three member-facing states below resolve zero documents and render empty. The
// `test.describe`/`beforeAll`/`afterAll` wrapper here mirrors e2e/waivers-signing.spec.ts's own
// pattern exactly (same global `settings` row, same single-worker/non-parallel suite from
// playwright.config.ts, so no other spec file's tests ever interleave with the override) --
// restored before Playwright moves on so the admin rollup's own tests, and every other spec file,
// see the ordinary value again.
//
// NEVER RUN LOCALLY (this repo's own standing rule, CLAUDE.md and every other visual spec's own
// header): this file was authored and verified by construction against
// e2e/waivers-signing.spec.ts's own proven locators/text (that spec was run locally against the
// same fixtures to confirm every heading, receipt, and card string below renders exactly as
// written), never executed itself. Baselines are CI-canonical; running this suite locally would
// mint workstation baselines that silently break the next CI run if committed.
//
// ADMIN IN A VISUAL SUITE: e2e/admin-login.spec.ts's own header notes "the admin surface stays
// out of the pixel-diff visual suite" as this repo's general practice. The rollup below is a
// deliberate, task-specified exception (member-waivers T8's own instruction names it as one of
// the four states to cover): it is the board's own "is the club protected" evidence surface, not
// an ordinary content-editing screen, so it gets the same design-fidelity bar as a member-facing
// page.
const WIDTHS = [390, 1440] as const;
const THEMES = ['light', 'dark'] as const;

test.describe('member-facing signing states', () => {
  test.beforeAll(() => setCurrentSeason(TEST_CURRENT_SEASON));
  test.afterAll(() => setCurrentSeason(REAL_CURRENT_SEASON));

  for (const width of WIDTHS) {
    for (const colorScheme of THEMES) {
      test(`signing moment mid-flow — ${colorScheme} — ${width}px`, async ({ page, context }) => {
        await mintMemberSession(context, { memberId: 'waiver-mem-visual-midflow' });
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ colorScheme });
        await page.goto('/my-account/sign');

        await expect(page.locator('.signing-receipt-title', { hasText: '[E2E TEST] Sample Release — season 2025' })).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: '[E2E TEST] Sample Acknowledgement — season 2025' })).toBeVisible();
        await expect(page).toHaveScreenshot(`waivers-sign-midflow-${colorScheme}-${width}.png`, { fullPage: true });
      });

      test(`household-complete gate waiting state — ${colorScheme} — ${width}px`, async ({ page, context }) => {
        await mintMemberSession(context, { memberId: 'waiver-mem-visual-parent-a' });
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ colorScheme });
        await page.goto('/my-account/sign?context=join');

        await expect(page.getByRole('heading', { level: 2, name: 'Waiting on Reese' })).toBeVisible();
        await expect(page).toHaveScreenshot(`waivers-sign-waiting-${colorScheme}-${width}.png`, { fullPage: true });
      });

      test(`contact-confirm card — ${colorScheme} — ${width}px`, async ({ page, context }) => {
        await mintMemberSession(context, { memberId: 'waiver-mem-visual-contact' });
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ colorScheme });
        await page.goto('/my-account/sign');

        await expect(page.getByRole('heading', { level: 2, name: 'Can the club reach you?' })).toBeVisible();
        await expect(page).toHaveScreenshot(`waivers-sign-contact-confirm-${colorScheme}-${width}.png`, { fullPage: true });
      });

      // The household device (finding 4, fresh-context coherence read): the ratified per-child Part
      // Two entry, expanded, with the AS 09.65.292 attestation radios and the "type once, sign each"
      // prefilled name -- fixture 8 (waivers-seed.sql) signs the parent's own two personal documents
      // up front so the moment lands directly on their minor's own Part Two, the only outstanding item.
      test(`household device — minor Part Two entry — ${colorScheme} — ${width}px`, async ({ page, context }) => {
        await mintMemberSession(context, { memberId: 'waiver-mem-visual-family-parent' });
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ colorScheme });
        await page.goto('/my-account/sign');

        await expect(page.locator('.signing-minor-id', { hasText: 'Robin Wavefixture' })).toBeVisible();
        await expect(page.getByText('I attest that I am, for this child')).toBeVisible();
        await expect(page.locator('.signing-name-input')).toHaveValue('Sam Wavefixture');
        await expect(page).toHaveScreenshot(`waivers-sign-family-${colorScheme}-${width}.png`, { fullPage: true });
      });
    }
  }
});

for (const width of WIDTHS) {
  for (const colorScheme of THEMES) {
    test(`admin "is the club protected" rollup — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/documents?season=2025');

      await expect(page.getByRole('heading', { level: 1, name: 'Waivers & acknowledgements' })).toBeVisible();
      await expect(page.getByText('[E2E TEST] Sample Release — season 2025', { exact: false })).toBeVisible();
      await expect(page).toHaveScreenshot(`waivers-admin-rollup-${colorScheme}-${width}.png`, { fullPage: true });
    });
  }
}
