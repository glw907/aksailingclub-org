// What is left of this module after the `0.94.0-rc.1` migration: the user-facing copy. The
// `checkRateLimit`/`checkRateLimitKeys` wrapper this file used to carry now ships as
// `@glw907/cairn-cms/cloudflare`, with the same degrade-to-open-on-an-absent-binding contract and
// the same short-circuit across several keys, so every call site imports the engine's pair
// directly and this file no longer wraps anything.

/** The user-facing message every fail-closed rate-limit rejection uses, shared so a caller's
 *  `invalid()`/`fail()` text stays consistent across call sites. Site copy, not engine behavior:
 *  cairn's primitives answer a boolean and take no position on what a refused visitor reads. */
export const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';
