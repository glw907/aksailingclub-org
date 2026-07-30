# Assets functional design

The functional spec for the Assets rebuild, produced by the 2026-07-29 Fable brainstorm
sitting against the input packet (`docs/2026-07-29-assets-functional-input.md`). The packet's
nine open questions are all settled here; this file records each ruling and the design that
follows from it. The design work splits into two plans: a substrate pass of functional
repairs, then the design-capture trial's screen builds under the existing protocol
(`docs/plans/2026-07-29-cairn-design-trial-assets.md`, which stands unamended).

This spec is functional. Under the trial's control conditions, cairn's packaged capture is
the only sanctioned carrier of design content to a builder, so nothing here describes visual
treatment, and anything design-shaped added later is a control violation.

## The nine rulings

1. **Capacity numbers are fiction, not policy.** The imported capacity values were authored
   examples, never club data (Geoff confirmed the rv_parking "5" was invented). The
   migration corrects the capacity column to real numbers. Geoff owes the confirmed figures
   for all four types; rv_parking is probably 10, pending confirmation.
2. **The id mismatch is fixed in this pass, first task.** The underscore ids migrate to the
   hyphenated document vocabulary, and the bare `as AssetKind` cast gains runtime
   validation. This repairs live waiver-enforcement damage affecting 21 households.
3. **Retention gets its creation path.** The renewal flow gains the designed step: a
   household holding an asset re-requests it during renewal, creating the
   `kind: 'retention'` request the admin inbox already approves.
4. **Waitlist promotion is surfaced, not automated.** On release and on the type header,
   the admin sees the waitlist head for that type and promotes with one click. The human
   stays the trigger; no offer-claim state machine.
5. **Decision emails to the household.** The lifecycle emails at the moments a member
   cannot otherwise discover: approved (assigned or queued), denied with the recorded
   reason, retention approved, and slot opened. Admin-side awareness stays badge-only.
6. **The type catalog gets a fee/capacity/label editor.** Ids stay immutable in the UI,
   because after ruling 2 they key waiver documents and a rename would silently un-gate
   signing lists again.
7. **The rebuild optimizes for the rare real event.** Row counts are tiny and every row
   matters. Empty states are the normal state and are first-class. Pagination, list
   search, and bulk actions are explicitly out.
8. **One holdings lens.** A single shared active-holdings query feeds the Assets screen,
   the Members-list chips, and the household desk panel.
9. **The legacy Stripe payment-link route is phase-2's problem.** Fee-collection nudges
   stay on the legacy route through coexistence; this pass documents the drift hazard
   (see "The coexistence sentence") and builds nothing payment-shaped.

## Structure: two plans, two sessions

The boundary rule: **the substrate pass repairs and completes existing behavior; the trial
pass builds new admin surface.** Every control-sensitive dispatch therefore lives in plan 2.
The substrate lands first so the trial's screens build against honest data. Each plan
executes in its own fresh Opus 5 session per the model-boundary rule.

## Plan 1: Assets substrate

### Task 1: schema-repair migration

One migration against `asc-club`, scratch-proven with forward, rollback, and verify steps,
then applied live. It makes three corrections:

- Rename the asset-type ids to the document vocabulary: `rv_parking` to `rv-parking`,
  `boat_parking` to `boat-parking`, `small_boat` to `small-boat-rack`. `mooring` is already
  correct. The rename covers `asset_types.id` and every referencing column; the migration
  author enumerates those columns from the live schema (`asset_assignments`,
  `asset_waitlist`, and `asset_requests` carry `asset_type`; verify whether
  `asset_payments` references the type directly or only through its assignment).
- Correct `asset_types.capacity` to Geoff's confirmed real numbers. **Blocking input: the
  four confirmed capacities.** The migration does not ship with the invented values.
- Backfill the 4 `asset_payments` rows whose `method` is NULL despite a Stripe reference,
  setting `method='card'`. (Adjacency rider, approved at the design gate.)

The verify step closes by running the waiver-requirements derivation against live data and
confirming the affected households' acknowledgement documents now appear on their signing
lists. Success criterion: the count of households holding a mismatched-type asset with a
missing document requirement goes from 21 to 0.

### Task 2: cast validation

Replace the bare `as AssetKind` casts (`waiver-requirements.ts`, `documents-store.ts`, and
any grep-found siblings) with a parse function that throws on an unknown id. A future id
drift then fails loudly at read time instead of silently removing documents from signing
lists. A unit test feeds the parser a real underscore-form id and asserts the throw; this is
the test the current suite lacks, because it only ever fed the derivation synthetic
already-hyphenated ids.

### Task 3: lens consolidation

Extract one shared active-holdings query into `assets-store` and point all three consumers
at it: the Assets screen's `listActiveAssignments`, the Members-list holding-chip query,
and the household desk's Assets panel source. Behavior-preserving refactor. Existing tests
keep passing, and a new test asserts the three consumers agree on a seeded fixture.

### Task 4: retention creation

`/my-account/renew` gains the designed step. When the renewing household holds one or more
active assignments, the flow shows each held asset and asks whether the household is
re-requesting it for the coming season. A yes creates an `asset_requests` row with
`kind: 'retention'`; a no creates nothing (release stays a separate, deliberate action on
`/my-account/gear`). The admin inbox's existing `approveRetentionRequest` branch needs no
change. This is the one substrate task with member-facing UI. It follows existing portal
patterns and takes the standard before/after gate on dev.

### Task 5: decision emails

A `sendAssetDecisionEmail` helper on the site's existing email sender, with four message
kinds: request approved and assigned, request approved and queued to the waitlist, request
denied (carrying the admin's recorded reason), and slot opened (inviting the household to
claim, linking to `/my-account/gear`). Wire the first three into the existing approve and
deny functions in `src/member-portal/lib/assets.ts`. The deny dialog's "notifying the
household is a manual step" copy comes out. The slot-opened kind is built and tested now
but wired only by the trial pass's promotion task. Retention approval also emails, since
`approved_awaiting_payment` is a state the member must act on.

### The coexistence sentence

The spec-level product truth, recorded here and as a comment in the Assets screen's server
module: during coexistence with the legacy ops dashboard, an asset fee collected through
the legacy Stripe payment-link route never reaches `asset_payments`, so the payment-standing
badge is only as current as the manual habit of recording those payments here with
`recordPayment`. The replacement belongs to the phase-2 ops absorption.

## Plan 2: the trial screens

The existing protocol doc governs process and measurement and stands untouched. Plan 2 is
the build task list the protocol presumes: rebuild `/admin/club/assets` and
`/admin/club/asset-requests` in fresh builder sessions, each dispatch carrying outcome
statements plus the cairn admin-screens skill pointer and nothing else about design.

Beyond the existing six actions and three tab views, the screens carry two scope
additions, stated as outcomes only:

- **Promotion.** On releasing an assignment, and on each type's header when the type has
  waitlist entries, the admin sees the head of that type's waitlist and can promote with
  one action: assign the household, dequeue the entry, and send the slot-opened email via
  the task-5 helper.
- **Type editor.** Each asset type's fee, capacity, and display label are editable from
  the admin. The id is not editable.

Constraints the plan carries forward: the rare-real-event premise from ruling 7 (no
pagination, no list search, empty states as the primary state), all writes through the
existing `clubAdminAction` gate, and fixtures grounded in real post-migration rows in both
themes per the standing probe lesson. Defect 11 (the invisible standing chips) is
deliberately not named in the plan; whether the capture catches it is a trial measurement.

## Out of scope

- `/my-account/gear` rebuild (the slot-opened email links to it as-is).
- Any payment-collection mechanism, including replacing the legacy payment-link route
  (ruling 9; phase 2).
- The offer-claim token machinery from the 2026-07-07 spec (superseded by ruling 4).
- Full CRUD on asset types (ruling 6 rejects create and delete).
- The Discord webhook rewire (considered and declined at ruling 5).

## Testing

Task-level: the migration's verify.sql; the cast-validation throw test; the three-consumer
agreement test; retention-creation and email tests extending the existing six-action suite
in `src/tests/assets-actions.test.ts` and the waiver-requirements suite. Trial screens
inherit the protocol's done-gate (static and rendered audit, both themes, grader prompt on
novel compositions). The substrate pass closes with the full repo gate: `npm run check`,
`npm test`, and the e2e suite, regenerating visual baselines via the CI dispatch if any
rendering changed.

## Inputs owed

- **The four confirmed capacities** (blocks task 1; rv_parking probably 10, pending
  Geoff's confirmation).
- Geoff's before/after on the retention step in the renewal flow (task 4's gate).
