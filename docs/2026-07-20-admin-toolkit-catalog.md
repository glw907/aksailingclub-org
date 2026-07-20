# Cairn admin toolkit catalog — walkthrough observations

> Running log for the admin toolkit catalog initiative (kickoff:
> `docs/2026-07-20-admin-toolkit-catalog-kickoff.md`). Mode: "I drive, you react" — the
> assistant captures each ASC admin screen locally (real `asc-club` data copied into the
> local replica) and Geoff reacts to what's rough. Each stop records Geoff's reactions,
> the screen's bespoke inventory, and the toolkit implication (the component or recipe
> cairn should ship so a future assistant builds this screen polished by default).
> The catalog's final home (ASC harvest doc vs. cairn-cms initiative) is an open fork,
> deliberately settled after the walk.

## Cross-cutting — no local-dev auth story (Geoff, 2026-07-20)

Raised while trying to browse the local admin: "Wouldn't it be useful to have a
non-gated local version?" Cairn's only door is the production magic-link flow, so every
local context reinvents session minting — `e2e/helpers/admin-session.ts` INSERTs
editor/session rows into the replica, the walkthrough driver re-authors the same recipe,
and a human signs in by pasting a cookie through devtools. Toolkit implication: a
dev-only auto-login (gated on a `.dev.vars` flag that cannot exist in production, with a
role picker so any declared role can be entered) would make local admin work
one-command, and per-role verification (pass B's sidebar walkthrough) trivial.

## Stop 1 — Members (`/admin/club/members`, 2026-07-20)

Captured at 1440, Administrator session, live-data copy (288 members / 149 households).

**Geoff's reactions:**

1. Rows are too tall.
2. The city isn't necessary in the summary view.
3. The interface around the search area feels cluttered.
4. "Tier & Amount" is a strange title — what columns belong in the summary view needs
   reconsidering.
5. The whole interface feels a bit "thrown together."
6. Alternating row colors might improve readability.
7. The primary-member indicator (the star suffix on the member chip) doesn't work well —
   primary member could be its own column. (Reacted during stop 2; the star is an
   unlabeled convention with no legend anywhere.)

**Bespoke inventory (nothing here comes from cairn beyond the shell):** the filter
cluster (search input, standing select, include-archived toggle, Add household CTA,
loose two-row right-aligned layout); the hand-rolled table (HEADER_CELL micro-labels,
standing-chip vocabulary with date logic in the label — "Lapsed — last 2024", member
name chips with a primary-member star, em-dash empty cells, an unexplained `1 !`
attention mark in Assets); bespoke pagination ("Page 1 of 15", Prev/Next); the count
line floating under the title. Real data also surfaced: name+city two-line stacks
inflate row height; multi-member households wrap chips so row heights vary; the tier
column mixes "$500" with "$0 / Comp".

**Toolkit implications:**

- **List toolbar recipe** — a standard header band composing search + filters + primary
  action with designed spacing. Every ASC list screen improvises this cluster; that is
  the "cluttered" and "thrown together" feel.
- **Summary-table recipe with a density contract** — standard compact row height, zebra
  option, a stance on multi-line cells (summary rows should not stack secondary facts;
  city belongs on the detail page). Column curation guidance: a summary view earns each
  column.
- **Chip/badge vocabulary component** — standing chips, count-with-attention marks, and
  primary-member stars are all site-invented with no legend surface.
- **Pagination component** — trivially reusable, currently hand-rolled per screen.

## Stop 2 — Money & Renewals (`/admin/club/money`, 2026-07-20)

Captured at 1440 full-page plus three section crops, live-data copy.

**Geoff's verdict: the page needs a reset, not polish.** It should restart with a
brainstorm that documents the screen's purpose and common use cases, with the UI/UX
flowing from that — the same function-first doctrine as the events-redesign pass.

**Geoff's reactions:**

1. The summary section looks totally undesigned.
2. The page is an incredibly long scroll.
3. It opens with "Renewal candidates," which isn't really useful information — most of
   those households are members who simply opted not to renew.

**Assistant's inventory (pre-reaction):** the page measures 9,675px tall — stats band,
Renewal candidates (~36 rows), Attention, the full ~100-row Memberships-by-season
table, and ~40 ledger entries all stacked in one scroll with no pagination or
collapse. Three list idioms coexist on one page (plain table, floating attention rows,
a bulleted ledger). The ledger puts a red "Refund on desk" action link on every row
(alarm color as furniture), prints each amount twice, shows "Dues · Membership dues"
double-labels, and renders every timestamp as "4:00 PM" (midnight UTC through the
Anchorage formatter). The stats band shows `$30044` with no thousands separator. The
season picker is a bare text input plus a "View" button.

**Toolkit implications:**

- **Stat-tile/summary-band component** — the "undesigned" summary is hand-stacked
  micro-labels; a real primitive with number formatting (thousands separators) is the
  fix. Same gap as pass-B harvest finding 5 (the Overview strip's dead daisy classes).
- **Page-composition guidance** — nothing in the toolkit says what a screen owes:
  sections that collapse or paginate, an above-the-fold contract (lead with what the
  operator acts on, not the biggest available list), a cap on list idioms per page.
- **Action-link discipline** — destructive/corrective actions (refund) need a quiet
  default presentation; semantic red belongs to state, not standing furniture.
- **Money/time formatters as toolkit citizens** — cents-to-dollars with separators,
  and a stance on date-only values so they never render as midnight-UTC timestamps.

**Disposition:** a future `money-redesign` pass (functional brainstorm first) — ASC
work, separate from the toolkit initiative; the toolkit provides the primitives that
pass would compose.

## Stop 3 — Classes + Class waitlist (`/admin/club/classes`, `/classes/waitlist`, 2026-07-20)

Captured at 1440, live-data copy; the waitlist doubles as the walk's first empty state.

**Geoff's reactions (Classes):**

1. Text overflows the pills.
2. The screen doesn't really serve its function — a class needs to be an expandable
   object that shows its members.
3. Prior-year classes are rarely referenced (yet the flat chronological table opens
   with June 2024 and buries the upcoming season at the bottom).

**Assistant's inventory:** one flat table across three seasons, oldest first, "15
classes on the books" counting history and future together; over-capacity fractions
("19/10 Full", "22/10") rendered without comment; inconsistent state treatment ("Open"
gets a tinted chip, "Full" is bare text); a Capacity column redundant with the
fraction in Enrolled; a Visibility column printing an identical "Visible" chip on
every row. Breadcrumb reads "Overview › classes" (lowercase leaf; every page claims
Overview as parent). Sidebar: with Classes inside the collapsed Events & Classes
group, no nav item shows the current page — Overview keeps its highlight; the
current-page signal disappears whenever the active item's group is collapsed (shell
behavior, kin to pass-B finding 6). The waitlist empty state is a full-width card
holding one centered grey sentence — present but unhelpful (nothing says what fills
the queue or where offers originate).

**Toolkit implications:**

- **Expandable/master-detail row recipe** — the headline gap: a list row that opens in
  place to show its children (class → enrollees) is a whole missing component genre;
  ASC's alternative today is navigating away per class.
- **Chip component with real text containment** — the overflow is a symptom of chips
  being hand-rolled spans; a toolkit chip owns its padding, truncation, and min-width.
- **Time-scoped list guidance** — default lists to the operationally relevant horizon
  (current/upcoming season) with history behind a filter, not a flat all-time scroll.
- **State-vocabulary consistency** — one presentation system for states (Open/Full),
  including the over-capacity case, which deserves an explicit visual voice.
- **Empty-state recipe** — an empty state should explain what fills the surface and
  link the action that does; the bare-sentence card is the current ceiling.

**Disposition (Geoff):** like Money, Classes should restart with a function-first
brainstorm — purpose and common use cases documented first, the UI flowing from that.

**Requirements evidence for that brainstorm (Geoff, during the walk):** an easy
mechanism to move a paid student from one class to another. The current screen has no
per-class roster surface at all, so a transfer is invisible to the UI today; the
toolkit angle is a "move between containers" action pattern (pick person → pick
destination → money follows), which likely also serves asset reassignment.

**Requirements evidence (Geoff, 2026-07-20, during the Members brainstorm):** class
rosters should show each student's age (derived from `members.birthdate` — "that's
definitely something we want to see for classes"). The Members pass's household panel
establishes the age-rendering idiom; the roster surface inherits it.

## Stop 4 — Assets (`/admin/club/assets`, 2026-07-20)

Captured at 1440 full-page (3,074px), live-data copy.

**Geoff's reactions:**

1. Assets joins the function-first reset column, though it's closer to salvageable
   than Money or Classes.
2. The per-type lists should probably be collapsible.
3. Rows are generally a bit too tall — they *look* nice, but they create a lot of
   scroll. The admin screens should be polished and nice to look at AND
   functional-first; when the two conflict, function leads.
4. Alternating row colors would help (second screen to draw this reaction).
5. Start with a functional analysis of what admins actually do with the screen, and
   have the UI/UX flow from that.

**Assistant's inventory:** a third list architecture in three screens (pagination /
stacked sections / grouped sub-tables under a hand-rolled pill-tab switcher); the
household column prints the same name twice ("Bob Chivvis · Bob Chivvis") on nearly
every row; over-capacity headers ("10/5 assigned", "19/15 assigned") pass unremarked,
same as class enrollment; red "Release" on all 41 rows (the per-row alarm-link pattern
again); payment states inconsistently dressed (chip for "Paid", other treatments for
"Outstanding"/"Not billed"); free-text descriptions pass through in shouting mixed
case ("TRAILER"/"BUCC"/"sailboat"); the screen's main action (the Assign form) sits at
the very bottom of the scroll. Sidebar finding resolved here: **Overview is
highlighted on every page** — the shell prefix-matches `/admin` against every path, so
two nav items always show active (engine bug, beside the collapsed-group
no-active-signal gap from stop 3).

## Stop 5 — Class detail + Email compose (`/classes/[id]`, `/email/compose`, 2026-07-20)

Captured at 1440, live-data copy (1st Adult Intro Class).

**Geoff's reaction:** the class detail page is an unstyled and unfinished mess.

**Assistant's inventory (class detail):** the roster renders raw enrollment UUIDs
("83550258-795f-…, Unpaid, Drop") — no names; the exact surface a student transfer
would live on cannot say who is enrolled. Every roster row claims "Unpaid" (the
imported enrollments have no payment rows) with the standing red per-row "Drop" link.
"18/10 enrolled, full." as plain prose (third over-capacity surface). Stray bullet
glyphs float beside centered empty-state sentences (Instructors, Waitlist). The edit
form is the walk's first real form: bespoke label-left rows, inconsistent two-column
pairing, a lone red "Delete" floating top-right, Save at the card bottom. The
breadcrumb never carries the class name ("Overview › classes").

**Disposition (Geoff):** full brainstorm and reset; not worth diving deeper in the
walk. (Quick fact for that reset: the data is intact — enrollments carry valid
`member_id` FKs and `members.name` exists, including `fee_paid`/`stripe_ref` on the
imported rows; the roster UI simply never joins to members, and its Unpaid chip
ignores `fee_paid`. Confirmed live by Geoff on dev: an enrollee "named"
0b4694c5-c253-445a-99fd-9c43dd038951.)

**Assistant's inventory (email compose):** the page titled "Compose" is actually the
blast-history screen (empty table, "No blasts sent yet," a "New email" CTA) — the real
composer sits behind the CTA/deep link. Another bare-sentence empty state.

**Toolkit implications:**

- **Form recipe** — the biggest unserved genre after tables: field-row layout,
  two-column pairing rules, primary/destructive action placement (Delete quarantined,
  not floating in red at page top), section headers, helper-text register.
- **Person-reference component** — a roster row should render a person (name, link,
  state chip) from an id; raw-id fallback is a bug the toolkit should make hard to
  write.
- **Detail-page skeleton** — title carrying the entity name into the breadcrumb,
  summary facts, child collections as designed sections.
- **Empty states again** — the floating-bullet-beside-centered-text quirk shows even
  the empty state is assembled per screen.

## Initiative shape — settled (Geoff, 2026-07-20)

The admin screens get taken on **one by one, each as a full pass opening with its own
functional brainstorm** (purpose, common use cases; UI/UX flows from that). Components
and standards are **harvested as we go** — each pass distills what it built into
reusable toolkit pieces and written standards, so later passes start further ahead and
the process compounds. This supersedes the kickoff's either/or (catalog-then-build vs
cairn-initiative-first): the catalog below is the standing evidence base each pass's
brainstorm draws from, and the cairn toolkit accretes from the harvests rather than
being designed up front. The already-queued `events-redesign` pass fits this same
model. The research phase (methodology ruling below) rides the early passes: table
density, striping, and form-layout evidence gets surveyed once and each later pass
inherits the citations.

**Pass ordering (Geoff):** Members first, probably followed by Classes or Assets.

## Methodology ruling (Geoff, 2026-07-20)

The walkthrough reactions (density, zebra striping, collapsible sections, …) are
hypotheses, not conclusions: "this sort of thing should be grounded in research and
science, not just my impressions." The initiative therefore includes a research phase
before any toolkit recipe locks — survey the published UX literature (NN/g and peers on
data-table density, striping, scan patterns) and the documented decisions of mature
admin design systems (IBM Carbon, Shopify Polaris, Atlassian, Material) and cite what
the evidence actually supports. Where the literature is thin, say so and fall back on
convention plus Geoff's verdict, explicitly labeled as such.

## Sweep inventories (assistant-filed, 2026-07-20; no Geoff reactions yet)

Captured to complete the evidence base after the initiative shape settled. Shots in the
session scratchpad; recapture is one `walk.mjs` run per path.

- **Member/household detail** (`/members/[id]`): the best detail page so far, but the
  roster row carries five inline controls (Visible chip, Signatures, Edit, Move…, red
  Archive); "Change tier" is wedged into the memberships table's State column; the money
  timeline repeats the ledger idiom (red per-row Refund, doubled amounts, "4:00 PM");
  breadcrumb never carries the household name.
- **Events** (`/events`): the cleanest list screen — but category chips have four
  different dressings (tinted Racing, bare Operations, light Social, dark Governance),
  and Visibility is another all-same-value chip column.
- **Event detail** (`/events/[id]`): the cleanest form (paired columns, date/time
  inputs); still the floating red top-right Delete, monospace textareas for prose
  descriptions, generic breadcrumb.
- **Club settings** (`/settings`): micro-forms per setting with three separate Save
  buttons at inconsistent positions; the season rollover is a red outline button; the
  Club-roles cluster cross-links into cairn's Editors screen.
- **Waivers** (`/documents`): TWO stacked page headers ("Waivers & acknowledgements"
  then "CLUB / Season rollup" — an assembly tell in the chrome itself); the same bare
  season-text-input + View as Money; a third badge treatment (amber/green count
  pills); Signed shows green "0" for every document.
- **Announce** (`/announce`): a picker-table of recent posts whose "Announced" column
  is all em-dashes; harmless but another all-same-value column.
- **Email index** (`/email`): dumps ~22 templates (raw `{{item_display_name}}`
  placeholders as subjects) and then THE ENTIRE SEND LOG, unpaginated (a 6,400px page).
  **Every visible send-log row reads "Failed"** (Jul 14, 2026, 12:13–12:15 AM) — needs
  a live check: real incident or import artifact. Flagged to Geoff during the walk.
- **Assets "By person" tab**: household rows stack per-asset lines each carrying chip +
  Record payment + red Release; the name-doubled household column again; the [DEMO]
  household sorts first (bracket beats alphabet).
- **Assets "Waitlist" tab**: captured (`assets-waitlist.png`).

## Emerging cross-cutting themes (running)

- **Function-first resets ordered so far:** Money, Classes, Assets (Assets closest to
  salvageable). Each opens with a functional analysis of what admins do on the screen;
  UI/UX flows from that. The toolkit's job is the primitives those redesigns compose.
- **Density doctrine:** rows too tall on every list screen so far; looks-nice-but-
  scrolls is the standing failure mode. The toolkit's table recipe needs a compact
  default, zebra option, and single-line-row stance.
- **Collapsible sections** for any grouped list; **pagination or scoping** for any
  unbounded one.
- **One state-chip system** with text containment, an over-capacity voice, and a
  legend surface.
- **Per-row action discipline:** corrective actions (Release, Refund) quiet by
  default, never a red link on every row.
