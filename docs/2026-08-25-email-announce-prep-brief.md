# Email + Announce pass: prep brief (2026-08-25)

Read-only prep for the next admin-screen pass. Nothing here is a plan. The charter for this series (`ROADMAP.md:56-74`) requires a functional brainstorm with Geoff first, and this brief exists to make that brainstorm short. Sources are file:line against branch `main` and the live `asc-club` database as of 2026-08-25.

## 1. What exists today, per screen

Five routes across two trees, sharing six library modules (`src/admin-club/lib/{segments,club-email,bulk-email,email-templates-store,announcements,discord}.ts`).

| Screen | Route and file | What it does today |
|---|---|---|
| Email index | `/admin/club/email`, `+page.svelte` (94 lines) | Lists ~22 templates, then the entire `email_log` unpaginated below it (a 6,400px page, `docs/2026-07-20-admin-toolkit-catalog.md:279-283`). Load-only, no actions. |
| Template edit | `/admin/club/email/[id]` | Subject and body editor, click-to-insert variable palette, sample-data preview through the real render path, reset to shipped default. Unknown `{{tokens}}` warn and still save (`email-templates-store.ts:54`). |
| Compose | `/admin/club/email/compose` (318 lines) | Three-step state machine in one component: landing (blast history), compose, review. Segment picker, server-resolved recipient count and 8-name sample, send-test-to-me, count-acknowledging confirm dialog. |
| Announce list | `/admin/club/announce` (69 lines) | The 15 most recent published posts with an "Announced" column, all em dashes today (`docs/2026-07-20-admin-toolkit-catalog.md:277-278`). |
| Announce form | `/admin/club/announce/[id]` (142 lines) | One editable Summary feeding both channels, each with its own preview shape (Geoff, 2026-07-08, `announcements.ts:189-198`); subject is email-only; Discord channel select; re-announce warning. |

Send pipeline, one path for everything: `sendClubEmail` (`club-email.ts:234`) renders a template or a raw body, calls the Cloudflare Email Sending binding (`wrangler.toml:28-29`), and writes one `email_log` row per attempt including refusals. It never throws, by design (`club-email.ts:208`). Bulk sends chunk at 50 concurrent (`bulk-email.ts:32`). Segments resolve live and are never stored (`segments.ts`); Announce's `currentMemberEmails` is a thin `resolveSegment('current')` caller so the two screens cannot drift (`announcements.ts:179-182`).

Audit state: `email_blasts` (migration 0025) holds **zero rows**. No production blast has ever been sent. The blast row is inserted before any send and updated after, so a mid-run D1 failure can never lose the trail (`bulk-email.ts:89-95`).

## 2. Live ops health

`email_log`, queried against remote `asc-club` on 2026-08-25: **471 failed, 279 sent, 750 total**. Unchanged since the 2026-07-20 walkthrough. No email activity of any kind since 2026-07-14.

| Template | Status | Rows | Window |
|---|---|---|---|
| `renewal_reminder` | sent | 240 | 2026-07-08 to 2026-07-14, daily ticks |
| `class_followup` | failed | 163 | 2026-07-14 08:07 to 08:15 |
| `class_day_before` | failed | 154 | same window |
| `class_week_out` | failed | 154 | same window |
| `class_day_before` / `class_week_out` / `class_followup` | sent | 18 / 18 / 3 | 2026-07-14 08:06 to 08:07 |

Every one of the 471 failures carries the same `error_detail`: `account daily sending quota exceeded`. They cluster in a single nine-minute window and are entirely the 2026-07-14 post-import catch-up blast (`docs/status-archive.md:1583-1587`).

What this implies, stated plainly:

- **There is no failure backlog, and no pre-pass remediation chore is warranted.** The failures are one closed incident, root-caused, with all three guards landed: the 10-day staleness cutoff in both due-selectors, the shared 50-send per-tick budget with its `send_cap_hit` audit row, and the cycle-keyed renewal markers from migration 0024. The cron trigger is removed from the worker and commented out of `wrangler.toml:82-83`, and re-enabling it is an explicit `mw-cutover` step (`ROADMAP.md:215-217`). Nothing is retrying, nothing is queued, nothing is failing now.
- **The rows stay.** Failed sends are the audit trail of the incident and are deliberately preserved. Any redesign of the log view must render them, not clean them.
- **The backlog is therefore a display problem, and it belongs inside this pass.** A screen whose visible send log reads "Failed" on every row is the current state, and the redesign has to decide what a 471-row single-incident cluster looks like at rest.
- **One genuine ops question does fall out of the data.** The only failure mode this system has ever produced is account daily quota exhaustion, and interactive sends have no per-run cap. `sendSegmentBlast` and `sendAnnouncementEmails` are budget-free; the `PER_TICK_SEND_CAP` covers cron only. A blast to `current` is roughly 285 recipients (`bulk-email.ts:93`), against an account quota whose current headroom nobody has measured since the incident. Checking that quota is a five-minute API question, not a chore, but it should be answered before the pass ships a screen that invites a 285-recipient send.
- **One real chore stands outside the pass.** The 2026-07-15 apology send is still queued and Geoff-attended (`docs/status-archive.md:1298-1300`). Its rows would land in `email_log` under `template_id = 'migration_apology'`, which the redesigned log view will surface. Sequencing it before or after the pass is a fork for Geoff, not a technical dependency.

## 3. The register gap list, most mechanical first

The bar is the settled admin register: StatusChip through the three tinted-ground registers, one 400 weight, no tone dots, per-page `import '$theme/admin-chip-registers.css'`; zebra stripes wherever rows list; `EmptyState` for empty views; `itemNoun` subtitles carrying real counts; `aria-pressed` view switchers (`docs/design-benchmark/decisions.md:449-512`).

### Tier 1: mechanical, no design decision needed

1. **Dead classes.** `cairn-audit` static runs clean and reports 17 `no-uncompiled-class` errors on these routes. Compose: `w-fit` (:144), `text-success` (:160, :252), `ml-1` (:183), `max-w-none` (:232, :271). Template edit: `w-fit` (:57), `text-warning` (:87), `text-success` (:92), `max-w-none` (:136), `btn-warning` (:160). Announce form: `w-fit` (:44), `text-success` (:64), `text-warning` (:69), `max-w-none` (:114), `border-l-4` and `border-primary` (:121), `whitespace-pre-line` (:125). Consequence today: every success and warning banner across all three screens renders toneless, prose previews never release the prose max-width, the Reset confirm button has no warning styling, and the Discord preview is a plain gray box with collapsed newlines.
2. **Zebra stripes.** Four tables render as plain `class="table"` with a hover tint: email templates, email send log, compose blast history, announce list. Stripe geometry is one dialect family-wide (`decisions.md:499-503`).
3. **`EmptyState`.** Four empty views render as a centered `<td colspan>` instead of the toolkit component.
4. **Subtitle counts through `itemNoun`.** Manual ternary pluralization at `email/+page.svelte:21-23`, `compose/+page.svelte:154`, and `recipientCountLabel` (compose:54-57). The email index subtitle counts templates only and says nothing of the send log, the exact tell the assets cold read failed on (`decisions.md:507`).
5. **The literal `(s)`.** Server-side only, in audit detail strings: `compose/+page.server.ts:142` and `announce/[id]/+page.server.ts:145`.
6. **Per-page stylesheet import.** No screen in this tree imports `$theme/admin-chip-registers.css`. Today the only consumers are assets and asset-requests.
7. **Doc drift.** `club-email.ts:111-113` says the log table is "Empty today", contradicted by 750 rows. The `email_log.segment` schema comment lists `'current' | 'lapsed' | 'class:<id>' | NULL` while actual writers emit `blast:<id>`, `blast-test`, and `announce:<postId>`.

### Tier 2: mechanical once one small ruling lands

8. **Send-status chips.** `email/+page.svelte:16-19` hand-rolls a daisy `badge` map: `bg-primary/10 font-medium text-primary` for sent, `badge-error font-medium` for failed. Three divergences stack (not StatusChip, a second weight, a primary tint with no register behind it), plus one open question: the settled grammar has quiet tint, warning tint, and hairline outline, and no error register exists site-side. Compose's failed-count badge (`compose/+page.svelte:183`) rides the same ruling.
9. **The "Announced" column.** `announcedLabel` (announce list, lines 20-27) renders state as muted prose with an em dash for never-announced, deliberately not a loading state. If it becomes a chip, quiet tint for announced and hairline outline for not-yet is a literal fit for the settled registers.
10. **Error and empty conflation.** `email/+page.svelte:22, 54` swaps `data.error` into both the subtitle and the empty cell. Settled screens keep the error in the subtitle plus a `role="alert"` banner.
11. **Always-rendered banner paragraphs.** Compose lines 148-151, 159-162, 251-254, 277-280 keep `role="alert"` and `role="status"` elements in the DOM holding empty strings at rest. The announce form already does this correctly with `{#if}` gating.
12. **Stray `sr-only` count.** `announce/+page.svelte:30` floats a `<span class="sr-only" role="status">` outside `OfficeList`; events renders a visible count line inside the toolbar (`events/+page.svelte:482-484`).

### Tier 3: genuine design work, probe territory

13. **Email index information architecture.** Two hand-rolled cards on one 6,400px page, with the send log duplicating `OfficeList` chrome by hand (`email/+page.svelte:62-94`). Assets solved multiple lists with one `OfficeList` behind an `aria-pressed` switcher. Pagination, filtering, and how a 471-row single-incident cluster reads at rest are all unanswered.
14. **Compose as a wizard.** A three-step machine in one route with full-width inline forms and ad-hoc "Back" ghost buttons (lines 239, 283). No settled screen has a precedent for it. This is not the dialog divergence case; the dialog ruling covers list-view mutations, not a primary authoring flow.
15. **The variable palette.** Chip vocabulary applied to interactive controls (`compose:216-224`, `email/[id]:101-109`). The bar has no ratified idiom for click-to-insert tokens.
16. **Announce list ordering and the date column.** Ties directly to the `publishedAt` rider in section 4.

### Load-bearing behavior any redesign must preserve

The count-confirm gate (server-resolved count in both the dialog heading and the button text, with `confirm=on` required by `?/send`); test-send always targeting `data.editorEmail` and never advancing the draft; draft carry across steps via `update({ reset: false })`; the `?segment=` deep link seeded once with `untrack`; live preview through the real `renderTemplateWithVariables` path; cursor-position insert from the palette; the single-summary two-preview announce contract; the re-announce warning from `data.previous`; the `untrack` plus `{#key}` seeding idiom on both form screens; and the em-dash-not-blank rule for never-announced rows.

## 4. Standing riders and rulings that bind this pass

| Ruling or rider | Source |
|---|---|
| **Announce-list recency via `publishedAt`.** Still open from 0.94. The list sorts by frontmatter `date` descending and slices to 15 (`announce/+page.server.ts:26`), so a backdated post vanishes from the very list an editor announces from. | `docs/STATUS.md:33`, `docs/status-archive.md:94-97`, `docs/HISTORY.md:284-286` |
| **The seam exists and nothing consumes it.** `ManifestEntry.publishedAt` is manifest-owned, stamped once by the engine publish path, never derivable from a content file. `stampFirstPublish` and `newlyPublishedEntries` are both in the installed 0.96 dist. `grep` over `src/` and `scripts/` returns zero hits, and the committed manifest holds zero stamps. | `dist/content/manifest.d.ts:41-49, 146`; `dist/delivery/manifest.d.ts:12-28`; `src/content/.cairn/index.json` |
| **A fallback is mandatory.** Every entry is unstamped today, so ordering is `publishedAt ?? date`, never `publishedAt` alone. `ContentSummary` does not carry the field, so the site reads the manifest directly, or this becomes an engine ask. | `dist/delivery/content-index.d.ts:8-35` |
| **The `CsrfField` plus `use:enhance` trap.** A bare `use:enhance` resets the form on success; `bind:value` re-syncs to defaults and unbound hidden inputs go blank and are never rewritten, so the next submit 403s. Filed twice. Compose is the origin of the documented workaround and carries the load-bearing comment. | `compose/+page.svelte:96-118`; `docs/2026-08-22-events-admin-harvest-findings.md:34-40`; `docs/HISTORY.md:130-131` |
| **Current includes overdue.** Grace is retired; Overdue keeps full member benefits until Former. `current` resolves to `'current' | 'overdue'` standing; `lapsed` means recorded Former, and never-paid households are in neither. | `segments.ts:100-183`; `docs/status-archive.md:729` |
| **Announce's audience was deliberately widened** when `currentMemberEmails` became a `resolveSegment('current')` caller, and that widening is still flagged for a walkthrough that has not happened. | `docs/status-archive.md:1514-1517, 1421-1422` |
| **The send safety flow is ruled.** Review with exact resolved count and sample, then send-test-to-me, then a count-acknowledging confirm. No hard cap on deliberate admin sends; the admin failure mode is a fat finger, and the missing gate was a human seeing the number. | `docs/2026-07-14-segment-email-design.md:49-60` |
| **`send` re-resolves the segment from scratch** and never trusts review's count; `test` always targets the signed-in editor because the form supplies no address. | `compose/+page.server.ts:156-196` |
| **Blast audit row is pre-inserted, then counts updated,** so a late D1 failure cannot lose the record of a blast that already reached recipients. | `bulk-email.ts:89-95` |
| **The cron stays disabled until `mw-cutover`.** A pre-production worker must not email real members. Keeping the trigger out of `wrangler.toml` is what stops every deploy from silently re-creating it. | `wrangler.toml:82-83`; `ROADMAP.md:215-217` |
| **Failed rows stay in the log.** They are the smoke in the audit trail. | `docs/status-archive.md:700-702`; `ROADMAP.md:189` |
| **Chip register grammar is toolkit-wide** (tinted grounds, no dots, one 400 weight, hairline outline for transient absence), verified only by canvas readback because `getComputedStyle` returns unresolved `oklch()`. This pass is the **third consumer**, which is the live consolidation trigger for the StatusChip engine ask. | `decisions.md:449-471`; `docs/2026-08-24-assets-register-harvest-findings.md:8-19`; `scripts/verify-chip-registers.mjs` |
| **Access is settled.** Webmaster holds the whole Communication group, Publisher is Communication-only, and the Email-class-members deep-link spillover is deliberate. "Announce" is the lone verb. | `decisions.md:320-326`; `docs/status-archive.md:673-674` |
| **Segment-email's declared out-of-scope,** available as headroom but never shipped silently: no drafts, no scheduling, no Discord on compose, no open or click tracking, no ad-hoc recipient lists. Announce adopting the segment picker was explicitly left open. | `docs/2026-07-14-segment-email-design.md:100-104` |
| **Admin mechanics from the last two closes.** `fakeD1` asserts SQL text only, so every guard lives in the statement. `*-narrow-hide` acceptance is `scrollWidth === clientWidth` at 390 with a row expanded. `ListToolbar` bands are sealed. A bare `<ul>` in a toolkit panel gets UA bullets. View switchers are plain `aria-pressed` buttons. | `docs/HISTORY.md:125-137`; `docs/2026-08-22-events-admin-harvest-findings.md:44-47` |
| **Admin error pages return HTTP 200** with a 404 body, so a 200 from an admin path is not proof the route exists. | memory `project_admin_error_status_200` |
| **Close mechanics.** Baselines are CI-canonical and regenerate only via the `ci.yml` `workflow_dispatch update_snapshots` run. Merging a green PR and deploying to dev is default behavior pre-cutover. | `CLAUDE.md`; Geoff, 2026-08-22 |
| **Two cutover touchpoints sit inside this surface.** The post URL mailed to members is `${ORIGIN}${permalink}` with `ORIGIN` hardcoded to `https://dev.aksailingclub.org`, and template `reply_to` is not threaded into sends because the Cloudflare binding has no such field. | `src/chassis/content.ts:57`; `club-email.ts:263-270` |

Two smaller constraints worth carrying into any query work: D1's 100-bound-parameter cap forces household `IN (...)` chunking at 90 (`segments.ts:122-126`), and the three class-reminder touch templates are absent from `KNOWN_TEMPLATE_VARIABLES`, so the unknown-variable guard silently skips them entirely.

Test coverage to extend rather than duplicate: fourteen relevant unit suites exist under `src/tests/` (`compose-actions`, `bulk-email`, `announce-actions`, `announcements`, `segments`, `club-email`, `email-template-actions`, `email-templates-store`, `send-cap`, and the job suites). There is **no e2e coverage of the email or announce admin at all** and no admin email visual baselines. The session-mint helper at `e2e/helpers/admin-session.ts` exists now, so the old "no editor-login helper" debt is paid.

## 5. Open questions for Geoff at the brainstorm

Each of these is a fork where both branches are defensible and the answer changes the plan.

1. **Does Announce keep a fixed `current` audience, or adopt the Compose segment picker?** Segment-email explicitly left the door open. Keeping it fixed preserves the "announce means the whole club" reading; adopting the picker makes Announce a second blast surface and raises the question of whether the count-confirm gate applies there too (it does not today). Related and separable: the widening of Announce's audience to overdue households has never been walked, so confirm it or narrow it.
2. **Does the site mint an error register for Failed, or does Failed take the existing warning tint?** The settled grammar has three registers and no error ground. Failed sends are settled history, not attention-needing, which argues for a quiet register; but 471 rows of quiet gray reads as if nothing happened. This is toolkit-wide, so it is a Geoff ruling, and it likely rides the StatusChip engine ask as the third consumer.
3. **What does the send log become?** Options span a filtered and paginated view inside the email index behind a switcher, a separate route, or a grouped view that collapses a same-error same-window cluster into one incident row. The cluster is not hypothetical; it is 471 of the 750 rows.
4. **Does Compose stay a three-step machine in one route?** No settled screen has this shape. Splitting into routes or moving review into a dialog would both change the `reset: false` workaround surface, which is the one trap in this tree that has already been filed twice.
5. **Does an interactive send grow a cap or a quota pre-check?** The 2026-07-14 ruling was "no hard cap on deliberate admin sends", and the only failure this system has ever produced is quota exhaustion. A ~285-recipient blast against unmeasured quota headroom is the same shape as the incident, minus the automation. A pre-send headroom check is a middle path that does not reopen the ruling.
6. **Does this pass consume `newlyPublishedEntries`, or only close the list-recency rider?** The rider is a one-file sort change with a mandatory fallback. Announce-on-publish is the feature the seam was built for and needs a persistence home for the prior manifest plus a hook at deploy or admin-publish time. This is the single largest scope lever in the brief.
7. **Does the 2026-07-15 apology send get sequenced before this pass?** It is Geoff-attended either way. Sending first means the redesigned log renders `migration_apology` rows from day one; sending after means the pass ships against the incident data alone.
8. **Do the templates themselves get work?** Twenty-two templates list with raw `{{item_display_name}}` placeholders as subjects, and three touch templates sit outside the known-variable map. Naming, grouping, and the guard gap are all in reach, and all are content work rather than register work.

## 6. First-cut pass shape

**Shape.** Functional brainstorm first, per the series charter, then a contract doc, then probes, then a plan. Five screens, one shared library layer, one open rider.

**Probable task list.**

| # | Task | Kind |
|---|---|---|
| 1 | Chip register adoption across all five screens: per-page stylesheet import, StatusChip for send status, failed-count badge, announced-state chip | mechanical after ruling 2 |
| 2 | Dead-class sweep plus banner gating across compose, template edit, and the announce form | mechanical |
| 3 | Table register: stripes, `EmptyState`, `itemNoun` subtitles, error and empty separation, the stray `sr-only` count | mechanical |
| 4 | Email index rebuild: templates and send log information architecture, pagination or filtering, incident presentation | probe |
| 5 | Compose flow ruling and rebuild, preserving all six load-bearing behaviors | probe |
| 6 | Announce list recency: `publishedAt ?? date` ordering off the manifest, plus the date column question | mechanical, with one design question |
| 7 | Announce form: the Discord preview is visibly broken today (no accent bar, collapsed newlines) and gets rebuilt, plus stacked-field register baseline coverage, which is an open carry-forward | mechanical |
| 8 | Tests and e2e: extend the fourteen unit suites, add the first admin email and announce e2e with `admin-session.ts`, mint visual baselines through CI dispatch | mechanical |
| 9 | Close: simplifier, reviewer fan-out, own read plus fresh-context cold read at 390 and 1440, CI baselines, PR, merge, deploy to dev, harvest, `decisions.md` settle, `HISTORY.md` | ritual |

**Probes versus mechanical rollout.** Two probe subjects, and they can share one probe page: the send-log presentation (including the 471-row incident cluster) and the chip registers for send status and announced state. Both must be grounded in real data, per the standing ruling that a probe queries live tables and renders both themes before ratification; the mock-D failure is the cautionary case. Everything in tiers 1 and 2 of section 3 is mechanical rollout once ruling 2 lands, and the `publishedAt` sort is mechanical once the fallback is specified.

**One pass or a split.** The ops-health finding does not force a split. There is no remediation backlog, no live failure, and no operational work blocking the redesign. Scope is what forces the question, and the honest read is:

- **One pass** if the seam consumption stays at the list-recency rider and Compose keeps its current flow. That is nine tasks over five screens with two probe subjects, comparable to the assets pass.
- **Split** the moment either large item enters. Announce-on-publish (question 6) needs a persistence decision, a deploy-time or publish-time hook, and its own probe; a Compose flow rework (question 4) touches the one trap filed twice and deserves its own review budget. Either one pushes the pass past what a single contract should carry.
- **The cut point, if a split is needed:** pass A takes the Email tree (index, send log, compose register, template edit) and pass B takes Announce (list, recency rider, form, and any seam consumption). The charter calls Email plus Announce "a natural single pass", so proposing the split needs Geoff's agreement rather than being taken silently.

Two items to route out of the pass regardless: the apology send stays a Geoff-attended chore (question 7), and the `ORIGIN` hardcode plus the reply-to gap are cutover work, noted in the harvest rather than fixed here.
