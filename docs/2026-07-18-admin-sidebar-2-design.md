# Admin sidebar round 2: functional design

> Spec for the `admin-sidebar-2` initiative (ROADMAP). Brainstormed interactively with
> Geoff and settled 2026-07-18, in-session beside the waivers build. Round 1 (initiative
> 5, 2026-07-15) shipped the split-desk tree on cairn's `navLayout` seam; this round
> reorganizes that tree by purpose, retires two surfaces, adds roles, and needs a cairn
> engine pass first (see Sequencing). The acceptance gate is Geoff's walkthrough.

## Purpose

Arrange the admin sidebar for how the club actually thinks and works. Round 1 grouped
by provenance and frequency; Geoff's review found too many groups, duplicate and
missing icons, labels that fail the "would a volunteer know without clicking" test, a
"Site" heading that collides with ASC usage (site means the physical grounds), and two
surfaces that should not exist at all. Round 2 fixes the taxonomy and adds the
mechanisms the fixed taxonomy needs.

## Ratified decisions (Geoff, 2026-07-18)

1. **Purpose-first groups, four of them.** Club (run the club), Events & Classes (the
   activity surface), Communication (every way the club talks to members), Website
   (the website's own machinery). Provenance grouping (engine screens vs. club
   screens) and the blurry Content/Site split are gone.
2. **Collapsed by default, the working group(s) open.** Groups render as labeled accordions
   (headers always visible, so nothing is hidden). Site-declared defaults set only
   the starting state; the existing per-user cookie persistence always wins after a
   person touches a header. Which group or groups start open is a probe-round
   verdict (Club only, or Club plus Events & Classes).
3. **The Signups screen retires fully.** Joins are automatic and self-serve; the board
   is notified of every paid join by the existing `board_join_notice` email, so the
   post-hoc review queue reviews nothing. Delete the route, its store and tests, and
   the Overview strip's pending-signup-reviews entry. The database table keeps its
   historical rows; no destructive migration.
4. **Bulletins is the one concept; `notifications` retires.** Production (the Hugo
   site) has a single `bulletins` concept: a dated notice with a detail line and an
   expiry whose latest unexpired entry renders as the home banner. The cairn
   migration split that into `bulletins` (feed) plus an invented `notifications`
   concept (banner), duplicating entries. Restore the production model: bulletins
   carry title, date, body, detail line, and expiry; the home banner reads the latest
   unexpired bulletin; the `notifications` concept, its two entries, and its read
   path (`active-notification.ts`) fold away. Manifest regenerates; the freeze-guard
   and fragment-integrity suites update.
5. **Relabels, by the volunteer test.** "Requests" becomes **Asset requests**;
   "Vocabulary" becomes **Tags**; "Site settings" becomes **Website settings**; the
   engine Editors screen becomes **Admin access**; the waivers admin rollup is
   **Waivers** and the signable-document concept editor is **Waiver text**. "Money"
   stays. The "Site" group heading becomes **Website**.
6. **Unique icons for every item.** No shared glyphs anywhere in the tree. Needs the
   engine's icon seams (below). The assignment below is proposed; the probe round
   verdicts it.
7. **Action-count badges.** Quiet count pills on items whose click clears real work:
   Asset requests (pending requests), Committees (pending join requests), Class
   waitlist (offers nearing expiry, freed seats with a waitlist behind them). A
   collapsed group's header shows the sum of its children's counts, so a closed
   group never hides pending work. Counts share the Overview needs-attention strip's
   sources so the two never disagree. Items with status but no admin action (Money,
   Email, content screens) get no badge; Waivers coverage stays on the rollup screen,
   not the sidebar.
8. **Five declared roles, plain-function names** (Geoff, 2026-07-18): **Administrator**
   (full control; renames `owner`), **Club manager** (club operations; renames
   `club-admin`), **Webmaster** (new; website machinery), **Publisher** (new; the
   whole Communication group, publish-and-notify included — posts and bulletins
   usually should send email and announce on Discord), **Instructor**. Publishers get
   no access to Pages; that is Webmaster territory. Waiver text is carved out for
   Administrator/Club manager regardless of group. Instructor stays invisible until
   class-management lands; Events & Classes is purpose-built to become its home (own
   classes, scoped). Renaming the two existing roles is a small data migration on the
   auth store's grant rows, and the engine's last-owner guard follows whatever name
   maps to owner capability.
9. **Two new class surfaces.** A cross-class **Class waitlist** overview screen
   (waitlists exist today only inside each class's detail page), and an **Email class
   members** nav entry deep-linking the compose screen with the class segment
   preselected (the distinct URL keeps the nav href-collision check satisfied while
   compose stays listed under Communication as Email).

## The tree

Order within groups and the icon assignment are proposed here and verdicted at the
probe round; the group structure, membership, and labels are ratified.

**Club** — open by default (candidate)

| # | Item | Icon (Lucide) | Notes |
|---|------|---------------|-------|
| 1 | Overview | `anchor` | needs-attention strip landing; signup-reviews entry removed |
| 2 | Members | `users` | |
| 3 | Money | `banknote` | |
| 4 | Committees | `users-round` | badge: pending join requests |
| 5 | Assets | `package` | |
| 6 | Asset requests | `inbox` | renamed from "Requests"; badge: pending requests |
| 7 | Waivers | `shield-check` | the "is the club protected" rollup (waivers build T6) |
| 8 | Club settings | `wrench` | moved from the old Site group |
| 9 | Admin access | `key-round` | the engine Editors screen, relabeled and moved |

**Events & Classes** — collapsed (default open is a probe question)

| # | Item | Icon | Notes |
|---|------|------|-------|
| 1 | Events | `calendar` | |
| 2 | Classes | `graduation-cap` | |
| 3 | Class waitlist | `list-ordered` | new cross-class screen; badge: expiring offers, freed seats |
| 4 | Email class members | `send` | deep link into compose, class segment preselected |

**Communication** — collapsed

| # | Item | Icon | Notes |
|---|------|------|-------|
| 1 | Posts | `newspaper` | |
| 2 | Bulletins | `bell` | the restored single concept; drives the home banner |
| 3 | Email | `mail` | |
| 4 | Announce | `megaphone` | |

**Website** — collapsed

| # | Item | Icon | Notes |
|---|------|------|-------|
| 1 | Pages | `files` | |
| 2 | Media | `image` | |
| 3 | Fragments | `puzzle` | |
| 4 | Tags | `tags` | renamed from "Vocabulary" |
| 5 | Nav | `menu` | |
| 6 | Waiver text | `file-pen` | owner/club-admin only (legal text; see roles) |
| 7 | Website settings | `settings` | renamed from "Site settings" |
| 8 | Help | `life-buoy` | |

25 items, 25 distinct icons.

## Roles matrix

| Group | Administrator | Club manager | Webmaster | Publisher | Instructor (future) |
|---|---|---|---|---|---|
| Club | all 9 | all but Admin access | — | — | — |
| Events & Classes | all | all | — | — | own classes, scoped |
| Communication | all | all | — | all 4 | — |
| Website | all | all | all | — | — |

Waiver text: Administrator and Club manager only, in every role's view.

Engine capability mapping: Club manager, Webmaster, and Publisher all carry the
engine's editor capability; what distinguishes them is club-role gating (nav and
site actions) plus the engine's new per-concept role gating (below). Instructor
stays `capability: none` until class-management. Enforcement is real, not cosmetic:
nav gating hides doors; `clubAdminAction` and the engine's route guards deny them.
The Email and Announce send actions widen from club roles to admit Publisher
(site-side change, with denial tests for the roles that stay excluded). Badges
follow visibility: no count renders for a queue the session cannot act on.

## Security model (Geoff's ruling, 2026-07-18: roles map to functions; categories are cosmetic)

Roles grant admin functions, never categories. The sidebar tree carries no access
semantics at all: regrouping, renaming, or reordering it requires zero security
review. That said, the taxonomies do coincide almost item-for-item (Geoff,
2026-07-18) — both mirror the club's division of labor, so the permission map comes
out group-shaped in practice (Publisher's grants are the Communication group;
Webmaster's are Website minus the Waiver text carve-out). The coincidence is a
deliberate legibility win: access stays auditable at a glance. It is an outcome of
the map, never the mechanism. The mechanism:

1. **One permission map.** Each admin function (a screen, an action, a concept)
   declares its allowed roles exactly once, in a single site-side module for club
   screens and via the engine's per-concept gating for content concepts.
2. **Enforcement reads the map** at the route and action (`clubAdminAction` and the
   engine's guards) — the real boundary. Deny by default: a function absent from the
   map is reachable by no one, so adding a screen to a group can never silently
   widen a role.
3. **The sidebar derives from the map.** An entry renders iff the session's roles
   reach that function; a group renders iff it has a visible child. No `roles:`
   declarations on nav groups or entries — round 1's group-level gating
   (`CLUB_ROLES` on sections) is removed, not reorganized, so nav and enforcement
   cannot drift.
4. **Item-level grants make exceptions ordinary:** Waiver text sits in the Website
   group while its map entry names Administrator/Club manager; nothing bends.

The roles matrix above is the human-readable summary of the permission map, not an
implementation source; the pass should generate or test it against the map so the
spec's summary and the deployed truth stay identical.

## Engine seam requirements (the cairn consumer brief)

Four seams, one cairn minor version, ASC the named first consumer. The cairn pass
owns the API shapes; these are the consumer's requirements, stated engine-facing
with acceptance criteria in `docs/2026-07-18-cairn-sidebar-seams-consumer-brief.md`
(the handoff document the cairn session reads).

1. **Default-collapsed groups.** A `navLayout` section can declare its default
   collapsed state. The shell's existing cookie persistence is unchanged and always
   wins once set; the declaration only replaces the current all-open starting state.
2. **Icon vocabulary.** The bundled custom-nav icon allowlist widens to cover this
   spec's assignment, and an engine screen ref (`{ screen: ... }`) accepts an icon
   override, since engine-owned icons otherwise collide (both dated concepts share
   the newspaper glyph).
3. **Badges.** The site supplies per-href action counts from its admin layout load;
   the shell renders a quiet pill on the item, sums child counts on a collapsed
   group's header, announces counts accessibly, and renders nothing at zero.
4. **Per-concept role gating and derived nav visibility.** A concept can restrict
   editing to named roles — capability alone is one blunt level that unlocks every
   concept's editor routes, and Publisher-vs-Webmaster (plus the Waiver text
   carve-out) requires enforcement at the route. With it, nav visibility derives
   from reachability (an entry renders iff the session can reach it; a group renders
   iff it has a visible child), replacing declared `roles:` on nav groups and
   entries per the security model above.

## Out of scope

Instructor class-management (its own initiative; this tree just leaves its home
ready), any screen behavior changes beyond the Signups retirement, the bulletins
restoration, and the two class surfaces named above, and the public site's own nav.

## Probe round (before or beside the engine pass)

Static HTML probe of the sidebar at desktop and mobile widths, both themes, real
glyphs, per the standing probe-iteration process. Verdicts owed: the open/closed
defaults (Club only vs. Club + Events & Classes), the icon assignment, and
within-group order. Badge rendering and collapsed-header sums are shown with
placeholder counts.

## Sequencing

1. **Cairn engine pass** (cairn-cms repo, its own session, `cairn-pass` skill): the
   four seams, released to npm as a minor version.
2. **ASC pass** (this repo, after the bump): the tree, labels, the renamed five-role
   vocabulary (`defineRoles`: Administrator, Club manager, Webmaster, Publisher,
   Instructor, with the grant-row rename migration), send-action gates, Signups
   retirement, bulletins restoration, Class waitlist screen, compose deep link,
   badges wiring, probe-verdicted icons/order/defaults, Geoff's walkthrough.

The implementation plan for each unit is written at that unit's pass start, per the
initiative-scoped session pattern; this spec is the contract both plans execute.
