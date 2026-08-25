# Assets register re-entry: execution plan

Implements `docs/2026-08-24-assets-register-design.md` (the contract; read it first). Probe
evidence and verdicts: `~/.local/asc-data/probes/assets-register/` (machine-local, PII) and
the "Probe verdicts" section below. Execution: one implementer→diff-reviewer chain per task
through the Agent tool, sequential (T1–T4 share files with T5–T6's neighbors; contention
beats parallelism here). Budget: the contract's 1.5M ceiling, checkpoint every four tasks.

**Goal:** both Assets admin screens at the events-admin register bar, plus the contract's
riders (member-surface rename, unique-index migration, description recasing).

**Spec:** `docs/2026-08-24-assets-register-design.md`.

## Probe verdicts (conductor's calls under Geoff's proceed-to-completion grant, 2026-08-24)

Measured against the live-mirror seed (41 active assignments, real distribution):
by-asset scroll 5,843px at 1440 / 7,947px at 390, row height 94px/134px, no overflow-x.

1. **No category color for asset types.** The by-asset view groups by type, the waitlist
   runs in type order, and the inbox leads with the type name in bold; per-type hue adds a
   fourth color vocabulary with no discrimination need (unlike the events ledger's
   interleaved categories). Type labels take the quiet neutral chip register.
2. **State chips take the tinted-ground grammar.** Paid = quiet tint (settled state
   recedes); Outstanding = warning tint; Not billed = hairline outline (the
   transient-absence register from the events settle). New/Retention kind badges = quiet
   tint. One font weight across all chips.
3. **Collapsible per-type groups, default open**, native disclosure semantics, the group
   header carrying name, count/capacity, fee, waiting/next + Promote, and Edit. No
   persistence of collapse state.
4. **Row register tightens**: alternating stripes per the events ledger, row height
   reduced from 94px toward the events row scale, the doubled name suppressed (member name
   renders only when it differs from the household label), over-capacity counts take
   warning ink.
5. **Primary actions move to the top.** The Assign form (currently six viewports down) and
   the waitlist-add form become top-anchored dialogs from the list header region; one
   filled primary per surface.

## Global constraints

- Chip recipes follow `src/routes/admin/club/events/+page.svelte`'s scoped styles and the
  decisions ledger (2026-08-24 entries): tints mixed in oklab into the ROW ground; the
  1.16–1.47:1 band per theme/stripe pair is the standard, not a single percentage; colors
  verified by the canvas-readback method (`getComputedStyle` returns unresolved
  `oklch()`/`color-mix()` here).
- `@layer` cannot restyle daisyUI `.btn`/`.badge` (project memory): overrides go unlayered,
  dark needs the dual selector idiom, and fixes are proven in the BUILT css.
- The events page is NOT touched. Its CLEAN verdict and baselines stand.
- Local replica group headers show fixture capacities ("11/2 assigned"): probe artifact,
  not a defect. Do not "fix" capacity data.
- All writes stay behind the existing `clubAdminAction` gate. No new server actions.
- `npm run check` 0 errors 0 warnings, `npm test` green, after every task. No new
  suppressions.
- Visual baselines are CI-canonical: never run a local `--update-snapshots`; regeneration
  happens once, at close, via `gh workflow run ci.yml -f update_snapshots=true`.
- Comments follow ts-conventions/svelte-conventions; no em dashes in comments.

## Task 1: the shared admin chip-state stylesheet

**Files:** create a small site-side stylesheet under `src/theme/` carrying the three state
registers (quiet tint, warning tint, hairline outline) and the weight normalization, wired
into the admin surface the way the site's other admin-reaching CSS is (investigate the
existing import path; do not invent a new mechanism if one exists). Modify nothing under
`src/routes/admin/club/events/`.

**Outcome:** classes (or a documented selector convention) that T2/T3 consume for
`StatusChip`-rendered chips: quiet tint = `color-mix(in oklab, var(--color-base-content)
10%, <row ground>)` tuned per theme/stripe into the band; warning tint = the warning hue
mixed likewise; outline = transparent ground, hairline `--color-base-content`-mixed border,
muted ink; every chip `font-weight: 400`. Both themes. A short header comment names the
events-settle provenance and finding 12 (the engine ask this carries until cairn ships it).

**Acceptance:** a unit or e2e-free check is not required for CSS alone, but the task ships
a tiny standalone verification script (canvas-readback, both themes, against the built
css) whose output lands in the task report: each register's chip/ground contrast inside
1.16–1.47:1 on the base and striped grounds. `npm run check` and `npm test` green.

## Task 2: the Assets screen register re-entry

**Files:** `src/routes/admin/club/assets/+page.svelte` (and its co-located modules if row
markup moves); consumes Task 1's registers and Task 4's `displayDescription` helper.

**Outcome:** the probe verdicts 2–5 on `/admin/club/assets`, concretely: payment-standing
chips through `StatusChip` mapped Paid→quiet, Outstanding→warning, Not billed→outline; the
waitlist type badge moved off `badge-neutral` onto the quiet register; per-type groups as
default-open native disclosures with the full header (name, count/capacity with warning
ink when count exceeds a non-null capacity, fee, waiting/next + Promote, Edit); alternating
row stripes; row vertical padding tightened toward the events row scale while keeping the
two-line name/description composition; the household·member doubled name suppressed when
identical; descriptions rendered through `displayDescription`; the Assign and waitlist-add
inline forms replaced by top-anchored dialogs launched from the list header region, one
filled primary per surface (existing dialog idiom on this page is the pattern); empty
states through the packaged `EmptyState`.

**Acceptance:** existing `src/tests/assets-actions.test.ts` untouched and green (no server
changes). At 390 with the seeded replica: `scrollWidth === clientWidth`. All six actions
still reachable and wired (assign, release, recordPayment, waitlistAdd, waitlistRemove,
waitlistMoveToEnd) plus promote and the type editor. `npm run check` 0/0.

## Task 3: the asset-requests screen register

**Files:** `src/routes/admin/club/asset-requests/+page.svelte`; consumes Tasks 1 and 4.

**Outcome:** the New/Retention kind badge moves off the hand-rolled
`.badge.cairn-chip-quiet` onto `StatusChip` with the quiet register; chip weight
normalized; descriptions in the prior-holding line (if any render) through
`displayDescription`; row register aligned with Task 2's stripes where the inbox lists
multiple requests; the packaged `EmptyState` stays.

**Acceptance:** approve/deny flows untouched server-side; existing tests green;
`npm run check` 0/0; 390 fit as in Task 2.

## Task 4: the description display helper

**Files:** create a pure module beside `src/admin-club/lib/assets-store.ts` (or in it if
that is the established shape) exporting `displayDescription(raw: string | null): string |
null`; apply it in the household desk's Assets panel
(`src/routes/admin/club/members/[id]/+page.svelte`). Tests in `src/tests/`.

**Outcome:** conservative display-time recasing per the contract's ruling 3: a token that
is entirely uppercase alphabetic and 3+ characters becomes title case ("TRAILER" →
"Trailer", "BAT BOAT" → "Bat Boat"); mixed-case tokens, digits-bearing tokens, and short
tokens pass through untouched ("LASER II" → "Laser II" — the digits-bearing "II" survives;
"BUCC 2" → "Bucc 2"; "New paint job Blue Sailboat" unchanged). Stored values never change.

**Acceptance:** unit tests cover the cases above plus null/empty passthrough, written
first and failing before the implementation lands. `npm run check` 0/0, `npm test` green.

## Task 5: the member-surface rename

**Files:** move `src/routes/(site)/my-account/gear/` to `src/routes/(site)/my-account/
storage/`; update every inbound reference (the portal landing page's links and copy, the
decision-email bodies in the task-5 email helper, `$theme/redirects.ts` only if it names
the old path, nav/labels, tests, and any e2e spec paths). Label: "Storage & moorings".

**Outcome:** `/my-account/storage` serves the screen; `/my-account/gear` 404s (no
redirect: nobody uses the system yet, Geoff 2026-08-24); no repo reference to the old
path survives (`grep -r "my-account/gear" src e2e` returns nothing).

**Acceptance:** the grep above empty; existing portal/renewal tests green with paths
updated; `npm run check` 0/0. Screen design otherwise untouched.

## Task 6: the `asset_requests` unique-index migration

**Files:** `migrations/asc-club/0037_asset_request_unique/` with `forward.sql`,
`rollback.sql`, `verify.sql`, `README.md`, following `0034_asset_type_ids`'s shape.

**Outcome:** a partial unique index enforcing at most one `pending` request per
(household, asset type): `CREATE UNIQUE INDEX ... ON asset_requests(household_id,
asset_type) WHERE status='pending'` (exact column names read from the live schema, not
assumed). This closes the double-click race the app-level guard cannot (two concurrent
inserts both pass the SELECT check). The app's write path must surface the constraint
failure as the existing duplicate-request error, not a 500: verify the member portal's
`requestAsset` and the renewal retention path handle a constraint rejection; adjust their
error mapping if a raw D1 error would escape.

**Acceptance:** scratch-proven forward → verify → rollback → forward against a local
scratch copy before live; a unit test seeds a pending row and asserts the second insert
rejects and maps to the friendly error; applied to remote `asc-club` only after the full
suite is green; `verify.sql` output recorded in the README. The migration README notes
the index must exist BEFORE any real member traffic (currently zero live rows, so the
apply is trivially safe).

## Order and close

T1 → T4 → T2 → T3 → T5 → T6, sequential chains. Close per the contract: code-simplifier
over the changed code, reviewer fan-out (svelte-reviewer, daisyui-a11y-reviewer,
cloudflare-workers-reviewer for T6), fresh-context cold coherence read at 390/1440 both
themes against the seeded replica, fix round if it fails, baselines via the CI dispatch,
PR, merge, deploy to dev, before/after artifact for Geoff, harvest filed, decisions.md
settle entry, STATUS/HISTORY updated.
