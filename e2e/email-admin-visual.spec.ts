import { test, expect } from '@playwright/test';
import { mintAdminSession } from './helpers/admin-session';

// The Email admin screens' first visual baselines (Email + Announce, Task 11): a deliberate,
// task-specified exception to this repo's general practice of keeping the admin surface out of
// the pixel-diff visual suite (e2e/admin-login.spec.ts's own header), the same exception
// e2e/waivers-visual.spec.ts's own "is the club protected" rollup already establishes for one
// admin screen. 390/1440 x light/dark, mirroring that file's own convention exactly (the
// established admin/portal device pair in this suite; e2e/site-visual.spec.ts's own broader
// five-width FAMILY_WIDTHS is reserved for public marketing pages).
//
// Baselines are CI-canonical (this repo's own standing rule, CLAUDE.md and every other visual
// spec's own header): running this suite locally is EXPECTED to fail on missing snapshots until
// `ci.yml`'s `workflow_dispatch` regenerates them on the runner. A workstation render is never
// committed as a baseline. Every state below was verified locally by construction against
// e2e/email-admin.spec.ts's own proven locators, never executed itself.
const WIDTHS = [390, 1440] as const;
const THEMES = ['light', 'dark'] as const;

for (const width of WIDTHS) {
  for (const colorScheme of THEMES) {
    // The send-log presentation (probe verdicts 1 and 2): the incident row expanded, its inset
    // member rows and in-incident pager, sent rows continuing in the chronology below.
    test(`email index — send log, incident expanded — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/email');
      await page.getByRole('button', { name: 'Send log' }).click();
      await page.getByRole('button', { name: 'Show 55 sends' }).click();
      // The log's own read orders `sent_at DESC`, so page 1 of the in-incident pager shows the
      // newest member row, inc-55, not inc-1 (e2e/email-admin.spec.ts's own comment on the order).
      await expect(page.getByText('e2e-eml-inc-55@aksailingclub.org')).toBeVisible();
      await expect(page).toHaveScreenshot(`email-index-log-incident-${colorScheme}-${width}.png`, { fullPage: true });
    });

    // The template edit screen at the register bar (Task 8): a real, live template.
    test(`email template edit — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/email/class_welcome');
      await expect(page.getByRole('heading', { level: 1, name: 'class_welcome' })).toBeVisible();
      await expect(page).toHaveScreenshot(`email-template-edit-${colorScheme}-${width}.png`, { fullPage: true });
    });

    // Compose's review step (Task 7): the resolved recipient count, the sample roster, the
    // Task 2 headroom line, and the household-per-email note.
    test(`email compose — review step — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintAdminSession(context);
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/club/email/compose');
      await page.getByRole('button', { name: 'New email' }).click();
      await page.getByLabel('Segment').selectOption({ label: 'Current households' });
      await page.getByLabel('Subject').fill('E2E visual subject');
      await page.getByLabel('Body (markdown)').fill('E2E visual body.');
      await page.getByRole('button', { name: 'Continue to review' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
      await expect(page).toHaveScreenshot(`email-compose-review-${colorScheme}-${width}.png`, { fullPage: true });
    });
  }
}
