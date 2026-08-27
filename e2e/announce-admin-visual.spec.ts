import { test, expect } from '@playwright/test';
import { mintAdminSession } from './helpers/admin-session';

// The Announce admin screens' first visual baselines (Email + Announce, Task 11): a deliberate,
// task-specified exception to this repo's general practice of keeping the admin surface out of
// the pixel-diff visual suite, the same exception e2e/waivers-visual.spec.ts's own "is the club
// protected" rollup already establishes. 390/1440 x light/dark, mirroring that file's own
// convention exactly.
//
// Baselines are CI-canonical: running this suite locally is EXPECTED to fail on missing snapshots
// until `ci.yml`'s `workflow_dispatch` regenerates them on the runner. A workstation render is
// never committed as a baseline. Every state below was verified locally by construction against
// e2e/announce-admin.spec.ts's own proven locators, never executed itself.
const WIDTHS = [390, 1440] as const;
const THEMES = ['light', 'dark'] as const;

for (const width of WIDTHS) {
  for (const colorScheme of THEMES) {
    // The announced-state chip pair (Task 9, probe verdict 3): the seeded post shows the
    // "Announced" quiet chip with its real detail text, every other recent post shows the
    // "Not announced" hairline-outline chip.
    test(`announce list — chip pair — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/announce');
      await expect(page.getByRole('link', { name: 'Welcome to the New Website' })).toBeVisible();
      await expect(page).toHaveScreenshot(`announce-list-chips-${colorScheme}-${width}.png`, { fullPage: true });
    });

    // The channel-block rebuild (Task 10, probe C): the shared Summary block, then the Email and
    // Discord blocks, each with its own enable control and preview -- the standing stacked-field
    // register carry-forward's own coverage, most legible at the narrow 390px width where a
    // regression would staircase the two-column field grid inside each block.
    test(`announce form — channel blocks — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1300 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/announce/2026-02-27-welcome-new-website');
      await expect(page.getByRole('heading', { level: 1, name: 'Welcome to the New Website' })).toBeVisible();
      await expect(page.locator('.announce-discord-preview')).toBeVisible();
      await expect(page).toHaveScreenshot(`announce-form-channel-blocks-${colorScheme}-${width}.png`, { fullPage: true });
    });
  }
}
