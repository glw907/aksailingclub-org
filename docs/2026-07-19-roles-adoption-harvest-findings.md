# Cairn DX-harvest findings from the roles-adoption pass (pass A, 2026-07-19)

> Filed per the standing harvest mandate: engine deficiencies this pass hit while adopting
> cairn 0.88's access seam, for the next cairn-cms pass to triage. Each is cited to the
> shipped `@glw907/cairn-cms@0.88.1` source or docs. ASC-side workarounds are in place and
> noted; nothing here blocks the site.

## 1. The reserved `owner` role cannot be renamed, and the grant UI offers the phantom

`defineRoles` hard-requires a literal `owner` key mapped to owner capability
(`dist/auth/roles.js` throws without it), so a site adopting a display vocabulary
(ASC: `Administrator`) must declare two owner-capability names. The `ManageEditors`
screen then lists every vocabulary key as grantable (`dist/sveltekit/editors-routes.js`,
`vocabularyList = Object.keys(vocabulary).map(...)`), so the phantom `owner` appears
beside `Administrator` in both the add-editor and role-change selects as a second,
confusing owner-level option. No escalation risk (the screen is owner-gated, and the
grant confers nothing the grantor lacks), but the wart sits in the roster UI every
admin sees. Wanted: let a site rename or display-label the reserved owner, or let the
editors screen hide vocabulary names the site marks internal.

ASC workaround: `owner` stays declared and un-granted; the reasoning is documented on
the `defineRoles` block in `src/theme/cairn.config.ts`.

## 2. The access guide's two-file pattern crashes on an ES-module cycle

`restrict-admin-access.md`'s worked snippet has `cairn.access.ts` import `roles` from
`cairn.config.ts` and declare `export const access = defineAccess(roles, {...})` at top
level, with `cairn.config.ts` importing `access` back for the adapter — but the roles
guide itself directs sites to declare `roles` inside `cairn.config.ts`, making that a
genuine two-file cycle. Following both guides literally throws
`ReferenceError: Cannot access 'roles' before initialization` at module load (confirmed
with a minimal two-file Node ESM reproduction). Wanted: fix the guide's snippet, or
accept a factory/thunk for `defineAdapter`'s `access` member.

ASC workaround: `src/theme/access.ts` exports a `buildAccess(roles)` factory that
`cairn.config.ts` calls once right after `roles` is declared; construction-time
validation still runs against the real vocabulary.

## 3. The 0.88.0 changelog's "no behavior change" claim misses a breaking type change

The changelog states "every addition above is additive, and a site that declares none
of it sees no behavior change" with no `Consumers must:` action — but
`ResolveNavLayoutOptions` replaced its loose `capability`/`role` pair with a required
`editor: Editor` field. Any consumer calling (or unit-testing) `resolveNavLayout`
breaks statically and at runtime (`Cannot read properties of undefined (reading
'role')`). ASC's `nav-layout.test.ts` did, on the bare bump. Wanted: a `Consumers
must:` entry whenever an exported signature changes shape, additive release or not.

## 4. `canReach`'s permissive no-map fallback is a trap for site-side action gates

`canReach(undefined, editor, target)` returns `true` for any editor-capability session
(`dist/auth/access.js`), the zero-config nav floor — while `requireAccess`/
`hasAccessRule` fail closed on a missing rule. A site composing `canReach` directly
inside its own form actions (the pattern pass A adopted in `clubAdminAction`, since
form actions never re-run the ancestor layout's `load`) silently inherits the
permissive fallback if the map is ever unwired from the guard: the read side breaks
loudly (403 everywhere) while the write side fails open. Both pass-A reviewers flagged
it. Wanted: an exported action-side helper with `requireAccess`'s fail-closed stance
(or a `canReach` variant that throws on an absent map), so sites don't each hand-roll
the guard.

ASC workaround: `clubAdminAction` fails closed (audited 500) when `locals.cairnAccess`
is absent, before any `canReach` call; every route-action test fixture injects the real
map so the fallback can never hollow a test again.
