# CSRF / Referrer-Policy pass: prep brief

Prepared 2026-08-26 at the Email + Announce close, from the pass-end review gate's
diagnosis (three reviewers converged independently) plus a dedicated read-only scout.
This is the staging document for the next pass's brainstorm; nothing here is
implemented. The defect blocks the apex cutover.

## The defect, in one paragraph

`src/hooks.server.ts:22-32` sets `Referrer-Policy: no-referrer` on every SSR response.
Per the Fetch spec, a request under that policy serializes its `Origin` header to
`null` even for a same-origin top-level form POST. cairn's CSRF guard (guard.js Rule
2, the strict check this site delegated to it via `csrf.checkOrigin: false`) compares
`Origin` to the request origin by bare string equality, so `null` fails and every
plain (non-`use:enhance`) form POST outside `/admin` returns 403 "Cross-site POST
form submissions are forbidden". Confirmed live on dev by curl (`Origin: null` → 403,
real origin → 200) and a real Chromium submission. Member sign-in, magic-link
confirm, committees, household, storage, classes, renewal, finish-joining, and the
waitlist-offer claim are all affected.

## Ground truth (scouted 2026-08-26, file:line evidence in place)

**The blast radius is 40 plain forms plus 5 remote-function forms.** The census by
file, with today's enhance counts:

| File (under `src/routes/(site)/`) | forms | enhanced | broken plain |
|---|---|---|---|
| `my-account/+page.svelte` | 3 | 0 | 3 (requestLink, signOut ×2) |
| `my-account/profile/+page.svelte` | 6 | 1 | 5 |
| `my-account/committees/+page.svelte` | 11 | 0 | 11 |
| `my-account/household/+page.svelte` | 5 | 0 | 5 |
| `my-account/classes/+page.svelte` | 5 | 0 | 5 |
| `my-account/storage/+page.svelte` | 5 | 0 | 5 (two cross-route) |
| `my-account/confirm/+page.svelte` | 2 | 0 | 2 |
| `my-account/renew/+page.svelte` | 2 | 1 | 1 |
| `my-account/finish-joining/+page.svelte` | 1 | 0 | 1 |
| `classes/offer/[token]/+page.svelte` | 2 | 0 | 2 |
| `my-account/sign/+page.svelte` | 5 | 5 | 0 |

The five remote-function forms (`join/apply`, `classes/[id]/signup` ×4) fail
differently: with JS they submit via fetch and work; without JS they degrade to a
plain POST that SvelteKit's remote branch rejects on the same `Origin: null`,
**independent of `kit.csrf`** (`respond.js:76-80`). Only restoring a real `Origin`
header fixes them; no config can.

**The hook clobbers everything.** `securityHeaders` is outermost in `sequence(...)`
and calls `response.headers.set(...)` on the built response, so it silently overrides:
the confirm route's own `setHeaders` (same value today, so invisible), cairn's
`PREVIEW_HEADERS` on `/preview/**`, and cairn's `/admin` headers including its
stronger `Strict-Transport-Security`. Any fix must make the hook path-conditional or
non-clobbering (set only when absent); a route-scoped `setHeaders` cannot win today.

**Why the naive fix broke `e2e/preview-route.spec.ts`:** line 28 asserts
`referrer-policy: no-referrer` on `/preview/**` 404s. The engine itself sets that
header via `setHeaders(PREVIEW_HEADERS)`; the spec stayed green only because the
hook's blanket value coincided. A non-clobbering hook keeps the spec green with no
spec edit, because the engine's own header then survives.

**The routes that genuinely need referrer suppression** (bearer secret in the URL):
`/classes/offer/{token}` (single-use claim token in the path), `/my-account/confirm`
(256-bit magic-link token in the query), `/preview/{token}` (engine-owned, engine
already sets `no-referrer`). Nothing else in the repo carries a URL secret.

**The pivotal spec fact:** only `no-referrer` (and `no-referrer-when-downgrade`'s
downgrade case) nulls the `Origin` header. `same-origin` sends no Referer to any
other origin AND leaves `Origin` intact on same-origin POSTs. So the token routes'
anti-leak property and working forms are not in tension.

**cairn offers no escape hatch:** `createAuthGuard` has no `trustedOrigins`, no
allowlist, and consults `Sec-Fetch-Site` nowhere. SvelteKit 2.70.3's own
`csrf.trustedOrigins` is inert here (`checkOrigin: false` already disables the
framework check for form posts). The engine-side question (should the guard accept
`Origin: null` with same-site `Sec-Fetch-Site`, or should cairn document the
`no-referrer` incompatibility?) is filed in the Email + Announce harvest, finding 1.

**Test blast radius is one assertion:** `preview-route.spec.ts:28`. No unit test
pins `securityHeaders` (the hooks test mocks the guard and never runs `handle`).
Existing 403 tests are the portal's double-submit token, unrelated.

## Remedy options

**Option 1 (recommended): fix the header, one hook edit.** Default
`strict-origin-when-cross-origin` (or `same-origin`, stricter privacy), applied
non-clobberingly (set only when the response lacks the header) so engine-set values
on `/preview/**` and `/admin/**` win; explicit `same-origin` on
`/classes/offer/**` and `/my-account/confirm` (preserving their anti-leak property
while restoring `Origin`). Fixes all 40 plain forms and the 5 remote-function no-JS
paths at once, zero form edits, preview spec untouched. The confirm route's now-
redundant own `setHeaders` gets reconciled in the same change.

**Option 2: convert all 40 forms to `use:enhance`.** Works (a fetch submit carries
`Origin` unconditionally), but it is 40 edits across 10 files, each needing the
`update({ reset: false })` / reset-trap discipline, it leaves the trap armed for
every future plain form, and it cannot fix the remote-function no-JS degradation.
Rejected as primary; individual forms may still adopt `use:enhance` later for UX
reasons on their own merits.

**Option 3: engine change (cairn accepts `Origin: null` + same-site
`Sec-Fetch-Site`).** Weakens the only CSRF layer on token routes that carry no
double-submit token, per OWASP's caution on null-tolerant comparisons; also couples
the fix to a cairn release. Rejected; the engine conversation continues via the
harvest finding on documentation instead.

## Open decisions for Geoff (the brainstorm's agenda)

1. The default policy value: `strict-origin-when-cross-origin` (web-standard
   default, origin-only leaks cross-origin) vs `same-origin` (nothing leaves the
   origin; stricter, and arguably right for a club site with no analytics
   dependencies). Either fixes the defect.
2. Whether the hook becomes non-clobbering for all four security headers it sets or
   only Referrer-Policy (the scout found it also flattens cairn's stronger admin
   HSTS; same mechanism, same fix, slightly wider diff).
3. Acceptance depth: header assertions plus a curl-shaped Origin test, or a full
   e2e round-trip through one previously broken plain form per surface (sign-in and
   offer-claim at minimum are cheap and high-value).

## Scope sketch

Small pass, one implementer task plus verification: the hook edit,
reconciling `my-account/confirm`'s redundant `setHeaders`, a unit test that actually
runs the `handle` chain and asserts per-path header values (the current hooks test
mocks it away), one e2e proving a plain portal form POST succeeds in a real browser
(the portal-session spec is the natural host), and the security reviewer re-run as
the gate. Out of scope: the 40 forms themselves (untouched), cairn changes, the
`csrf.checkOrigin` → `trustedOrigins` config migration (fold in only if trivially
safe; SvelteKit deprecation warning already fires in Vitest).
