# Email + Announce pass: harvest findings

Recorded at pass close (2026-08-26, overnight run). The pass's ledger entry is
`docs/HISTORY.md` (2026-08-26); the settle entry is `docs/design-benchmark/decisions.md`.
Engine-level items follow the workstation "Engine-level UI mechanics" rule: a mechanic
belongs to cairn, a design choice belongs to this site.

## Engine-level findings (file with cairn)

1. **cairn's CSRF guard rejects `Origin: null` under `Referrer-Policy: no-referrer`.**
   Found while building Task 11's portal round-trip e2e, confirmed by curl repro and by
   reading the guard source. This site sends a blanket `Referrer-Policy: no-referrer`
   (`src/hooks.server.ts`); per the Fetch spec that makes a plain same-origin top-level
   POST navigation carry `Origin: null`, which cairn's non-admin CSRF guard (guard.js
   Rule 2, restoring the strict check `csrf.checkOrigin: false` disables) rejects with a
   403. Every plain non-`use:enhance` POST form outside `/admin` is affected: roughly
   thirty member-portal forms (committees, household, storage, confirm, finish-joining,
   sign-out). Invisible to tests because nothing exercises a full HTTP POST through a
   plain portal form. The pass fixed only its own new Notifications form (switched to
   `use:enhance` + `update({ reset: false })`, the contract's second sanctioned idiom);
   the site-wide remedy is a deliberate follow-up: either per-form `use:enhance`
   everywhere or loosening the blanket header, and the header path is known to break
   `e2e/preview-route.spec.ts` by silently overriding per-route Referrer-Policy values.
   **Flagged pre-cutover in STATUS.** The engine question for cairn: should the guard
   treat `Origin: null` + a same-site `Sec-Fetch-Site` as acceptable, or should cairn
   document that consuming sites must not ship `no-referrer` globally?

   The pass-end security review escalated the blast radius with live evidence: **member
   sign-in (`/my-account?/requestLink`) and magic-link confirm 403 in a real browser on
   dev today**, confirmed by curl (`Origin: null` → 403, real origin → 200) and by a
   Chromium form submission. Every plain unenhanced form on the public/member side is
   affected, including `/classes/offer/[token]`'s claim/decline, which has no
   double-submit token, so the origin check is its only CSRF layer and must not be
   loosened. The reviewer's prescribed remedy: serve `strict-origin-when-cross-origin`
   (or `same-origin`) as the site default, which nulls `Origin` only on an https-to-http
   downgrade, and keep `no-referrer` scoped to the token-bearing `/classes/offer/**`
   responses the header exists for, taking care the hook does not clobber a route's own
   more specific header. Per-form `use:enhance` conversion also works but leaves the
   trap armed for the next plain form.
2. **A warning button register is missing.** Task 8's template editor carried a dead
   `btn-warning` on its Reset confirm. This site has a settled `.btn-error`
   destructive-confirm tier (`asc-components.css:795`) and no warning tier;
   `decisions.md` carries no button-register entry. The Reset button keeps plain `btn`
   chrome for now. Whether a warning tier belongs in the family's admin register is a
   cairn-level question, not a site invention.
3. **`cairn-audit`'s `no-uncompiled-class` rule cannot see site-authored stylesheets.**
   Task 7 hit the gap: the chip-register marker classes live in this site's own
   `$theme/admin-chip-registers.css`, which the rule does not read (it checks only the
   packaged `cairn-admin.css`), so a class that is genuinely compiled site-side still
   needs case-by-case exemption reasoning. The rule wants a way to register site
   stylesheets as additional compiled sources (`cairn-audit.config.json` has
   `static.paletteFiles` but nothing for compiled-class sources). Concrete cost at this
   pass's close: six `no-uncompiled-class` errors on the email index (4) and announce
   list (2), every one a chip marker span the plan itself mandates and
   `verify-chip-registers` proves compiled (26/26 measurements). Ruled known-false-
   positive at close rather than evaded by switching to variable class bindings, which
   is why the compose and template screens show zero: their chip classes bind through a
   map variable the static scanner cannot see, the same reason assets shows only one.
4. **No compiled success/warning text tint exists for `/admin/**` routes.** Task 7
   replaced two dead `text-success` banners with `text-muted` (the `events` idiom) and
   rendered the over-headroom warning in plain `font-medium` because `text-warning` is
   also uncompiled. Admin screens have no non-error status tint vocabulary at all;
   engine-level candidate for the admin sheet.
5. **StatusChip register consolidation: the third consumer landed.** The chip recipes
   (`asc-admin-chip-quiet`/`-warning`/`-outline` marker spans over `StatusChip`) now
   ride three screens beyond assets: the email index's sent/failed chips, the announce
   list's announced/not-yet pair, and Compose's failed-count badge. The recipe survived
   unmodified (`scripts/verify-chip-registers.mjs` green throughout, 26 measurements).
   This is the evidence the assets-pass harvest asked for: the register is stable across
   consumers and ready for cairn's StatusChip to absorb (which also retires the
   household desk's still-hand-rolled asset chip, assets harvest finding 1).

## Site-side findings and deferred debt

6. **The default-recipient CTE carries an email predicate inside the audience query.**
   `segments.ts`'s `default_recipient` CTE ranks by "non-archived with an email", which
   ruling 2's own definition forces (the default recipient must be reachable), but it
   means the SMS pass inherits an email-determined default recipient rather than a
   channel-neutral one. The audience/projection split is otherwise channel-clean; the
   SMS pass must decide whether the default recipient generalizes to "reachable on any
   enabled channel".
7. **`getEmailQuotaHeadroom` trusts a partial body.** If `result.usage.sent` is absent
   while `quota.value` is present, `sentToday` defaults to 0 and the screen advertises
   full headroom instead of "unknown". Harmless for the live measured shape; tighten if
   Cloudflare's response ever varies.
8. **The headroom token's scope branch.** The Worker secret is named
   `CLOUDFLARE_EMAIL_SENDING_TOKEN` (with `CLOUDFLARE_ACCOUNT_ID` as a `[vars]` copy of
   wrangler.toml's deploy field). Not minted; headroom renders "unknown", a supported
   state. When Geoff mints it (dashboard chore, read-only Email Sending scope, never a
   send-capable credential), it installs via the ASC per-project secret store plus
   `wrangler secret put CLOUDFLARE_EMAIL_SENDING_TOKEN` with no code change.
9. **The Compose variable palette was judged at the pass-close coherence read, not
   probed.** Task 7's dispatch left the call open and the implementer made no explicit
   judgment; the fresh-context coherence read graded it in place. Verdict recorded in
   `decisions.md`'s settle entry.
10. **Email index polish debt (deferred deliberately, non-blocking review findings):**
    zebra striping uses `:nth-child(even)` over all rows, so an incident block shifts
    stripe parity for the ordinary rows after it; an incident whose rows all carry a
    null `template_id` renders a dangling separator after the empty template list; the
    in-incident pager is hand-rolled rather than toolkit `Pagination` and renders
    disabled Prev/Next even for a single-page incident; the pager's `td` zeroes daisyUI
    cell padding onto its inner div while the sibling incident row keeps cell padding
    (two idioms where one would do).
11. **Test-isolation debt in `e2e/portal-notifications.spec.ts`.** The round-trip test
    mutates `portal-mem-primary.club_email_opt_in` and relies on its own second half to
    restore it; a mid-test failure leaves the row at 1, which the sibling visual spec
    asserts is 0. Safe under `workers: 1` and current file order; wants a fixture reset.
12. **Whether the Communication roles should get an opt-in setter.** The opt-in writers
    are the member's own portal toggle and the household desk (Administrator/Club
    manager key). Members of the Communication committee cannot set the flag without
    the club key. Carried as an open product question, Geoff's call.
13. **Cutover items routed here by the contract:** the `ORIGIN` hardcode in mailed post
    URLs, and the missing `reply_to` threading on outbound club email. Both belong to
    the apex-cutover checklist, not this pass.
14. **Historic `email_blasts.segment_label` snapshots keep their stored text.** Pre-pass
    rows read "Current members" while new sends read "Current households"; labels are
    point-in-time snapshots by design (recorded inline at
    `src/tests/compose-actions.test.ts:93-95`).

## Coherence read findings (2026-08-26 close)

35. **Engine candidate: cairn-admin.css carries no list reset**, so any `<ul>` an
    admin screen composes keeps the browser's 40px `padding-inline-start` and its
    bullets. Bit this pass three times from one root cause (the variable palette's
    indent on two screens, the review step's stray bullet); fixed site-side at close,
    but the reset belongs in the engine sheet. Repeated-workaround flag raised by the
    coherence read itself.
36. **Engine candidate: the admin `.select`'s fixed width defeats intended inline
    filter rows** (a flex-wrap row of two selects computed to one select's width and
    stacked at 1440). Fixed site-side at close; the engine question is whether the
    admin select should be intrinsically sized or ship a documented inline-filter
    idiom.
37. **Held for Geoff, from the coherence read**: the announce list's emphasis
    inversion (fourteen outlined "Not announced" pills make the default state loud
    while the one "Announced" row carries the quietest chip; the chip pair is
    probe-ratified, so the verdict stands unless Geoff reopens it); the headroom
    fact's two homes (a bordered banner on compose review, a bare helper line on the
    announce form); and whether the announce send should gate behind a
    count-acknowledging confirm the way Compose does.
38. **Small polish, deferred**: the template editor's byline renders a raw actor key
    ("by authored:job-runner"); subjects containing a literal `--` break mid-token at
    390; the subtitle-plus-count-line double count is a family idiom worth one ruling
    (both the email index and announce list show it).

## Workstation finding (2026-08-26 close)

39. **CORRECTED at close: the `wrangler dev` esbuild failure was a branch regression,
    not a workstation quirk.** Close round item 28's `itemNoun` re-export put
    `@glw907/cairn-cms/admin-toolkit` into `ui.ts`; Vite's SSR build left the package
    import external in a server chunk, and wrangler's own esbuild pass then failed on
    the barrel's twelve `.svelte` files ("No loader is configured") — while the dev
    server's port stayed open serving nothing. That silent-port failure mode hung
    CI's e2e jobs for hours (every `page.goto` aborts, every test times out, retries
    multiply). Fixed at close (close-C: the pluralization implemented locally in
    `ui.ts`, no toolkit import in the server graph). Two durable lessons: **the repo
    gate cannot see a wrangler-bundle break** — `check`, `test`, and `npm run build`
    all stay green because none runs wrangler's bundler; a `wrangler deploy
    --dry-run` (or a one-request `wrangler dev` smoke) belongs in CI ahead of the
    e2e job, and the e2e webServer wants a failure signature that closes the port
    instead of hanging it. And the engine half of item 30 stands sharpened: the
    admin-toolkit barrel is radioactive to any server-graph import, so a pure-utils
    subpath export is the real fix.

## A11y review findings (2026-08-26 close), engine-level and deferred

31. **DaisyUI's unchecked `.checkbox` edge is near-invisible on both themes**
    (measured 1.50:1 light / 1.75:1 dark against the 3:1 WCAG 1.4.11 floor): the
    faint-control-edge family agent memory already carries for `.btn`. Fixed site-side
    at this pass's close (explicit `--input-color`, canvas-readback verified) on the
    portal Notifications box and the two announce-form checkboxes; the mechanic
    belongs in cairn's admin sheet so every site's checkboxes clear the floor.
32. **The switcher `aria-label`-on-role-less-`div` defect is inherited from
    `assets/+page.svelte:333`** (fixed on the email index at close with
    `role="group"`; the assets copy and the engine question of a labeled-group
    switcher idiom go to cairn).
33. **The `computeCountLine` `role="status"` idiom reads as page-load noise on a
    static list**: the announce list has no filters, so its count never changes
    client-side and the live region announces nothing useful. The plan mandated the
    events idiom there; kept as shipped for consistency, but the idiom wants a
    static variant (plain text) for filterless lists. Engine/idiom question.
34. **Deferred a11y polish, one later ticket**: the announce form's unguarded send
    (Compose gates the same action behind a count-acknowledging dialog; adding a
    confirm is a UX change Geoff should rule on); the disabled-option-as-bound-value
    edge on the channel select; conditional mounting of the status regions (absent at
    load, announcing only on later mutations).

## Svelte review findings (2026-08-26 close)

25. **Engine gap: `ExpandableRow` cannot model a `colspan` summary row.** The email
    index's incident row hand-rolls expand/collapse because the toolkit's
    `ExpandableRow` (graduated out of this repo) models a sticky trigger cell plus a
    panel, not a full-width `colspan` summary whose expansion is sibling `<tr>`s. The
    hand-roll also carries `aria-expanded` with no `aria-controls` target, a contract
    the engine widget would supply. File with cairn.
26. **`{#key data.post.id}` does not re-run instance-script seeds**, on the announce
    form, the template editor, and the classes desk alike: the seeds live outside the
    key block, so an in-route sideways navigation would render stale drafts, and the
    comment claiming otherwise is wrong. Practically unreachable today (no sideways
    links), but the load-bearing comment should be corrected when next touched; the
    real fix is a layout-level key or derived-plus-dirty-flag seeding.
27. **Portal Notifications polish, deferred together with the head-of-household
    toggle ruling (finding 15)**: the checkbox never re-syncs from server state on a
    failed save (one-way `checked` plus `reset: false`), its only feedback is the
    page-top banner rendered off-screen for this mid-page section, and the e2e
    assertion that claims to test the re-render is vacuous (it asserts the state the
    test itself set). All three move together when Geoff rules on the toggle's
    semantics.
28. **Email index polish (adds to item 10)**: the one-frame empty-table flash on
    filter change (reset rides an `$effect` after render; a derived clamp fixes it);
    the two denominators on one screen (the count line's send attempts vs the pager's
    display units; naming them "sends"/"groups" would disambiguate); `aria-label` on
    the role-less switcher `<div>` (wants `role="group"`); the over-quota
    `role="alert"` inside a closed `<dialog>` announces unreliably and is redundant
    once `showModal()` moves focus.
29. **The `publishedAt` seam is inert and unpinned**: zero of the 31 live posts carry
    `publishedAt` yet, and the ordering test supplies its own stamp map, so a glob
    that silently resolved empty would leave a green suite and a dead feature. A
    one-line assertion that `postPublishedAt` builds non-trivially from the real
    manifest pins it.
30. **`itemNoun` imported from the admin-toolkit entrypoint inside two
    `+page.server.ts` files** (announce, compose) solely for audit-string plurals,
    coupling server bundles to a UI package whose index re-exports ten `.svelte`
    components; re-export from `$admin-club/lib/ui` or inline the ternary.

## Security review findings (2026-08-26 close), deferred with reasons

15. **The Notifications toggle is a false control for a household's default recipient**
    (`profile/+page.svelte:117-122` against `segments.ts:212`): the default recipient
    receives every membership-wide send regardless of the flag, so the head of
    household sees an unchecked box whose state changes nothing about their own reach,
    and no unsubscribe path exists for them. This follows from contract ruling 2, so
    the remedy is a member-facing product fork held for Geoff: render checked-and-
    disabled with honest copy ("you receive club email as this household's default
    recipient"), or let the default recipient's opt-out demote the household to the
    next eligible member.
16. **`?/send` accepts `household:<id>` though the picker never offers it**
    (`compose/+page.server.ts:206`, `segments.ts:404`), letting any Communication-
    access editor mail a full household outside the opt-in model. Bounded (they can
    already mail all current households) and partly by design: the Members panel's
    Email-household preset legitimately seeds compose with exactly that key, so a
    validation fix must allowlist that flow rather than checking against
    `listSegmentOptions` alone.
17. **`setEmailOptIn` (household desk) neither scopes `memberId` to the route's
    household nor checks the row exists** (`members/[id]/+page.server.ts:191-205`): a
    forged hidden field flips any member, and a bogus id still writes an audit row
    claiming a change. Inherited verbatim from `setArchived`/`setVisibility`/
    `updateMember` beside it; fixing the pattern is one sweep across all four, its own
    small task.
18. **Headroom fetch notes:** the 3s `AbortSignal.timeout` is awaited inline on both
    the compose and announce loads (a hung Cloudflare API adds up to 3s to page load;
    on announce it fires even for a bogus post id); `redirect: 'manual'` is a free
    hardening pin; `CLOUDFLARE_ACCOUNT_ID` is committed plaintext in `wrangler.toml`
    while `deploy.yml` treats the same value as a GitHub secret — account ids are not
    secrets, but the two treatments should agree.
19. **The 2000-row send-log read widens member-address exposure for Publisher/
    Webmaster** (access map admits them to `/admin/club/email`): ~750 addresses now
    ship in one page payload where the prior cap was 100. A logged design decision
    (contract ruling 5); noted for the access-model review the roles question (item 12)
    already implies.

## Workers review findings (2026-08-26 close), deferred with reasons

20. **`email_log(segment)` has no index and three member-facing cooldown reads
    full-scan on it** (`waiver-notify.ts:44,63`, `committees.ts:293`), while this pass
    made `email_log` a documented growing table. The cheap fix is a `0040` migration
    adding `idx_email_log_segment` (or `(segment, sent_at)`). First candidate for the
    next pass touching this schema; not added at close because a new migration means
    bootstrap-probe wiring outside the plan's scope.
21. **The send-log payload grows monotonically** (~150 KB serialized today, ~330 KB at
    the 2000 cap, `error_detail` written unbounded from `err.message`): headroom moves
    are deferring `error_detail` to incident expansion, a `.slice(0, 500)` cap at the
    write site, and eventually a retention policy. Related: **the count line silently
    misreports at the cap** ("2000 log entries" with no truncation cue) and an incident
    spanning the truncation boundary splits silently; pass `truncated: boolean` from
    the load when `log.length === EMAIL_LOG_GUARD_LIMIT`.
22. **The membership audience ignores `households.left_at`**: `leaveClub` stamps it,
    but `classifyHouseholdStanding` never reads it, so a household that left keeps
    receiving club email until its paid year lapses. Latent today (0 live rows with
    `left_at`), reachable for the first time via this pass's audience model. Wants a
    ruling: one `AND h.left_at IS NULL` predicate, best placed in the classifier so
    every consumer inherits it.
23. **Headroom fetch shape**: runs serially before the D1 work on both loads (move
    into the existing `Promise.all`), no cache (a module-scope ~60s TTL memo is safe
    for an account-global figure), and the bare `catch` swallows a misconfigured token
    forever (one `console.warn` with status only would surface it in Workers Logs).
    Verified at close: the secret is unminted, so dev renders "headroom unknown" —
    the documented degrade, but reviewers on dev see the inert state.
24. **Smaller performance notes, one ticket's worth**: `announce/[id]` resolves the
    entire current-member audience to render one count; `resolveClassSegment` is an
    N+1 over the roster (same family as the deferred review-inbox N+1 carry-forward);
    the `audience_member` CTE re-expands as a co-routine (a `MATERIALIZED` keyword if
    it ever matters); two primary-key `.first()` reads lack the `LIMIT 1` their
    siblings carry; `columnExists` wants a literal-only-contract comment. Also: any
    future touch of the CSRF config should migrate the deprecated
    `csrf.checkOrigin` to `csrf.trustedOrigins` (Vitest already warns).
