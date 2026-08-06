# Polish backlog (beta → 1.0)

Assembled 2026-07-07 from the day's own findings, the parity audit, the requirements
review, and the design-panel triage. Each item is small-to-medium, well-scoped, and
independent, so it executes in any order. Ranked within each group by leverage. Anything
not done today Geoff tackles on Opus tomorrow; hand this file to that session.

## Geoff's design calls (from the gestalt panel — decisions, not tasks I execute alone)

- **Repalette the accent off the photography?** The panel reads the fireweed-magenta CTA as
  generic consumer-SaaS, not Alaska-sailing; it suggests a lake-blue / hull-orange / muted-green
  accent pulled from the club's own photos. This is a real identity choice (and the north star
  chose the magenta), so it's yours to rule, not mine to swap. If yes: a token change +
  contrast recheck, low-medium effort.
- **Education's genre.** The panel says the docs-style sticky-TOC frame makes the club's flagship
  persuasion page (get a parent to register a kid) read like a software help center. Options: keep
  the sidebar for the reference tables lower down but let the top of the page breathe as a normal
  page; or drop the docs frame entirely. A genre decision, yours.
- **Let the photography breathe** (needs your photos): the hero + the What-do-we-do trio boxed
  small caps every page's ceiling; larger, ideally full-bleed-within-column crops. The facilities
  block is the panel's cited template for how the rest should look.

## From the gestalt panel (polish-tier, executable)

- **The "Welcome to the New Website" news thumbnail** (the green Matrix-code image) reads as
  broken/AI and clashes with the real photography — replace with a real photo or a clean graphic.
- **Education visual pacing**: a photo every 2-3 sections + a type distinction between the ~20%
  that matters to a first-time parent (tracks, pricing, how-to-register) and the reference detail
  (refund policy, wishlist), so the page stops reading as one flat manual.

## Design / front-end (feeds the design-panel round; some may already be in-flight)

- **Photos Geoff supplies** (blocking only visual completeness, not function): the three
  What-do-we-do Learn/Race/Relax tiles (currently sanctioned "photo coming"); a PORTRAIT
  facilities photo (the slot force-crops a landscape today, `data-crop` marks it
  deliberate); any hero the panel flags as under-using the club's photo archive.
- **The image-orientation pass** sitewide: apply the orientation rule (landscape/square/
  portrait per slot; docs/2026-07-06-asc-phase-1-design.md) to every image slot, with a
  photo-request list where the library lacks a fitting asset.
- **The rest-of-site craft pass**: once home + education pass Geoff's read, apply the same
  treatment (type scale already sitewide; section rhythm, hero presence, panel system) to
  racing, join, governance, visiting-the-club, the storage pages, the member guides.
- **Section-panel measure**: education's panels narrow the reading measure to ~50ch (the
  boxed-panel-plus-sidebar cost); revisit padding/gutter to reclaim toward 60-65ch if the
  panel round wants it.
- **Design-panel survivors**: whatever the three-lens panel + refuter confirm on home +
  education that isn't fixed in today's wave.
- **404 / error pages, empty states**: audit every empty/error surface for the club-grounds
  voice + treatment (the events empty-state, a signed-out portal deep link, a 500).
- **Dark mode**: the theme carries a full dark system but it's unaudited against the new
  type scale, panels, and heroes; a dark-mode read pass.
- **Five-viewport CI baselines**: regenerate + confirm the width-matrix baselines after the
  wave settles (the portal + panel pages are new to the suite).

## The tool / functionality (from the parity audit + requirements review)

- **Discord notifications** (parity GAP): the committee loses real-time visibility ops had
  — wire payment-request-sent and waitlist events to the Discord webhooks (they exist:
  DISCORD_WEBHOOK_ASSETS/CLASSES on the ops worker; the estate doc lists them).
- **Boson Bot cutover** (a silent trap): the Discord announce bot watches the OLD site's
  feed; repoint it to the new feed.xml at cutover or new-post announcements stop.
- **Asset-type fee editing** (parity GAP): no writer exists; add an owner-only settings
  action (mirrors tier prices).
- **Class-waitlist manual reorder + waitlist admin notes** (parity GAP): ops had both;
  the asset side kept move-to-end, the class side has neither.
- **Post-create assignment note editing** (minor parity GAP).
- **The cancellation/refund voucher type** (requirements review): the education page
  publishes a carry-to-next-year voucher on in-window cancellation; a distinct credit-grant
  source tag + the deadline math (rides the payment/refund build).
- **Boat qualifications** (requirements review): class completion "checks you out" on the
  boats sailed — a per-member qualification record; a natural post-2.2 portal surface.
- **Race registration** (requirements review): member/non-member differential pricing +
  registration deadlines (the NOR bulletin's own promise); the per-event pages are its home.
- **The support / reimbursement / IT-request forms** (2.3): category routing + receipt
  upload, per the Issues & Support page's own promises.
- **Email-preferences opt-out surface** (the symmetry rule's inverse of bulk sends).

## Correctness / hygiene (fast wins)

- **Migration renumbering**: the four parallel worktrees collided on numbers (0011/0014/…);
  after the merge, confirm the sequence is clean and contiguous on main.
- **The email sends promoted to templates**: the portal capstone used `raw` unstored
  content for its admin-notify sends to sidestep a collision; promote them to editable
  `email_templates` rows now that the editor exists.
- **The directory-listing-confirm nudge**: the portal deferred it for lack of a dismissal
  column; add the column + the dismissible nudge.
- **Turnstile: PROVISIONED 2026-07-07** — widget created for aksailingclub.org + dev; secret set
  on the asc-site worker (TURNSTILE_SECRET_KEY). Remaining: wire the PUBLIC sitekey
  `0x4AAAAAADxia9mnjaUA0nfx` into the forms' config (contact/donate/class-signup) so the widget
  renders; the server-side verify already exists (donate pattern). A small config edit, post-merge.
- **CONTACT_EMAIL / sender onboarding**: confirm the EMAIL sender domain is onboarded for
  all the new transactional sends (the durable Cloudflare-email gotcha).
- **The `/images` 410-rationale refresh**: the parity audit found the ops `/images` route
  has no live consumer anymore; document before a later retirement wave.

## Human / cutover checklist (Geoff's, not code)

- Stripe: swap sandbox → live keys at real cutover (never before).
- The magic-link smoke clicks (member + admin sign-in from Geoff's inbox).
- The ops events/classes 410 flip (parity audit says GO; Geoff's word).
- The apex DNS cutover (aksailingclub.org → asc-site) after the before/after review.
- MembershipWorks subscription cancel (after 2.4, the last ops domain).

## Admin interface feedback (Geoff, live review 2026-07-07 — queued for the admin review round)

- **Payment-due presentation in Members**: the Standing column renders "Current Payment due"
  as one run-on string — the standing value and the payment-due flag need visual separation
  (a distinct badge/pill for "Payment due," not inline concatenation with the standing).
- **Count mismatch on the same screen**: "Showing 1-10 of 23 members" vs "25 members across
  15 households" — if the delta is archived members, one of the counts must say so; as
  rendered it reads as a bug.
- **Header stack reads doubled**: "Overview / members / Club / Members / …" — the eyebrow,
  page title, and list header repeat the same words; consolidate the screen's heading
  hierarchy.
- Already handled separately: the double-Settings relabel (shipped), the sidebar scroll-bleed
  and auto-collapse-on-navigate (engine fixes in flight).
- **Dark-mode header logo near-invisible** (coherence read, 2026-07-18): the dark navy mark
  sits on near-black in site chrome, both widths — pre-existing (visible in home-dark
  baselines), re-enshrined by every dark baseline; wants a dark-variant mark or a lightness
  step.
- **Directory mail-icon optical alignment** (coherence read, 2026-07-18): the at-rest mail
  icon may sit 1-2px high against the caret/name midline on icon-bearing rows; settle with a
  computed getBoundingClientRect midline check, not by eye.
- **Members AND Memberships in the sidebar** (Geoff): the club nav needs a Memberships entry
  alongside Members. This is a screen build, not a relabel — a memberships view (household/tier/
  paid-through/standing, the dues records the payments webhook reconciles) distinct from the
  member-people list. Scope it in the admin review round; it connects to the MW-absorption
  membership-management item.
- **A global, default-correct vertical-centering mechanism for padded labels** (Geoff,
  2026-07-30, deferred to a subsequent pass). **This is an ENGINE-level fix (Geoff): the
  mechanism belongs in cairn, and the standing check belongs in `cairn-audit`, so every
  consuming site inherits both. Filed for the harvest in
  `docs/2026-07-30-assets-substrate-harvest-findings.md`, finding 1, which carries the full
  evidence.** What stays site-side is only the eventual adoption: ASC's own
  `.asc-availability-chip` and its siblings drop their local compensation once cairn ships the
  default. Geoff noticed the `CURRENT PLAN` chip's text
  sitting off-centre in its pill on `/my-account/renew` at 390 and asked for a global way to
  manage vertical centering so it is easy and correct by default, rather than a per-component
  fix each time someone spots one. A one-off `line-height: 1` patch to `.asc-availability-chip`
  was built and reverted during the Assets substrate pass, deliberately: it was not the general
  answer, and its stated rationale did not survive measurement.

  What the measurement actually showed, so the next pass does not re-derive it. On the events
  page chip (13.12px uppercase text, `padding: 0.1rem 0.5rem`, inheriting the ambient
  line-height), the ink sits **1.0px LOW** in the pill, not high: 6.59px of space above the cap
  line against 4.59px below the baseline. `line-height: 1` reduces that to 0.43px low but
  shrinks the pill from 23.19px to 18.31px, which is a real layout change in the 19 places the
  chip is used. `line-height: 1.5` measures best of the three at 0.15px low. **The
  `CURRENT PLAN` instance Geoff actually saw was NOT measured**; it sits inside
  `.renew-tier-name`'s `inline-flex` with `align-items: center`, a different context from the
  events-page instance, so start there rather than trusting the numbers above to describe it.

  Method that worked, reusable for a probe check: read the baseline from real layout by
  appending a zero-size `inline-block` with `vertical-align: baseline` and taking its
  `getBoundingClientRect().bottom`, then take glyph extents from canvas
  `TextMetrics.actualBoundingBoxAscent`/`Descent` for the element's own resolved font. Deriving
  the baseline from font metrics alone produced numbers that disagreed with the rendered result.

  The standards answer worth evaluating first: CSS `text-box-trim` / `text-box-edge` (the
  `text-box: trim-both cap alphabetic` shorthand) trims the unfilled ascent and descent
  allowance at its source, which is exactly the "correct by default" behaviour asked for. Check
  current browser support and treat it as progressive enhancement over a fallback, since this is
  a public member-facing site. Whatever mechanism wins, pair it with a standing check in
  `scripts/design-probe.mjs` alongside `checkTouchTargets` and `checkOverflow`, so the rule is
  mechanical rather than dependent on someone noticing.
- **The toggle-action control** (Geoff, 2026-07-30). **ENGINE-level, like the two items above:
  cairn owns the primitive. Filed for the harvest in
  `docs/2026-07-30-assets-substrate-harvest-findings.md`, finding 2.** ASC's retention control on
  `/my-account/renew` is the reference implementation and stays self-contained in that route
  until cairn ships; the site-side work is then dropping the local copy for the primitive.
- **65 `no-uncompiled-class` findings on the Club admin screens** (found 2026-08-05, the cairn
  `0.94.0-rc.1` migration). `npx cairn-audit` reports 65 static errors, every one of them a class
  the markup writes that never compiles into the shipped admin stylesheet: `w-fit`,
  `text-warning`/`text-success`, `max-w-none`, `ml-1`, `pl-4`, `gap-8`, `input-xs`, `btn-warning`,
  `xl:grid-cols-4`, `border-error/30`, `bg-error/5`, `print:p-0`, and a handful more, concentrated
  in Money, Members detail, Email, and Compose. These are classes in the author's mind and absent
  from what ships, so each one is a style that silently does nothing.

  **Pre-existing, not migration damage**, and verified rather than assumed: six of seven sampled
  classes were already absent from `0.91.1`'s shipped sheet, and no release in the `0.92.0`
  through `0.94.0-rc.1` window removed a class (the inventory has been a tested contract since
  `0.91.1`). Deliberately left alone by the migration pass, which changed no class strings. Each
  finding resolves one of three ways: onto an admin grammar token, into the screen's own scoped
  `<style>`, or by deleting a class that was never doing anything. The `type-scale` rule is
  already clean here and the rendered audit passes at 0 errors, so this is the one standing gate
  the Club screens do not hold.
- **`audit_log.created_at` still defaults to `datetime('now')`** (found 2026-08-05, same
  migration). cairn's bundled `migrations/0002_audit.sql`, which is this table's own schema
  carried into the engine, deliberately deviates on exactly this column: it defaults to
  `strftime`'s ISO 8601 form, unambiguous UTC at millisecond resolution. asc-club's original
  default writes a space-separated, second-resolution, no-`Z` string, which `new Date(...)` reads
  as LOCAL time in a browser and which sorts several same-second audit rows non-deterministically.
  Both matter for a table whose whole purpose is being read by people in order.

  Not taken at the migration: SQLite cannot alter a column default in place, so this is a table
  rebuild against live audit rows, which is a real migration with real risk and no business
  sitting inside a dependency bump. Route it to a pass that is already touching asc-club, with
  the usual scratch-proven forward/rollback/verify.
