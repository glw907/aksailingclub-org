# Cairn editor/role management — the ASC consumer brief

For the cairn-cms brainstorm filed in that repo's Next tier (one identity, a
site-declared role vocabulary; ASC named first consumer). This is the consuming site's
requirements statement and evidence, written from ASC's seat. The engine design is
cairn's; nothing here prescribes implementation.

## The shape, confirmed from this seat

The committed shape — the engine keeps owning identity end to end (allowlist, editor
table, ManageEditors screen), the role column opens to a site-declared vocabulary in
committed config, each declared role mapping to one engine capability level
(owner-level / editor-level / none), and `locals.editor.role` typed to the declared
vocabulary — collapses exactly the machinery this site had to build: the parallel
`club_roles` table, the second grant/revoke screen in Settings, the duplicated
last-owner guard, and the bridge from cairn's session to our own binding. ASC commits
to collapsing onto the seam at its `membership-admin` initiative (ROADMAP.md), as the
first consumer.

The boundary that stays: member-scale auth (`member_tokens` / `member_sessions`,
`/my-account`, the magic-link member login) is a separate system and remains so —
Geoff's 2026-07-13 separation ruling. The allowlist is staff-scale; members never
appear in it.

## ASC's declared vocabulary (the config this site would commit)

- `owner` → owner-level. Manages the allowlist; today's two seeded rows.
- `club-admin` → editor-level. Committee volunteers who run the club screens
  (events, classes, signups, assets, announce) and plausibly also edit site content.
  If the club later wants club-admins locked out of content editing, the mapping
  drops to `none` in config with the club screens granted by site routes — the
  shape makes that a config tune, not a contract question. That flexibility is a
  point in the shape's favor.
- `instructor` → none. Sign-in identity only, today aspirational (zero rows): the
  future surface is per-class rosters granted entirely by site routes.

## The seam question ASC needs answered explicitly

A `none`-capability role has "no engine admin surface at all; everything they can do
is granted by the site's own routes." ASC needs that stated as a contract guarantee:
a `none` session still authenticates and still reaches site-mounted admin routes
(the `CairnAdminShell` custom-route seam) when the site's own gate admits it. If
`none` instead meant "cannot enter the admin shell," the instructor mapping breaks
and ASC would need instructor at editor-level with site-side denial — the exact
duplicated-guard pattern the shape exists to kill.

## Requirements that carry over regardless of shape

1. **Email matching must be normalization-safe.** ASC normalizes emails on every
   write path (lowercase, trimmed) — a ruling born from real matching failures during
   the MW import. The allowlist should store lowercase and compare lowercased; a
   mixed-case sign-in silently losing its role is the likeliest silent failure
   between the systems. The same email is also the join key to ASC's member domain
   (an instructor's editor row ↔ their `members` row), so one normalization rule
   must hold on both sides.
2. **The last-owner guard, now strictly the engine's.** Removing or demoting the
   final owner-level entry must be refused atomically. ASC's `club_roles` learned
   this at pass 2.1 (the compare-and-set guard, confirmed by security review); the
   race exists verbatim in the ManageEditors screen, and after the collapse the
   engine's guard is the only one.
3. **Seeded rows survive migration with a sane default**, and a fresh site gets a
   deliberate bootstrap owner (a config-declared owner would also retire the
   hand-seed step ASC's own setup needed).
4. **Adding an editor sends nothing.** The allowlist row IS the provisioning under
   magic-link; no invite ceremony as a dependency of access.
5. **Grants, revokes, and role changes are auditable.** Engine's own log or emitted
   events a site can sink — silent role changes on a member-facing site's CMS are
   not acceptable at go-live.
6. **The screen mounts through the existing `adminNav` seam**, owner-visible, zero
   site wiring.

## The two flagged forks, answered from the consumer seat

- **Capability mapping: hold the line at three levels.** ASC's whole vocabulary maps
  onto them with room to spare (see above); anything interrogable is the
  policy-engine slope the charter forbids, and this consumer has no case for it.
- **Nav visibility: per-request code is fine.** ASC already filters admin nav per
  request (`club-nav-filter`) and would keep doing so keyed on the typed role; no
  declarative knob needed.

## What ASC retires at the collapse (the membership-admin work item)

The `club_roles` table and its migrations-forward uses; the Settings screen's
grant/revoke section; the club layout guard's own role lookup (switches to the typed
`locals.editor.role`); the site-side last-owner guard. `class_instructors` (display
linkage, `member_id`-keyed) is untouched. Member auth is untouched.

## Explicit non-needs (YAGNI guardrails from this consumer)

No per-concept or per-path permissions. No draft/approval workflow tiers. No invite
flows or passwords. No member-scale auth in the allowlist, ever. No cross-site
identity. No role UI in the consuming site.

## ASC's concrete state, for sizing

`AUTH_DB` = `cairn-asc-auth` (this site's own instance; schema owned by cairn's
migrations). Two editor rows today, both Geoff's addresses; `club_roles` holds one row
(owner). Steady state after go-live: roughly three to six volunteers, a few changes a
year. The operator today is a Claude session with wrangler; the point of the screen is
that a board member replaces that operator. ASC trials the shipped seam at
`membership-admin` and files friction back, the established harvest pattern.
