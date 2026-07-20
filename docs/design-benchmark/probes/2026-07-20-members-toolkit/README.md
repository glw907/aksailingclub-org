# Members-pass toolkit probe (Task 4)

`status-chip-pagination-light.png` / `status-chip-pagination-dark.png` render all three of Task
4's toolkit citizens (`src/admin-club/toolkit/format.ts`, `StatusChip.svelte`,
`Pagination.svelte`) with live-shaped household data (names, phones, dues, join dates in the
exact shapes `households-store.ts`/`money-store.ts` produce, none of it real member data), in
both admin themes (`cairn-admin` / `cairn-admin-dark`).

Captured from a dev-only SvelteKit route rendered locally and removed once the screenshots were
taken (per the plan's "dev-only route rendered locally is acceptable" allowance) — the repo's own
`docs/design-benchmark/portal-mock-d/` idiom for a Svelte-component probe rather than a static
HTML mock. To reproduce: recreate a page under `src/routes/` that imports
`@glw907/cairn-cms/components` (for the side-effect `cairn-admin.css` import) plus the three
toolkit modules above, wrap the markup in `<div data-theme="cairn-admin">` (or
`"cairn-admin-dark"`), and screenshot with Playwright (`chromium.launch()` → `page.goto()` →
`page.screenshot({ fullPage: true })`) — not `toHaveScreenshot()`, which mints a CI-canonical
visual-regression baseline instead of a one-off design capture.

**Verdict: open.** Geoff reacts asynchronously; the build continues per the plan's own note.
