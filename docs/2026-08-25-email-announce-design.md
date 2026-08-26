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
   probe. Announce-list ordering becomes `publishedAt ?? date` descending, read from the
   manifest directly, because every entry is unstamped today and `ContentSummary` does not
   carry the field.

2. **The audience model.** Membership-wide sends go to each household's head, not to every
   member. A new opt-in flag on `members` (migration, default off) lets any other household
   member receive club email too: self-serve in the member portal, and admin-set on the
   member's row in the household desk. The membership-wide segments (`current`, `lapsed`)
   resolve to the primary member of each qualifying household plus its opted-in members;
   Announce inherits the change through `currentMemberEmails`, which stays a thin
   `resolveSegment('current')` caller. Class-roster and instructor segments stay per-member
   as today: enrollment is its own opt-in. The data supports the default with no gap,
   measured 2026-08-25: all 149 households carry a `primary_member_id`, and every one of
   those primaries has an email address.

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

   The `CsrfField`-plus-`use:enhance` reset trap has been filed twice; this pass does not
   reopen that surface.

4. **Announce's reach.** No segment picker. Announce means "tell the club", and Compose
   already exists for targeted email. The audience widening to overdue households is
   confirmed as correct (overdue keeps full member benefits under the settled standing
   model), so the walkthrough flag on `currentMemberEmails` closes. With ruling 2, a
   whole-club announcement resolves to 89 households plus opt-ins, measured live
   2026-08-25 through the classifier's own rule (85 current, 4 overdue; 58 former and 2
   never-paid households excluded). The Former-transition sweep rides the disabled cron,
   so an overdue household lingers in this audience until cutover re-enables it.

5. **The send log.** The email index becomes one `OfficeList` behind an `aria-pressed`
   Templates / Send log switcher, the assets pattern. The log view is paginated (the
   toolkit `Pagination`, bounded default) and filterable by outcome and template. A run of
   failed rows sharing one `error_detail`, each within an hour of the next, collapses to a
   single incident row carrying the count, the time window, the error, and the templates
   involved; expanding it reaches the member rows. The 2026-07-14 quota incident (471 of
   the 750 live rows) is the case the grouping exists for. The rows stay: failed sends are
   the audit trail of the incident and are deliberately preserved.

6. **Failed status.** Send status maps onto the settled three-register chip grammar. Sent
   takes the quiet tint and failed takes the warning tint. No red error register is minted;
   whether the toolkit ever grows one rides the StatusChip engine ask (this pass is its
   third consumer) as harvest material, not a site-side invention. The announce list's
   Announced column becomes chips on the same grammar: the quiet tint marks announced, the
   hairline outline not-yet-announced. This supersedes the brief's em-dash-not-blank rule
   for never-announced rows; the hairline outline carries what the em dash was carrying.

7. **Quota headroom.** The account's Email Sending quota was measured at 200 messages per
   day on 2026-08-25 (`GET /accounts/{id}/email/sending/limits`). A member-level whole-club
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

8. **The template guard.** The three class-reminder templates (`class_week_out`,
   `class_day_before`, `class_followup`) join `KNOWN_TEMPLATE_VARIABLES` so the
   unknown-variable warning covers them. Renaming, grouping, and subject-line work on the
   roughly 22 templates is content work and is deferred.

9. **The apology chore.** Geoff sent the 2026-07-15 apology himself, outside the site,
   superseding the brief's section 2, which had it still queued. No `migration_apology`
   rows will ever land in `email_log`; the standing "apology-send verification" queue item
   drops from STATUS, and the log ships against the incident data alone.

## The screens

**Email index** (`/admin/club/email`). One `OfficeList`, Templates / Send log switcher,
subtitle counts through `itemNoun` naming whichever view is active. Templates view: the
template list, zebra-striped, with the edit link. Send log view: paginated recent-first rows
(recipient, template, outcome chip, time), outcome and template filters, incident rows
inline where a failure cluster collapses. An error no longer renders in the empty cell. It
shows in the subtitle and a `role="alert"` banner, and `EmptyState` is reserved for
genuinely empty views.

**Template edit** (`/admin/club/email/[id]`). Register sweep only: dead classes replaced,
banners `{#if}`-gated, the Reset confirm button styled to its warning intent, prose preview
released from the prose max-width. Behavior unchanged.

**Compose** (`/admin/club/email/compose`). Register sweep plus the headroom line in review
and the warning in the confirm dialog. The failed-count badge takes the warning tint. Blast
history gets zebra and `EmptyState`. The variable palette keeps its current interaction;
its visual treatment goes to the probe only if the register sweep leaves it looking
assembled.

**Announce list** (`/admin/club/announce`). Ordering by `publishedAt ?? date` descending.
The Announced column becomes the chip pair of ruling 6; rows keep a date. Zebra,
`EmptyState`, and the stray `sr-only` count replaced by a visible toolbar count in the
events idiom.

**Announce form** (`/admin/club/announce/[id]`). The Discord preview gets the accent border
and preserved newlines its dead classes were meant to provide. Headroom line beside the
send control. The single-summary two-preview contract, the re-announce warning, and the
`untrack` plus `{#key}` seeding idiom survive verbatim. The stacked-field register baseline
coverage carry-forward lands here.

**The opt-in surfaces.** In the member portal, a Notifications section on the member's own
account page, one row per channel with email the only row this pass: receive club email,
off by default, with one sentence saying household announcements otherwise go to the head
of household. The section is shaped so the notifications pass's SMS row joins it later
without rework. In the admin, the same flag on the member's row in the household desk, an
additive control on the settled Members screen. Both write the one column; neither touches
standing or segments beyond it.

## The mechanical sweep

Everything in the brief's tiers 1 and 2 executes as rollout, with no further rulings
needed:

- the 17 dead classes across compose, template edit, and the announce form;
- zebra on the four tables (email templates, send log, compose blast history, announce
  list);
- `EmptyState` for the four empty views;
- `itemNoun` subtitles, replacing the manual ternaries;
- the two server-side literal `(s)` strings;
- the per-page `$theme/admin-chip-registers.css` import on every screen with a chip;
- banner `{#if}` gating where compose keeps empty `role="alert"` elements in the DOM;
- error-versus-empty separation on the email index;
- the `club-email.ts` doc drift (the "Empty today" comment, and the `email_log.segment`
  vocabulary, which actually carries `blast:<id>`, `blast-test`, and `announce:<postId>`).

## Data and infrastructure

One migration: the opt-in column on `members`, default off, applied to the live database
with the standard scratch-proven forward, rollback, and verify steps. The log view reads
`email_log` as it stands; incident grouping is a query and presentation concern, not a
migration. Segment resolution keeps its chunking at D1's parameter cap and its
shared-email dedup (which already prefers the household primary); the membership-wide
resolvers change per ruling 2, and the pre-inserted blast audit row is untouched. The
headroom check needs one new Worker secret: a Cloudflare API token scoped to Email Sending
read on this account, minted fresh, installed through the ASC per-project secret store and
`wrangler secret put`, named in `src/app.d.ts`. The cron trigger stays disabled until
`mw-cutover`.

## Groundwork for the notifications pass

The SMS ruling (Geoff, 2026-08-25) lands as its own `club-notifications` initiative on
`ROADMAP.md`, and this pass lays its groundwork deliberately rather than incidentally:

- **Per-channel opt-in columns.** The migration adds the email opt-in as its own column;
  the SMS pass adds `sms` as a later additive migration. No generic preferences table or
  blob for two known channels.
- **Audience selection split from channel projection.** The membership-wide resolver is
  factored in two steps: first the notification audience (each qualifying household's
  primary member plus its per-channel opt-ins), then the projection of that audience to
  email addresses. The SMS pass reuses the audience step and adds a phone projection
  (member phones are already E.164 on every write path); the household logic is never
  forked.
- **Parallel announce channel blocks.** The announce form's channel sections (email,
  Discord) restyle as structurally uniform blocks, each carrying its own preview, so the
  SMS block and its short-text preview join as a third row without rework.
- **The portal Notifications section** grows by row per channel, as ruled above.
- **`email_log` stays email's own.** Generalizing the audit table into a channel-generic
  log now would be speculative surgery; the SMS pass gets its own delivery log and reuses
  the log-view register this pass builds (pagination, incident grouping, outcome chips).

## Process

The probe-iteration process governs the visual work. One probe page, built from the dev
shell with compiled CSS per the standing pattern, grounded in the live `email_log` rows and
rendered in both themes at 1440 and 390, carries the two probe subjects: the send-log
presentation (incident row collapsed and expanded, sent and failed chips, the switcher
context) and the announced-state chip pair. The audience model needs no probe; it has no
visual surface beyond a toggle. Geoff verdicts async; the settle lands in `decisions.md`.

The plan runs in workflow mode (`~/.claude/workflows/pass-execute.js`) at roughly eleven
tasks, per the six-or-more rule. The build runs on its own branch through the full gate,
extends the fourteen existing unit suites rather than duplicating them (the segments suite
carries the audience-model tests), adds the first email and announce admin e2e through
`e2e/helpers/admin-session.ts`, and regenerates visual baselines only through `ci.yml`'s
`update_snapshots` dispatch. The pass closes with the reviewer fan-out, the fresh-context
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
