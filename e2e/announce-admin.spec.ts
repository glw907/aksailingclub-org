import { test, expect } from '@playwright/test';
import { mintAdminSession } from './helpers/admin-session';

// The Announce form's first functional e2e coverage (Email + Announce, Task 11): the channel-block
// rebuild (Task 10, probe C's ratified composition) against a real published post
// (`2026-02-27-welcome-new-website`, the site's own most recently published post), asserting each
// channel block carries its own enable control and its own preview. Mints an admin session
// (e2e/helpers/admin-session.ts), the CLUB_DB/AUTH_DB-writing helper for /admin/**.

test('the announce form renders both channel blocks with their own enable control and preview', async ({ page, context }) => {
  await mintAdminSession(context);
  await page.goto('/admin/club/announce/2026-02-27-welcome-new-website');

  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to the New Website' })).toBeVisible();

  // The Email block: its own enable control, the subject prefilled from the post title, and its
  // own preview pane.
  await expect(page.getByLabel('Email current households')).toBeVisible();
  await expect(page.getByLabel('Subject')).toHaveValue('Welcome to the New Website');
  await expect(page.locator('.announce-preview')).toBeVisible();

  // The Discord block: its own enable control (unchecked by default, unlike email) and its own
  // preview, independent of the Email block's.
  const discordToggle = page.getByLabel('Discord', { exact: true });
  await expect(discordToggle).toBeVisible();
  await expect(discordToggle).not.toBeChecked();
  await expect(page.locator('.announce-discord-preview')).toBeVisible();
  await expect(page.locator('.announce-discord-preview')).toContainText('Welcome to the New Website');
});
