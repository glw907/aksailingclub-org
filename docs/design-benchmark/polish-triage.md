# Polish backlog, triaged into the design-round groups

Working doc for the design-session conductor. It folds `docs/2026-07-07-polish-backlog.md`
into the six page-by-page design groups defined in
`docs/design-benchmark/page-confirmations.md` and the `design-propagation` ROADMAP entry.

Each backlog line is quoted or near-quoted so it traces back to the source file. Every item
carries a disposition:

- **(a) design-contract miss** — belongs to its group's conductor fix round.
- **(b) content/copy** — route to the content-draft / content-review path, not the design
  fix round.
- **(c) superseded** — already settled by a logged decision or a landed change; the note
  says which. Items that fall on a confirmed page (home, education) are additionally tagged
  **confirmed page — reopen only on Geoff's call**.
- **(d) not page-scoped** — infrastructure, global rendering, functional/backend, or a human
  checklist item. Collected in the trailing sections, out of the per-group render reads.

Verification performed for this triage (file reads only, no git): the `migrations/asc-club/`
sequence, the Turnstile wiring in `src/theme/` and the form routes, and the admin nav
surface after initiative 5.

## Group 1: home + primary pages

Home and `/education/` are confirmed (2026-07-14). Most Group-1 backlog items name those two
pages and are therefore superseded by the confirmation rounds; the residue is photo supply
and the unconfirmed primary pages (racing, events, join, members, contact).

- **"Education's genre"** — the docs-style sticky-TOC frame reading like a help center; keep
  the sidebar for lower reference tables or drop the docs frame. **(c) superseded, confirmed
  page — reopen only on Geoff's call.** Resolved across education rounds 2-3 (decisions.md:
  "fun, engaging, informative web page — a program brochure done well, less designed than
  home"; the TOC standard settled as wayfinding furniture that collapses to a mobile
  accordion).
- **"Education visual pacing"** — a photo every 2-3 sections plus a type distinction between
  the first-time-parent ~20% (tracks, pricing, how-to-register) and the reference detail.
  **(c) superseded, confirmed page — reopen only on Geoff's call.** Education rounds 2-5
  shipped the divider-group clusters, the promise hero, and the primary-vs-reference pacing;
  the page is pinned as confirmed.
- **"Let the photography breathe"** — larger, full-bleed-within-column hero and What-do-we-do
  trio crops. **(c) superseded on the design rule, confirmed page — reopen only on Geoff's
  call.** The hero standard is codified (2:1 editorial crop with per-photo `imageFocus`,
  `docs/image-standard.md`) and home is the pinned benchmark. Residual is photo supply, tracked
  in the next item, not a contract miss.
- **"Photos Geoff supplies"** — the three What-do-we-do Learn/Race/Relax tiles (sanctioned
  "photo coming"), a PORTRAIT facilities photo (the slot force-crops a landscape today), and
  any hero under-using the archive. **(d) photo-supply dependency, home-scoped.** Not a design
  miss; a blocked slot awaiting an asset. Carry it as the Group-1 photo-request list (slot,
  wanted orientation, subject) per the image-orientation rule; it blocks visual completeness,
  not the render read.
- **"Section-panel measure"** — education's boxed-panel-plus-sidebar narrows the reading
  measure to ~50ch; revisit padding/gutter toward 60-65ch. **(c) superseded, confirmed page —
  reopen only on Geoff's call.** Education is confirmed; the measure concern was inside the
  arc that settled. Reopen only if Geoff calls it out on a re-read.
- **"Design-panel survivors"** — whatever the three-lens panel and refuter confirm on home and
  education that today's wave did not fix. **(c) superseded.** Both pages are now confirmed;
  the survivors were resolved through the confirmation rounds.

No backlog item names racing, events, join, members, or contact individually. Their Group-1
work is the `.page-cta` ratification and rollout (join and members are marked candidates) plus
the per-page image check, both carried as sweep riders below, not as discrete backlog lines.

The accent-repalette question also lands on every primary page but was decided at home; see
the global section.

## Group 2: Members-menu children + membership/renewal how-tos

No backlog item names a Group-2 page as a design miss. The pages arrive through the general
craft pass (next item) and the `.page-cta` rollout.

- **"The rest-of-site craft pass"** — "once home + education pass Geoff's read, apply the same
  treatment … to racing, join, governance, visiting-the-club, the storage pages, the member
  guides." **(c) superseded — this item IS the design-propagation sweep.** It became Groups
  1-4 of this method; it is the parent of the whole exercise, not a discrete fix. The named
  targets (visiting-the-club, the member guides) fall in Groups 2-4.
- **"The directory-listing-confirm nudge"** — add the dismissal column and the dismissible
  nudge the portal deferred. **(d) functional/backend**, surfaces on `/directory/` (Group 2)
  but the work is a schema column plus portal logic, not a design fix. Route to the portal /
  ops-absorption track.

## Group 3: governance + policy documents

No backlog item names a governance or policy page. Governance is one of the craft-pass targets
above; its Group-3 work is the standard render read against the contract (editorial pacing,
the type spine, the TOC standard for long documents), no carried defects.

## Group 4: storage pages

No backlog item names a storage page. "The storage pages" are a named craft-pass target;
their Group-4 work is the standard render read, no carried defects.

## Group 5: form, confirmation, and system pages

- **"Turnstile: wire the PUBLIC sitekey into the forms' config (contact/donate/class-signup)
  so the widget renders."** **(c) superseded — landed.** The widget is wired into
  `ContactForm.svelte`, `DonateForm.svelte`, `join/apply/+page.svelte`, and
  `classes/[id]/signup/+page.svelte` (all render `data-sitekey={TURNSTILE_SITE_KEY}`).
  **Sitekey resolved (2026-07-15):** the code's `0x4AAAAAACaRcPmackdot0hZ` is the correct
  live pair — the ASC secret registry (`aksailingclub-legacy/secrets/registry.md`) records it
  as `TURNSTILE_SITE_KEY`, paired with the stored `TURNSTILE_SECRET_KEY`. The backlog's
  `0x4AAAAAADxia9mnjaUA0nfx` ("aksailingclub.org public forms") and a duplicate "ASC Site
  Forms" widget (`0x4AAAAAACZWVbMNjwdDBsuG`) are orphan widgets, never wired; route both to
  the infrastructure-tidy pass for deletion. Contact is a Group-1 page; the rest are Group 5.
- **"The support / reimbursement / IT-request forms (2.3)"** — category routing and receipt
  upload per the Issues & Support page's promises. **(d) functional/backend**, surfaces on
  `/it-request/` (Group 5) and `/issues-and-support/` (Group 2), but the build is form logic
  and routing, not a design fix. Route to the 2.3 functional track.

The confirmation and system pages in this group (`/class-registration-complete/`,
`/confirmation/`, `/welcome/`, `/official-website/`) carry no backlog defects; their Group-5
work is the standard render read plus the club-grounds voice check on system copy.

## Group 6: news surfaces

- **"The 'Welcome to the New Website' news thumbnail"** — the green Matrix-code image reads as
  broken/AI and clashes with the real photography; replace with a real photo or a clean
  graphic. **(b) content/asset work**, visible on `/posts/` and the post itself (Group 6).
  Route to the content path as an asset swap; it is not a template or contract change. Confirm
  the post still carries that image before the swap.
- **"Boson Bot cutover"** — the Discord announce bot watches the old site's feed; repoint it to
  the new `feed.xml` at cutover. **(d) not design-scoped**, a cutover/ops task tied to the
  news feed. Route to the mw-cutover runbook, not the Group-6 render read.

The posts/bulletins composition spec (the never-written phased half of the template-system
spec) is a sweep rider for this group, per the ROADMAP; it is prerequisite design authorship,
not a backlog line.

## Global / not-page-scoped design items

These are cross-cutting design concerns that no single group owns. Fold them into the sweep as
global passes or run them once after the group rounds settle.

- **"Repalette the accent off the photography?"** — the panel reads the fireweed-magenta CTA
  as generic consumer-SaaS and suggests a lake-blue / hull-orange / muted-green accent from the
  club's photos; Geoff's call, a token change plus contrast recheck. **(c) superseded, confirmed
  benchmark — reopen only on Geoff's call.** The north star chose the magenta, and home (which
  carries the CTA) is now the pinned design benchmark, ratifying the fireweed role. The color
  story is the standing contract; reopen only if Geoff reverses it, and if so it is one global
  token change, not a per-group fix.
- **"The image-orientation pass sitewide"** — apply the orientation rule (landscape / square /
  portrait per slot) to every image slot, with a photo-request list where the library lacks a
  fitting asset. **(c) rule superseded / (a) pass distributes into every group.** The rule is
  codified (`docs/image-standard.md`, the pages concept's `imageFocus`, the 2:1 hero crop
  standard). What remains is the application, which is exactly each group's per-page image
  check plus its photo-request list. Not a standalone item; it rides every render read.
- **"404 / error pages, empty states"** — audit every empty/error surface for the
  club-grounds voice and treatment (the events empty-state, a signed-out portal deep link, a
  500). **(d) not page-scoped.** These surfaces are not in any of the six groups. Run one
  global empty/error-state audit, ideally alongside Group 5 (the nearest system-page work).
- **"Dark mode"** — the theme carries a full dark system, unaudited against the new type
  scale, panels, and heroes; a dark-mode read pass. **(d) not page-scoped, global rendering.**
  One dark-mode read pass after the light-mode groups settle, or a dark capture added to each
  group's five-viewport read.
- **"Five-viewport CI baselines"** — regenerate and confirm the width-matrix baselines after
  the wave settles (the portal and panel pages are new to the suite). **(d) infrastructure.**
  The sweep regenerates `e2e/site-visual.spec.ts` baselines per group as pages change; a final
  full regeneration confirms the settled state. Runs continuously with the groups, not once.

## Not design-scoped: functional / parity backlog (other initiatives)

These are backend or feature-build items from the parity audit and requirements review. They
have no design fix in the page groups; several surface on a page (noted), but the work belongs
to the class-management, payments, or ops-absorption ROADMAP entries. Listed so the design
conductor can route rather than absorb them.

- **"Discord notifications"** — wire payment-request-sent and waitlist events to the Discord
  webhooks. Ops/class-management.
- **"Asset-type fee editing"** — add an owner-only settings writer mirroring tier prices.
  Admin/ops.
- **"Class-waitlist manual reorder + waitlist admin notes"** — restore the ops parity the class
  side lost. Class-management.
- **"Post-create assignment note editing"** — minor parity gap. Admin/ops.
- **"The cancellation/refund voucher type"** — a credit-grant source tag plus deadline math;
  rides the payment/refund build. Payments.
- **"Boat qualifications"** — a per-member qualification record; a post-2.2 portal surface.
  Ops-absorption.
- **"Race registration"** — member/non-member differential pricing plus deadlines; the
  per-event pages are its home. Functional; touches racing/events (Groups 1) but the build is
  registration logic.
- **"Email-preferences opt-out surface"** — the inverse of bulk sends. Functional/portal.
- **"The email sends promoted to templates"** — promote the portal capstone's `raw` admin-notify
  sends to editable `email_templates` rows. Backend; `0016_template_defaults` exists.

## Correctness / hygiene

- **"Migration renumbering"** — confirm the sequence is clean and contiguous on main after the
  four-worktree collision. **(c) superseded — resolved.** `migrations/asc-club/` runs
  `0001`-`0026` with no gaps or duplicates (verified by directory listing for this triage).
- **"CONTACT_EMAIL / sender onboarding"** — confirm the email sender domain is onboarded for all
  new transactional sends. **(d) infrastructure/cutover.** Route to the mw-cutover runbook.
- **"The `/images` 410-rationale refresh"** — document the ops `/images` route's now-absent live
  consumer before a retirement wave. **(d) infrastructure/docs.** Ops-absorption.

## Admin-interface feedback (separate admin review round)

These are admin-CMS screens, not public-site pages. They fall outside the design-propagation
groups, which cover public pages only (`/my-account/` portal chrome is already excluded in
page-confirmations.md, and the same boundary applies to the `/admin` CMS). Route to the admin
review round. Initiative 5 (admin-roles + admin-nav-reorg, landed 2026-07-15) reorganized the
sidebar and may have moved some of these; verify against the landed nav before acting.

- **"Payment-due presentation in Members"** — separate the standing value from the payment-due
  flag (a badge, not inline concatenation). Admin review round.
- **"Count mismatch on the same screen"** — "1-10 of 23 members" vs "25 members across 15
  households"; one count must name the archived delta. Admin review round.
- **"Header stack reads doubled"** — the eyebrow, page title, and list header repeat; consolidate
  the heading hierarchy. Admin review round; check whether initiative 5's nav reorg touched it.
- **"Members AND Memberships in the sidebar"** — a memberships view distinct from the member-people
  list. **Possibly landed** — initiative 5 shipped the split-desk nav plus membership admin
  (`0023_membership_admin`, `listSeasonMemberships` in `money-store.ts`). Verify the nav before
  scoping; connects to the MW-absorption membership-management item.
- **"Already handled separately"** — the double-Settings relabel (shipped) and the sidebar
  scroll-bleed / auto-collapse (engine fixes). **(c) superseded** per the item's own note.

## Human / cutover checklist (Geoff's, not code)

Out of the design sweep entirely; route to the mw-cutover runbook. Stripe sandbox→live key
swap, the magic-link smoke clicks, the ops events/classes 410 flip, the apex DNS cutover, and
the MembershipWorks subscription cancel.

## Suggested execution order

Start with **Group 1**, then **Group 2**, then **Group 6**, then Groups 3-5. Group 1 carries the
highest member traffic and is the fastest to confirm: home and education are already logged, so
the session finishes only racing, events, join, members, and contact, and it is the natural home
for the `.page-cta` ratification that five later pages depend on. Group 2 follows because the
Members-menu children and the membership/renewal how-tos are high-weight member reading that no
confirmation has touched yet, and they are where the `.page-cta` rollout first pays off. Group 6
comes next: it holds the one visible content defect in the whole backlog (the Matrix-code
thumbnail) and needs the posts/bulletins composition spec written before it can be confirmed, so
it should not be last. Groups 3 (governance), 4 (storage), and 5 (forms/system) close the sweep;
they carry no backlog defects, run on the most uniform templates, and are the lowest-traffic
narrative surfaces, so they are the cheapest confirms once the shared devices are settled.
