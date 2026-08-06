# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE CAIRN ADOPTION PASS LANDED ON BRANCH `cairn-0.94-migration`. WHAT IS OWED IS GEOFF'S
BEFORE/AFTER ON THE ADMIN FORM FIELDS, THEN THE MERGE (2026-08-05).** What happened:

- **This site is on `@glw907/cairn-cms` `0.94.0-rc.1`, pinned exactly** (commit `fbb5908`),
  crossing `0.92.0`, `0.93.0`, and the RC window in one step. The pin is deliberate and must
  stay a pin: a caret range never resolves a prerelease, so `^0.94.0-rc.1` would silently hold
  the site on `0.91.x`. **Move to `^0.94.0` when the stable publishes.**
- **All four brief seams are consumed and every site copy is deleted.**
  `admin-club/lib/audit-sink.ts` gives way to `createD1AuditSink`, with no migration: asc-club's
  `audit_log` is the table cairn's packaged `migrations/0002_audit.sql` was derived from, and its
  columns already match. `club-action.ts`'s hand-rolled composition gives way to
  `createSectionAction` (128 lines of logic become 57 of config). `theme/turnstile.ts`'s verifier
  and `theme/rate-limit.ts`'s wrapper give way to `/cloudflare`. The token, hash, and
  constant-time-compare copies in member-auth, offers, and the portal wrapper give way to
  `/auth-crypto`. The jobs runner's own audit inserts now go through the packaged sink too, under
  namespaced action names, since `0.94.0-rc.1` sanctioned direct domain-event calls.
- **Gates all green**: `check` 0/0, 2057 tests, `build`, `cairn-audit` static and rendered (0
  errors, `one-filled-action` clean, run authenticated with `CAIRN_AUDIT_COOKIES` against a
  seeded local session — an unauthenticated rendered run measures the sign-in card twelve times
  and reports a fake pass). `cairn-doctor`'s two FAILs are the API token lacking Zone Settings
  Read, not zone findings; `http://` redirects to `https://` on both hosts, checked directly.
- **OWED, and the only thing between here and the merge: Geoff's before/after on the admin form
  fields.** The pass takes `0.92.0`'s new stacked field register (label above control) as the
  default rather than passing `register="inline"` to hold the old horizontal rhythm. That is
  what this site's own ratified mockup asked for and what `EventForm.svelte` had been recording
  as a wanted future addition, but it is a visual change across thirteen admin screens and it
  gates on his eyes. Baselines regenerate on the branch via the `ci.yml` `update_snapshots`
  dispatch. RESUME PROMPT: "Check the `cairn-0.94-migration` branch's CI, put the regenerated
  admin baselines in front of Geoff as a before/after on the stacked field register, and merge
  once he approves." Launch from ~/Projects/aksailingclub-org.
- **Not taken, deliberately, both filed to `docs/2026-07-07-polish-backlog.md`**: the 65
  pre-existing `cairn-audit` `no-uncompiled-class` errors on the Club screens (verified
  pre-existing against `0.91.1`'s own shipped sheet), and `audit_log.created_at`'s
  `datetime('now')` default, whose fix is a table rebuild against live rows.
- The engine-side half of this pass lives in cairn-cms, not here: the upgrade-guide corrections
  (`30d6fbbe`) and the migration report (`bb37c809`).

**PRIOR ENTRY (2026-08-01) — the pass above executed its NEXT. One rider survives it, still
undone: Announce list recency via `publishedAt`, since the picker sorts by frontmatter `date`
(`announce/+page.server.ts:26`) and a backdated post can vanish from the list an editor announces
from. The seam is available on this pin; nothing consumes it yet.**

- **The cairn ratchet pass landed in cairn-cms** (PR #13, merge `e70f295b`) **and 0.92.0 is
  published as latest**, superseding the archived Assets-trial entry's NEXT. 0.93.0 is in flight now,
  carrying the xcathletes engine seams: the `./auth-store` export promotion, the `publishedAt`
  first-publish stamp, and the `newlyPublishedEntries` diff helper. This repo still pins
  `^0.91.1` at the time of writing; the entry above is where that ended.
- **A harvest sweep found five functionality seams and filed them** as
  `cairn-cms/docs/internal/2026-08-01-asc-consumer-brief.md` (commit `e15173d1`): (1) the auth
  crypto primitives, reimplemented three times in the family (`src/member-auth/lib/crypto.ts`,
  `offers.ts`, xcathletes member OTP next); (2) a form-action wrapper seam (`club-action.ts`
  and `portal-action.ts` are two hand-rolled copies, xcathletes platform Task 5 would write the
  third); (3) `verifyTurnstile`, already copied verbatim from ecxc-ski; (4) the rate-limit
  degrade-to-open wrapper; (5) a packaged D1 audit sink with an `audit_log` migration. The
  legacy-redirect helper was considered and held site-side (Geoff's call). Geoff runs the
  engine update from the brief.

**STILL OPEN ON GEOFF'S QUEUE (pointers; full entries in docs/status-archive.md):**
the before/after on both rebuilt Assets screens on dev (/admin/club/assets and
/admin/club/asset-requests), which gates the apex (full entry in the archive);
the Classes before/after on dev (/admin/club/classes) and the 2026-07-21 probe
verdicts, including the three riders (StatusChip palette, the never-paid 'none'
copy, the search focus ring — the latter two since CLOSED; full entry archived);
the pass-B sidebar walkthrough per role (four-group tree, badges, the two class
surfaces, Help in the foot; full entry moved to the archive);
the attorney packet send (docs/waivers/, all DRAFTs; the sitting's full entry is in
the archive — sources verified live, register/fact gates run, board-packet.md carries
the Borough records-request path);
the waivers signing-moment before/after (dev renders the no-docs state; the moment is
visible in the CI-minted baselines and locally via the e2e fixtures — full build entry
in the archive);
member-directory before/afters (/my-account/directory, /my-account/committees, edit
surfaces, public /committees); portal redesign before/after against mock D (PR #1,
merge 510b266); the payments live smoke (docs/plans/2026-07-15-payments-live-smoke.md);
the five-stop dev walkthrough; the 07-15 apology-send verification; the fragments
/members before/after and the unfiled fragments harvest
(docs/2026-07-17-fragments-harvest-findings.md); the directory pass's DX-harvest notes
(shared portal section primitive, --container-measure-list token — in the archive
entry);
the board-demo cleanup after the board meeting (`node scripts/import/demo-household.mjs --cleanup`; full entry in the archive);
the retention step's before/after on /my-account/renew (https://claude.ai/code/artifact/6e29d1e8-1b9f-4d51-a133-9be3b8c0eecb);
the admin form fields' stacked-register before/after on the cairn-0.94-migration branch, which
gates that merge (full entry at the top of this file);
the asset_requests uniqueness race (a double-click can still create two pending retention
rows; needs a unique index, so a migration, deliberately routed out of the substrate pass).
