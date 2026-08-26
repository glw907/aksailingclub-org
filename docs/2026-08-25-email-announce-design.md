# Email + Announce admin: the design contract

Brainstormed with Geoff on 2026-08-25 and ratified in that sitting, with the audience-model
ruling added later the same day. This is the Email + Announce pass in the
`admin-screen-passes` series (`ROADMAP.md`), covering the five screens under
`/admin/club/email` and `/admin/club/announce`, their shared library modules, and one
addition to the member portal. The factual ground is the prep brief
(`docs/2026-08-25-email-announce-prep-brief.md`); the bar is the settled admin register
(`docs/design-benchmark/decisions.md`, the chip-register and table-register entries) and the
resolved-craft catalogue (`docs/2026-07-15-asc-invisible-polish-brief.md`).

## The rulings

1. **The pass shape.** One pass, roughly eleven tasks. Announce-on-publish stays out: the
   pass consumes the `publishedAt` seam only as the list-recency rider, and auto-announcing
   a newly published post is its own future pass with its own persistence decision and
   probe. Announce-list ordering becomes `publishedAt ?? date` descending, because every
   entry is unstamped today and `ContentSummary` does not carry the field. The stamp is read
   site-side through one new `$theme` seam over the committed manifest
   (`src/content/.cairn/index.json`, an eager `import.meta.glob`, the idiom
   `src/theme/cairn.config.ts:144` already uses for `media.json`). The row source stays
   `posts.all()`, so draft filtering and concept typing stay engine-owned. The two keys are
   different shapes and normalize before they are compared: `publishedAt` is a full ISO
   instant, `date` is a civil day read at UTC midnight, and both become epoch milliseconds.

2. **The audience model.** Membership-wide sends go to each household's head, not to every
   member. A new opt-in column on `members` (`club_email_opt_in`, integer, not null,
   default 0) lets any other household member receive club email too: self-serve in the
   member portal, and admin-set on the member's row in the household desk. The
   membership-wide segments (`current`, `lapsed`) resolve to one default recipient per
   qualifying household plus that household's opted-in members. The default recipient is the
   `primary_member_id` row when that member is non-archived and carries an email, and
   otherwise the household's earliest-created non-archived member with an email. A
   qualifying household with any emailed member never resolves to zero recipients; a
   household with no emailed member at all resolves to nothing, exactly as today. Announce
   inherits the change through `currentMemberEmails`, which stays a thin
   `resolveSegment('current')` caller. Class-roster, instructor, and `household:<id>`
   segments stay per-member as today: enrollment is its own opt-in, and emailing one named
   household deliberately reaches every member of it. The data supports the default with no
   gap, measured 2026-08-25: all 149 households carry a `primary_member_id`, and every one
   of those primaries has an email address. That measurement is a snapshot; the fallback
   above is what makes it a rule. The two membership segment labels change with the
   audience: `Current members` and `Former members` become `Current households` and `Former
   households` wherever they are minted or rendered.

3. **Compose's flow.** The three-step machine (audience, compose, review) stays in one
   route, structurally as built. The pass restyles it to the settled register and touches
   nothing in the flow. Six behaviors survive verbatim:
   - the count-confirm gate (server-resolved count in the dialog heading and button text,
     `confirm=on` required by `?/send`);
   - test-send always targeting the signed-in editor, never advancing the draft;
   - draft carry across steps via `update({ reset: false })`;
   - the `?segment=` deep link seeded once with `untrack`;
   - live preview through the real `renderTemplateWithVariables` path;
   - cursor-position insert from the variable palette.

   The `CsrfField`-plus-`use:enhance` reset trap has been filed twice. This pass does not
   reopen Compose's own wiring, and every other form it authors or touches either uses no
   `use:enhance` at all (the `/my-account/profile` precedent) or passes
   `update({ reset: false })`.

4. **Announce's reach.** No segment picker. Announce means "tell the club", and Compose
   already exists for targeted email. The audience widening to overdue households is
   confirmed as correct (overdue keeps full member benefits under the settled standing
   model), so the walkthrough flag on `currentMemberEmails` closes. With ruling 2, a
   whole-club announcement resolves to 89 households plus opt-ins, measured live
   2026-08-25 through the classifier's own rule (85 current, 4 overdue; 58 former and 2
   never-paid households excluded). The Former-transition sweep rides the disabled cron,
   so an overdue household lingers in this audience until cutover re-enables it.

5. **The send log.** The email index becomes one `OfficeList` behind an `aria-pressed`
   Templates / Send log switcher, the assets pattern. The load serves the whole log rather
   than a page of it: `listEmailLog`'s 100-row cap is raised to a guard bound of the most
   recent 2,000 rows (750 live today), ordered `sent_at DESC, id DESC` so ties page
   deterministically. Grouping runs over that whole chronology once, before any filtering
   and before any pagination. Failed rows sharing one `error_detail`, chained at gaps under
   an hour, fold into a single incident row carrying the count, the time window, the error,
   and the templates involved; expanding it reaches the member rows inside the incident.
   Runs are computed over failed rows alone, so a sent row inside an incident's window
   neither joins nor splits it and renders in its own chronological position. The outcome
   filter then selects among the grouped display rows (failed shows incidents plus failed
   singletons, sent shows sent rows, all shows everything), and the template filter narrows
   within a group, so a template-filtered incident states its filtered count. Filters, the
   active view, and the page number are all client state over the fully loaded set, the
   `members` screen's own idiom; nothing about this screen goes into the URL. The 2026-07-14
   quota incident (471 of the 750 live rows) is the case the grouping exists for. The rows
   stay: failed sends are the audit trail of the incident and are deliberately preserved.

6. **Failed status.** Send status maps onto the settled three-register chip grammar. Sent
   takes the quiet tint and failed takes the warning tint. No red error register is minted;
   whether the toolkit ever grows one rides the StatusChip engine ask (this pass is its
   third consumer) as harvest material, not a site-side invention. The announce list's
   Announced column becomes chips on the same grammar: the quiet tint marks announced, the
   hairline outline not-yet-announced. This supersedes the brief's em-dash-not-blank rule
   for never-announced rows; the hairline outline carries what the em dash was carrying.
   Each chip pair marks state and nothing else. An announced row keeps its date column and
   the detail its cell carries today (the email count and the Discord channel) as muted text
   beside the chip, and a send-log row keeps its Segment column; nothing the current cells
   carry is discarded.

7. **Quota headroom.** The account's Email Sending quota was measured at 200 messages per
   day on 2026-08-25 (`GET /accounts/{id}/email/sending/limits`), whose live body is
   `{"result":{"quota":{"value":200,"unit":"day"},"usage":{"sent":0,"over_quota":false,"resets_at":null}},"success":true}`.
   The screens' quota, sent-today, and remaining figures are read out of that nested shape,
   never a flat triple. A member-level whole-club
   blast approaches or exceeds that ceiling, which is what prompted ruling 2; under the
   household model the same send is 89 emails plus opt-ins and fits with margin. The compose
   review step and the announce form still show live headroom (quota, sent today,
   remaining) before the send, and the confirm dialog warns plainly when the resolved
   recipient count exceeds it. The 2026-07-14 ruling stands. There is no hard cap on
   deliberate admin sends, and the gate is a human seeing the number. A send taken past
   headroom proceeds, and the overflow attempts fail into the log as ordinary rows
   (`sendClubEmail` never throws). When the limits call fails, the screen says headroom is
   unknown and never blocks. Requesting a quota increase from Cloudflare is a
   Geoff-attended margin item worth filing before cutover, off this pass's critical path.

8. **The template guard.** Every shipped template joins `KNOWN_TEMPLATE_VARIABLES`. Eight
   are absent today, counted against the live `email_templates` table on 2026-08-25 (21 ids
   live, 14 in the map): `board_join_notice`, `class_day_before`, `class_followup`,
   `class_refund_window`, `class_week_out`, `class_welcome`, `join_welcome`, and
   `stripe_payment_receipt`. All eight have real senders, and `findUnknownVariables` returns
   `[]` for each of them today, so their editors warn on nothing. Each new vocabulary is the
   variable set that template's SENDER passes, read from the call site, never scanned off a
   stored body: the map is the thing a body is checked against, as
   `email-templates-store.ts:9-17` records. Conversely `withdrawal_notice` is a map key with
   no template row and is removed. Renaming, grouping, and subject-line work on the roughly
   22 templates is content work and is deferred.

9. **The apology chore.** Geoff sent the 2026-07-15 apology himself, outside the site,
   superseding the brief's section 2, which had it still queued. No `migration_apology`
   rows will ever land in `email_log`; the standing "apology-send verification" queue item
   drops from STATUS, and the log ships against the incident data alone.

## The screens

**Email index** (`/admin/club/email`). One `OfficeList`, Templates / Send log switcher,
subtitle counts through `itemNoun` naming whichever view is active. Templates view: the
template list, zebra-striped, with the edit link. Send log view: recent-first rows
(recipient, template, segment, outcome chip, time), two labeled `<select>` filters for
outcome and template, a visible count line, incident rows inline where a failure cluster
collapses, and `Pagination` over the grouped display rows. No `ListToolbar`: the toolkit's
toolbar requires a search box, and this pass adds no search. An error no longer renders in
the empty cell. It shows in the subtitle and a `role="alert"` banner, and `EmptyState` is
reserved for genuinely empty views.

**Template edit** (`/admin/club/email/[id]`). Register sweep only: dead classes replaced and
the prose preview released from the prose max-width. Behavior unchanged. The banners here
are already `{#if}`-gated, so the gating item is compose's alone. The Reset confirm's dead
`btn-warning` goes with the other dead classes and the button keeps the plain `btn` chrome
in its existing modal; this site has a settled destructive-confirm tier (`.btn-error`,
`src/theme/asc-components.css:795`) and no warning tier, and minting one is a settle
question rather than a sweep, so it goes to the harvest.

**Compose** (`/admin/club/email/compose`). Register sweep plus the headroom line in review
and the warning in the confirm dialog. The failed-count badge takes the warning tint. Blast
history gets zebra and `EmptyState`. The review step gains one muted line reading that a
membership-wide send is one email per household. The variable palette keeps its current
interaction. Its visual treatment goes to the probe only if the register sweep leaves it
looking assembled, and the judgment either way is recorded in the harvest.

**Announce list** (`/admin/club/announce`). Ordering by `publishedAt ?? date` descending.
The Announced column becomes the chip pair of ruling 6, beside the date and the existing
announced detail. Zebra, `EmptyState`, and the stray `sr-only` count replaced by a visible
`role="status"` count line built from `computeCountLine`, matching the line the events
screen renders (`events/+page.svelte:482-484`) without adding a toolbar.

**Announce form** (`/admin/club/announce/[id]`). The two-column grid is rebuilt into
per-channel blocks: a shared header block (subject, summary, the shared-summary note), then
one block per channel carrying that channel's own enable control, its channel-specific
controls, and its own preview. That is a layout rebuild rather than a restyle, so it is the
probe's third subject. The Discord preview gets the accent border and preserved newlines its
dead classes were meant to provide. Headroom line beside the send control. The email
channel's control reads `Email current households`, matching ruling 2. The single-summary
two-preview contract, the re-announce warning, and the `untrack` plus `{#key}` seeding idiom
survive verbatim. The stacked-field register baseline coverage carry-forward lands here.

**The opt-in surfaces.** In the member portal, a Notifications section on
`/my-account/profile`, beside the directory-visibility preference and not on the settled
`/my-account` landing, one row per channel with email the only row this pass: receive club
email, off by default, with one sentence saying household announcements otherwise go to the
head of household. The section is shaped so the notifications pass's SMS row joins it later
without rework. In the admin, the same flag as an additive control on the household desk's
roster row (`/admin/club/members/[id]`), the screen that already owns every per-member
action. Both write the one column through one shared writer; neither touches standing or
segments beyond it. The admin control inherits the Members tree's own access key
(Administrator and Club manager, `src/theme/access.ts:80`). Webmaster and Publisher reach
the flag only through what Compose and Announce show them, which is deliberate: editing a
member row is a Club act rather than a Communication one. Whether the two Communication
roles should get a setter of their own is harvest material, not this pass.

## The mechanical sweep

Everything in the brief's tiers 1 and 2 executes as rollout, with no further rulings
needed:

- the 17 dead classes across compose, template edit, and the announce form, proved cleared
  by a `npx cairn-audit` static run reporting zero `no-uncompiled-class` errors on these
  five routes;
- zebra on the four tables (email templates, send log, compose blast history, announce
  list);
- `EmptyState` for the four empty views;
- `itemNoun` subtitles, replacing the manual ternaries;
- the two server-side literal `(s)` strings;
- the per-page `$theme/admin-chip-registers.css` import on every screen with a chip, each
  `StatusChip` wrapped in its register's marker span (`asc-admin-chip-quiet`,
  `-warning`, `-outline`) per that stylesheet's own usage block, since the import alone is
  inert without the wrapper;
- banner `{#if}` gating where compose keeps empty `role="alert"` elements in the DOM;
- error-versus-empty separation on the email index;
- the `club-email.ts` doc drift (the "Empty today" comment, and the `email_log.segment`
  vocabulary, which actually carries `blast:<id>`, `blast-test`, and `announce:<postId>`).

## Data and infrastructure

Two migrations, both additive, each a directory in this repo's own shape (`forward.sql`,
`rollback.sql`, `verify.sql`, `README.md`, matching `migrations/asc-club/0037_asset_request_unique/`),
scratch-proven and then applied to the live database: `0038_club_email_optin` adds the
opt-in column on `members`, and `0039_email_log_sent_at` adds `email_log(sent_at)`, a table
that carries no index of any kind today. The second is performance only. No schema
change beyond the opt-in column and that index: incident grouping is a query and
presentation concern, not a migration. Each migration also gets its own warm-replica
catch-up probe in `e2e/fixtures/bootstrap-club-db.mjs`, which that file's header requires of
any migration a warm local replica must catch up on. Segment resolution keeps its chunking
at D1's parameter cap and its shared-email dedup (which already prefers the household
primary); the membership-wide resolvers change per ruling 2, and the pre-inserted blast
audit row is untouched. The headroom check reads one optional Worker secret: a Cloudflare
API token on this account with a read-only Email Sending permission. Minting it is a
Geoff-attended dashboard chore, because the estate's API credential deliberately lacks
`API Tokens Read/Write` (verified 2026-08-25: it can neither enumerate permission groups
nor create tokens). If the dashboard offers no read-only Email Sending permission, no
token is minted at all — the Worker already holds an unrestricted `send_email` binding,
and a send-capable REST credential would only widen the surface — and the screens show
headroom as unknown, with the gap noted in the harvest. When minted, the token installs
through the ASC per-project secret store and `wrangler secret put`, and is named in
`src/app.d.ts`; until then the feature ships in its degraded state, which is a supported
state, not an error. The cron trigger stays disabled until `mw-cutover`.

## Groundwork for the notifications pass

The SMS ruling (Geoff, 2026-08-25) lands as its own `club-notifications` initiative on
`ROADMAP.md`, and this pass lays its groundwork deliberately rather than incidentally:

- **Per-channel opt-in columns.** Migration `0038` adds the email opt-in as its own column;
  the SMS pass adds `sms` as a later additive migration. No generic preferences table or
  blob for two known channels.
- **Audience selection split from channel projection.** The membership-wide resolver is
  factored in two steps: first the notification audience (each qualifying household's
  default recipient plus its per-channel opt-ins), then the projection of that audience to
  email addresses. The split is only worth having if the channel filter sits on the right
  side of it: the audience step carries membership guards alone (`archived_at IS NULL`,
  household membership, default-recipient-or-opted-in) and selects id, name, email, phone,
  household id, and whether the row is the household's default recipient. The email
  projection is where a non-empty email is required and where the existing case-insensitive
  dedup with the primary tie-break happens. A phone-only member therefore appears in the
  audience and is absent from the email projection. The SMS pass reuses the audience step
  and adds a phone projection (member phones are already E.164 on every write path); the
  household logic is never forked.
- **Parallel announce channel blocks.** The announce form's two-column layout is rebuilt
  into structurally uniform per-channel blocks (email, Discord), each carrying its own
  enable control and its own preview, so the SMS block and its short-text preview join as a
  third row without rework. That rebuild is the probe's third subject, since it is a layout
  change rather than a restyle.
- **The portal Notifications section** grows by row per channel, as ruled above.
- **`email_log` stays email's own.** Generalizing the audit table into a channel-generic
  log now would be speculative surgery; the SMS pass gets its own delivery log and reuses
  the log-view register this pass builds (pagination, incident grouping, outcome chips).

## Process

The probe-iteration process governs the visual work. One probe page, built from the dev
shell with compiled CSS per the standing pattern, grounded in the live `email_log` rows and
rendered in both themes at 1440 and 390, carries three probe subjects: the send-log
presentation (incident row collapsed and expanded, sent and failed chips, the switcher
context), the announced-state chip pair, and the announce form's channel-block composition
(the shared header block plus two per-channel blocks, each with its own preview). The
audience model needs no probe; it has no visual surface beyond a toggle. Geoff verdicts
async; the settle lands in `decisions.md`.

The plan runs in workflow mode (`~/.claude/workflows/pass-execute.js`) at roughly eleven
tasks, per the six-or-more rule. The build runs on its own branch through the full gate,
extends the fourteen existing unit suites rather than duplicating them (the segments suite
carries the audience-model tests), and adds the first email and announce admin e2e: the
admin screens through `e2e/helpers/admin-session.ts` and the portal Notifications
round-trip through `e2e/helpers/member-session.ts`, which writes a different database and
sets a different cookie and is never interchangeable with the admin helper. The e2e replica
has no `email_log` or `announcements` rows today, so the pass ships its own fixture seed for
both. Visual baselines regenerate only through `ci.yml`'s `update_snapshots` dispatch. The
pass closes with the reviewer fan-out, the fresh-context
coherence read at 390 and 1440, Geoff's before/after on dev, the harvest-findings doc, and
the `decisions.md` settle.

## Out of scope

Announce-on-publish and the SMS channel, which together form the notifications initiative
on `ROADMAP.md` (Twilio or equivalent, A2P 10DLC registration, STOP handling, an SMS
delivery log, and the on-publish hook; member phones are already E.164 on every write
path, and per-channel opt-in columns make SMS a later additive migration). Template
renaming, grouping, and subject content. Drafts, scheduling, Discord on compose, open and click tracking, and ad-hoc
recipient lists (segment-email's standing exclusions). The `ORIGIN` hardcode in mailed post
URLs and the missing `reply_to` threading, which are cutover work and go in the harvest.
Re-enabling the cron trigger. The Cloudflare quota-increase form, which is Geoff's to file.
The deferred assets-register carry-forwards (`db.batch()` on the money path, the
review-inbox N+1) stay deferred; neither belongs to these screens.
