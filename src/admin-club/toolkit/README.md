# The admin toolkit (this repo's own reference notes)

`StatusChip`, `Pagination`, `AdminTable`, `ListToolbar`, `format.ts`, and (as of the
Members-refinement-round-1 settle) `ExpandableRow` have all graduated to
`@glw907/cairn-cms/admin-toolkit` (Classes pass Task 1/2 for the first group, the settle's A1
pickup for `ExpandableRow`); this repo imports every one of them from that subpath now and
carries no local copies. See cairn-cms's own `docs/reference/admin-toolkit.md` for their
contracts, class inventories, and usage.

This directory keeps no component of its own; the compiled-CSS constraint below stays here as
this repo's own admin-route reference note (several `/admin/club/**` screens' scoped `<style>`
comments point back to it).

## The compiled-CSS constraint

`/admin/**` routes render inside `CairnAdminShell` and load **only** cairn's precompiled
`cairn-admin.css` (`src/routes/admin/+layout.svelte`; see also
`src/routes/admin/club/+page.svelte`'s own "Scoped styles, not daisyUI stats" comment). This
site's own Tailwind/daisyUI build (`theme.css`, `src/routes/(site)/+layout.svelte`) never touches
an admin route. A daisyUI **component** class only works on an admin screen if it is already
compiled into the packaged `cairn-admin.css`; an arbitrary **Tailwind utility** string only works
if that literal string already happens to appear somewhere in cairn's own scanned admin source.
Every component listed above keeps spacing/truncation/wrapper layout in its own scoped `<style>`
block for this reason (`ExpandableRow`'s own contract doc, in cairn's own
`docs/reference/admin-toolkit.md`, documents its narrow-viewport sticky-cell and panel-`<td>`
details); this repo's own `/admin/club/**` screens follow the same rule for their route-local
styling.
