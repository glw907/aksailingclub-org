# Member directory — plan (2026-07-17, reshaped for roles & committees)

Executes docs/2026-07-17-member-directory-design.md AND
docs/2026-07-17-roles-committees-design.md (read both first; the roles spec
supersedes the directory spec's decision 6, and its ratified decisions govern every
roles/committees task). Runs as its own pass in a fresh session, first in the
pre-cutover queue. OPUS CONDUCTS (Geoff, 2026-07-17): development against two
ratified specs, with the T0 probes composing inside the existing portal-derived
design language and gating on Geoff's verdicts either way. If the probe arc turns
genuinely novel design work, propose a Fable sitting in one sentence per the
suggestion rules instead of silently absorbing it. Sonnet implementers per task; the
conductor reviews each diff and verifies the full gate (`npm run check`, `npm test`,
build) between dispatches; baselines are CI-canonical (regen via the ci.yml
update_snapshots dispatch only). Design work binds to the resolved-craft bar, the
probe-iteration process, and the portal pass's standing ruling: probes grounded in
real rows and both themes BEFORE ratification.

## T0 — Design probes (conductor-led, Geoff-gated; no build until ratified)

Outcome: ratified HTML probes for the directory composition at 390 and 1440, both
themes, built from REAL data: pull actual member/household rows (names recased as the
import left them), real assignment free text for seeded-boat plausibility, and the
seed roles from the published /committees At-a-Glance table. Probes cover the entry
anatomy (name, household + city, titles, boats with kept-on, contact per visibility
state), the search-plus-chips header, empty/thin states (few boats early on), and the
mobile composition as its own screen. STATE: the round-1 probe is BUILT and awaiting
Geoff's verdict on the non-roles parts; its roles rendering (filled navy-tint chip
for held positions and derived chair titles, quieter outline marker for plain
committee membership) is now the spec's decision 6 rendering and stands unless Geoff
overturns it at verdict. Geoff verdicts per the probe-iteration process; verdicts log
to docs/design-benchmark/member-directory-round-1-arc.md and distill to decisions.md
at settle. The portal masthead/rail stay unborrowed; full-bleed only with logged
justification.

## T1 — Schema: boats, committees, committee_members, member_positions

Outcome: asc-club migrations with forward/rollback/verify, scratch-proven then
applied live, carrying four tables. `boats`: id, household_id (FK), name,
class_model, sail_number nullable, kept_on TEXT CHECK ('trailer','mooring') DEFAULT
'trailer', timestamps. `committees`: id, slug, name, description, kind TEXT CHECK
('standing','established'), sort_order, archived_at, timestamps. `committee_members`:
id, committee_id (FK), member_id (FK), role TEXT CHECK ('chair','co-chair','member')
DEFAULT 'member', status TEXT CHECK ('pending','active') DEFAULT 'pending',
timestamps, UNIQUE (committee_id, member_id). `member_positions`: id, member_id (FK),
kind TEXT CHECK ('officer','director','appointed'), title TEXT NOT NULL, sort_order,
timestamps. The flat `member_roles` table from the superseded decision 6 is never
built. No visibility schema change (directory spec decision 7). Tests assert every
CHECK constraint, FK behavior, and the UNIQUE pair.

## T2 — Boat seeder from assignment free text

Outcome: a verified-import script in scripts/import (dry-run plan, audit trail,
verify.sql, rollback) that parses asset-assignment free text into boats rows where a
boat is recognizably described, sets kept_on='mooring' for households holding a
mooring assignment, and SKIPS ambiguous text rather than guessing (the audit lists
skips). The directory never reads assignment data at runtime; seeding is the only
touch. Dry-run output reviewed by the conductor before live apply.

## T2b — Committees and people seeder

Outcome: a verified-import script (same pattern as T2) that seeds the seven
committees (Fleet, Site, Program, Membership & Events, Harbor as 'established';
Finance, Board Development as 'standing'; descriptions drawn from the committees
page's own summaries) and the first people rows from the published /committees
At-a-Glance table: the four officers as member_positions kind 'officer', chairs and
the Membership co-chair as active committee_members rows with the right role. All
four officers hold board seats by construction; plain 'director' rows for any current
director without an office come from Geoff at import review (the dry-run plan is the
prompt for that list). Names match against `members`; misses land in the audit, never
guessed. Dry-run reviewed by the conductor, and the director list confirmed by
Geoff, before live apply.

## T3 — Directory query and listing rule

Outcome: the directory read joins members, households, boats, member_positions, and
active committee_members (with committee names), and lists only current-or-grace,
non-archived, non-hidden members (directory spec decision 8), sourcing standing from
the unified-signup machinery's definition, never a directory-local clock. Chair
titles DERIVE in this layer ("{committee.name} Chair" / "{committee.name} Co-Chair");
they are never stored (roles spec decision 2). Partial visibility nulls contact
fields; visible exposes them; boats, positions, and committee memberships show for
any listed member. Pending committee rows never appear in directory data. Unit tests
cover each visibility state, the grace boundary day, an archived member, a household
with multiple listed members sharing one boat, derived chair titles, and the
exclusion of pending rows.

## T4 — The directory screen

Outcome: /my-account/directory rebuilt to the T0-ratified composition: one search box
matching across member name, boat name, position title, and committee name; the chip
row (Board & chairs, Instructors, On a mooring) reading Board & chairs from positions
kinds officer/director plus chair/co-chair rows, and Instructors from the appointed
'Instructor' title; person-first entries rendered fully inline with the ratified
roles rendering (filled chip for positions and derived chair titles, outline marker
for plain membership); mobile as its own composition with 44px targets and
thumb-reach actions. Search filters client-side at club scale (~210 members, the
whole list in page data, as today). Recognition over recall: one obvious thing to do
on arrival. Design-probe gates (scripts/design-probe.mjs) pass; both themes composed,
not just light.

## T5 — Member edit surface: boats and the preview

Outcome: boat add/edit/remove on the household screen (primary) and profile screen,
same override precedence as visibility today; the profile "what others see" preview
extends to show positions, committee memberships, and boats under each visibility
state (the choice stays legible to an occasional user; roster names stay visible even
for hidden, per roles spec decision 5, and the preview says so plainly). Server
actions validate kept_on against the CHECK values and lengths; no new auth surface in
this task (committee actions live in T6b).

## T6 — Admin screen: committees, memberships, positions

Outcome: a minimal club-admin CRUD covering the whole model: committees (create,
edit name/description/kind/sort, archive — archived committees keep roster history
and vanish from member surfaces), committee memberships (add/remove members, set
chair/co-chair/member, approve or decline pending requests), and member_positions
(assign kind + title, edit, remove, reorder). Deliberately small: the queued
admin-nav-reorg + admin-roles pass absorbs it later (named seam). The screen groups
current holders by committee and by title so election-time updates are one sitting.

## T6b — Portal committees page, delegation, and the public directive

Outcome: /my-account/committees listing every active committee with description,
chair(s), and roster (active rows only; names render regardless of
directory_visibility, contact never shown beyond the visibility dial). A member sees
request-to-join (writes a pending row, notifies the chair(s) by email via the
existing job-runner machinery) or their pending state, and leave on their own
memberships; decline and leave delete the row. Management affordances render per the
roles spec's permissions table, derived from the model, not cairn editor roles: a
chair/co-chair sees the pending queue and add/remove on their own committee; a board
member (kind officer/director) additionally sees appoint/remove chair and committee
create/edit/archive. Server actions enforce the same predicates server-side; tests
cover each actor tier including the denial cases (a plain member cannot approve; a
chair cannot touch another committee; a non-board member cannot appoint). The public
/committees page's At-a-Glance table renders from live data via a content directive
(the join-page price-directive pattern), replacing the hand-maintained table in
committees.md; the page's prose stays authored. The new page's composition follows
the portal design language, probed at 390/1440 both themes from real seeded rows and
Geoff-verdicted before build (the resolved-craft bar applies at build time).

## T7 — Verification and the deploy gate

Outcome: e2e visual specs for the directory AND the portal committees page (both
themes, five-viewport bar composed at the extremes) with CI-minted baselines via the
update_snapshots dispatch (read the run log, not its conclusion); svelte-reviewer and
daisyui-a11y-reviewer fan-out on the changed surfaces, plus web-auth-security-reviewer
on the T6b authorization predicates and server actions (new member-scale authz is
this pass's riskiest surface); a fresh-context whole-page coherence read at 390/1440
(the expert-tells question); then Geoff's before/after against the ratified probes.
The sitewide 44px backlog gap stays out of scope, but nothing NEW ships under 44px.
