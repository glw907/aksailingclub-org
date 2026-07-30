# Assets trial build plan

> **For agentic workers:** execute task by task. The main loop orchestrates, dispatches each
> task to the repo's Sonnet-pinned implementer, reviews the diff, and clears the gate before
> the next dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Authorities.** The functional contract is `docs/2026-07-29-assets-functional-design.md`,
> section "Plan 2: the trial screens"; read it first. The evidence base with `file:line`
> citations is `docs/2026-07-29-assets-functional-input.md`, which is **orchestrator-only** and
> never reaches a builder session; see "Control conditions" below. Process, measurement, and the
> builder's done-gate belong to `docs/plans/2026-07-29-cairn-design-trial-assets.md`, which this
> plan never amends and reaches only by pointer rather than by restatement.

**Goal:** rebuild `/admin/club/assets` and `/admin/club/asset-requests` with their existing six
actions and their full readout of holdings, waitlist, and pending requests intact, plus two
capability additions: waitlist promotion that assigns, dequeues, and emails the household, and a
fee/capacity/label editor for the asset-type catalog with the id immutable.

**Dependency:** this plan executes only after the Assets substrate plan lands
(`docs/plans/2026-07-29-assets-substrate.md`, spec section "Plan 1"). Task 1 verifies the full
landed set of substrate outcomes against the code and the live database rather than against a
filename, and no later task starts until that verification passes.

**Tech stack:** SvelteKit 2 / Svelte 5 runes, `@glw907/cairn-cms` `^0.91.1` admin shell and
admin-toolkit, D1 (`asc-club`), Vitest, Playwright.

## Control conditions

The trial's control conditions (protocol doc, "Control conditions") govern every dispatch in
this plan and override anything else here.

- Tasks 5 and 6 are **builder dispatches**. Each runs in a fresh session that has not seen this
  plan's other tasks.
- **What travels in a builder dispatch, and nothing else:** that task's Files line, its Outcomes
  section, its Constraints section, its Acceptance criteria section, the one instruction to load
  the `cairn-admin-screens` skill, and the protocol doc's "The done-gate" section, which the
  task's own constraints point at. The Constraints and Acceptance criteria sections carry
  functional scope, gate commands, and the fixture bootstrap. They carry no design content, which
  is what makes them safe to send.
- **What is orchestrator-only, and must not reach a builder session in any form.** Not quoted,
  not paraphrased, and not as a path a builder would open:
  - `docs/2026-07-29-assets-functional-input.md`, the evidence packet. Its defect 11 is the
    withheld measurement: whether the packaged capture catches it unaided is a trial result, and
    naming it to a builder destroys that result.
  - `docs/2026-07-29-assets-functional-design.md`'s defect references and ruling commentary. The
    spec's functional outcomes reach a builder only as restated inside that task's Outcomes.
  - This plan's "Global constraints" block, this "Control conditions" block, every task's
    **Dispatch** note, and every other task's text.
  - The protocol doc beyond its "The done-gate" section, including its control conditions,
    metrics, and grader calibration.
  - Task 7's coherence-read findings, until the orchestrator hands a bounded fix list back.
- This plan states what the screens do. It never states how they look. The skill, `cairn-audit`,
  and `cairn-audit norms` are the only sanctioned carriers of design content to a builder.
- **A functional scope ruling is not design content.** Spec ruling 7's exclusions (no pagination,
  no list search, no bulk actions) restate an approved scope boundary carried from the spec, and
  they travel with the builder dispatch. They name component vocabulary, so the trial log records
  the exposure as sanctioned rather than as a violation.
- The trial log (`docs/design-benchmark/2026-07-29-assets-trial-log.md`) records what each
  builder actually had in context. The orchestrator writes that record at dispatch time.

## Global constraints

This block is orchestrator-only. It governs the orchestrator's review of every diff; the parts a
builder needs are restated inside that builder's own task.

- Every write is a server action gated by `clubAdminAction` in
  `src/admin-club/lib/club-action.ts`, which checks the club role, rate-limits per editor, and
  audits the action. No new roles, and no `roles:` nav gates; visibility derives from the access
  map alone.
- Spec ruling 7, the rare-real-event premise, a functional scope ruling carried from the approved
  spec: no pagination, no list search over the result sets, no bulk actions. Every view renders
  its full result set in one load. Each view renders a defined state when its result set is
  empty, and the empty state is the expected state for the waitlist and the request inbox, both
  of which hold zero live rows (packet, "The real data").
- The write paths keep their existing option sources, `listMembershipOptions` and
  `listMemberOptions` in `src/admin-club/lib/assets-store.ts`. No server-side search is added
  (packet defect 10).
- Assignments attach to memberships; waitlist entries attach to members (`assignAsset` and
  `addToWaitlist` in `src/admin-club/lib/assets-store.ts`). Any code that moves an entry to an
  assignment resolves the member's current-season membership explicitly.
- No `asc-club` migration belongs to this plan. The substrate pass owns the schema repair.
  `EVENTS_DB` stays untouched.
- Fixtures are grounded in real post-migration row shapes: real fees, free-text boat
  descriptions, both themes. The standing lesson is that a probe once depicted data the system
  cannot produce (`docs/status-archive.md:706-714`).
- Dates and times display in America/Anchorage, as elsewhere in the admin.
- Gate between dispatches: `npm run check` (0 errors, 0 warnings), `npm test`, `npm run build`.
- Visual baselines regenerate only through the `ci.yml` `workflow_dispatch` `update_snapshots`
  mode (`gh workflow run ci.yml -f update_snapshots=true`), never locally. Neither Assets screen
  carries an e2e baseline today, so no baseline change is expected; if one appears, it is a
  signal to investigate before regenerating.
- DX findings against cairn accumulate as they surface, per the standing harvest mandate.

---

### Task 1: preflight and dependency verification

**Files:** read-only across the repo; write the record into
`docs/design-benchmark/2026-07-29-assets-trial-log.md`.

**Deliverables (3):** the substrate verification record, the perimeter audit baseline
confirmation, the one-executor check.

**Outcomes**

- The substrate plan's landed outcomes are confirmed in place, each against the code or the live
  database: the live `asset_types` ids are the hyphenated forms; `asset_types.capacity` carries
  the confirmed numbers; the `as AssetKind` casts are replaced by a throwing parse; one shared
  active-holdings query feeds all three consumers; the renewal flow creates `kind: 'retention'`
  requests; `sendAssetDecisionEmail` exists with its five kinds including slot-opened; and the
  coexistence comment is present in `src/admin-club/lib/assets-store.ts`.
- The perimeter's audit state is confirmed error-clean before any build starts, so a finding
  raised later in the trial is attributable to the build.
- No other executor is live in this worktree.

**Constraints**

- Verify the id migration with a live read-only query against `asc-club`, not by reading the
  migration file: `npx wrangler d1 execute asc-club --remote --command "SELECT id, name, fee, capacity FROM asset_types ORDER BY sort_order;"`.
- Verify the waiver repair with the substrate's own verify criterion: the count of households
  holding a mismatched-type asset with a missing document requirement is 0 (was 21; packet,
  "The real data").
- The audit baseline runs as the protocol's own door describes; both perimeter pages are
  already named in `cairn-audit.config.json`.

**Acceptance criteria**

- The live query returns `mooring`, `rv-parking`, `boat-parking`, `small-boat-rack`, and each
  row's `capacity` matches the four values recorded in the substrate plan's "Blocking input"
  section (`docs/plans/2026-07-29-assets-substrate.md`, Task 1). If that section still names no
  confirmed numbers, the substrate has not landed and this plan does not start.
- `src/admin-club/lib/assets-store.ts` carries the coexistence comment, naming the legacy
  payment-link route, the `asset_payments` rows it never writes, and the phase-2 owner. It is a
  spec commitment sitting in a file the rebuild touches, so it is confirmed present before the
  build and re-asserted at pass close.
- `npm run check` (0/0), `npm test`, and `npm run build` are green on the tree as inherited.
- `npx cairn-audit` static reports zero error-tier findings on the perimeter.
- The trial log carries a dated entry with the query output and the gate results.

---

### Task 2: local fixture rows for the never-exercised states

**Files:** create `e2e/fixtures/assets-seed.sql`; modify `e2e/fixtures/bootstrap-club-db.mjs`.

**Deliverables (3):** the fixture file, its wiring into the bootstrap, the reachability check
for populated and empty states.

**Outcomes**

- The local D1 replica carries pending asset requests of both kinds (`new` and `retention`) and
  waitlist entries in more than one asset type, so a builder and the rendered audit can reach
  the populated states of both screens. Both tables hold zero live rows today
  (packet, "The real data"), so fixtures are the only path to those states.
- One seeded asset type sits at its capacity, its active-assignment count equal to its `capacity`
  value, and one other sits below capacity. Approving a new request therefore has both of its
  outcomes reachable locally: the assigning path and the enqueue-onto-the-waitlist path.
- Every seeded waitlist member holds a membership in the replica's current season, so promotion
  can be exercised by hand. Promotion fails by design for a member without one, and a waitlist
  that cannot be promoted makes task 5's acceptance unreachable.
- Both the populated and the empty state of each view are reachable locally, and the trial log
  records the command that moves between them.

**Constraints**

- **Attach the new rows to the real `mooring` asset type that `waivers-seed.sql` already seeds.**
  Do not insert, delete, or re-key any other real type id. Every other type these rows need is a
  fixture-prefixed placeholder, which is the established convention: `portal-seed.sql` documents
  it in its own waiver-scope comment for `portal-at-mooring`, `portal-at-trailer`, and
  `portal-at-rv`, and `membership-admin-seed.sql` follows it with its `madm-` prefix.
- Prefix every id the new file creates distinctly, so its rows delete cleanly and never collide
  with the `portal-`, `waiver-`, or `madm-` sets.
- **Bootstrap slot: last.** Append the new file to `e2e/fixtures/bootstrap-club-db.mjs` after
  `waivers-seed.sql`. `signup-seed.sql` deletes `asset_requests`, `asset_waitlist`, and
  `asset_assignments` unconditionally, and `waivers-seed.sql` deletes and reinserts the real
  `mooring` row; any earlier slot loses the new rows outright or breaks their foreign key.
- Row shapes mirror live production rows: fees matching the type the row attaches to, free-text
  boat descriptions on assignments (never a slot identifier), waitlist positions computed as tail
  entries within one type.
- Read the current season from the replica's `settings` row rather than hard-coding a year,
  matching how the other fixtures resolve it.
- Scope the new rows to households the new file creates itself, which no baselined spec renders,
  so the visual suites keep their current baselines.

**Acceptance criteria**

- After `node e2e/fixtures/bootstrap-club-db.mjs`, a local query returns a non-zero count from
  `asset_requests` for each of `kind='new'` and `kind='retention'`, and waitlist entries in at
  least two asset types.
- A local query returns one asset type whose active-assignment count equals its `capacity`, and
  one whose count is below it.
- Every seeded waitlist member resolves to a membership in the replica's current season,
  confirmed by query.
- `npm run test:e2e` is green with no baseline change.
- `npm test` and `npm run check` (0/0) stay green.

---

### Task 3: waitlist promotion, server side

**Files:** modify `src/admin-club/lib/assets-store.ts`,
`src/routes/admin/club/assets/+page.server.ts`,
`src/routes/admin/club/assets/assets-form-input.ts`, `src/tests/assets-store.test.ts`,
`src/tests/assets-actions.test.ts`.

**Deliverables (4):** the store function, the input parser, the gated route action, the tests.

**Outcomes**

- A store function reads the head entry of a given asset type's waitlist, which is the entry
  with the lowest position in that type (`listAssetWaitlist` and `addToWaitlist` in
  `src/admin-club/lib/assets-store.ts` carry the existing shape).
- A store function promotes a waitlist entry: it resolves the entry's member to that member's
  current-season membership, creates an active assignment of the entry's asset type for that
  membership, removes the waitlist entry, and reports the new assignment id.
- A route action exposes promotion, gated by `clubAdminAction` and audited like the other six
  actions, and sends the slot-opened message through the substrate's `sendAssetDecisionEmail`
  helper.
- Promotion is admin-triggered and never automatic. Releasing an assignment continues to write
  nothing to the waitlist on its own (packet defect 5).

**Constraints**

- If the promoted member has no current-season membership, the action fails with a stated
  reason and writes nothing. It never invents a membership.
- If the waitlist entry no longer exists, the action fails the same way the existing
  `waitlistMoveToEnd` action's precondition read does, in
  `src/routes/admin/club/assets/+page.server.ts`.
- Assignment and dequeue succeed or fail together. Email delivery is not part of that
  atomicity: a send failure leaves the assignment standing and reports the failure.
- Capacity is advisory on this path, never a write barrier. Promotion does not refuse a type that
  is already at or over capacity; ruling 4 makes the admin the deliberate trigger.
- No UI in this task.

**Acceptance criteria**

- `npm test` covers, at minimum: the head-entry read picks the lowest position within one type
  and ignores other types; a successful promotion creates the assignment, removes the entry,
  and calls the email helper once; a member with no current-season membership fails with no
  write; a missing entry fails; an editor with no club role gets 403 and the rejected attempt is
  audited (the `postEvent` recipe in `src/tests/assets-actions.test.ts`).
- `npm run check` (0/0) and `npm run build` are green.

---

### Task 4: asset-type editing, server side

**Files:** modify `src/admin-club/lib/assets-store.ts`,
`src/routes/admin/club/assets/+page.server.ts`,
`src/routes/admin/club/assets/assets-form-input.ts`, `src/tests/assets-store.test.ts`,
`src/tests/assets-actions.test.ts`.

**Deliverables (4):** the store write, the input parser, the gated route action, the tests.

**Outcomes**

- A store function updates one asset type's display name, fee, and capacity by id. It is the
  first write path to `asset_types` in the application; the four rows have only ever been
  written by the one-time import (packet defect 3).
- An input parser validates the submitted values: a non-empty name, a fee that is a
  non-negative whole number, and a capacity that is either a positive whole number or cleared
  to null.
- A route action exposes the edit, gated by `clubAdminAction` and audited.
- The id is never writable. It is the request key and nothing else. After the substrate's
  migration, an id keys the waiver documents, and a rename would silently un-gate signing lists
  again (spec ruling 6).

**Constraints**

- `sort_order` stays unwritten by this pass. Creating and deleting types stay out of scope
  (spec, "Out of scope").
- Capacity may be null, and clearing it to null is a supported edit rather than an error.
- Capacity is advisory, never a write barrier. The write accepts a capacity below the type's
  current active-assignment count and reports no error for it.
- Fee changes apply to future reads only. No existing `asset_payments` row is rewritten, and
  no payment is created or collected (spec ruling 9).
- No UI in this task.

**Acceptance criteria**

- `npm test` covers: a successful update of all three fields; capacity cleared to null;
  rejection of an empty name, a negative fee, and a fractional fee or capacity; no id column is
  written on any path; the 403 and audit path for an editor with no club role.
- `npm run check` (0/0) and `npm run build` are green.

---

### Task 5: rebuild `/admin/club/assets` (builder dispatch)

**Dispatch (orchestrator-only; this block never travels):** fresh session. Send exactly what
"Control conditions" lists as travelling, which is this task's Files line, Outcomes, Constraints,
and Acceptance criteria, plus the instruction to load the `cairn-admin-screens` skill. Send
nothing else. Record what the builder had in context in the trial log.

**Files:** rebuild `src/routes/admin/club/assets/+page.svelte`; adjust
`src/routes/admin/club/assets/+page.server.ts` only where the load contract needs it; extend
`src/tests/assets-actions.test.ts` if an action contract changes.

**Deliverables (4 artifacts, covering 8 user-facing actions):** the rebuilt screen carrying all
eight actions named below, any load-contract adjustment, the test updates, the builder's own
report.

> **Orchestrator note (not dispatched):** this is the pass's largest task, past the
> roughly-four-deliverable bar on action count. It is deliberately not split. One fresh session
> owns one screen, and splitting the screen across two builders would break the
> uncoordinated-builder premise the trial measures. Flag the sizing in the trial log at dispatch
> time so the cost is attributable.

**Outcomes**

The screen is the club's direct-management surface for asset assignments and the waitlist. An
administrator or club manager can do all of the following from it.

- Read all current holdings and the waitlist from the screen, over one shared query. The
  holdings are readable grouped by asset type and readable grouped by household; the waitlist is
  readable in queue position order. Each holding carries the household, the free-text
  description, and the derived payment standing (not-billed, outstanding, or paid); each asset
  type carries its assigned count against its capacity (`listActiveAssignments` and the
  `AssetPaymentStanding` derivation in `src/admin-club/lib/assets-store.ts`).
- Assign an asset type to a household's current-season membership, with an optional
  description.
- Release an assignment, which is a status flip that preserves history. Release is a deliberate,
  acknowledged action, never a single unguarded press.
- Record a payment against an assignment for the current season: an amount, a method of card,
  check, or cash, upserted per season so recording twice corrects rather than duplicates.
- Add a member to an asset type's waitlist, remove an entry, and move an entry to the end of
  its own type's queue.
- See the head entry of an asset type's waitlist and promote that household in one action,
  which assigns, dequeues, and emails the household that a slot opened. The promotion is
  reachable both when releasing an assignment of that type and whenever that type has waitlist
  entries.
- Edit an asset type's display name, fee, and capacity. The id is not editable and is not
  offered for editing.

**Constraints**

- Every write goes through the existing `clubAdminAction`-gated route actions. The promotion and
  type-edit actions already exist beside the other six; this task consumes them and adds no new
  server capability.
- **A functional scope ruling carried from the approved spec, not design guidance:** the rebuild
  optimizes for the rare real event. No pagination, no search or filter over the result sets, no
  bulk actions. Every result set renders in full in one load, and each carries a defined state
  when it is empty. The waitlist is empty in production today.
- The existing action failure path stays: a failed action reports its error on the screen
  rather than silently.
- The write paths keep their existing option sources, `listMembershipOptions` and
  `listMemberOptions` in `src/admin-club/lib/assets-store.ts`. No server-side search is added.
- Run `node e2e/fixtures/bootstrap-club-db.mjs` to reach the populated states, and clear those
  fixture rows to reach the empty states. Capture both.
- The rendered audit runs against a local `wrangler dev` with an authed admin session supplied
  through `CAIRN_AUDIT_COOKIES`. `cairn-audit.config.json` already names this page.
- The builder's done-gate is the protocol's, not this plan's: satisfy
  `docs/plans/2026-07-29-cairn-design-trial-assets.md`, section "The done-gate", in full. That
  section is the only part of the protocol doc that travels with this dispatch, and this plan
  neither restates nor relaxes it.

**Acceptance criteria**

- `npm run check` (0/0), `npm test`, and `npm run build` are green.
- The protocol's done-gate is satisfied on `/admin/club/assets`.
- All six existing actions plus promotion and type editing are reachable from the screen and
  exercised once each by hand against the local replica.
- The builder's report names what it had in context and everything the protocol's done-gate
  requires it to report.

---

### Task 6: rebuild `/admin/club/asset-requests` (builder dispatch)

**Dispatch (orchestrator-only; this block never travels):** fresh session, uncoordinated with
task 5. Send exactly what "Control conditions" lists as travelling, which is this task's Files
line, Outcomes, Constraints, and Acceptance criteria, plus the instruction to load the
`cairn-admin-screens` skill. Send nothing else. Record what the builder had in context in the
trial log.

**Files:** rebuild `src/routes/admin/club/asset-requests/+page.svelte`; adjust
`src/routes/admin/club/asset-requests/+page.server.ts` only where the load contract needs it.

**Deliverables (3):** the rebuilt screen, any load-contract adjustment, the builder's own
report.

**Outcomes**

The screen is the review inbox for member-submitted asset requests. An administrator or club
manager can do all of the following from it.

- Read every pending request, oldest first, each showing the asset type, the household, the
  request kind (new or retention), the requester and the timestamp, the member's optional note,
  and the household's prior holding of that type when one exists (`listPendingAssetRequests` and
  `getPriorHoldingSummary` in `src/member-portal/lib/assets.ts`).
- See the count of pending requests, which is the same count the Club landing page and the
  admin navigation already report from one shared source, so the three cannot disagree
  (`src/routes/admin/club/+page.server.ts`; `loadAttentionCounts` in
  `src/theme/admin-attention.ts`).
- Approve a new request, which assigns the household directly when the type has a free slot and
  otherwise enqueues the requester onto that type's waitlist, marking the request `assigned` or
  `queued` accordingly (`approveNewRequest` in `src/member-portal/lib/assets.ts`).
- Approve a retention request, which moves it to `approved_awaiting_payment` and states the fee.
  Assignment happens later, when the member pays, from the member portal
  (`approveRetentionRequest` and `payForApprovedRequest` in
  `src/member-portal/lib/assets.ts`).
- Deny either kind with a required non-empty reason, which is recorded on the request.
- Read the state the inbox is in when nothing is pending, which is its state in production
  today. `asset_requests` holds zero live rows.

**Constraints**

- The approve and deny paths are the existing functions in `src/member-portal/lib/assets.ts`,
  each re-checking that the request is still pending and matches the expected kind before
  acting. This task changes no server capability.
- The substrate pass wired the decision emails and removed the deny path's
  "notifying the household is a manual step" copy. Do not reintroduce that claim.
- **A functional scope ruling carried from the approved spec, not design guidance:** no
  pagination, no filtering, and no sorting beyond the fixed oldest-first order.
- Run `node e2e/fixtures/bootstrap-club-db.mjs` to reach the populated state, and clear those
  fixture rows to reach the empty state. Capture both.
- The rendered audit runs against a local `wrangler dev` with an authed admin session supplied
  through `CAIRN_AUDIT_COOKIES`. `cairn-audit.config.json` already names this page.
- The builder's done-gate is the protocol's, not this plan's: satisfy
  `docs/plans/2026-07-29-cairn-design-trial-assets.md`, section "The done-gate", in full. That
  section is the only part of the protocol doc that travels with this dispatch, and this plan
  neither restates nor relaxes it.

**Acceptance criteria**

- `npm run check` (0/0), `npm test`, and `npm run build` are green.
- The protocol's done-gate is satisfied on `/admin/club/asset-requests`.
- Approve-new against a type with a free slot, approve-new against a type already at its
  capacity, approve retention, and deny with a reason are each exercised once by hand against the
  local replica, and the resulting request statuses are confirmed by query.
- The builder's report names what it had in context and everything the protocol's done-gate
  requires it to report.

---

### Task 7: the cold coherence reads

The trial's primary instrument. The protocol's headline metric is reads-to-PASS, which only
exists if the reads are actually run and the tells they surface are fixed and re-read. This task
is that loop; it is orchestrator-run, not a builder dispatch.

**Files:** modify `docs/design-benchmark/2026-07-29-assets-trial-log.md`; fix-only changes to
`src/routes/admin/club/assets/+page.svelte` and
`src/routes/admin/club/asset-requests/+page.svelte`.

**Deliverables (4):** the first-read record per screen, the tell classification, the fix rounds,
the reads-to-PASS figure per screen.

**Outcomes**

- Each rebuilt screen gets its external coherence read run exactly as the protocol specifies
  (`docs/plans/2026-07-29-cairn-design-trial-assets.md`, section "Measurement"). That section
  owns k, the consensus rule, the pinned prompt and its recorded hash, the grading model, the
  viewports, the interaction state, and both themes. This task restates none of those parameters
  and substitutes nothing for them.
- Every first-read tell is classified against the coverage contract the protocol names, as
  capture-gap or covered-but-missed. Classification is against the contract, never against the
  rule inventory.
- Tells are fixed and the screen re-read until it reaches PASS. The number of reads each screen
  needed is the pass's headline measurement, recorded per screen.

**Constraints**

- The reader is a fresh context that neither built the screen nor orchestrated its build. The
  context that built a screen never grades it.
- Read the reader's findings, not its verdict line, and treat a null or empty return as a failed
  reader that throws rather than as zero findings. A dead reviewer silently filtering to
  "no findings" nearly published unreviewed work once on this repo.
- Fixes are the orchestrator's to route. Each fix round is a bounded, named list of tells handed
  to a fresh session, and that fix list is the only thing from this task that reaches a builder
  session.
- A fix round changes rendering, not behavior. Any behavior defect this task surfaces is filed
  and routed, never absorbed into a fix round.
- Each screen runs its own reads independently. A tell found on one screen is not pre-emptively
  fixed on the other, because cross-fixing destroys the second screen's first-read count.
- Re-run the protocol's done-gate after each fix round, since a fix can move the audit.

**Acceptance criteria**

- Both screens reach PASS under the protocol's consensus rule.
- The trial log carries, per screen: each read's tell union, each tell's classification with the
  contract clause it lands against, the fix applied, and the reads-to-PASS count.
- `npm run check` (0/0), `npm test`, and `npm run build` are green after the final fix round.

---

### Task 8: pass close

**Files:** modify `docs/design-benchmark/2026-07-29-assets-trial-log.md` and `docs/STATUS.md`.

**Deliverables (3):** the full repo gate, the trial record, the status entry.

**Outcomes**

- The full repo gate is green across the pass: `npm run check` (0/0), `npm test`,
  `npm run build`, and `npm run test:e2e`.
- The trial's measurements are recorded per the protocol, which owns the metric definitions,
  the pinned grader prompt, and the verdict logic. This plan adds nothing to them. Task 7's
  per-screen reads-to-PASS and first-read tell counts feed the first two metrics; the builders'
  own reports feed the mid-build audit catches and the suppressions added; the pass's token cost
  is recorded against the Members and Classes builds.
- `docs/STATUS.md` points at the next action, and any deferred item is routed rather than
  absorbed.

**Constraints**

- If a baselined visual surface changed, regenerate through
  `gh workflow run ci.yml -f update_snapshots=true` and read the run log rather than its
  conclusion. Never regenerate locally.
- Run the `code-simplifier` agent over the pass's changed code before the commit.
- Both screens carry Geoff's before/after gate on dev before anything reaches the apex.

**Acceptance criteria**

- All four gate commands are green and their results are recorded.
- The trial log carries the per-builder context records, the audit results, task 7's read record,
  and the measurements the protocol calls for.
- The coexistence comment task 1 confirmed is still present in
  `src/admin-club/lib/assets-store.ts`, unchanged in substance. A rebuild that adjusted the
  Assets load contract must not have deleted it.
- `docs/STATUS.md` names the open gates, including Geoff's before/after.
