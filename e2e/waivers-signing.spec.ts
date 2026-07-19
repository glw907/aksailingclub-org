import { test, expect } from '@playwright/test';
import { mintMemberSession } from './helpers/member-session';
import { queryClubDb } from './helpers/club-db';
import { REAL_CURRENT_SEASON, TEST_CURRENT_SEASON, TEST_LAST_SEASON, setCurrentSeason } from './helpers/waivers-season';

// The member-waivers signing flow's functional e2e coverage (member-waivers T8): sign flow
// end-to-end, the household-complete gate, the season-boundary re-sign, and the minors path --
// against the real `/my-account/sign` route, the real requirement engine, and the real
// `waiver_acceptances` write path, fixtures in e2e/fixtures/waivers-seed.sql.
//
// SEASON OVERRIDE (see e2e/helpers/waivers-season.ts's own header for the full reasoning): this
// file's fixture documents (`src/content/documents/test-*.md`) are published at seasons 2024/2025
// -- permanently before any real production `current_season` -- so `beforeAll`/`afterAll` here
// temporarily point `settings.current_season` at `TEST_CURRENT_SEASON` for the span of these
// tests only, restoring `REAL_CURRENT_SEASON` before Playwright moves on (this suite runs one
// worker, fully serial, so no other spec file's tests are ever interleaved with the override).
test.describe('the signing flow', () => {
  test.beforeAll(() => setCurrentSeason(TEST_CURRENT_SEASON));
  test.afterAll(() => setCurrentSeason(REAL_CURRENT_SEASON));

  // 1. Sign flow end-to-end: outstanding rows -> /my-account/sign -> sign each -> completion,
  // records written (waiver-hh-solo, e2e/fixtures/waivers-seed.sql's own solo household).
  test('a solo member signs every outstanding document and reaches the completion coda', async ({ page, context }) => {
    await mintMemberSession(context, { memberId: 'waiver-mem-solo' });
    await page.goto('/my-account/sign');

    await expect(page.getByRole('heading', { level: 1, name: `Signatures for the ${TEST_CURRENT_SEASON} season.` })).toBeVisible();
    await expect(page.getByText('Document 1 of 2')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '[E2E TEST] Sample Release — season 2025' })).toBeVisible();

    await page.getByLabel('Type your full legal name').fill('Sasha Wavefixture');
    await page.getByRole('button', { name: 'Sign' }).click();

    // The first entry collapses to a receipt and the second becomes current, with no full
    // navigation (`use:enhance` re-derives `load` in place).
    await expect(page.locator('.signing-receipt-title', { hasText: '[E2E TEST] Sample Release — season 2025' })).toBeVisible();
    await expect(page.locator('.signing-receipt-note', { hasText: 'Signed' })).toContainText('as Sasha Wavefixture');
    await expect(page.getByText('Document 2 of 2')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '[E2E TEST] Sample Acknowledgement — season 2025' })).toBeVisible();

    await page.getByLabel('Type your full legal name').fill('Sasha Wavefixture');
    await page.getByRole('button', { name: 'Sign' }).click();

    await expect(page.getByRole('heading', { level: 2, name: `That’s everything for ${TEST_CURRENT_SEASON}.` })).toBeVisible();

    const rows = queryClubDb<{ document_id: string; season: number; person_name: string; context: string }>(
      `SELECT document_id, season, person_name, context FROM waiver_acceptances WHERE member_id = 'waiver-mem-solo' AND minor_member_id IS NULL ORDER BY document_id`,
    );
    expect(rows).toEqual([
      { document_id: 'test-acknowledgement', season: TEST_CURRENT_SEASON, person_name: 'Sasha Wavefixture', context: 'renewal' },
      { document_id: 'test-release', season: TEST_CURRENT_SEASON, person_name: 'Sasha Wavefixture', context: 'renewal' },
    ]);
  });

  // 2. The household-complete gate: payment locked at the waiting state until the second adult
  // signs; resumption unlock (waiver-hh-family, an unpaid join membership both adults share).
  test('a join stays locked until both adults sign, then the payment door unlocks', async ({ browser }) => {
    const parentAContext = await browser.newContext();
    await mintMemberSession(parentAContext, { memberId: 'waiver-mem-parent-a' });
    const parentAPage = await parentAContext.newPage();

    // Visiting the payment door before the household is complete redirects straight back to the
    // signing moment (the hard gate re-checked at `load`, not just at submit).
    await parentAPage.goto('/my-account/finish-joining?context=join');
    await expect(parentAPage).toHaveURL(/\/my-account\/sign\?context=join/);

    for (const name of ['[E2E TEST] Sample Release — season 2025', '[E2E TEST] Sample Acknowledgement — season 2025']) {
      await expect(parentAPage.getByRole('heading', { level: 2, name })).toBeVisible();
      await parentAPage.getByLabel('Type your full legal name').fill('Alex Wavefixture');
      await parentAPage.getByRole('button', { name: 'Sign' }).click();
    }

    // Parent A's own moment is done, but Parent B has not signed: the waiting state, not the
    // plain completion coda, and the payment door is still locked for Parent A too.
    await expect(parentAPage.getByRole('heading', { level: 2, name: 'Waiting on Riley' })).toBeVisible();
    await expect(parentAPage.getByText('2 of their own to sign', { exact: false })).toBeVisible();
    await parentAPage.goto('/my-account/finish-joining?context=join');
    await expect(parentAPage).toHaveURL(/\/my-account\/sign\?context=join/);
    await parentAContext.close();

    const parentBContext = await browser.newContext();
    await mintMemberSession(parentBContext, { memberId: 'waiver-mem-parent-b' });
    const parentBPage = await parentBContext.newPage();
    await parentBPage.goto('/my-account/sign?context=join');

    for (const name of ['[E2E TEST] Sample Release — season 2025', '[E2E TEST] Sample Acknowledgement — season 2025']) {
      await expect(parentBPage.getByRole('heading', { level: 2, name })).toBeVisible();
      await parentBPage.getByLabel('Type your full legal name').fill('Riley Wavefixture');
      await parentBPage.getByRole('button', { name: 'Sign' }).click();
    }

    // Parent B's own signature was the household's last one: the completion coda now points at
    // the join payment door, and the door itself no longer redirects.
    await expect(parentBPage.getByRole('heading', { level: 2, name: `That’s everything for ${TEST_CURRENT_SEASON}.` })).toBeVisible();
    await parentBPage.goto('/my-account/finish-joining?context=join');
    await expect(parentBPage).not.toHaveURL(/\/my-account\/sign/);
    await parentBContext.close();

    const memberRows = queryClubDb<{ document_id: string; member_id: string }>(
      `SELECT document_id, member_id FROM waiver_acceptances WHERE member_id IN ('waiver-mem-parent-a', 'waiver-mem-parent-b') ORDER BY member_id, document_id`,
    );
    expect(memberRows).toHaveLength(4);

    // Best-effort resumption email (member-waivers T5b): Parent B's own last signature is the one
    // that completes the household, so it fires the resumption email to the primary, Parent A --
    // never Parent A's own signature, which continues straight to payment instead. Asserted as
    // "an attempt was logged" rather than a specific delivery status: this local dev environment
    // carries no live email provider, so `sendClubEmail`'s own degrade path can log `status =
    // 'failed'` here even though the code path fired at exactly the right moment.
    const emailRows = queryClubDb<{ segment: string }>(
      `SELECT segment FROM email_log WHERE segment = 'waiver-resumption:waiver-hh-family:${TEST_CURRENT_SEASON}'`,
    );
    expect(emailRows.length).toBeGreaterThan(0);
  });

  // 3. Season-boundary re-sign: signed last season -> outstanding this season (waiver-hh-boundary,
  // a signature already on file for TEST_LAST_SEASON).
  test('a document signed last season is outstanding again this season, and re-signing completes it', async ({ page, context }) => {
    const before = queryClubDb<{ n: number }>(
      `SELECT COUNT(*) AS n FROM waiver_acceptances WHERE member_id = 'waiver-mem-boundary' AND season = ${TEST_LAST_SEASON}`,
    );
    expect(before[0]?.n).toBe(1);

    await mintMemberSession(context, { memberId: 'waiver-mem-boundary' });
    await page.goto('/my-account/sign');

    // Both documents show as outstanding this season -- the release despite last season's
    // signature on file, since matching is by document id plus season, never by version.
    await expect(page.getByText('Document 1 of 2')).toBeVisible();
    await expect(page.locator('.signing-receipt')).toHaveCount(0);

    await page.getByLabel('Type your full legal name').fill('Jordan Wavefixture');
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.getByLabel('Type your full legal name').fill('Jordan Wavefixture');
    await page.getByRole('button', { name: 'Sign' }).click();

    await expect(page.getByRole('heading', { level: 2, name: `That’s everything for ${TEST_CURRENT_SEASON}.` })).toBeVisible();

    const thisSeasonRow = queryClubDb<{ document_id: string; season: number }>(
      `SELECT document_id, season FROM waiver_acceptances WHERE member_id = 'waiver-mem-boundary' AND document_id = 'test-release' AND season = ${TEST_CURRENT_SEASON}`,
    );
    expect(thisSeasonRow).toHaveLength(1);
    // Last season's own row is untouched: a fresh season adds a new record, it never overwrites.
    const lastSeasonRow = queryClubDb<{ n: number }>(
      `SELECT COUNT(*) AS n FROM waiver_acceptances WHERE id = 'waiver-sig-boundary-2024'`,
    );
    expect(lastSeasonRow[0]?.n).toBe(1);
  });

  // 4. The minors path: a per-child Part Two, with the AS 09.65.292 attestation
  // (waiver-hh-minor, ?context=class-signup so the household-complete loop never engages).
  test("a parent signs a minor's Part Two with an attestation", async ({ page, context }) => {
    await mintMemberSession(context, { memberId: 'waiver-mem-minor-parent' });
    await page.goto('/my-account/sign?context=class-signup');

    // The parent's own two personal documents come first (release, then acknowledgement), then
    // the child's own Part Two under the release.
    for (const name of ['[E2E TEST] Sample Release — season 2025', '[E2E TEST] Sample Acknowledgement — season 2025']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
      await page.getByLabel('Type your full legal name').fill('Drew Wavefixture');
      await page.getByRole('button', { name: 'Sign' }).click();
    }

    await expect(page.locator('.signing-minor-id', { hasText: 'Casey Wavefixture' })).toBeVisible();
    await expect(page.getByText('I attest that I am, for this child', { exact: false })).toBeVisible();
    await page.getByRole('radio', { name: 'A natural or adoptive parent' }).check();
    await page.getByLabel('Type your full legal name').fill('Drew Wavefixture');
    await page.getByRole('button', { name: 'Sign' }).click();

    await expect(page.getByRole('heading', { level: 2, name: `That’s everything for ${TEST_CURRENT_SEASON}.` })).toBeVisible();

    const minorRow = queryClubDb<{ document_id: string; minor_member_id: string; signer_relationship: string; person_name: string }>(
      `SELECT document_id, minor_member_id, signer_relationship, person_name FROM waiver_acceptances WHERE minor_member_id = 'waiver-mem-minor-child'`,
    );
    expect(minorRow).toEqual([
      { document_id: 'test-release', minor_member_id: 'waiver-mem-minor-child', signer_relationship: 'parent', person_name: 'Drew Wavefixture' },
    ]);
  });
});
