import { test, expect } from '@playwright/test';

// The share-a-draft preview mount's own functional gate (cairn 0.95 adoption pass,
// docs/plans/2026-08-21-cairn-0.95-adoption.md T4): an unknown token must answer the engine's own
// contract for a malformed token, a plain 404, never a crash, and the response must carry no
// `<link rel="canonical">` -- the engine's own `previewLoad` strips canonical/og:url on every
// preview response regardless of outcome (PREVIEW_HEADERS/the malformed-token gate both run
// before any content resolution). "not-a-real-token" is also the wrong shape for a minted token
// (43 base64url characters), so this exercises the cheapest rejection path, the one spray traffic
// hits, with no AUTH_DB read (previewLoad's own TOKEN_SHAPE_RE gate, 404 with no D1 read at all).
test('an unknown preview token answers not-found with no canonical link', async ({ page }) => {
  const response = await page.goto('/preview/not-a-real-token');

  expect(response?.status()).toBe(404);

  const canonicalCount = await page.locator('link[rel="canonical"]').count();
  expect(canonicalCount).toBe(0);
});
