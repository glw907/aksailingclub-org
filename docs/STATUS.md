# asc-site status

> Rolling status for the Alaska Sailing Club's cairn rebuild: read this file first for
> where the work stands and the immediate next action. Only the CURRENT initiative's
> entries live here, plus the most recent completed initiative while its follow-ups stay
> open; everything older moves to `docs/status-archive.md` (history, never instructions).
> TRIM RULE (Geoff, 2026-07-14): at each session close, when a new entry lands, move
> entries beyond the top two or three to the archive — this file is @-imported into every
> session's context, so its length is a per-session token tax.

**THE CAIRN RATCHET IS SHIPPED ENGINE-SIDE AND THE ASC CONSUMER BRIEF IS FILED. THIS
REPO'S NEXT PASS IS THE CAIRN ADOPTION/SIMPLIFICATION PASS, GATED ON GEOFF'S ENGINE UPDATE
(2026-08-01, Fable conducting).** What happened:

- **The cairn ratchet pass landed in cairn-cms** (PR #13, merge `e70f295b`) **and 0.92.0 is
  published as latest**, superseding the archived Assets-trial entry's NEXT. 0.93.0 is in flight now,
  carrying the xcathletes engine seams: the `./auth-store` export promotion, the `publishedAt`
  first-publish stamp, and the `newlyPublishedEntries` diff helper. This repo still pins
  `^0.91.1`, so none of the repairs this site's own trial generated are consumed here yet.
- **A harvest sweep found five functionality seams and filed them** as
  `cairn-cms/docs/internal/2026-08-01-asc-consumer-brief.md` (commit `e15173d1`): (1) the auth
  crypto primitives, reimplemented three times in the family (`src/member-auth/lib/crypto.ts`,
  `offers.ts`, xcathletes member OTP next); (2) a form-action wrapper seam (`club-action.ts`
  and `portal-action.ts` are two hand-rolled copies, xcathletes platform Task 5 would write the
  third); (3) `verifyTurnstile`, already copied verbatim from ecxc-ski; (4) the rate-limit
  degrade-to-open wrapper; (5) a packaged D1 audit sink with an `audit_log` migration. The
  legacy-redirect helper was considered and held site-side (Geoff's call). Geoff runs the
  engine update from the brief.
- **NEXT (this repo, once the engine update lands)**: the adoption/simplification pass. Bump
  `@glw907/cairn-cms`, regenerate visual baselines via the `ci.yml` `update_snapshots`
  dispatch (the 0.92.0 ratchet changes admin rendering by design), and put the before/after on
  Geoff's queue; then retrofit each landed seam by deleting the site copy: member-auth and
  offers crypto onto the exported primitives, `club-action.ts`/`portal-action.ts` onto the
  wrapper seam, `turnstile.ts`, `rate-limit.ts`, and `audit-sink.ts` onto the packaged sink.
  Candidate rider: Announce list recency via `publishedAt` — the picker sorts by frontmatter
  `date` (`announce/+page.server.ts:26`), so a backdated post can vanish from the list an
  editor announces from. RESUME PROMPT: "Run the ASC cairn adoption pass: check the published
  cairn version and which seams from cairn-cms docs/internal/2026-08-01-asc-consumer-brief.md
  landed, bump the dependency, regenerate baselines via the ci.yml dispatch, and retrofit each
  landed seam by deleting the site copy." Launch from ~/Projects/aksailingclub-org.

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
