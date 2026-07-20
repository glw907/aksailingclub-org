# The admin toolkit

The cairn admin toolkit's own components, born in this repo's theme layer (ASC is the first
consumer, not the ceiling) per `docs/2026-07-20-members-pass-design.md`'s "Toolkit births" and
`docs/plans/2026-07-20-members-pass.md`. Every contract here is general-purpose: it carries the
convergent shape the research survey's eight-design-system sweep found even where the Members
pass does not exercise the whole thing. A wrong contract shipped here costs one refactor; the same
mistake published to cairn costs every consuming site a breaking change, so generality is decided
before publication, not after.

Citations below point at `docs/2026-07-20-admin-toolkit-research-survey.md` ("the survey"), the
document every toolkit contract answers to. Tier letters are the survey's own (E = a cited
controlled study, C = convergent convention across 3+ of the eight surveyed systems, G = Geoff's
explicit call where the literature is silent).

## The compiled-CSS constraint

`/admin/**` routes render inside `CairnAdminShell` and load **only** cairn's precompiled
`cairn-admin.css` (`src/routes/admin/+layout.svelte`; see also
`src/routes/admin/club/+page.svelte`'s own "Scoped styles, not daisyUI stats" comment). This
site's own Tailwind/daisyUI build (`theme.css`, `src/routes/(site)/+layout.svelte`) never touches
an admin route. Two consequences shape every component below:

1. A daisyUI **component** class (`badge`, `status`, `join`, `table`, `stats`, ...) only works on
   an admin screen if it is already compiled into the packaged `cairn-admin.css` — either because
   cairn's own admin components happen to use it, or because it is in cairn's admin CSS blessed-set
   safelist (`ADMIN_CSS_SAFELIST`, cairn-cms's own `dist/components/admin-css-safelist.js`, shipped
   from 0.88.3). Each component's own section below lists the exact classes it leans on and
   whether the compiled sheet was checked directly (`grep` against
   `node_modules/@glw907/cairn-cms/dist/components/cairn-admin.css`) — the audit surface a future
   daisyUI upgrade can grep against to see its blast radius, per the plan's "stay upgrade-friendly
   to daisyUI" constraint.
2. An arbitrary **Tailwind utility** string (`min-w-[6rem]`, `gap-1.5`, a color opacity fraction)
   only works if that literal string already happens to appear somewhere in cairn's own scanned
   admin source — there is no guarantee, and no safelist covers open-ended utility values. Every
   component below keeps this class of styling (padding, truncation, min/max width, wrapper
   layout) in its own Svelte **scoped `<style>` block** instead, which Vite compiles and ships with
   the component regardless of what cairn's bundle contains. This is the same fix
   `/admin/club/+page.svelte` already applied to the Overview strip's `stats` band before the
   safelist existed, generalized into a standing rule for this toolkit.

The admin shell uses its own two-theme system, `cairn-admin` (light) and `cairn-admin-dark`
(dark) — a separate vocabulary from the public site's `asc`/`asc-dark` — set on the shell's own
root via `CairnAdminShell`'s theme toggle. "Both themes" below always means these two.

## `format.ts`

Pure formatter functions, general-purpose per the survey's "Formatters as citizens" verdict
(**C**, unopposed — "no system disagrees, several ship the helpers"). Every formatter takes its
locale/time zone as an option with a sensible default rather than assuming ASC's own defaults, so
a second consumer in another zone or locale is a parameter, not a fork.

| Function | Contract | Notes |
|---|---|---|
| `formatMoney(cents, options?)` | Signed integer cents in, a currency string with separators out (`30044` → `"$300.44"`, `-4500` → `"-$45.00"`). `options.currency` defaults `'USD'`, `options.locale` defaults `'en-US'`. | Ends the raw-cents artifact the walkthrough caught in the stats band (`docs/2026-07-20-admin-toolkit-catalog.md`). |
| `formatCivilDate(iso, options?)` | A calendar day (no time of day) from an ISO date or the leading 10 characters of a SQLite datetime, parsed at local midnight so it never shifts a day west of Greenwich. `options.fallback` defaults `'Not yet'`. | Never routes through a time-of-day formatter — the "4:00 PM" artifact a civil date picked up when it passed through a timestamp formatter. |
| `formatTimestamp(sqliteDatetime, options?)` | A SQLite `datetime('now')` UTC string as a local date and time. `options.timeZone` defaults `'America/Anchorage'` (the club's own zone, this formatter's first client, not its ceiling). | Pinned by option, not by the runtime's own zone: a Cloudflare Worker's runtime zone is UTC, not the club's. |
| `ageFromBirthdate(birthdateIso, asOf?)` | A whole-years age, turning over on the birthday itself. Reads `null` for a missing or unparseable birthdate. `asOf` defaults to `new Date()`; pass a fixed date for deterministic call sites. | The Members panel's per-member age (`members.birthdate`). |

No daisyUI assembly — these are TypeScript functions, no markup, no CSS. Tests:
`src/tests/toolkit-format.test.ts`.

`src/admin-club/lib/ui.ts` still carries this repo's own already-wired formatters
(`formatCivilDate`, `formatDollars`, `formatCents`, `formatClubTimestamp`); this module is the
toolkit's separate, general-contract set, not yet consumed by a screen (the Members screen rebuild
rewires onto it).

## `StatusChip.svelte`

**Contract:** the toolkit's one surface allowed a semantic status color (survey: Chip **reshaped,
split in three**, tier C — StatusChip/TagChip/CountBadge, "one do-everything chip re-merges what
[three systems] learned to separate"). Props: `tone` (`'neutral' | 'info' | 'success' | 'warning'
| 'danger'`, the full vocabulary — Current/Overdue/Former is this chip's first client, not its
ceiling), `label`, `size` (`'xs' | 'sm'`, defaults `'sm'`, named after `AdminTable`'s own density
tiers), and an optional `legend` string surfacing as a native tooltip and folding into the chip's
accessible name — the toolkit's "legend hook." The tone-to-domain mapping (which standing reads
`warning`, which reads `neutral`) lives with the consumer; StatusChip carries no domain knowledge.
`STATUS_CHIP_DOT_CLASS` (the tone → `status-<tone>` map) is exported from the component's module
context so a future legend/key component can reuse the identical color without duplicating the
mapping.

**daisyUI assembly:** `badge badge-ghost` (shape only — no tone reads through the badge fill) plus
a `status status-<tone>` dot for the actual color signal, and `badge-xs`/`badge-sm` +
`status-xs`/`status-sm` for the two sizes. **Verified against the built `cairn-admin.css`
(0.88.3):** `badge-info`, `badge-warning`, `badge-neutral`, and `badge-primary` compile, but
`badge-success` and `badge-error` do **not** — so a colored badge fill cannot cover the full tone
vocabulary consistently. Every `status-<tone>` modifier, including `status-success` and
`status-error`, is in the safelist and does compile, which is why the dot (not the badge fill)
carries tone color here: one consistent mechanism across all five tones, not four different ones
plus a gap. Padding, truncation, and min/max width (the "chip-overflow kill" — the walkthrough's
literal "text overflows the pills" reaction, `docs/2026-07-20-admin-toolkit-catalog.md`) are the
component's own scoped CSS, per the compiled-CSS constraint above.

**Exact class inventory:** `badge`, `badge-ghost`, `badge-xs`, `badge-sm`, `status`,
`status-neutral`, `status-info`, `status-success`, `status-warning`, `status-error`, `status-xs`,
`status-sm`.

Tests: `src/tests/toolkit-components.test.ts`.

## `Pagination.svelte`

**Contract:** page navigation plus an optional item-range line (survey: Pagination **confirmed**,
tier C, "`join` + `btn` (daisy's own idiom)"). Props: `page` (1-based), `pageCount`,
`onPageChange(page)`, and the optional `totalItems`/`pageSize`/`itemLabel` (defaults `'items'`)
that add a "Showing X–Y of N `<itemLabel>`" line — general enough that a consumer with only a page
count (no raw item total) still gets a working pager, and a consumer with both gets the range line
too. A page count of 7 or fewer renders every page button; beyond that, `computePageWindow`
(exported from the module context, independently unit tested) reduces to first, last, and a run
around the current page with `'ellipsis'` gap markers, so the control never grows unbounded. A
single page renders no nav at all, only the range line if one applies.

**daisyUI assembly:** `join` + `join-item` + `btn`/`btn-sm`/`btn-active`. **Verified against the
built `cairn-admin.css`:** every one of these already compiles from cairn's own admin usage (the
safelist's own comment: "every `btn` variant the join-pagination idiom needs ... already compiles
... so no `btn` addition belongs in this safelist"); `join-item` and both orientation modifiers are
newly safelisted in 0.88.3. Wrapper layout (the flex row between the range line and the nav) and
the range line's own type color (`var(--color-muted)`, the same theme variable `.text-muted`
resolves to) are scoped CSS, per the compiled-CSS constraint above — not because anything here is
missing from the compiled sheet, but because an unverified arbitrary spacing utility is the wrong
default to reach for on an admin route.

**Exact class inventory:** `join`, `join-item`, `btn`, `btn-sm`, `btn-active`, `btn-disabled`.

Tests: `src/tests/toolkit-components.test.ts` (component rendering) and the same file's
`computePageWindow`/`computeItemRange` suites (pure-function edge cases: zero/negative page count,
a stale page past the last item, window boundaries with no needless ellipsis).

## What is not here yet

`AdminTable`, `ExpandableRow` (Task 5) and `ListToolbar` (Task 6) land in later Members-pass tasks
and extend this README with their own sections when they do. The Members screen rebuild (Task 7)
is every component's first real consumer.
