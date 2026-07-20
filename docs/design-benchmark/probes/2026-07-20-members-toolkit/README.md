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

## Task 6: `toolbar-1440-light.png` / `toolbar-1440-dark.png` / `toolbar-390-light.png` /
`toolbar-390-dark.png` / `toolbar-overflow-open-light.png` / `toolbar-overflow-open-dark.png`

Render `ListToolbar.svelte` in three states, live-shaped to the design spec's own Members filter
set (standing, holdings, role/instructor, class -- "the Members filter set," the plan's own
wording) plus one fabricated case exercising the overflow disclosure the plan requires "present in
the contract even though Members promotes only four" of its own filters:

1. **Default state** (149 households, no search, every filter at its own default) with
   `autofocus` set, demonstrating the toolbar's own autofocus contract (the visible focus ring on
   the search box in `toolbar-1440-light.png`/`toolbar-390-light.png` is the browser's real
   default outline, not a design decision — the same native mechanism the "cursor lands in search
   on open" contract rides on).
2. **Search plus three applied filters** (`search="Sara"`, standing=Overdue, holdings=Holding
   assets, role=Instructors, class left at its default), showing the applied-filter pills (neutral
   `badge-neutral`, each with its own labeled remove control) and the count line's scope string
   (`"12 households · Overdue · Holding assets"`, exactly `computeCountLine`'s own copy pattern).
3. **The synthetic overflow case** (standing and holdings promoted, a fabricated Role/Committee
   pair demoted to the overflow disclosure) — a pairing invented for this probe only, since the
   real Members screen promotes all four of its own filters and never renders this disclosure. The
   base four screenshots show the disclosure closed (the "More filters" trigger, plus the
   already-applied Overdue/Race committee pills, since a filter counts as applied whether its own
   control is promoted or hidden); `toolbar-overflow-open-light.png`/`-dark.png` click the trigger
   open first (Playwright `getByRole('button', { name: 'More filters' }).click()`) and clip a
   region including the opened `dropdown-content`, showing the demoted Role and Committee selects
   with their own visible labels (the overflow disclosure is the one place `ListToolbar` renders a
   filter's `label` as visible text rather than an `aria-label` alone, since the promoted controls'
   own compact selects rely on the toolbar's tight horizontal band instead).

All three states render in both admin themes (`cairn-admin`/`cairn-admin-dark`) and both the
family's 390 and 1440 viewports (the overflow-open pair only at 1440, since the disclosure's own
open/closed mechanics don't change by viewport). The first capture pass (`toolbar-*-390-*.png`
before renaming) caught a real defect worth recording: with the toolbar band set to
`flex-wrap: nowrap` and the primary action right-aligned only via `justify-content: space-between`,
the fixed-width search box and the "Add household" button visibly overlapped at 390px — the width
budget for both plus the loosely-shrinking search box was simply insufficient in one line.
Wrap chaos, exactly the plan's own acceptance line names. Fixed by giving the band itself
`flex-wrap: wrap` and switching the primary action to a `margin-left: auto` (which still resolves
against a lone item's own flex line, not just a shared one), so the action cleanly drops to its own
right-aligned line once the controls cluster's wrapped content no longer leaves room beside it —
verified by recapturing after the fix; the four base screenshots and the overflow-open pair
attached here are all from the *post-fix* render, not the one that caught the bug.

Same probe idiom as Tasks 4 and 5: a dev-only route (`src/routes/_toolkit-toolbar-probe/+page.svelte`,
wrapped as `<div data-theme={...}><div class="bg-base-100 text-base-content">...`, per the same
structural note Task 5's section above already explains) rendered locally with `npm run dev`,
captured with Playwright (`chromium.launch()` → `page.goto()` → `page.screenshot()`, never
`toHaveScreenshot()`), then deleted before this commit.

**Verdict: open.** Geoff reacts asynchronously; the build continues per the plan's own note.
