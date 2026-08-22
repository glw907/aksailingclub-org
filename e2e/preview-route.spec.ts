import { test, expect } from '@playwright/test';

// The share-a-draft preview mount's own functional gate (cairn 0.95 adoption pass,
// docs/plans/2026-08-21-cairn-0.95-adoption.md T4): an unknown token must answer the engine's own
// contract for a malformed token, a plain 404, never a crash. "not-a-real-token" is also the
// wrong shape for a minted token (43 base64url characters), so this exercises the cheapest
// rejection path, the one spray traffic hits, with no AUTH_DB read (previewLoad's own
// TOKEN_SHAPE_RE gate, 404 with no D1 read at all).
//
// The response also carries the engine's own PREVIEW_HEADERS (cairn-cms's previewLoad,
// dist/sveltekit/preview.js): `event.setHeaders(PREVIEW_HEADERS)` runs unconditionally at the top
// of previewLoad, before the token-shape check, so every response on this route, refusal
// included, carries them. This does not assert a `<link rel="canonical">` is absent: the root
// +error.svelte 404 page never renders one on any route, so that check would pass regardless of
// whether the preview mount worked at all. The canonical/og:url/jsonLd.url strip is
// ArticleView's own `previewSafeSeo` (see src/theme/preview-seo.ts and its unit test), which only
// runs once a token resolves to real content; a 404 never reaches it, so there is nothing
// preview-specific to assert about the 404's head here beyond the headers the engine actually
// sends on this path.
test('an unknown preview token answers not-found with the engine preview headers', async ({ page }) => {
  const response = await page.goto('/preview/not-a-real-token');

  expect(response?.status()).toBe(404);

  const headers = response?.headers() ?? {};
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['x-robots-tag']).toContain('noindex');
  expect(headers['referrer-policy']).toBe('no-referrer');
});
