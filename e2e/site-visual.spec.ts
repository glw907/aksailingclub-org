import { test, expect } from '@playwright/test';

// The pixel-diff CI rider (plan Task 5's acceptance: "the pixel-diff rider is in the site's CI").
// This suite is a REGRESSION gate against ASC's own prior render, not a live diff against the
// north star HTML (docs/superpowers/specs/assets/2026-07-06-asc-home-northstar.html in cairn-cms):
// that file is a static mockup with no D1 data or real photography, so it served as the one-time
// build contract Task 3/4 built against, verified by a fresh-context glance read, not an ongoing
// pixel source. Once a human has confirmed a baseline matches intent, this suite catches any future
// unintended drift from it.
//
// Known limitation: wrangler dev's local D1 renders the real Season/events data shape (seeded by
// e2e/fixtures/events-seed.sql; see playwright.config.ts), but the local R2 replica the CI runner
// starts carries no media objects, so every real photo (the hero, fleet, and facilities images)
// renders as the browser's broken-image glyph with its alt text, not the actual photograph. This
// is deterministic across runs (a real layout regression still shows), so it does not weaken the
// gate; it just cannot catch a photo-specific regression, which stays a manual review concern.
// The baselines are CI-canonical: a developer's workstation that has already run `wrangler dev`
// against the real MEDIA_BUCKET (populating its own local R2 replica under the gitignored
// .wrangler/) will render the real photos instead, and diff against these broken-image baselines
// for a reason that is not a regression. Trust a red run here only after also checking it on CI,
// or after clearing the local .wrangler/state/v3/r2 replica first.
const FAMILY_WIDTHS = [320, 390, 768, 1440, 2560];

test('home — light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Ahoy!' })).toBeVisible();
  await expect(page).toHaveScreenshot('home-light.png', { fullPage: true });
});

test('home — dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Ahoy!' })).toBeVisible();
  await expect(page).toHaveScreenshot('home-dark.png', { fullPage: true });
});

// The family five-viewport bar (320/390/768/1440/2560), composed at the extremes: the masthead's
// nav collapses to the menu affordance at 320, and the page stays a deliberate, contained column
// rather than stretching edge to edge at 2560.
for (const width of FAMILY_WIDTHS) {
  test(`home — light — ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page).toHaveScreenshot(`home-light-${width}.png`, { fullPage: true });
  });
}

// The B1 editorial-pacing exemplar (the education page's schedule): real subheads, an at-a-glance
// table, and tightened prose in place of a single long wall of text.
test('education — light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/education/');
  // Round 3, pass C (the promise hero): the page's own title ("Education") demotes to an eyebrow
  // above the h1, and the display promise takes the h1 role instead. Text matches the frontmatter
  // `promise` field (education.md), updated by a later headline pass (ad590de) that this
  // assertion had fallen behind.
  await expect(page.getByRole('heading', { level: 1, name: 'Come learn to sail with us.' })).toBeVisible();
  // The class-schedule island (unified-signup arc, ClassSchedule.svelte) reads its rows through a
  // remote query, not SSR: while the read is in flight it renders five ghost rows, a different
  // height than the one real fixture class's resolved row, so a screenshot taken before the await
  // settles flakes on height alone. Waiting for the ghost list to clear (its own `aria-busy`
  // marker) is the fix, matching the sibling long-form-pipeline test's own hydration wait below.
  await expect(page.locator('.class-schedule ul[aria-busy="true"]')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('education-light.png', { fullPage: true });
});

// Regression for the pipeline-ordering bug (edu-round-3): the long-form page's group split used to
// run against html the program-section and registration-band wraps had already applied, so a group
// boundary that fell inside the band's own wrapper divs cut the slice through them, leaving one
// {@html} segment with an unclosed div and the next with its stray closer. The browser's
// error-correcting parser repaired each segment independently, which duplicated the whole
// Registration-through-Questions block on hydration. 'load', not 'networkidle' (the design-probe
// script's own note: some pages keep a request open past 'load'), plus a short settle for
// hydration to finish.
test('education — long-form pipeline renders no duplicate section', async ({ page }) => {
  await page.goto('/education/', { waitUntil: 'load' });
  await page.waitForTimeout(300);

  await expect(page.locator('#how-to-register--pricing')).toHaveCount(1);

  const band = page.locator('.registration-band');
  await expect(band.locator('#how-to-register--pricing')).toHaveCount(1);
  await expect(band.locator('#swim-test-capsize-drill-and-life-jackets')).toHaveCount(0);

  const dividerLabels = page.locator('.group-divider-label');
  await expect(dividerLabels).toHaveCount(3);
  await expect(dividerLabels.nth(0)).toHaveText('Registration & logistics');
  await expect(dividerLabels.nth(1)).toHaveText('Preparing for class');
  await expect(dividerLabels.nth(2)).toHaveText('Policies & questions');
});

// The season page lands the reader on the next upcoming band on arrival (its own
// `afterNavigate`), so every screenshot here scrolls back to the top first: a full-page capture
// taken mid-page renders the sticky masthead over a different band each run.
async function resetScroll(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
}

// The D1-backed /events template: the events-redesign pass's one long, anchorable season page
// (the light hero without a promise sentence, the calendar-subscribe bar, the month index, the
// alternating photo bands, and the governance coda), reading from the seeded fixture rows.
// Content assertions over a screenshot here: the redesign intentionally breaks the prior
// card-grid baseline, which regenerates on CI post-merge rather than being hand-verified
// pixel-by-pixel in this suite.
test('events — light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/events/');
  // The events-redesign pass's own title: the "Events" eyebrow over "The {seasonYear} Season"
  // (no promise sentence). 2026 matches migration 0001_substrate's seeded `current_season` row.
  await expect(page.getByRole('heading', { level: 1, name: 'The 2026 Season' })).toBeVisible();
  await expect(page.locator('.events-hero-eyebrow', { hasText: 'Events' })).toBeVisible();
  // A season band, proving the full read/group/render pipeline, not just the shell.
  await expect(page.locator('.ev-band').first()).toBeVisible();
  // A band title is plain text inside its h3, not a self-link (the header-round pass moved the
  // month running head to the h2 step as the season's chapter heading, close-out review round).
  await expect(page.getByRole('heading', { level: 3, name: 'Test Regatta' })).toBeVisible();
  // The governance coda, still reachable off the month index's own "Meetings" link.
  await expect(page.locator('#meetings')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Meetings and governance' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apple Calendar' })).toBeVisible();
  // The fixed clock (ASC_FIXED_TODAY=2026-08-22, playwright.config.ts) puts the fixture's fall
  // clinic ahead of "today" and its June class behind it, so the page renders exactly one
  // Register action, in fireweed, and the June rows read as past.
  await expect(page.getByRole('link', { name: /^Register/ })).toHaveCount(1);
  await expect(page.locator('.ev-cta')).toHaveCount(1);
  await resetScroll(page);
  await expect(page).toHaveScreenshot('events-light.png', { fullPage: true });
});

for (const width of FAMILY_WIDTHS) {
  test(`events — light — ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/events/');
    await resetScroll(page);
    await expect(page).toHaveScreenshot(`events-light-${width}.png`, { fullPage: true });
  });
}

// The real .ics feed the calendar-subscribe bar's links point at.
test('events calendar.ics — real feed', async ({ page }) => {
  const res = await page.request.get('/events/calendar.ics');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/calendar');
  const body = await res.text();
  expect(body).toContain('BEGIN:VCALENDAR');
  expect(body).toContain('SUMMARY:Test Regatta');
  expect(body).toContain('UID:test-regatta@aksailingclub.org');
});

// The events-redesign pass's link-preview stub (/events/[id]): a shared link to a season row
// still unfurls with its own title and a noindex robots tag, then forwards a real browser on to
// the row's own anchor on the season page. Uses the fixture's seeded 'test-regatta' id (the
// design contract's own illustrative "Governor's Cup" example names no row this suite's fixture
// actually seeds); the two prior full-page "event detail — light" / "class detail — light" tests
// this replaces checked a per-event template that the events-redesign pass retired.
test('events detail stub — redirects', async ({ page }) => {
  const res = await page.request.get('/events/test-regatta');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('<meta http-equiv="refresh" content="0; url=/events#test-regatta"');
  expect(body).toContain('<meta name="robots" content="noindex"');
});

// The public join door (plan Task 8, the unified-signup arc): tier selection with live
// settings-driven prices, the purchaser's own fields, and the optional class-pick list, reading
// the same fixture classes/settings the join-and-class-door functional spec exercises. The
// Turnstile widget's own script is blocked here for the same reason the functional spec blocks
// it (join-and-class-door.spec.ts's own header): left unblocked, a real network path to
// Cloudflare's challenge platform renders non-deterministic third-party widget content this
// suite has no reason to pixel-diff.
test('join apply — light', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/join/apply/');
  await expect(page.getByRole('heading', { level: 1, name: 'Join the club' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Individual/ })).toBeVisible();
  await expect(page).toHaveScreenshot('join-apply-light.png', { fullPage: true });
});

for (const width of FAMILY_WIDTHS) {
  test(`join apply — light — ${width}px`, async ({ page }) => {
    await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/join/apply/');
    await expect(page).toHaveScreenshot(`join-apply-light-${width}.png`, { fullPage: true });
  });
}

// The Turnstile hardening pass (plan Task 1, 2026-07-15): one representative screenshot per
// newly-gated public page, proving the added widget renders without breaking layout. A single
// light-mode capture each, not the full five-viewport family bar (that bar is the acceptance gate
// for a design pass; this is a narrower correctness check that the widget addition itself is the
// only visible diff). The Turnstile challenge script is blocked for the same non-determinism
// reason `join apply — light` blocks it above.
test('my-account — signed out (Turnstile hardening pass)', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/my-account');
  await expect(page.getByRole('heading', { level: 1, name: 'Member sign-in' })).toBeVisible();
  await expect(page).toHaveScreenshot('my-account-signed-out-light.png', { fullPage: true });
});

test('my-account confirm — sign-in button (Turnstile hardening pass)', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/my-account/confirm?token=any-token-value');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Alaska Sailing Club' })).toBeVisible();
  await expect(page).toHaveScreenshot('my-account-confirm-light.png', { fullPage: true });
});

// The class waitlist offer page: e2e/fixtures/signup-seed.sql seeds one pending offer whose
// plaintext token is 'fixture-offer-token' (the hashed value stored is the only form the schema
// carries; see that fixture's own header for why the hash is hard-coded there).
test('class offer — claim/decline (Turnstile hardening pass)', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/classes/offer/fixture-offer-token');
  await expect(page.getByRole('button', { name: 'Claim my spot' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pass this time' })).toBeVisible();
  await expect(page).toHaveScreenshot('class-offer-light.png', { fullPage: true });
});

// The class-signup page's post-enrollment panel: payClassFee's own widget only ever renders after
// a real enroll (never on a bare GET), so this test signs up the fixture's own 'current'-standing
// member (e2e-current-member@example.com, signup-seed.sql) to reach it. STRIPE_SECRET_KEY and
// TURNSTILE_SECRET_KEY are both unbound locally (join-and-class-door.spec.ts's own header), so
// the joinClass submission itself degrades open, same as every other local e2e submission here.
test('class signup — enrolled, pay class fee (Turnstile hardening pass)', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/classes/test-intro-class/signup');
  await page.getByRole('group', { name: 'Full name' }).getByRole('textbox').fill('E2E Current Member');
  await page.getByRole('group', { name: 'Email address' }).getByRole('textbox').fill('e2e-current-member@example.com');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText("You're signed up for Test Intro Class.")).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay \$150 now/ })).toBeVisible();
  await expect(page).toHaveScreenshot('class-signup-enrolled-light.png', { fullPage: true });
});

// The class-door standing gate's own renew pivot: requestRenewLink's widget, the signup page's
// second new Turnstile gate. Reached the same way join-and-class-door.spec.ts's own class-door
// pivot test reaches its pivot -- an email-blur probe, ahead of any submit -- against the
// fixture's own 'lapsed'-standing member (e2e-lapsed-member@example.com, signup-seed.sql: a
// household with no paid membership row at all).
test('class signup — lapsed pivot, renew sign-in link (Turnstile hardening pass)', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/classes/test-intro-class/signup');
  await page.getByRole('group', { name: 'Full name' }).getByRole('textbox').fill('E2E Lapsed Member');
  const emailField = page.getByRole('group', { name: 'Email address' }).getByRole('textbox');
  await emailField.fill('e2e-lapsed-member@example.com');
  await emailField.blur();
  await expect(page.getByText('Renew to sign up for Test Intro Class.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(page).toHaveScreenshot('class-signup-renew-light.png', { fullPage: true });
});

// /events/[id].ics: the per-event add-to-calendar endpoint, exactly one VEVENT.
test('event detail .ics — real feed', async ({ page }) => {
  const res = await page.request.get('/events/test-regatta.ics');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/calendar');
  const body = await res.text();
  expect(body).toContain('UID:test-regatta@aksailingclub.org');
  expect(body.indexOf('BEGIN:VEVENT', body.indexOf('BEGIN:VEVENT') + 1)).toBe(-1);
});
