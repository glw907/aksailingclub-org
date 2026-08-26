# Email + Announce pass: execution plan

Implements `docs/2026-08-25-email-announce-design.md` (the contract; read it first). The
factual ground behind both is `docs/2026-08-25-email-announce-prep-brief.md`. Execution
runs in workflow mode per the contract: `~/.claude/workflows/pass-execute.js` with the
implementer→diff-reviewer→gate chain per task, honoring the dependency notes below (tasks
marked independent may pipeline). Budget: 2.5M agent tokens, checkpoint every four tasks.

**Goal:** the five Email and Announce admin screens at the settled register bar, the
head-of-household audience model live end to end (migration, resolver, portal and admin
opt-in surfaces), and the advisory quota headroom check on both send surfaces.

**Spec:** `docs/2026-08-25-email-announce-design.md`.

## Probe round (before T6, T9, and T10)

One probe page from the dev shell with compiled CSS (the
`~/.local/asc-data/probes/assets-register/` pattern), grounded in the live `email_log`
rows, both themes, 1440 and 390. Three subjects: the send-log presentation (grouped rows,
the 2026-07-14 incident row collapsed and expanded, sent and failed chips, the
Templates / Send log switcher context), the announced-state chip pair, and the announce
form's channel-block composition (a shared header block plus one block per channel, each
carrying its own enable control and its own preview). Geoff verdicts async; verdicts are
appended to this plan as a "Probe verdicts" section before the gated tasks dispatch.
T1–T5, T7, and T8 do not wait on the probe; T11 waits on it transitively through T6.

## Probe verdicts (Geoff, 2026-08-25: "These look great. Go forward.")

Blanket ratification of the probe's primary compositions as rendered (probe pages at
`~/.local/asc-data/probes/email-announce/`, both themes, read at 1440 and 390):

1. The incident row sits on the NEUTRAL row ground (probe A): the warning chip alone
   carries the tone. The A′ tinted-ground alternative is not taken.
2. The expanded state as probed: inset member rows with their own Failed chips, the
   in-incident pager, sent rows continuing in chronology below.
3. The announced-state chip pair with the detail as muted text beside the chip.
4. The announce form's stacked parallel channel blocks, each carrying its own enable
   control, its fields, and its own preview; SMS joins as a third block later.
5. The subject field lives inside the Email block.

Two substrate findings recorded for Task 8 and the harvest: `discord.ts`'s
`DiscordBindingEnv` doc comment claims an `EDUCATION` webhook secret that does not exist
(verified configured channels 2026-08-25: general, site, fleet, racing, harbor,
technology), and `email_log.segment` is null on all 750 live rows.

## Global constraints

- Chip recipes ride `src/theme/admin-chip-registers.css` (the assets pass's stylesheet) via
  a per-page side-effect import (`import '$theme/admin-chip-registers.css';`). That import
  is inert on its own: every `StatusChip` must sit inside its register's marker span, the
  map shape `src/routes/admin/club/assets/+page.svelte:92-94` already encodes. The three
  recipes are exactly `<span class="asc-admin-chip-quiet"><StatusChip tone="neutral"
  register="quiet" ... /></span>` for the quiet tint, `asc-admin-chip-warning` with
  `tone="warning" register="quiet"` for the warning tint, and `asc-admin-chip-outline` with
  `tone="neutral" register="bounded"` for the hairline outline. Tints are verified by canvas
  readback against the BUILT css (`getComputedStyle` returns unresolved `oklch()`). `@layer`
  cannot restyle daisy `.btn`/`.badge`: overrides go unlayered, dark uses the dual selector
  idiom.
- The Compose flow's six load-bearing behaviors (contract ruling 3) survive verbatim.
- The `CsrfField` + `use:enhance` reset trap covers every form this pass authors or touches,
  not Compose alone: the portal Notifications toggle (T3), the household-desk opt-in control
  (T4), any form the email index grows (T6; the settled design has none, filters being
  client state), Compose's existing wiring (T7), and the announce
  form (T10). Each either uses no `use:enhance` at all (the `/my-account/profile`
  precedent, whose own header records the choice) or passes `update({ reset: false })`. A
  bare `use:enhance` on a form carrying `CsrfField` is a diff-reviewer reject; this repo has
  hit it twice (`docs/2026-08-22-events-admin-harvest-findings.md:34-40`), and the household
  desk's own `closeDialogOnSettle` (`members/[id]/+page.svelte:38-43`) still calls a bare
  `await update()`.
- `fakeD1` asserts SQL text only: every data guard lives in the statement itself, and a
  test asserting behavior a statement does not carry is asserting nothing. A stale SQL
  substring key answers `[]` rather than erroring, so a green run against an unchanged key
  is not evidence.
- Membership-wide audience resolution changes only in `segments.ts`'s membership segment
  path. `membersInHouseholds` (`segments.ts:131-146`) is shared with
  `resolveHouseholdSegment` (`:243`) and MUST keep returning every non-archived, emailed
  member of a household unchanged; the audience narrowing happens in a new step above it.
  Class-roster, instructor, and `household:<id>` segments are untouched (contract ruling 2).
- The send log's view selection, filters, and page number are client state over a fully
  loaded row set, matching `assets/+page.svelte:333-344` and `members/+page.svelte:83,363`.
  No filter or page value ever reaches SQL, and nothing about this screen goes into the URL.
- All admin writes stay behind the existing `clubAdminAction` gate; the portal toggle
  writes through the member-portal action wrapper and only ever the signed-in member's
  own row.
- `npm run check` 0 errors 0 warnings and `npm test` exit 0 after every task. No new
  suppressions.
- Visual baselines are CI-canonical: no local `--update-snapshots`, ever, and no local run
  that can mint a missing PNG. Any local e2e run uses `npm run test:e2e -- --ignore-snapshots`
  (Playwright 1.62.1 supports the flag; the config sets no `updateSnapshots` override).
  Regeneration happens once, at close, via `gh workflow run ci.yml -f update_snapshots=true`.
- Comments follow ts-conventions/svelte-conventions; no em dashes in comments.
- Member-facing copy (the portal Notifications sentence) follows the shared web-content
  method's rubric; there is no site content guide (`docs/content-guide.md` does not
  exist).
- Any task that edits `wrangler.toml` runs `npm run types` and commits the resulting
  `worker-configuration.d.ts` diff (or confirms it empty) before its gate.

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/asc-club/0038_club_email_optin/` | Create | `forward.sql`, `rollback.sql`, `verify.sql`, `README.md` (the `0037_asset_request_unique/` shape): `members.club_email_opt_in`, default 0 |
| `migrations/asc-club/0039_email_log_sent_at/` | Create | same four files: `CREATE INDEX idx_email_log_sent_at ON email_log(sent_at)` |
| `e2e/fixtures/bootstrap-club-db.mjs` | Modify | `columnExists` helper plus warm-replica probes for 0038 and 0039 (T1 owns both, so no other task edits this file until T11 adds the seed line) |
| `e2e/fixtures/email-seed.sql` | Create | `email_log` incident cluster, sent rows, a singleton failure, one `announcements` row |
| `src/admin-club/lib/segments.ts` | Modify | audience selection / email projection split, segment labels |
| `src/member-portal/lib/household.ts` | Modify | the one shared opt-in writer, beside `setDirectoryVisibility` (`:131`) |
| `src/admin-club/lib/club-email.ts` | Modify | full-log reader for T5; doc-drift comment fixes for T8 (see the ownership note in T5) |
| `src/admin-club/lib/email-log-groups.ts` | Create | the pure incident-fold over an ordered row array |
| `src/admin-club/lib/email-templates-store.ts` | Modify | known-variable guard gap, stale `withdrawal_notice` key |
| `src/admin-club/lib/email-limits.ts` | Create | quota headroom client, degrade-to-unknown |
| `src/theme/announce-stamps.ts` | Create | `publishedAt` seam over the committed manifest |
| `src/routes/admin/club/email/+page.server.ts` | Modify | serves templates plus the full log |
| `src/routes/admin/club/email/+page.svelte` | Modify | switcher rebuild, filters, chips, register sweep |
| `src/routes/admin/club/email/[id]/+page.svelte` | Modify | register sweep |
| `src/routes/admin/club/email/compose/+page.svelte` | Modify | register sweep, headroom line |
| `src/routes/admin/club/email/compose/+page.server.ts` | Modify | headroom load, `(s)` fix |
| `src/routes/admin/club/announce/+page.server.ts` | Modify | `publishedAt ?? date` ordering |
| `src/routes/admin/club/announce/+page.svelte` | Modify | chip pair, count line, register sweep |
| `src/routes/admin/club/announce/[id]/+page.svelte` | Modify | channel blocks, Discord preview, headroom, copy |
| `src/routes/admin/club/announce/[id]/+page.server.ts` | Modify | headroom load, `(s)` fix |
| `src/routes/(site)/my-account/profile/+page.svelte` | Modify | Notifications section, email toggle |
| `src/routes/(site)/my-account/profile/+page.server.ts` | Modify | the toggle's `portalAction` (actions are inline here) |
| `src/routes/admin/club/members/[id]/+page.svelte` | Modify | admin opt-in control on the roster row |
| `src/routes/admin/club/members/[id]/+page.server.ts` | Modify | the opt-in `clubAdminAction` |
| `src/app.d.ts`, `wrangler.toml` | Modify | headroom token secret, account id var |
| `src/tests/*` | Modify/Create | per task below |
| `e2e/*` | Create | first email/announce admin e2e, visual specs |

## Task 1: the audience model (migrations + resolver + writer)

**Files:** `migrations/asc-club/0038_club_email_optin/`;
`migrations/asc-club/0039_email_log_sent_at/`; `src/admin-club/lib/segments.ts`;
`src/member-portal/lib/household.ts`; `e2e/fixtures/bootstrap-club-db.mjs`;
`src/tests/segments.test.ts`; `src/tests/announcements.test.ts`;
`src/tests/compose-actions.test.ts`.

**Outcome:** both of this pass's migrations, each a directory in this repo's shape
(`forward.sql`, `rollback.sql`, `verify.sql`, `README.md`, matching
`migrations/asc-club/0037_asset_request_unique/`), scratch-proven and applied to remote at
close of the task. A flat `.sql` file is invisible to every applier in this repo, which
enumerates directories (`e2e/fixtures/bootstrap-club-db.mjs:85-91`, `scripts/verify/*.mjs`).
`0038_club_email_optin` adds `members.club_email_opt_in` (integer, not null, default 0).
`0039_email_log_sent_at` adds `CREATE INDEX idx_email_log_sent_at ON email_log(sent_at)`,
which that table has no index of any kind for today; it is performance only, for the
full-log read Task 5 builds, and no query depends on it for correctness. Both migrations
land here so one task owns every edit to the e2e bootstrap script.

`segments.ts`'s membership path factored per the contract's groundwork section. Step one
selects the notification audience and carries membership guards only (`archived_at IS
NULL`, household membership, default-recipient-or-opted-in), selecting id, name, email,
phone, household id, and the default-recipient flag. Step two projects that audience to
email recipients: the non-empty-email filter and the existing case-insensitive dedup with
the primary tie-break live there, unchanged in behavior. No channel-specific predicate
lives in the audience query.

The default recipient per qualifying household is its `primary_member_id` row when that
member is non-archived and has an email, and otherwise the household's earliest-created
non-archived member with an email. A qualifying household with any emailed member never
resolves to zero recipients.

`membersInHouseholds` stays as it is for `resolveHouseholdSegment`'s sake: the narrowing is
a new step above it, never an added predicate inside it. Class-roster and instructor
resolvers untouched.

The two membership segment labels change with the audience: `'Current members'` and
`'Former members'` become `'Current households'` and `'Former households'` at
`segments.ts:180` and `:292-293`, the only places they are minted.

Also add a `columnExists(table, column)` helper (a `PRAGMA table_info` read beside the
existing `tableExists`/`indexExists`) and two warm-replica probes in the else branch at
`e2e/fixtures/bootstrap-club-db.mjs:94-109`: one applying `0038`'s `forward.sql` when
`members.club_email_opt_in` is absent, and one applying `0039`'s when
`idx_email_log_sent_at` is absent (`indexExists` already exists, the `0037` probe's shape).
That file's own header mandates a probe for any migration a warm replica must catch up on;
without it a workstation replica runs the whole e2e suite against a `members` table with no
such column while cold CI passes.

Also add the one shared writer both later surfaces consume,
`setClubEmailOptIn(db, memberId, optedIn)`, in `src/member-portal/lib/household.ts` beside
`setDirectoryVisibility` (`:131`), which is already the single writer the portal profile
action and the admin household desk share for the sibling per-member column. Tasks 3 and 4
import it; neither writes its own UPDATE.

**Acceptance:** segments tests cover, at minimum: head-only default (a two-member
household with no opt-ins resolves to one recipient, the default one); opt-in inclusion; a
default recipient sharing an email with an opted-in member dedups to the default
recipient's name; an overdue household's head included in `current`; a former household's
opted-in member excluded from `current` and included in `lapsed`; never-paid households in
neither; a household with `primary_member_id IS NULL` and one emailed member resolves to
that member; a household whose primary is archived falls back rather than dropping; a
household whose primary has a NULL email falls back; a household with no emailed member at
all resolves to nothing and is not an error; a phone-only opted-in member appears in the
audience and is absent from the email projection; and a `household:<id>` segment still
resolves to BOTH members of a two-member household with no opt-ins (the Members panel's
Email-household action is untouched), asserted against the statement text, not canned rows
alone.

The `fakeD1` SQL substring keys in the touched fixtures are updated to match the new
queries' text: `announcements.test.ts:113,123,134,144,157-158,189,199` and
`compose-actions.test.ts:67,149` all carry `primary_member_id: null` today and expect a
non-primary member reached, and `segments.test.ts:45` and `compose-actions.test.ts:205,261`
assert the old segment labels. A green run against an unchanged key proves nothing.
`src/tests/bulk-email.test.ts` supplies its own segment fixtures, so its `'Current members'`
strings are literals that need no change; confirm by grep rather than by assumption.

Gate green. This task carries the pass's novel correctness-critical logic: dispatch with
`model: opus`.

## Task 2: quota headroom plumbing

**Files:** create `src/admin-club/lib/email-limits.ts`; `src/app.d.ts`; `wrangler.toml`
(a plain `[vars]` entry for the account id; the token is a secret, never a var).

**Outcome:** a function returning `{ quota, sentToday, remaining } | null` from
`GET /accounts/{account_id}/email/sending/limits`, authenticated by a new Worker secret. The
live response body, measured against this account on 2026-08-25, is:

```json
{"result":{"quota":{"value":200,"unit":"day"},"usage":{"sent":0,"over_quota":false,"resets_at":null}},"success":true}
```

Map `quota = result.quota.value`, `sentToday = result.usage.sent`, and
`remaining = Math.max(0, quota - sentToday)`. Treat `success !== true` or a missing
`result.quota.value` as the null path. The success-path test stub uses that literal body
copied verbatim: the implementer writes both parser and stub, so a hand-shaped object is
self-confirming and would leave production reading `undefined` forever.

The fetch carries `signal: AbortSignal.timeout(3000)`; an abort is one of the null paths.
Any failure (missing secret, non-200, abort, thrown fetch) returns null; callers render
"headroom unknown" and never block.

`wrangler.toml` already declares this account id at line 4 as the top-level `account_id`
deploy field, which the Worker runtime cannot read. Add the `[vars]` copy with a comment
pointing at line 4 so the pair reads as one value in two places.

The token is NOT a dispatch prerequisite. Minting it is a Geoff-attended dashboard chore
(the estate's API credential cannot create tokens; verified 2026-08-25), scoped read-only
Email Sending or not minted at all — never a send-capable REST credential (the Worker
already holds the `send_email` binding; contract "Data and infrastructure"). The
implementer codes against the secret name only, with the missing-secret path rendering
"headroom unknown" as a supported state; when Geoff mints it, it installs through the ASC
per-project secret store plus `wrangler secret put` with no code change.

**Acceptance:** unit tests with a stubbed fetch covering the verbatim success body, non-200,
an aborted/timed-out fetch, and a thrown fetch, each of the last three returning null.
`npm run types` run after the `wrangler.toml` edit with its `worker-configuration.d.ts`
diff committed or confirmed empty. `npm run check` clean with the new var and secret named
in `src/app.d.ts`'s `Platform.env`.

## Task 3: the portal Notifications section

**Files:** `src/routes/(site)/my-account/profile/+page.svelte` and
`src/routes/(site)/my-account/profile/+page.server.ts` (actions are inline in that file;
there is no separate action module). The section lands on `/my-account/profile`, beside the
existing directory-visibility preference, NOT on the `/my-account` landing, which is a
settled design under separate review and carries its own visual baselines.

**Outcome:** a Notifications section, one row per channel with email the only row: a
toggle for the signed-in member's own `club_email_opt_in`, off by default, one sentence of
copy saying household announcements otherwise go to the head of household. The section's
markup is shaped so a second channel row is additive. The action mirrors `updateVisibility`
(`profile/+page.server.ts:72-80`): a `portalAction` deriving the member id from `ctx`, never
from the form, calling Task 1's `setClubEmailOptIn`. Do not create a second writer.

**Acceptance:** an action test proving a forged member id in the payload cannot move
another member's flag; a rendering test for both toggle states. Gate green. Depends on
Task 1.

## Task 4: the household desk opt-in control

**Files:** `src/routes/admin/club/members/[id]/+page.svelte` (the Roster `<li>` opening at
`:270`, which already carries the visibility chip, Signatures, Edit, Move and Archive)
and `src/routes/admin/club/members/[id]/+page.server.ts`. This is the household desk, not
the household-grouped Members list at `members/+page.svelte`, which has no per-member row.

**Outcome:** the same flag, admin-set, as an additive per-member control on the household
desk's roster row, written through `clubAdminAction` with an audit row. The handler mirrors
`setVisibility` (`members/[id]/+page.server.ts:158-172`): read `memberId` from the form,
reject a missing or malformed value with a `ctx.audit` rejection row plus `fail(400)`, call
Task 1's `setClubEmailOptIn`, then emit one `ctx.audit({ action, entity: 'member',
entityId, detail })`, and declare the same `{ action, entity, deniedMessage }` opts. No
access-map change: the control inherits `/admin/club`'s Administrator/Club manager key
(`src/theme/access.ts:80`). No other change to the settled screen.

**Acceptance:** an action test in the `src/tests/committees-actions.test.ts` shape, which
injects a `cairnAuditSink` through `locals` (`:24`, `:43`) and asserts the recorded record's
`action`/`entity`/`entityId`/`detail`; audit rows are emitted through that sink, never
through a SQL statement the route composes, so there is no audit INSERT for `fakeD1` to see.
A `fakeD1` assertion covers the UPDATE statement text. The control renders both states.
Gate green. Depends on Task 1 (the writer and the column).

## Task 5: send-log data (full log, grouping)

**Files:** `src/routes/admin/club/email/+page.server.ts`;
`src/admin-club/lib/club-email.ts` (the reader only: raise `listEmailLog`'s cap and add the
deterministic ordering; leave every comment in that file to Task 8);
`src/admin-club/lib/email-log-groups.ts` (new, the pure fold);
`src/tests/email-log-groups.test.ts` (new).

**Outcome:** the load serves the templates list and the whole send log, not a page of it.
`listEmailLog`'s `limit = 100` becomes a guard bound of the most recent 2,000 rows (750
live today) and its statement orders `sent_at DESC, id DESC`, since `sent_at` is
second-granular and `id` is a random UUID, so ties would otherwise repeat or vanish across
a page boundary. The load does no filtering and no paging.

Grouping is a pure exported function over the whole ordered row array, run before any
filtering and before any pagination. Failed rows sharing one `error_detail`, chained at
gaps under an hour, fold into one incident display unit carrying the count, the first and
last `sent_at`, the error, and the distinct templates involved; every other row is its own
display unit. Runs are computed over failed rows alone, so a sent row inside an incident's
window neither joins nor splits it and takes its own chronological position. The function's
signature takes an ordered row array and returns display units, so the unit tests call it
directly.

The `email_log(sent_at)` index this read wants ships in Task 1 as migration
`0039_email_log_sent_at`, so that one task owns every migration and every e2e bootstrap
edit. Nothing here depends on it for correctness.

**Ownership note:** Tasks 5 and 8 both touch `src/admin-club/lib/club-email.ts`. Task 5
owns the reader (statement and cap), Task 8 owns the comments. They are NOT co-runnable;
T8 dispatches after T5.

**Acceptance:** unit tests on the grouping function: the live cluster's shape (471 failed
rows, one `error_detail`, 08:07:11 to 08:15:55, folding to exactly one unit whose count
reads 471 and whose window spans the full nine minutes); a singleton failure; two clusters
separated by more than an hour; a sent row inside a failure window that does not split the
incident; and the same input grouping identically whether or not an outcome filter is
later applied. A test against the real remote data is not required; fixtures mirror it.
Gate green. Independent of T1–T4.

## Task 6: the email index screen (gated on probe verdicts)

**Files:** `src/routes/admin/club/email/+page.svelte`.

**Outcome:** one `OfficeList` behind an `aria-pressed` Templates / Send log switcher
(client `$state`, the assets pattern at `assets/+page.svelte:333-344`); `itemNoun` subtitle
naming the active view's real count; zebra on both tables; `EmptyState` for empty views;
error shown in subtitle plus `role="alert"` banner, never in the empty cell; send-status
chips through `StatusChip` on the imported chip registers with their marker spans (sent
quiet, failed warning); incident rows per the probe's settled presentation; the send-log
row keeping its Segment column.

The send-log view carries two labeled `<select>` filters over the loaded set: outcome
(all / sent / failed) and template (every distinct `template_id` in the log). The outcome
filter selects among the grouped display units (failed shows incidents plus failed
singletons, sent shows sent rows, all shows everything); the template filter narrows within
a group, so a template-filtered incident states its filtered count. Beside them a visible
`role="status" aria-live="polite"` count line built from `computeCountLine`, naming the
applied filters, matching `events/+page.svelte:482-484`. No `ListToolbar`: its `search` and
`onSearch` props are required, and this pass adds no search box. `Pagination` pages the
grouped display units client-side, the `members` screen's idiom
(`members/+page.svelte:68,83,199-201,363-370`). Filters, view, and page are all client
state; none of them reaches SQL or the URL.

**Acceptance:** the probe verdicts are reflected one for one; filtering to `failed` leaves
the 2026-07-14 incident row present and the sent rows gone; filtering to a single template
narrows the incident row's own count; `scrollWidth === clientWidth` at 390 with an incident
row expanded; `node scripts/verify-chip-registers.mjs` green unchanged (the registers are
reused, not re-tuned), plus a rendered assertion that the Sent and Failed chips differ in
INK rather than ground, since the dark theme's two grounds are luminance-identical by design
(`admin-chip-registers.css:60-70`) and a ground-only comparison passes while the two states
read the same. Gate green. Depends on Task 5 and the probe settle.

## Task 7: Compose register sweep + headroom

**Files:** `src/routes/admin/club/email/compose/+page.svelte` and its `+page.server.ts`;
`src/tests/compose-component.test.ts` (new); `src/tests/compose-actions.test.ts` (T1 owns
that file's fixture and segment-label updates; T7 only appends the headroom cases).

**Outcome:** the compose screen at the register bar with its flow untouched: dead classes
replaced, banners `{#if}`-gated, blast history zebra-striped with `EmptyState`,
`itemNoun` for the recipient-count label, the failed-count badge on the warning tint (with
the per-page chip-registers import and its marker span), the server-side literal `(s)`
fixed (`compose/+page.server.ts:142`). Review step shows the headroom line (quota, sent
today, remaining, from Task 2) and one muted line reading that a membership-wide send is one
email per household (the head of household plus anyone opted in); the confirm dialog adds a
plain warning sentence when the resolved count exceeds remaining; unknown headroom renders
as unknown and never blocks. The segment labels themselves come from Task 1 and are rendered
here verbatim.

Per contract ruling 3, if the register sweep leaves the variable palette
(`compose/+page.svelte:216-224`) reading as assembled, file it as a fourth probe subject
rather than inventing an idiom; otherwise record in the harvest that it was judged settled
without a probe.

**Acceptance:** existing compose-actions tests still green, extended for the headroom
presence in review and the over-headroom warning path. The six load-bearing behaviors each
covered by an assertion: the confirm gate cites `compose-actions.test.ts:244` and the
editor-targeted test send cites `:215`, and the four the server tests cannot reach get the
new component test file. That file asserts each of them: draft values survive a `review`
response (`update({ reset: false })`,
`+page.svelte:103-107`), a `?segment=` preset seeds `segmentKey` once through `untrack`
(`:37-39`) and a later prop change does not re-seed it, the preview subject and html come
from `renderTemplateWithVariables` (`:49`), and `insertVariable` splices `{{token}}` at the
textarea's `selectionStart`/`selectionEnd` (`:130-139`). Existing Svelte component suites
(`toolkit-table.test.ts`, `events-page.test.ts`) are the shape to follow. `npx cairn-audit`
static reports zero `no-uncompiled-class` errors on this route. Gate green. Depends on
Task 2.

## Task 8: template edit sweep + guard gap + doc drift

**Files:** `src/routes/admin/club/email/[id]/+page.svelte`;
`src/admin-club/lib/email-templates-store.ts`; `src/admin-club/lib/club-email.ts`
(comments only); `src/tests/email-templates-store.test.ts`.

**Outcome:** the template editor at the register bar: dead classes replaced (`w-fit`,
`text-warning`, `text-success`, `max-w-none`, `btn-warning`) and the preview released from
the prose max-width. The banners here are already `{#if}`-gated
(`email/[id]/+page.svelte:80-95`), so nothing to do there. The Reset confirm's dead
`btn-warning` goes with the other dead classes; the button keeps the plain `btn` chrome in
its existing modal, and a warning button register is harvest material rather than a
site-side invention (this site has a settled `.btn-error` destructive-confirm tier,
`asc-components.css:795`, and no warning tier, and `decisions.md` carries no button-register
entry).

The eight shipped templates absent from `KNOWN_TEMPLATE_VARIABLES` join it:
`board_join_notice`, `class_day_before`, `class_followup`, `class_refund_window`,
`class_week_out`, `class_welcome`, `join_welcome`, `stripe_payment_receipt` (counted against
the live `email_templates` table on 2026-08-25: 21 ids live, 14 in the map). Each
vocabulary is the variable set that template's SENDER passes, read from its call site, never
scanned off a stored body; `email-templates-store.ts:9-17` records why the map is the thing
a body is checked against. The call sites are `src/jobs/class-reminders.ts:151-160`
(`class_week_out`, `class_day_before`, `class_followup`, all three taking the same five
vars), `src/jobs/class-refund-window-notice.ts:116-125`,
`src/admin-club/lib/class-welcome.ts:50-59` (`class_welcome`), and
`src/admin-club/lib/stripe-reconcile.ts:223,286,358`
(`stripe_payment_receipt`, whose vars spread `receiptVars(...)` and must be expanded to its
real key set), `:605-618` (`join_welcome`), and `:621-630` (`board_join_notice`).
`withdrawal_notice` is a map key with no template row and is removed.

`club-email.ts`'s stale comments corrected in the same task (the "Empty today" claim; the
`email_log.segment` vocabulary listing what writers actually emit: `blast:<id>`,
`blast-test`, `announce:<postId>`).

**Acceptance:** a test asserting each new map entry equals its sender's `vars` key set (the
three reminders take exactly `person_name`, `item_display_name`, `start_date`, `location`,
`committee_email`), plus a negative test that a body using a token outside a template's
vocabulary is reported by `findUnknownVariables` and one that a token the sender does pass
but the shipped body does not yet use (`{{committee_email}}` on `class_followup`) is NOT
reported. A test asserting `KNOWN_TEMPLATE_VARIABLES` names every template id the repo's own
migrations seed, so a future seeded template cannot silently reopen the gap. Editor renders
unchanged behaviorally; `npx cairn-audit` static reports zero `no-uncompiled-class` errors on
this route. Gate green. Depends on Task 1 (shared `compose-actions.test.ts`, per the Files
note) and Task 2, and dispatches after Task 5 (shared file, see T5's ownership note).

## Task 9: announce list (ordering + chips)

**Files:** `src/theme/announce-stamps.ts` (new); `src/routes/admin/club/announce/+page.server.ts`
and `+page.svelte`; `src/tests/announce-list-order.test.ts` (new; kept its own file because T1 owns
`announcements.test.ts`).

**Outcome:** the new `$theme` seam reads the committed manifest with an eager
`import.meta.glob('../content/.cairn/index.json', { eager: true, import: 'default' })`,
the idiom `src/theme/cairn.config.ts:144` already uses for `media.json`, types it against
`Manifest`/`ManifestEntry` (exported from the package root, `dist/index.d.ts:23`), and
exposes a `Map<postId, publishedAt>` over `entries` where `concept === 'posts'`. The route
never imports the manifest JSON itself. The row source stays `posts.all()`
(`announce/+page.server.ts:26`), so draft filtering and concept typing stay engine-owned.

Ordering is an exported pure function taking the post rows plus that stamp map and returning
the sorted list, so the test supplies a stamped entry directly and no test reads the real
manifest. The comparison normalizes both shapes to epoch milliseconds: `publishedAt` is a
full ISO instant, a bare `date` is that civil day at UTC midnight. Never a raw string
compare. Sort first, slice to `RECENT_POST_LIMIT` second.

The Announced column becomes the chip pair (announced quiet, not-yet hairline outline,
superseding the em-dash rule), with the per-page `$theme/admin-chip-registers.css` import
and the marker spans. The chip marks state only: the row keeps its date column, and an
announced row keeps the detail `announcedLabel` builds today (`+page.svelte:20-27`: the
timestamp, `email to N`, and `#channel`) as muted text beside the chip, minus the leading
`Announced` word the chip now supplies. Also: the stray `sr-only` count
(`+page.svelte:30`) replaced by a visible `role="status" aria-live="polite"` line built from
`computeCountLine`, rendered inside `OfficeList` above the table, matching
`events/+page.svelte:482-484`. No `ListToolbar` is added: this list has no search and no
filters. Zebra; `EmptyState`.

**Acceptance:** an ordering unit test where a backdated `date` with a newer `publishedAt`
sorts first (stamp a fixture entry, call the pure function); an ordering test where an
unstamped entry falls back to `date`; chip mapping tests; a rendering test that a row
announced with `emailCount: 12` and a Discord channel still shows both facts; the count line
renders inside `OfficeList`. Gate green. Chip presentation follows the probe settle; the
ordering half is independent and may land first.

## Task 10: announce form (channel blocks + Discord preview + headroom)

**Files:** `src/routes/admin/club/announce/[id]/+page.svelte` and its `+page.server.ts`.

**Outcome:** the two-column `lg:grid-cols-2` layout (`+page.svelte:78-133`: every control in
the left `<section>` under one shared "Where to send" `<fieldset>` at `:88-107`, both
previews stacked in the right `<section>` at `:110-132`) is rebuilt into per-channel blocks:
a shared header block (subject, summary, the shared-summary note), then one block per
channel carrying that channel's own enable control,
its channel-specific controls, and its own preview. This is a layout rebuild, not a restyle,
and it follows the probe's third subject's settled verdict. A third channel block joins as
another row without rework, which is the point (contract groundwork).

Also: the Discord preview given the accent border and preserved newlines its dead classes
were meant to provide; the headroom line beside the send control (Task 2); dead classes
replaced; the server-side `(s)` fixed (`announce/[id]/+page.server.ts:145`); the email
channel's control relabeled `Email current households` (`+page.svelte:92` reads "Email all
current members" today, which ruling 2 makes false) with one short line saying the send is
one email per household. The single-summary two-preview contract, re-announce warning, and
`untrack` plus `{#key}` seeding survive verbatim.

**Acceptance:** existing announce-actions and announcements tests green; a rendering
assertion that each channel block contains its own enable control and its own preview
element (email block: `emailAll` plus the email preview; Discord block: `notifyDiscord` plus
the channel select plus the Discord preview); both previews render from the one `message`
value; a rendering assertion on preserved newlines in the Discord preview; the probe
verdicts reflected one for one; `npx cairn-audit` static reports zero `no-uncompiled-class`
errors on this route. Gate green. Depends on Task 2 and the probe settle.

## Task 11: e2e and visual coverage

**Files:** `e2e/fixtures/email-seed.sql` (new) and its application line in
`e2e/fixtures/bootstrap-club-db.mjs`; new specs under `e2e/` using
`e2e/helpers/admin-session.ts` (`mintAdminSession`) for the five admin screens and
`e2e/helpers/member-session.ts` (`mintMemberSession`, default member `portal-mem-primary`
from `e2e/fixtures/portal-seed.sql`) for the portal Notifications round-trip. The two
helpers write different databases and set different cookies (`cairn-asc-auth` /
`cairn_session` against `asc-club` / `asc-member`); never substitute one for the other.

**Outcome:** the e2e replica has no `email_log` and no `announcements` rows today, so the
new seed supplies them, applied last in `bootstrap-club-db.mjs`, after `assets-seed.sql`
(which carries its own "MUST run last" comment today; this seed goes after it): a synthetic same-error failure cluster large enough to span more than one page of
grouped display units, sharing one `error_detail`, timestamps inside one hour, across two
template ids; a handful of sent rows outside it; one singleton failure; and one
`announcements` row so both halves of the announced chip pair render.

The first email and announce admin e2e: the index switcher (both views reachable,
`aria-pressed` correct), an incident row expanding, an outcome filter narrowing the log,
compose's review step showing the count and the confirm dialog requiring acknowledgment, the
announce form rendering both channel blocks' previews, and the portal Notifications toggle
round-tripping. Visual snapshots added for the five admin screens and the portal section at
the family viewports, including the stacked-field register on the announce form (the
standing carry-forward). Functional specs and visual specs go in separate files, following
the repo's own `*-visual.spec.ts` naming.

**Acceptance:** `npm run test:e2e -- --ignore-snapshots` green locally: the functional specs
assert, and every screenshot comparison is skipped, so Playwright cannot mint a workstation
baseline (its default `updateSnapshots: "missing"` writes the PNG and fails the test on a
first run, which is what broke CI on 2026-07-15). Before commit, `git status --porcelain
e2e/` must show no new PNG; delete any that appeared. The new visual specs are committed with
no baselines, and the PR's visual job is expected red until the CI dispatch at close mints
them. Gate green. Depends on all prior tasks.

## Pass-end checklist

- [ ] `code-simplifier` agent (plugin name `code-simplifier:code-simplifier`) on changed code
- [ ] Quality gate: `npm run check` (0/0), `npm test` (exit 0), `npm run build`,
      `npm run probe:design`, `npm run verify:chips`, and `npx cairn-audit` static reporting
      zero `no-uncompiled-class` errors on the five routes in this pass (17 today)
- [ ] Review gate: svelte-reviewer, daisyui-a11y-reviewer, cloudflare-workers-reviewer,
      web-auth-security-reviewer (the portal toggle and new secret make this one mandatory)
- [ ] Fresh-context coherence read at 390 and 1440 on the five screens
- [ ] Visual baselines via `gh workflow run ci.yml -f update_snapshots=true`; read the log
- [ ] PR, merge on green, deploy to dev (standing pre-cutover authorization)
- [ ] Harvest findings doc (`docs/2026-08-25-email-announce-harvest-findings.md`); the
      StatusChip third-consumer consolidation evidence belongs here, along with the headroom
      token's scope branch, the variable-palette probe judgment, the missing warning button
      register, whether the Communication roles should get an opt-in setter, and the two
      cutover items the contract routes here (the `ORIGIN` hardcode in mailed post URLs,
      the missing `reply_to` threading)
- [ ] `decisions.md` settle entry, recording the `currentMemberEmails` overdue-widening
      walkthrough as closed-confirmed (contract ruling 4); `docs/HISTORY.md` entry
- [ ] `ROADMAP.md`: move Email + Announce out of `admin-screen-passes`'s remaining-screens
      sentence (`ROADMAP.md:63`) into the "Shipped so far" list (`:60`)
- [ ] `docs/STATUS.md`: new starter prompt, and remove the three items this pass closes
      (the 0.94 `publishedAt` announce-list recency carry-forward, the stacked-field
      baseline coverage carry-forward, and the "07-15 apology-send verification" queue item
      per contract ruling 9), moving anything historical to `docs/HISTORY.md` rather than
      deleting it
- [ ] Archive this plan to `docs/plans/archive/` if that convention exists, else leave in
      place per repo practice
- [ ] Geoff's before/after on dev; budget scored against the 2.5M ceiling
