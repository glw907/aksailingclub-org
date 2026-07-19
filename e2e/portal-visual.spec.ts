import { test, expect } from '@playwright/test';
import { mintMemberSession } from './helpers/member-session';

// The portal's first-ever signed-in visual baselines (T5, portal-redesign): the landing at the
// pass's own two required-designed widths, 390 (mobile composition) and 1440 (desktop
// composition), light mode only per the task's own "minimum". Matches `site-visual.spec.ts`'s
// own idiom (a `for` loop over widths, one screenshot call per state). Two of the landing's four
// first-class states get a baseline here: `in-season-needs-you` (the seeded portal fixture's own
// routine state, `e2e/fixtures/portal-seed.sql`'s Wright household) and `in-season-clear` (that
// same file's second, Sterling household, seeded with zero real action rows by construction). The
// other two states (`renewal-window`, `off-season`) are not committed baselines, since the task's
// own scope is these two, minimum, but were rendered separately for a one-time human read (see
// the implementer's own report, not a repo artifact).
//
// Baselines are CI-canonical (this repo's own standing rule, CLAUDE.md): running this suite
// locally is EXPECTED to fail on missing snapshots until `ci.yml`'s `workflow_dispatch` regenerates
// them on the runner. A workstation render is never committed as a baseline.
const WIDTHS = [390, 1440];

// Both `.portal-desktop` and `.portal-mobile` mount at once (`+page.svelte`'s own header
// comment); CSS alone toggles which is visible per viewport, at the 1024px breakpoint
// (`.portal-desktop`'s own style block). A bare `getByText(...).first()` would pick whichever
// composition renders FIRST in DOM order regardless of viewport (the desktop one, always first),
// so at 390px that match is the hidden desktop copy and `toBeVisible()` fails on a real element
// that is correctly off-screen. Scoping every assertion to the composition CSS actually shows at
// the test's own width sidesteps that, the same fix `+page.svelte`'s own content already needs.
function compositionSelector(width: number): string {
  return width <= 1024 ? '.portal-mobile' : '.portal-desktop';
}

for (const width of WIDTHS) {
  test(`my-account signed in — needs-you — light — ${width}px`, async ({ page, context }) => {
    await mintMemberSession(context);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/my-account');
    const composition = page.locator(compositionSelector(width));
    await expect(composition.getByText('Wright', { exact: false }).first()).toBeVisible();
    await expect(composition.getByText('Trailered Boat Parking fee outstanding', { exact: false }).first()).toBeVisible();
    await expect(page).toHaveScreenshot(`my-account-needs-you-light-${width}.png`, { fullPage: true });
  });

  test(`my-account signed in — all-clear — light — ${width}px`, async ({ page, context }) => {
    await mintMemberSession(context, { memberId: 'portal-mem-clear' });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/my-account');
    const composition = page.locator(compositionSelector(width));
    await expect(composition.getByText('Sterling', { exact: false }).first()).toBeVisible();
    await expect(composition.getByText('Nothing needs you', { exact: false }).first()).toBeVisible();
    await expect(page).toHaveScreenshot(`my-account-all-clear-light-${width}.png`, { fullPage: true });
  });
}

// T7-prep (member-directory pass): the two new member-only surfaces T3/T6b built, at this suite's
// established two-width minimum (390/1440, the five-viewport bar's own extremes; the family's
// full five-width sweep is `site-visual.spec.ts`'s job for a public page, this suite's own
// `my-account` precedent above already narrows to the pass's two required-designed widths) and, per
// this task's own instruction, BOTH themes (unlike the landing baselines above, which stayed
// light-only per T5's minimum) -- `page.emulateMedia({ colorScheme })` follows `theme.css`'s own
// `prefers-color-scheme` block exactly as `site-visual.spec.ts`'s `home — dark` test already
// exercises, since neither page here sets an explicit `data-theme` cookie.
//
// Directory: signed in as the Wright household's own primary member (the suite's default
// `mintMemberSession()` id), which lists every currently-VISIBLE-standing member across
// `portal-seed.sql`'s two households -- Geoff Wright and Sam Wright (`visible`/`partial`, same
// household) plus Alex Sterling (`visible`, the Sterling household) -- so the rendered list is
// never empty.
//
// Committees: `portal-seed.sql` seeds no `committees`/`committee_members` rows (that data is a
// separate task, T2b, not yet landed as of this spec), so this page's signed-in baseline is
// necessarily the committees EMPTY state (the h1 and intro copy, no committee sections). That is
// still real, honest coverage of what a member currently sees at this URL; a richer
// chair/roster/manage-affordance baseline is future work once committee fixture rows exist.
for (const width of WIDTHS) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`my-account directory signed in — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintMemberSession(context);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/my-account/directory');
      await expect(page.getByRole('heading', { level: 1, name: 'Member directory' })).toBeVisible();
      await expect(page.getByText('Geoff Wright', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Alex Sterling', { exact: false }).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`my-account-directory-${colorScheme}-${width}.png`, { fullPage: true });
    });

    test(`my-account committees signed in — ${colorScheme} — ${width}px`, async ({ page, context }) => {
      await mintMemberSession(context);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/my-account/committees');
      await expect(page.getByRole('heading', { level: 1, name: 'Committees' })).toBeVisible();
      await expect(page).toHaveScreenshot(`my-account-committees-${colorScheme}-${width}.png`, { fullPage: true });
    });
  }
}
