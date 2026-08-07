# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE CAIRN ADOPTION PASS IS COMPLETE AND VERIFIED ON BRANCH `cairn-0.94-migration`, PINNED TO
`0.94.0-rc.2` (commit `d71ff1e`). IT IS NOT MERGED AND NOT DEPLOYED. GEOFF APPROVED THE STACKED
FIELD REGISTER ON 2026-08-06, so the only remaining gate is the engine. IMMEDIATE NEXT ACTION: flip
the pin to `^0.94.0` once `0.94.0` stable publishes, re-run the gates, and merge.**

- **The rc.1 Workers blocker is gone, and the fix is proven against the registry artifact.**
  `0.94.0-rc.2` carries `worker` ahead of `browser` on both `./auth-crypto` and `./cloudflare`.
  Verified on a clean `npm ci` after deleting `node_modules`, so nothing of the diagnosis-time patch
  survived into the measurement. **The Playwright suite started a Worker and ran all 75 specs, where
  rc.1 had allowed none of them to reach a request**: zero `ERR_CONNECTION_REFUSED`, zero
  `is server-only`, zero `Workers runtime failed to start`. Every functional spec passed (admin
  session, both join paths, both portal sessions, all four waivers signing specs, both `.ics`
  feeds), which exercises both subpaths server-side under `workerd`. `check` 0/0, 2057 tests,
  `build` clean. Recorded engine-side in cairn `90b87511`.
- **The pin must stay an exact pin until `0.94.0` ships.** A caret range never resolves a
  prerelease, so `^0.94.0-rc.2` would silently hold the site on `0.91.x`. At the time of writing npm
  `latest` is `0.93.0` and `next` is `0.94.0-rc.2`. **Move to `^0.94.0` when the stable publishes**,
  which is now the only thing this branch is waiting on.
- **The visual baselines regenerated on the branch** via the `ci.yml` `update_snapshots` dispatch
  (runs `31141539971` → `873a3bb`, then `31148708255` → `e509b28` after the alignment fix). Read from
  the step log rather than the job conclusion, since that workflow reports success when it commits
  nothing: both regens ran 75 specs and staged all three snapshot dirs. **Twelve of 63 baselines
  changed**, across exactly two surfaces. A local `test:e2e` run reports ~60 visual failures against
  CI baselines; that gap is the documented workstation-versus-runner rendering delta, not breakage.
- **All four brief seams are consumed and every site copy is deleted.**
  `admin-club/lib/audit-sink.ts` gives way to `createD1AuditSink`, with no migration: asc-club's
  `audit_log` is the table cairn's packaged `migrations/0002_audit.sql` was derived from, and its
  columns already match. `club-action.ts`'s hand-rolled composition gives way to
  `createSectionAction` (128 lines of logic become 57 of config). `theme/turnstile.ts`'s verifier
  and `theme/rate-limit.ts`'s wrapper give way to `/cloudflare`. The token, hash, and
  constant-time-compare copies in member-auth, offers, and the portal wrapper give way to
  `/auth-crypto`. The jobs runner's own audit inserts now go through the packaged sink too, under
  namespaced action names, since `0.94.0-rc.1` sanctioned direct domain-event calls.
- **`cairn-audit` static and rendered was green at the rc.1 state** (0 errors, `one-filled-action`
  clean, run authenticated with `CAIRN_AUDIT_COOKIES` against a seeded local session — an
  unauthenticated rendered run measures the sign-in card twelve times and reports a fake pass).
  `cairn-doctor`'s two FAILs are the API token lacking Zone Settings Read, not zone findings;
  `http://` redirects to `https://` on both hosts, checked directly. **Neither was re-run on the
  `rc.2` pin**, since the bump changed only an exports condition; re-run both before the merge.
- **APPROVED 2026-08-06 ("that looks good now"): the stacked field register.** The before/after he
  read is https://claude.ai/code/artifact/f30398c5-351a-4568-b914-676e61821715, showing the flip at
  1440 and 390 in both themes with the alignment break below already fixed in every frame, and the
  fixture drift separated out so it does not read as cairn's doing. The pass takes `0.92.0`'s
  stacked register (label above control) as the default rather than passing `register="inline"` to
  hold the old horizontal rhythm, which is what this site's ratified mockup asked for and what
  `EventForm.svelte` recorded as a wanted addition. **Scope correction to the prior entry: ten
  admin surfaces carry cairn fields, and exactly one of them (`/admin/club/documents`) has a visual
  baseline**, so the regeneration proves the flip on one screen and says nothing about announce,
  assets, classes, committees, compose, email detail, events, members detail, or money. Covering
  those is a separate pass if Geoff wants it before the merge rather than after.
- **AN ALIGNMENT BREAK THE FLIP CAUSED: FIXED HERE (`f0f79bb`), MECHANIC FILED IN CAIRN.** The
  stacked register drops a field's control by the label's height; a bare sibling control in the same
  row does not move, so the row's two halves stop lining up. On the `/admin/club/documents` season
  picker the input's vertical centre went 145.0px → 157.0px while the `View` button stayed at
  144.5px, a 12.5px offset at 390 and 1440 in both themes. Cause: `items-center` on a row holding a
  two-line field block and a bare button. Fix: `items-end`, on `documents` and `money`;
  `admin/club/settings` already composed it correctly, which is the tell that the right composition
  is not discoverable from `FieldLabel`. Verified against real renders and then against the
  regenerated baselines (`e509b28`): the offset is back to 0.5px. **Geoff's standing instruction
  (2026-08-06): never put a before/after in front of him with a visible alignment defect in the
  "after"; fix it first.**
- **WHY THIS CLASS KEEPS RECURRING, answered from the record 2026-08-06 and refiled.** Three
  structural gaps plus a process one. Cairn ships compound blocks (label + control) but never names
  which element is the row's alignment anchor. The type layer leaves ascent/descent allowance the
  glyphs do not fill, so CSS-correct centring and looks-centred diverge on every padded label.
  `cairn-audit`'s fifteen rendered rules measure only the horizontal axis (`field-edge-alignment`
  compares left edges, `container-inset-asymmetry` left inset against right); none compares two
  vertical centres. And Geoff's 2026-07-30 request for an engine-level centring default
  (`docs/2026-07-30-assets-substrate-harvest-findings.md`, finding 1, with `text-box-trim` named as
  the mechanism and the measurements taken) was parked in the design-ratchet plan's "next pass seed"
  paragraph, that plan closed 2026-07-31, and it never reached cairn's ROADMAP. Refiled there
  2026-08-06 as `3101993b`, beside the both-axes filing `00eb7436`; they are one class and should be
  worked as one pass.
- RESUME PROMPT: "cairn `0.94.0` stable should be published; flip this repo's pin from
  `0.94.0-rc.2` to `^0.94.0`, re-run `check`/`test`/`build`/`test:e2e` plus `cairn-audit` and
  `cairn-doctor`, then merge. Geoff approved the field register on 2026-08-06; no further review
  gate stands between this branch and `main`." Launch from ~/Projects/aksailingclub-org.
- **Not taken, deliberately, both filed to `docs/2026-07-07-polish-backlog.md`**: the 65
  pre-existing `cairn-audit` `no-uncompiled-class` errors on the Club screens (verified
  pre-existing against `0.91.1`'s own shipped sheet), and `audit_log.created_at`'s
  `datetime('now')` default, whose fix is a table rebuild against live rows.
- The engine-side half of this pass lives in cairn-cms, not here: the upgrade-guide corrections
  (`30d6fbbe`), the migration report (`bb37c809`, amended to the rc.2 result in `90b87511`), and
  the alignment mechanic on the ROADMAP (`3d622521`).
- **Fixture drift rode along in the baseline regeneration and is not cairn's doing.** The assets
  fixture (2026-07-30) seeds five directory-visible members; the directory baseline had not been
  reminted since 2026-07-20, so `/my-account/directory` goes 5 → 10 rows, the waivers rollup's
  outstanding counts go 8 → 13, and an asset-requests badge appears. Data, not design.

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
