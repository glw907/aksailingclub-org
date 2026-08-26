import { test, expect } from '@playwright/test';
import { mintMemberSession } from './helpers/member-session';
import { queryClubDb } from './helpers/club-db';

// The portal Notifications toggle's first functional e2e coverage (Email + Announce, Task 11):
// a real round trip through `/my-account/profile`'s `?/updateNotifications` action and the real
// `members.club_email_opt_in` column (migration 0038), against the portal fixture's own default
// member (e2e/helpers/member-session.ts's `mintMemberSession` default, `portal-mem-primary` from
// e2e/fixtures/portal-seed.sql) -- never e2e/helpers/admin-session.ts, the different-database
// helper for /admin/**. The toggle is flipped ON and back OFF in one test, so the shared fixture
// row is left exactly as every other spec in this suite expects it.
test('the Notifications email toggle round-trips through the real club_email_opt_in column', async ({ page, context }) => {
  await mintMemberSession(context);
  await page.goto('/my-account/profile');

  const notificationsForm = page.locator('form[action="?/updateNotifications"]');
  const toggle = notificationsForm.getByRole('checkbox', { name: 'Email', exact: true });

  // Off by default: migration 0038's own default is 0, and this fixture member's row never sets
  // it explicitly.
  await expect(toggle).not.toBeChecked();
  const before = queryClubDb<{ club_email_opt_in: number }>(
    `SELECT club_email_opt_in FROM members WHERE id = 'portal-mem-primary'`,
  );
  expect(before[0]?.club_email_opt_in).toBe(0);

  await toggle.check();
  await notificationsForm.getByRole('button', { name: 'Update' }).click();

  // This form submits through `use:enhance` with `update({ reset: false })`, so the assertion
  // below reads the checkbox re-rendered from the `invalidateAll`-refreshed load data, not from
  // a full page load.
  const reloadedToggle = page.locator('form[action="?/updateNotifications"]').getByRole('checkbox', { name: 'Email', exact: true });
  await expect(reloadedToggle).toBeChecked();
  const afterOn = queryClubDb<{ club_email_opt_in: number }>(
    `SELECT club_email_opt_in FROM members WHERE id = 'portal-mem-primary'`,
  );
  expect(afterOn[0]?.club_email_opt_in).toBe(1);

  await reloadedToggle.uncheck();
  await page.locator('form[action="?/updateNotifications"]').getByRole('button', { name: 'Update' }).click();

  const finalToggle = page.locator('form[action="?/updateNotifications"]').getByRole('checkbox', { name: 'Email', exact: true });
  await expect(finalToggle).not.toBeChecked();
  const afterOff = queryClubDb<{ club_email_opt_in: number }>(
    `SELECT club_email_opt_in FROM members WHERE id = 'portal-mem-primary'`,
  );
  expect(afterOff[0]?.club_email_opt_in).toBe(0);
});
