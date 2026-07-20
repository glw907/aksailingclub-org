# Members-pass toolkit probe (Task 4, Task 5)

## Task 4: `status-chip-pagination-light.png` / `status-chip-pagination-dark.png`

Render all three of Task 4's toolkit citizens (`src/admin-club/toolkit/format.ts`,
`StatusChip.svelte`, `Pagination.svelte`) with live-shaped household data (names, phones, dues,
join dates in the exact shapes `households-store.ts`/`money-store.ts` produce, none of it real
member data), in both admin themes (`cairn-admin` / `cairn-admin-dark`).

**Verdict: open.** Geoff reacts asynchronously; the build continues per the plan's own note.

## Task 5: `admin-table-light.png` / `admin-table-dark.png`

Render `AdminTable.svelte` and `ExpandableRow.svelte` with the same 10 live-shaped, multi-member
households (names, phones, ages, holdings, and class enrollments in the shapes
`households-store.ts` produces; none of it real member data) across five conditions, in both admin
themes:

1. The **current, unredesigned** `/admin/club/members` table's own markup (read verbatim from
   `src/routes/admin/club/members/+page.svelte`), as the real height baseline for section 2.
2. `AdminTable` at `density="sm"`, `zebra={false}` — the plan's own default combination for the
   10-row roster.
3. The same table with `ExpandableRow`, one row (Dunleavy, a 4-member household) expanded, showing
   the panel's contacts/members-with-ages/holdings/classes and the three actions (Open household,
   Email household, Add member — none wired, a static demo).
4. `AdminTable` at `density="xs"`, `zebra={true}` — the compact tier and the zebra option together.
5. `AdminTable`'s empty-state slot.

Both components render inside a bare `<div data-theme="cairn-admin">` wrapping an inner
`<div class="bg-base-100 text-base-content">` — a theme utility class must sit on a *descendant* of
the `data-theme` element to match cairn's own `:where([data-theme=...]) .bg-base-100` scoping (the
same structure `ConfirmPage.svelte`'s own header comment documents: "a class on the theme element
itself would not match"). Putting the utility class directly on the `data-theme` div was tried
first and silently rendered a transparent background with no compile error — worth restating here
since the mistake is easy to repeat.

Captured from a dev-only SvelteKit route (`src/routes/_toolkit-table-probe/+page.svelte`) rendered
locally and removed once the screenshots were taken (per the plan's "dev-only route rendered
locally is acceptable" allowance) — the repo's own `docs/design-benchmark/portal-mock-d/` idiom for
a Svelte-component probe rather than a static HTML mock. To reproduce: recreate the route, wrap the
markup as described above, and screenshot with Playwright (`chromium.launch()` -> `page.goto()` ->
`page.screenshot()`) — not `toHaveScreenshot()`, which mints a CI-canonical visual-regression
baseline instead of a one-off design capture.

### The "under half height at `sm`" acceptance line -- measured, not met as written

The plan's own acceptance line for Task 5 reads: "the probe page shows a 10-row live-shaped roster
in under the current screen's half height at `sm`." Measured directly (Playwright
`getBoundingClientRect()` on the real `<table>` element in both section 1 and section 2, same 10
households, same viewport, no member-name wrapping in either — every row in both tables renders on
one line at 1200px wide):

| Table | Height (px) | Ratio to today's table |
|---|---|---|
| 1. Current screen (today), plain `table` | 498.9 | 100% |
| 2. `AdminTable`, `density="sm"` | 404.0 | 81% |
| 4. `AdminTable`, `density="xs"` | 277.6 | 56% |

`sm` alone lands at roughly a fifth shorter, not half: today's table's per-row padding
(`padding-block: .75rem`, the compiled `cairn-admin.css`'s own base `.table :where(th, td)` rule)
versus `table-sm`'s `padding-block: .5rem` is a real but modest difference, and this probe's
households are short enough (1-4 members, no long names) that neither table's Members column ever
wraps to a second line -- the wrapping today's table *would* incur with longer real names never
materializes here to inflate section 1's baseline. `xs` (56%) comes close to the stated target but
does not clear it either. This is a genuine finding, not a rounding gap, and it's recorded here
rather than silently claimed as met: **the "half height" reading likely assumed either the `xs`
tier, or today's table's real row heights inflating further under real (longer, more numerous)
household names than this probe's fictional set exercises.** Geoff's verdict decides whether
Members ships at `sm` (matching the plan's explicit density) accepting the smaller real reduction,
or `xs` for the fuller one; either is a one-line prop change on `AdminTable`, not a rebuild.

**Verdict: open.** Geoff reacts asynchronously; the build continues per the plan's own note.
