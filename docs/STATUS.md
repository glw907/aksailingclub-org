# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE CAIRN 0.94.0 ADOPTION IS COMPLETE: MERGED TO `main` (PR #3, merge `3e7d97d`) AND DEPLOYED TO
dev.aksailingclub.org ON 2026-08-07, ON THE `^0.94.0` CARET RANGE.** No initiative is in flight.
The immediate next action is Geoff's: the open before/afters on his queue below, or the announce
`publishedAt` rider. The apex cutover remains its own deliberate DNS change, never bundled.

**The completion record (2026-08-07):**

- **The caret flip.** `0.94.0` stable published (npm `latest`); the pin went `0.94.0-rc.2` →
  `^0.94.0` (`8076b00`), lockfile regenerated, clean `npm ci`. The installed copy verified:
  version `0.94.0`, exports reading `types > worker > browser > default` on both `./auth-crypto`
  and `./cloudflare`, so the rc.1 Workers fix is in stable. Only the version-cut commit separates
  rc.2 from stable engine-side.
- **Gates, all green.** `check` 0/0 (1013 files), 2057 tests across 152 files, `build` clean.
  Local Playwright: all 75 specs served by a started Worker; 19 functional specs passed and the
  56 failures were all `toHaveScreenshot` pixel diffs (every failure dir carries a diff.png,
  none is a startup or request error) — the documented workstation-versus-runner delta. The
  canonical pixel gate ran on CI: PR #3's `ci` check passed in 6m47s, full visual suite included.
- **The two re-runs the rc.2 entry owed.** Rendered `cairn-audit` on the `0.94.0` install:
  12 pages measured authenticated (freshly minted local session, real admin shell rendered),
  **0 errors**, 733 advisories, 353 suppressed — the advisory mass is the known ruling-exempt
  hairline state. `cairn-doctor`: 14 PASS, the same two FAILs (Always Use HTTPS / Zone HSTS
  reads returning 403, the API token lacking Zone Settings Read, not zone findings);
  `http://` → `https://` 301 re-confirmed directly on both hosts.
- **Deployed and smoked.** Merge to `main` ran `deploy.yml` (run `31215130848`, green) to the
  `asc-site` Worker. Live smoke via the Access service token: `/`, `/events`, `/education`,
  `/join/apply`, `/admin/login`, `/events/calendar.ics` all 200 with substance — the Season band
  renders from D1, the `.ics` feed carries 17 VEVENTs, Turnstile loads on join, the sign-in card
  renders. That exercises both cairn subpaths server-side on the deployed Worker.
- **Static audit: baseline unchanged, two adjacent findings filed.** 65 `no-uncompiled-class`
  errors, exactly the recorded pre-existing baseline. Two further errors (`reduced-motion` and
  `focus-parity` on `src/routes/admin/club/+page.svelte`) are pre-existing site-side, not this
  migration's doing (rules shipped since `0.91.0`, file unchanged on the branch); filed to
  `docs/2026-07-07-polish-backlog.md` beside the 65.
- **Riders surviving the initiative**, all recorded: announce-list recency via `publishedAt`
  (picker still sorts by frontmatter `date`, `announce/+page.server.ts:26`; the seam is on this
  pin, nothing consumes it); baseline coverage for the stacked register proves the flip only on
  `/admin/club/documents`, the one field-carrying admin surface with a baseline (a coverage pass
  is Geoff's call); the `asset_requests` uniqueness race (needs a unique index, so a migration);
  the polish-backlog items above. The full adoption-pass record (seams consumed, alignment
  mechanic, approval trail) is the top entry in `docs/status-archive.md`; the engine-side record
  is cairn's migration report (`docs/internal/feedback/2026-08-05-aksailingclub-org-migration.md`).

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
the asset_requests uniqueness race (a double-click can still create two pending retention
rows; needs a unique index, so a migration, deliberately routed out of the substrate pass).
