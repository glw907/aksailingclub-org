# asc-site status

> Present tense only: where the work stands and the immediate next action. Read in full at
> every session start, so it stays under 60 lines. `docs/HISTORY.md` is a frozen record (git and
> PR bodies are the history now); initiatives are records in `glw907/initiatives`, deferred work is `BACKLOG.md`; superseded status
> entries, carry-forwards, and the review queue are `docs/status-archive.md`. Pruning means
> moving to the archive, never deleting.

**Current state (2026-08-26).** The site runs cairn `^0.96.0`. The Email + Announce pass is
complete: PR #11 merged and deployed to dev — the head-of-household audience model end to
end (migrations 0038/0039 applied to live and verified), the five Email and Announce admin
screens at the register bar, the advisory quota headroom (renders "unknown" until the token
mints), and the first email/announce e2e plus visual coverage. The record:
`docs/design-benchmark/decisions.md` (the 2026-08-26 settle), `docs/HISTORY.md`
(2026-08-26), harvest `docs/2026-08-25-email-announce-harvest-findings.md` (39 findings).
The apex cutover remains its own deliberate DNS change, **now explicitly blocked on the
CSRF/Referrer-Policy defect below**.

**Resume prompt (next session).** "Start the CSRF/Referrer-Policy pass: read
docs/STATUS.md and docs/2026-08-26-csrf-referrer-prep-brief.md in full, then run the
brainstorm on the brief's three open decisions with Geoff before any plan is written."

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
file Cloudflare's quota Limit Increase form (200/day measured), and add a `.devcontainer/`
with pinned Node + wrangler (`~/.dotfiles/bluefin/devenv-research.md`). Standing dev queue:
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

**Carry-forwards and Geoff's review queue** (assets-register and email-announce deferrals, probe
infra, the before/after reads, the attorney packet, the board-demo cleanup) are in the newest
entry of `docs/status-archive.md`.
