import { test, expect } from '@playwright/test';
import { mintAdminSession } from './helpers/admin-session';

// The Email admin screens' first functional e2e coverage (Email + Announce, Task 11), against
// the real /admin/club/email and /admin/club/email/compose routes and e2e/fixtures/email-seed.sql's
// real send-log rows: the Templates/Send log switcher, an incident row expanding to its own
// member rows and in-incident pager, the outcome filter narrowing the log, and Compose's own
// review step (the resolved count) plus its confirm dialog (the count-acknowledging gate). Every
// test mints its own admin session (e2e/helpers/admin-session.ts's `mintAdminSession`, the
// CLUB_DB/AUTH_DB-writing helper for /admin/**), never e2e/helpers/member-session.ts, which is
// the member-portal's own, different-database helper.

test.describe('the email index screen', () => {
  test('the Templates/Send log switcher toggles views with correct aria-pressed state', async ({ page, context }) => {
    await mintAdminSession(context);
    await page.goto('/admin/club/email');

    const templatesTab = page.getByRole('button', { name: 'Templates' });
    const logTab = page.getByRole('button', { name: 'Send log' });

    // Templates is the default view: its own tab is pressed, and a known live template id shows.
    await expect(templatesTab).toHaveAttribute('aria-pressed', 'true');
    await expect(logTab).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('link', { name: 'class_welcome' })).toBeVisible();

    await logTab.click();

    await expect(logTab).toHaveAttribute('aria-pressed', 'true');
    await expect(templatesTab).toHaveAttribute('aria-pressed', 'false');
    // The seed's own singleton failure, a real send-log row, only ever renders in this view.
    await expect(page.getByText('e2e-eml-single-1@aksailingclub.org')).toBeVisible();
  });

  test('an incident row expands to its own member rows and in-incident pager', async ({ page, context }) => {
    await mintAdminSession(context);
    await page.goto('/admin/club/email');
    await page.getByRole('button', { name: 'Send log' }).click();

    // The 55-row quota-incident cluster (email-seed.sql): folded into one display unit, collapsed
    // by default. The log's own read orders `sent_at DESC`, so the incident's own member rows run
    // newest first: page 1 (INCIDENT_PAGE_SIZE 50) covers inc-55 (the latest) down to inc-6, and
    // page 2 covers the oldest five, inc-5 down to inc-1.
    const showButton = page.getByRole('button', { name: 'Show 55 sends' });
    await expect(showButton).toBeVisible();
    await expect(page.getByText('e2e-eml-inc-55@aksailingclub.org')).not.toBeVisible();

    await showButton.click();

    await expect(page.getByRole('button', { name: 'Hide 55 sends' })).toBeVisible();
    await expect(page.getByText('e2e-eml-inc-55@aksailingclub.org')).toBeVisible();
    await expect(page.getByText('1–50 of 55 in this incident')).toBeVisible();
    await expect(page.getByText('e2e-eml-inc-1@aksailingclub.org')).not.toBeVisible();

    await page.getByRole('button', { name: 'Next ›' }).click();

    await expect(page.getByText('51–55 of 55 in this incident')).toBeVisible();
    await expect(page.getByText('e2e-eml-inc-1@aksailingclub.org')).toBeVisible();
    await expect(page.getByText('e2e-eml-inc-55@aksailingclub.org')).not.toBeVisible();
  });

  test('the outcome filter narrows the log to failed rows only', async ({ page, context }) => {
    await mintAdminSession(context);
    await page.goto('/admin/club/email');
    await page.getByRole('button', { name: 'Send log' }).click();

    // Before filtering: both a sent row and the two kinds of failure are on the page.
    await expect(page.getByText('e2e-eml-sent-1@aksailingclub.org')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show 55 sends' })).toBeVisible();
    await expect(page.getByText('e2e-eml-single-1@aksailingclub.org')).toBeVisible();

    await page.getByLabel('Outcome').selectOption('failed');

    // The incident row and the singleton failure both survive a `failed` filter (an incident is
    // always a run of failed rows); every sent row disappears.
    await expect(page.getByRole('button', { name: 'Show 55 sends' })).toBeVisible();
    await expect(page.getByText('e2e-eml-single-1@aksailingclub.org')).toBeVisible();
    await expect(page.getByText('e2e-eml-sent-1@aksailingclub.org')).not.toBeVisible();
    await expect(page.getByText('e2e-eml-sent-4@aksailingclub.org')).not.toBeVisible();
  });
});

test.describe('Compose', () => {
  test('review shows the resolved recipient count, and the confirm dialog gates the send', async ({ page, context }) => {
    await mintAdminSession(context);
    await page.goto('/admin/club/email/compose');

    await page.getByRole('button', { name: 'New email' }).click();
    await page.getByLabel('Segment').selectOption({ label: 'Current households' });
    await page.getByLabel('Subject').fill('E2E compose subject');
    await page.getByLabel('Body (markdown)').fill('E2E compose body.');
    await page.getByRole('button', { name: 'Continue to review' }).click();

    // The review step's own subtitle names the server-resolved segment and count, never a
    // client-guessed number.
    await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
    await expect(page.getByText(/^Current households: \d+ recipients?\.$/)).toBeVisible();

    const sendButton = page.getByRole('button', { name: /^Send to \d+ recipients?$/ }).first();
    await sendButton.click();

    // The confirm dialog: the count-acknowledging gate, requiring an explicit second click before
    // anything actually sends. Cancelling leaves the draft on the review step, untouched.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('This cannot be undone.')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /^Send to \d+ recipients?\?$/ })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
  });
});
