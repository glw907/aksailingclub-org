# Member directory — plan (2026-07-17)

Executes docs/2026-07-17-member-directory-design.md (read it first; its Ratified
decisions section governs every task). Runs as its own pass in a fresh session, first
in the pre-cutover queue. OPUS CONDUCTS (Geoff, 2026-07-17): straightforward
development against a ratified spec, with the T0 probes composing inside the existing
portal-derived design language and gating on Geoff's verdicts either way. If the probe
arc turns genuinely novel design work, propose a Fable sitting in one sentence per the
suggestion rules instead of silently absorbing it. Sonnet implementers per task; the
conductor reviews each diff
and verifies the full gate (`npm run check`, `npm test`, build) between dispatches;
baselines are CI-canonical (regen via the ci.yml update_snapshots dispatch only).
Design work binds to the resolved-craft bar, the probe-iteration process, and the
portal pass's standing ruling: probes grounded in real rows and both themes BEFORE
ratification.

## T0 — Design probes (conductor-led, Geoff-gated; no build until ratified)

Outcome: ratified HTML probes for the directory composition at 390 and 1440, both
themes, built from REAL data: pull actual member/household rows (names recased as the
import left them), real assignment free text for seeded-boat plausibility, and the
real role titles Geoff supplies for the first roles seed. Probes cover the entry
anatomy (name, household + city, role titles, boats with kept-on, contact per
visibility state), the search-plus-chips header, empty/thin states (few boats early
on), and the mobile composition as its own screen. Geoff verdicts per the
probe-iteration process; verdicts log to the design-benchmark arc file and distill to
decisions.md at settle. The portal masthead/rail stay unborrowed; full-bleed only with
logged justification.

## T1 — Schema: boats and member_roles

Outcome: two asc-club migrations with forward/rollback/verify, scratch-proven then
applied live. `boats`: id, household_id (FK), name, class_model, sail_number nullable,
kept_on TEXT CHECK ('trailer','mooring') DEFAULT 'trailer', timestamps. `member_roles`:
id, member_id (FK), title TEXT NOT NULL, sort_order, timestamps; many rows per member
allowed by construction. No visibility schema change (spec decision 7). Tests assert
the CHECK constraints and FK behavior.

## T2 — Boat seeder from assignment free text

Outcome: a verified-import script in scripts/import (dry-run plan, audit trail,
verify.sql, rollback) that parses asset-assignment free text into boats rows where a
boat is recognizably described, sets kept_on='mooring' for households holding a mooring
assignment, and SKIPS ambiguous text rather than guessing (the audit lists skips). The
directory never reads assignment data at runtime; seeding is the only touch. Dry-run
output reviewed by the conductor before live apply.

## T3 — Directory query and listing rule

Outcome: the directory read joins members, households, boats, and member_roles, and
lists only current-or-grace, non-archived, non-hidden members (spec decision 8),
sourcing standing from the unified-signup machinery's definition, never a
directory-local clock. Partial visibility nulls contact fields; visible exposes them;
boats and roles show for any listed member. Unit tests cover each visibility state,
the grace boundary day, an archived member, and a household with multiple listed
members sharing one boat.

## T4 — The directory screen

Outcome: /my-account/directory rebuilt to the T0-ratified composition: one search box
matching across member name, boat name, and role title; the chip row (Board & chairs,
Instructors, On a mooring); person-first entries rendered fully inline; mobile as its
own composition with 44px targets and thumb-reach actions. Search filters client-side
at club scale (~210 members, the whole list in page data, as today). Recognition over
recall: one obvious thing to do on arrival. Design-probe gates
(scripts/design-probe.mjs) pass; both themes composed, not just light.

## T5 — Member edit surface: boats and the preview

Outcome: boat add/edit/remove on the household screen (primary) and profile screen,
same override precedence as visibility today; the profile "what others see" preview
extends to show roles and boats under each visibility state (spec: the choice stays
legible to an occasional user). Server actions validate kept_on against the CHECK
values and lengths; no new auth surface.

## T6 — Admin roles screen

Outcome: a minimal club-admin CRUD for member_roles (assign title to member, edit,
remove, reorder), deliberately small: the queued admin-nav-reorg + admin-roles pass
absorbs it later (spec: down-payment, named seam). Titles are free text, specific by
convention ("Race Committee Chair"); the screen shows current holders grouped by title
so election-time updates are one sitting.

## T7 — Verification and the deploy gate

Outcome: an e2e visual spec for the directory (both themes, five-viewport bar composed
at the extremes) with CI-minted baselines via the update_snapshots dispatch (read the
run log, not its conclusion); svelte-reviewer and daisyui-a11y-reviewer fan-out on the
changed surfaces; a fresh-context whole-page coherence read at 390/1440 (the
expert-tells question); then Geoff's before/after against the T0-ratified probes. The
sitewide 44px backlog gap stays out of scope, but nothing NEW ships under 44px.
