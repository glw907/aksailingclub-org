# Assets substrate plan

The first of the two plans the Assets functional design splits into
(`docs/2026-07-29-assets-functional-design.md`, section "Plan 1: Assets substrate"). It repairs
and completes behavior that already exists. The trial pass
(`docs/plans/2026-07-29-cairn-design-trial-assets.md`) builds the new admin surface, and that
protocol doc stands unamended.

**The boundary rule, binding on every task here: this plan adds no new admin screen and no new
admin control.** Task 4 is the one member-facing UI change, and it is a step inside an existing
route. Anything screen-shaped belongs to plan 2. This plan also carries no design content: the
trial's control conditions make cairn's packaged capture the only sanctioned carrier of design
guidance to a builder, so a dispatch from this file describes outcomes and never visual
treatment.

The evidence base is `docs/2026-07-29-assets-functional-input.md`, whose claims all carry
`file:line` or a live query. Citations below point into the source directly.

## Execution order and dependencies

1. **Task 1 blocks Task 2.** Task 2 makes an unknown asset-type id throw at read time. Landing
   it while the live database still holds underscore ids would break the member portal for the
   21 affected households. Task 2 starts only after Task 1's forward migration is applied to
   live `asc-club` and its verify step reports zero mismatches.
2. **Task 1 is itself blocked on Geoff.** See its blocking input below.
3. **Task 5a blocks Task 5b.** 5b wires the helper 5a builds.
4. Tasks 3, 4, the 5a/5b pair, and 6 are independent of each other and of the Task 1/2 pair.
   They touch different files and may run in any order.

## Task 1: the schema-repair migration

### Blocking input

**This task does not start until Geoff supplies the four confirmed capacities** for `mooring`,
`rv-parking`, `boat-parking`, and `small-boat-rack`. The design spec's ruling 1 records that the
imported capacity values were authored examples rather than club data, and that `rv_parking`'s
`5` was invented. `rv-parking` is expected to be 10, pending confirmation. The migration never
ships with the invented values, and an implementer who reaches this task without the four
numbers stops and reports the missing input rather than guessing.

### Outcomes

One new migration directory, `migrations/asc-club/0034_asset_type_ids/`, holding `forward.sql`,
`rollback.sql`, `verify.sql`, and `README.md`, following the shape of
`migrations/asc-club/0033_member_standing/`. The migration makes three corrections in one
transaction-shaped forward step:

- **Id rename.** `rv_parking` becomes `rv-parking`, `boat_parking` becomes `boat-parking`, and
  `small_boat` becomes `small-boat-rack`. `mooring` is already correct and is left alone. The
  target vocabulary is `DocumentAudience` in `src/theme/documents.ts:26-33` and the frontmatter
  of the six published 2026 documents under `src/content/documents/`.
- **Capacity correction.** `asset_types.capacity` is set to Geoff's four confirmed numbers.
- **Payment-method backfill.** The 4 `asset_payments` rows whose `method` is NULL despite
  carrying a `stripe_ref` are set to `method='card'`. This is the adjacency rider the design
  gate approved, sourced from the import script's insert never populating the column
  (`scripts/import/ops-assets.mjs:640`).

### Constraints

- **Enumerate the referencing columns from the live schema before writing any SQL.** Do not
  trust this plan's list. Read the real table definitions first:

  ```
  npx wrangler d1 execute asc-club --remote --command "SELECT name, sql FROM sqlite_master WHERE type='table';"
  ```

  The known carriers of an `asset_type` value are `asset_assignments`, `asset_waitlist`, and
  `asset_requests`. Whether `asset_payments` references the type directly or only through its
  assignment is an open question the schema read settles. Any column the read turns up that
  this plan does not name is still in scope for the rename.
- The enumeration also settles whether foreign keys are declared on those columns and, if they
  are, what update ordering or deferral the rename needs. Prove the chosen technique on the
  scratch replica, not on live.
- **Verified-migration pattern, scratch-proven first.** Follow the procedure recorded in
  `migrations/asc-club/0033_member_standing/README.md` under "Scratch-proof procedure": a fresh
  `--persist-to` directory distinct from the repo's `.wrangler/` state, migrations `0001`
  through `0034` applied in order with `--local`, then forward, verify, rollback,
  verify-rollback, and forward again.
- **Seed the scratch replica to the live condition before the forward step, or the proof proves
  nothing.** No migration populates `asset_types`; `migrations/asc-club/0007_assets_email/forward.sql:29`
  only creates the table, and its own comment already names the hyphenated vocabulary. A replica
  built from `0001` through `0034` therefore has an empty `asset_types` and nothing to rename.
  Seed the four live rows in their current underscore form with their current capacities and
  fees, then seed synthetic rows in each referencing column the schema read turned up, so both
  the rename and its referential fan-out have something to move.
- `rollback.sql` restores the underscore ids and the prior capacity values, and returns the 4
  backfilled `method` values to NULL. Record in the README that rollback is safe only before
  any post-migration write depends on the hyphenated ids.
- No change to `EVENTS_DB`. This migration targets `asc-club` only.
- Do not modify `scripts/import/ops-assets.mjs`. The import is a one-time script that has
  already run; Task 2's parse function is what makes a hypothetical re-run fail loudly rather
  than silently reintroducing the underscore form.

### Acceptance criteria

- The scratch run completes all six steps with no error, and the README records the actual
  output of each.
- `verify.sql` on the scratch replica returns zero rows for any `asset_types.id` matching an
  underscore form, and zero rows for any referencing column still holding one.
- `forward.sql` applied to live `asc-club` with `--remote` completes without error.
- The verify step closes by running the waiver-requirements derivation against live data.
  **Success criterion: the count of households holding a mismatched-type asset with a missing
  document requirement goes from 21 to 0.** The derivation lives at
  `src/member-portal/lib/waiver-requirements.ts:182-195,234-240`; the 21-household figure and
  the live `settings.current_season` of `2026` come from the packet's own live queries.
- Live `asset_types.capacity` matches the four confirmed numbers, confirmed by a `--remote`
  select in the task report.
- Live `SELECT COUNT(*) FROM asset_payments WHERE method IS NULL AND stripe_ref IS NOT NULL`
  returns 0.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.

**Deliverables: 4.** The migration directory carrying all three corrections, the six-step
scratch-proof record in its README, the live `--remote` apply, and the live waiver-derivation
verification that closes it. The payment-method backfill rides on this migration rather than
taking a task of its own: it is a one-line `UPDATE` against a table the migration already
touches, and the design gate approved it as an adjacency rider. If the schema read shows the
rename needs more than a straightforward id update, report that before writing SQL rather than
letting the rider inflate the task.

## Task 2: cast validation

### Outcomes

A runtime list of the four kinds and an exported parse function, both beside the `AssetKind`
type in `src/member-portal/lib/waiver-requirements.ts:32`. The parser takes a raw
`asset_types.id` string and returns an `AssetKind`, throwing on any value outside the
vocabulary. Every bare `as AssetKind` cast in the codebase calls it instead. The four known cast
sites:

- `src/member-portal/lib/waiver-requirements.ts:346`
- `src/admin-club/lib/documents-store.ts:209`
- `src/routes/(site)/my-account/+page.server.ts:241`
- `src/routes/(site)/my-account/sign/+page.server.ts:122`

Grep for `as AssetKind` across `src/` before finishing and convert any site this list misses.

### Constraints

- Task 1's forward migration must already be applied to live `asc-club`. Confirm that before
  starting.
- The throw carries the offending value in its message, so a future drift names itself in the
  logs.
- **The runtime list needs a real runtime value, kept honest by the compiler.** `AssetKind` is a
  type-level derivation (`Exclude<DocumentAudience, ...>` at `waiver-requirements.ts:32`) and
  `DocumentAudience` is a pure union (`src/theme/documents.ts:26-33`) with no runtime
  counterpart, so no expression can produce the four strings from the type. Declare a
  `readonly AssetKind[]` beside the type in `waiver-requirements.ts`, holding the four strings
  literally, and add a compile-time exhaustiveness assertion tying it back to `AssetKind` so
  adding or removing a kind fails `npm run check` rather than silently drifting. The existing
  `DRY_STORAGE_KINDS` at `waiver-requirements.ts:36` is the local precedent for a runtime set
  typed against `AssetKind`; this one differs in owing the exhaustiveness guarantee.
- The parse function is the only runtime enumeration of the **asset-kind** vocabulary.
  `src/theme/cairn.config.ts:319` separately enumerates all seven `DocumentAudience` values as
  the admin's audience picker options; that is the audience vocabulary, not the asset-kind
  subset, and it stays where it is. Do not add a third list.
- **Type-predicate form, so the cast disappears rather than moving.** The parser narrows through
  a `value is AssetKind` predicate over the runtime list. A parser that internally writes
  `value as AssetKind` relocates the unchecked cast instead of removing it and fails this
  task's own grep criterion.
- Behavior on valid input is unchanged. This task adds no branching to the callers beyond the
  call itself.

### Acceptance criteria

- A new unit test in `src/tests/member-portal-waiver-requirements.test.ts` feeds the parser a
  real underscore-form id (`rv_parking`) and asserts it throws. This is the test the current
  suite lacks: existing coverage feeds the pure derivation synthetic, already-hyphenated
  `assetKinds` arrays and so never exercises the database-to-`AssetKind` cast
  (`src/tests/member-portal-waiver-requirements.test.ts:110-115,135,233-268`).
- A companion test asserts each of the four valid ids parses to itself.
- `grep -rn "as AssetKind" src/` returns no hits, the parser's own body included.
- Removing a kind from the runtime list, or adding a string the type does not carry, fails
  `npm run check`. Prove it once by hand and report the error; do not leave the probe committed.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.

**Deliverables: 3.** The runtime list plus its parse function, the four converted call sites,
the two tests.

## Task 3: lens consolidation

### Outcomes

One shared active-holdings query in `src/admin-club/lib/assets-store.ts`, with all three
consumers reading from it:

- The Assets screen's `listActiveAssignments` (`src/admin-club/lib/assets-store.ts:110`),
  consumed at `src/routes/admin/club/assets/+page.server.ts:8-32`.
- The Members-list holding-chip query, the `HOLDINGS_SQL` constant used at
  `src/admin-club/lib/households-store.ts:265` to fill `HouseholdHoldingChip`
  (`households-store.ts:63`).
- The household desk's Assets panel source (`src/admin-club/lib/households-store.ts:385-397`
  and the query around `households-store.ts:460-478`), rendered read-only at
  `src/routes/admin/club/members/[id]/+page.svelte:383-403`.

### Constraints

- Behavior-preserving refactor. No screen changes what it renders.
- The desk panel deliberately shows released assignments alongside active ones, unlike the
  other two lenses. The shared source therefore takes a status scope so the desk keeps its
  released rows. Do not narrow the desk to active-only.
- Payment standing stays derived at read time into `not-billed` / `outstanding` / `paid`
  (`src/admin-club/lib/assets-store.ts:24-29,140-153`). No stored flag is introduced.
- The Members list's `holdings: 'all' | 'holding'` filter facet
  (`src/admin-club/lib/households-store.ts:125,289,303`) keeps working unchanged.
- The consolidated query keeps the current set-based shape. Do not introduce a per-household
  query loop; the module comment at `households-store.ts:23-26` records why.
- `assets-store.ts` is the home for the shared lens. `households-store.ts` imports from it, not
  the reverse.

### Acceptance criteria

- A new test asserts the three consumers agree on one seeded fixture: a household holding an
  active assignment appears with the same asset type, description, and payment standing through
  all three paths. Place it in `src/tests/assets-store.test.ts` or a sibling, using the existing
  `src/tests/_fake-d1` harness.
- All existing tests in `src/tests/assets-store.test.ts`, `src/tests/assets-actions.test.ts`,
  and the households-store suites pass unchanged.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.
- The admin screens render identically. If any committed e2e baseline moves, that is a signal
  the refactor changed behavior; investigate rather than regenerating.

**Deliverables: 3.** The shared query, the three repointed consumers, the agreement test.

## Task 4: retention creation in the renewal flow

### Outcomes

`/my-account/renew` gains the retention step the 2026-07-07 spec designed and no code ever
built. When the renewing household holds one or more active assignments, the flow lists each
held asset and asks whether the household is re-requesting it for the coming season. A yes
creates an `asset_requests` row with `kind: 'retention'`. A no creates nothing.

Files: `src/routes/(site)/my-account/renew/+page.server.ts` and its `+page.svelte`.

### Constraints

- Read the household's active assignments through the existing
  `listHouseholdAssignments` in `src/member-portal/lib/assets.ts:60`. Do not write a new query.
- Create requests through the existing `createAssetRequest`
  (`src/member-portal/lib/assets.ts:156`) with `kind: 'retention'`. The admin inbox's
  `approveRetentionRequest` branch (`src/member-portal/lib/assets.ts:345`) needs no change.
- A "no" creates nothing. Releasing an asset stays a separate, deliberate action on
  `/my-account/gear` (`src/routes/(site)/my-account/gear/+page.server.ts:50-56`). Do not add a
  release path here.
- Submitting the step twice must not produce two pending retention requests for the same
  household and asset type. Guard on the existing pending row before inserting.
- The action goes through `portalAction` (`$member-portal/lib/portal-action`), matching every
  other member-facing write in this route family, so CSRF and household scoping are unchanged.
- The renewal route's signing gate stays in force. `SIGN_REDIRECT`
  (`src/routes/(site)/my-account/renew/+page.server.ts:31`) redirects a household with
  outstanding signatures at both `load` and the `?/renew` action, and the retention step never
  offers a way around it.
- Follow the existing portal patterns in this route and its siblings. This task carries no
  design content and introduces no new component.
- A household with no active assignments sees no step at all.

### Acceptance criteria

- **Action-level assertions go in `src/tests/my-account-renew-actions.test.ts`**, this route's
  own action suite, which already covers the `SIGN_REDIRECT` gate the retention step must not
  weaken. A test asserts that a yes on a held asset creates exactly one `asset_requests` row
  with `kind: 'retention'`, the household's own id, and `status: 'pending'`. A second asserts a
  no creates nothing and a repeat submission creates no duplicate. A third asserts a household
  with zero active assignments gets no step and no rows. A fourth asserts the sign gate still
  redirects at both `load` and the action after the step exists.
- Any assertion about `createAssetRequest`'s own behavior, rather than this route's wiring,
  belongs in the existing member-portal asset suite (`src/tests/member-portal-assets.test.ts`).
- **Before/after gate, captured through the portal e2e session fixture.** `/my-account/renew`
  sits behind cairn's magic-link member auth, and the `claude-capture-asc-ref` Access service
  token clears Cloudflare Access only, never that portal session
  (`e2e/join-and-class-door.spec.ts:27` records exactly this limit). The established mechanism
  is the seeded session used for `e2e/portal-session.spec.ts` and `e2e/portal-visual.spec.ts`:
  `mintMemberSession` against `e2e/fixtures/portal-seed.sql`, whose Wright household already
  holds active asset assignments and already carries season-2026 signature rows, so it clears
  the `SIGN_REDIRECT` gate at `+page.server.ts:70` and reaches the step. Capture the after state
  this way at 390 and 1440 in both themes.
- **The before capture is taken first, before the change exists.** Render the same route through
  the same fixture on the pre-change build and keep those frames; once the step ships, the
  before state is unrecoverable. Take the matching dev frames from `dev.aksailingclub.org`
  before deploying, for the same reason.
- Deploy to dev after the change lands, and report what dev actually renders. Real dev data may
  hold no assignments at all, in which case dev correctly shows no step; that is a data
  observation, not the before/after evidence. The fixture frames are the evidence Geoff reads.
- The task is not done until the pairs exist and are handed over.
- **The retention step gains a `portal-visual` case.** Add `/my-account/renew` with a seeded
  active assignment to `e2e/portal-visual.spec.ts`, following that file's existing loop idiom.
  It has no entry today, so a member-facing surface would otherwise ship with zero pixel-diff
  coverage. **Its first baselines are minted only by the CI dispatch**,
  `gh workflow run ci.yml -f update_snapshots=true`. Playwright mints missing snapshots on the
  first local run with no flag, so running the new case locally creates workstation baselines
  that break CI the moment they are committed. Expect the local run to fail on missing
  snapshots; that is the correct state.
- If any existing committed baseline changes, regenerate it the same way and never with a local
  `--update-snapshots`.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.

**Deliverables: 5.** The load extension, the template step, the create action, the unit tests,
the `portal-visual` case. The before/after gate is an acceptance criterion on the whole, not a
sixth deliverable.

## Task 5a: the decision-email helper

### Outcomes

A `sendAssetDecisionEmail` helper in `src/member-portal/lib/`, a sibling module to
`waiver-notify.ts` and following its shape, carrying the request-lifecycle messages as five
distinct kinds. It has no caller when this task lands; Task 5b wires it.

The spec's ruling 5 names the moments a member cannot otherwise discover: approved and
assigned, approved and queued to the waitlist, denied with the recorded reason, retention
approved, and slot opened. **Ruling 5's own enumeration makes retention a fifth distinct kind,
superseding the "four message kinds" phrasing in the spec's own Plan 1 Task 5 paragraph**, which
folds retention in as an afterthought. Build all five rather than overloading one: the retention
message says something different from the new-request approval, because
`approved_awaiting_payment` is a state the member must act on.

**The slot-opened kind is built and tested here and wired by nobody.** The trial pass's
promotion task is its only caller. Leaving it unwired is deliberate; do not find a caller for
it.

### Constraints

- Send through `sendClubEmail`'s `raw` path (`src/admin-club/lib/club-email.ts:235`), following
  the precedent in `src/member-portal/lib/waiver-notify.ts` where a lib module owns its own
  notification send rather than leaving it to the route.
- Resolve the recipient the way `waiver-notify.ts` does. A request carries `requested_by`; the
  household's managing adult is the fallback when the requester cannot be resolved.
- Tag each send with an `email_log.segment` unique to the request and the decision, matching the
  segment idiom at `waiver-notify.ts:41,55`. The segment is for traceability, never a guard: the
  helper deduplicates nothing.
- A failed or unbound send never throws. `sendClubEmail` already degrades this way when `EMAIL`
  is unbound, and the helper passes that `{ ok: false }` through rather than raising.
- The slot-opened message links to `/my-account/gear`. That route is out of scope and is linked
  as it stands.
- Email copy is member-facing text and takes the content standards. This repo has no
  `docs/content-guide.md`, so the standard is the `content-draft` skill's shared method plus the
  copy already shipping in `src/member-portal/lib/waiver-notify.ts`, which is the nearest
  same-audience precedent. Keep each message to what the member must know and do.

### Acceptance criteria

- A unit test per kind asserts the rendered body carries what that moment obliges: the assigned
  kind names the asset, the queued kind says the household is on the waitlist, the retention
  kind names the payment the member must now act on, the denied kind carries the recorded
  reason verbatim, and the slot-opened kind carries a `/my-account/gear` link. Place them in
  their own suite beside `src/tests/waiver-notify.test.ts`, which is the precedent for testing a
  notification module with no route in the picture.
- A unit test asserts an unbound `EMAIL` binding returns `{ ok: false }` and throws nothing.
- The slot-opened kind is tested by a direct call, never through a lifecycle function, since it
  has no caller in this pass.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.

**Deliverables: 3.** The helper with its five kinds, the five message copies drafted to the
member-facing content standards, the tests.

## Task 5b: wiring the decision emails

### Outcomes

Task 5a's helper called from every existing decision path, and the deny dialog's copy corrected
to match. Four decision sends across the three existing functions in
`src/member-portal/lib/assets.ts`:

- `approveNewRequest` (`src/member-portal/lib/assets.ts:304`) sends approved-and-assigned or
  approved-and-queued, matching its own `outcome` return.
- `approveRetentionRequest` (`src/member-portal/lib/assets.ts:345`) sends retention-approved.
- `denyAssetRequest` (`src/member-portal/lib/assets.ts:358`) sends denied, carrying the recorded
  reason.

The deny dialog at `src/routes/admin/club/asset-requests/+page.svelte:78` currently tells the
admin that notifying the household is a manual step. **Replace that sentence with copy stating
that the household automatically receives the reason by email**, which this task makes true. Do
not merely delete it: the admin needs to know the reason they type is what the member reads.

### Constraints

- The slot-opened kind stays unwired. Its only caller is the trial pass's promotion task.
- A failed or unbound send never fails the admin action. The callers must not turn the helper's
  `{ ok: false }` into an action failure, and must not surface it to the admin as an error.
- Each caller passes the request id and its decision, so Task 5a's segment tagging stays unique
  per request per decision. The approve and deny functions already re-check that a request is
  still pending before acting
  (`src/member-portal/lib/assets.ts:304-336,345-354,358-365`), so the segment is for traceability
  rather than a second guard.
- Admin-side awareness stays badge-only. Do not add an admin notification, and do not rewire the
  legacy Discord webhook (declined at ruling 5).
- The replacement dialog sentence is admin-facing copy, not design content. Match the register of
  the surrounding dialog text and add no new control.

### Acceptance criteria

- Unit tests in `src/tests/assets-actions.test.ts` or the member-portal asset suite assert that
  approving a new request into a free slot sends the assigned kind, approving into a full type
  sends the queued kind, approving a retention request sends the retention kind, and denying
  sends the denied kind with the reason present in the body.
- A unit test asserts an unbound `EMAIL` binding leaves the approve and deny results unchanged.
- `grep -rn "manual step" src/routes/admin/club/asset-requests/` returns no hit, and the
  replacement sentence is present.
- `npm run check` reports 0 errors and 0 warnings, and `npm test` passes.
- The copy change at `asset-requests/+page.svelte:78` is rendering-affecting. If a committed
  baseline moves, regenerate through `gh workflow run ci.yml -f update_snapshots=true` only.

**Deliverables: 3.** The four decision sends, the dialog copy replacement, the wiring tests.

## Task 6: the coexistence sentence

### Outcomes

The spec-level product truth recorded as a comment in `src/admin-club/lib/assets-store.ts`,
beside the payment-standing derivation it qualifies (`assets-store.ts:24-29`): during
coexistence with the legacy ops dashboard, an asset fee collected through the legacy Stripe
payment-link route never reaches `asset_payments`, so the payment-standing badge is only as
current as the manual habit of recording those payments here with `recordPayment`. The
replacement belongs to the phase-2 ops absorption.

### Constraints

- A comment only. This task changes no behavior and adds no UI copy.
- **The store module is the home, not the route.** The spec names "the Assets screen's server
  module", but `src/routes/admin/club/assets/+page.server.ts` is the exact file plan 2 rebuilds
  from scratch in an uncoordinated fresh builder session, which would delete this durable
  product truth on its way past. `assets-store.ts` survives the screen rebuild and already owns
  the derivation the sentence qualifies. **Plan 2's preflight verifies the comment is still
  present in `assets-store.ts`** before its screen rebuild starts; carry that forward as a
  plan-2 constraint.
- The legacy route in question is `POST /api/assignments/:id/send-payment` on the legacy ops
  worker, deliberately kept when other legacy routes were retired
  (`docs/plans/assets/ops-events-410.md:1-11`). Name it in the comment so a future reader can
  find it.
- No em dash in code comments, per the workstation comment standard. Follow the Svelte and
  TypeScript comment conventions the surrounding files already use.

### Acceptance criteria

- The comment is present in `assets-store.ts` and names the legacy route, the missing rows, and
  the phase-2 owner.
- `npm run check` reports 0 errors and 0 warnings.

**Deliverables: 1.** The comment.

## The pass gate

The substrate pass closes with the full repo gate:

- `npm run check`, 0 errors and 0 warnings.
- `npm test`, all suites passing.
- `npm run test:e2e` against the local build.
- Any rendering change regenerates its baselines through
  `gh workflow run ci.yml -f update_snapshots=true` and nowhere else, and so does the first mint
  of any newly added visual case. Read the run's log rather than its conclusion, and confirm
  which files the bot actually minted.
- The `code-simplifier` agent runs over the changed code before each commit, per the
  workstation git convention. Docs-only commits skip it.
- Task 4's before/after pairs are in Geoff's hands.

## Inputs owed by Geoff

- **The four confirmed capacities.** Blocks Task 1 entirely. `rv-parking` is expected to be 10,
  pending confirmation.
- **The before/after on the retention step.** Task 4's gate.

## Out of scope

Restated from the design spec so no dispatch drifts into it:

- Any new admin screen or admin control, including the waitlist promotion action and the asset
  type editor. Both belong to plan 2.
- A `/my-account/gear` rebuild. The slot-opened email links to it as it stands.
- Any payment-collection mechanism, including replacing the legacy payment-link route.
- The offer-claim token machinery from the 2026-07-07 spec, superseded by ruling 4.
- Create and delete on asset types, rejected at ruling 6.
- The Discord webhook rewire, declined at ruling 5.
- Any advisory from the rendered audit baseline. This pass fixes none of them and names none of
  them.
