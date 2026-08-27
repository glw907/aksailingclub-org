# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. The per-pass ledger (what landed, what the
> gate caught, what not to rediscover) is `docs/HISTORY.md`; strategic initiatives are
> `ROADMAP.md`; pre-2026-08-21 status entries are `docs/status-archive.md`. Pruning means
> moving to one of those, never deleting.

**Current state (2026-08-26).** The site runs cairn `^0.96.0`. The Email + Announce pass is
complete: PR #11 merged and deployed to dev — the head-of-household audience model end to
end (migrations 0038/0039 applied to live and verified), the five Email and Announce admin
screens at the register bar, the advisory quota headroom (renders "unknown" until the token
mints), and the first email/announce e2e plus visual coverage. The record:
`docs/design-benchmark/decisions.md` (the 2026-08-26 settle), `docs/HISTORY.md`
(2026-08-26), harvest `docs/2026-08-25-email-announce-harvest-findings.md` (39 findings).
The apex cutover remains its own deliberate DNS change, **now explicitly blocked on the
CSRF/Referrer-Policy defect below**.

**THE pre-cutover blocker.** The blanket `Referrer-Policy: no-referrer`
(`src/hooks.server.ts`) nulls `Origin` on every plain form POST, which cairn's CSRF guard
403s: member sign-in and magic-link confirm fail in real browsers on dev today (40 plain
forms; confirmed by curl and Chromium at this pass's close). The next pass fixes it; the
staging brief with the census, mechanism, and remedy options is
`docs/2026-08-26-csrf-referrer-prep-brief.md`. Three decisions open for its brainstorm: the
default policy value, non-clobbering scope, and acceptance depth.

**Immediate next action (Geoff's).** The Email + Announce before/after (machine-local HTML,
delivered at the overnight close). Then the CSRF pass brainstorm off the prep brief. Held
for Geoff from this pass's reviews: the head-of-household toggle semantics (the default
recipient sees a control that cannot change their own reach — harvest 15), the announce
list's emphasis inversion and the announce send's missing confirm (harvest 37). Chores
whenever: mint the read-only Email Sending token (`CLOUDFLARE_EMAIL_SENDING_TOKEN` via the
ASC store + `wrangler secret put`; headroom shows "unknown" until then, a supported state)
and file Cloudflare's quota Limit Increase form (200/day measured). Standing dev queue:
`/admin/club/events` and `/events` at 1440/390, smartypants on `/governance`, the
theme-flip cross-fade on `/` and a 404, a minted "Share preview" link in a private window,
one Tidy run.

**Open decisions.**
- `wrangler.toml` `compatibility_date` is `2026-07-06`; bumping it is its own small pass.
- TypeScript 7 / `@types/node` 26 held back (svelte-check; Node 24). `@anthropic-ai/sdk`
  stays `^0.105` inside cairn's peer range.
- `prose.css` stays diverged from the showcase chassis by design.
- `households.left_at` is ignored by the email audience (harvest 22): a household that
  "left" keeps receiving club email until its paid year lapses. Latent (0 live rows);
  wants a one-predicate ruling.

**Carry-forwards.** From assets-register, deferred deliberately: `payForApprovedRequest`
atomicity (`db.batch()`), the review inbox's per-row N+1, the household desk's hand-rolled
asset chip, the `isUniqueViolation` consolidation, the committees "(s)" subtitle, no
visual baselines on the two Assets screens. From email-announce: `email_log(segment)`
index as migration 0040 on the next schema touch (harvest 20); the send-log payload/count
truncation notes (harvest 21); the `setEmailOptIn` household-scoping sweep across its
three siblings (harvest 17); `wrangler dev`'s local esbuild barrel-import failure
(harvest 39). Probe infra: `~/.local/asc-data/probes/` (assets-register, email-announce).

**Geoff's review queue (full entries in docs/status-archive.md).** The Email + Announce
before/after (this close). Still queued: the assets before/after (gates the apex), the
`/events` before/after and coherence read, Classes, the pass-B sidebar walkthrough,
waivers signing, member directory and committees, the portal redesign against mock D, the
retention step, the fragments /members page, the attorney packet send, the payments live
smoke, the five-stop dev walkthrough, the fragments harvest, the directory DX notes, the
board-demo cleanup (`node scripts/import/demo-household.mjs --cleanup`).
