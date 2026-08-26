import { test, expect } from '@playwright/test';
import { mintMemberSession } from './helpers/member-session';

// The portal Notifications section's first visual baselines (Email + Announce, Task 3):
// `/my-account/profile`, the fixture member's default (opted-out) state. 390/1440 x light/dark,
// matching e2e/portal-visual.spec.ts's own convention exactly (this repo's established
// member-facing device pair).
//
// Baselines are CI-canonical: running this suite locally is EXPECTED to fail on missing snapshots
// until `ci.yml`'s `workflow_dispatch` regenerates them on the runner. A workstation render is
// never committed as a baseline. Every state below was verified locally by construction against
// e2e/portal-notifications.spec.ts's own proven locators, never executed itself.
const WIDTHS = [390, 1440] as const;
const THEMES = ['light', 'dark'] as const;

for (const width of WIDTHS) {
  for (const colorScheme of THEMES) {
    test(`profile — Notifications section — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintMemberSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/my-account/profile');
      await expect(page.getByRole('heading', { level: 2, name: 'Notifications' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Receive club email' })).not.toBeChecked();
      await expect(page).toHaveScreenshot(`profile-notifications-${colorScheme}-${width}.png`, { fullPage: true });
    });
  }
}
