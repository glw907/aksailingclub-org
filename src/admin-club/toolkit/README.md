# The admin toolkit (ASC's local remainder)

`StatusChip`, `Pagination`, `AdminTable`, `ListToolbar`, and `format.ts` graduated to
`@glw907/cairn-cms/admin-toolkit` in cairn 0.89.0/0.89.1 (Classes pass Task 1/2); this repo
imports them from that subpath now, and no longer carries local copies. See cairn-cms's own
`docs/reference/admin-toolkit.md` for their contracts, class inventories, and usage.

`ExpandableRow.svelte` stays here: the survey left its exact shape open for the Classes pass to
settle among four systems' variants (see this component's own header comment), so it graduates in
a later cairn wave once that shape is proven.

## The compiled-CSS constraint

`/admin/**` routes render inside `CairnAdminShell` and load **only** cairn's precompiled
`cairn-admin.css` (`src/routes/admin/+layout.svelte`; see also
`src/routes/admin/club/+page.svelte`'s own "Scoped styles, not daisyUI stats" comment). This
site's own Tailwind/daisyUI build (`theme.css`, `src/routes/(site)/+layout.svelte`) never touches
an admin route. A daisyUI **component** class only works on an admin screen if it is already
compiled into the packaged `cairn-admin.css`; an arbitrary **Tailwind utility** string only works
if that literal string already happens to appear somewhere in cairn's own scanned admin source.
`ExpandableRow` keeps spacing/truncation/wrapper layout in its own scoped `<style>` block for this
reason, the same rule the graduated components in cairn's own reference doc follow.

## `ExpandableRow.svelte`

**Contract:** the expand-in-place table row (survey: ExpandableRow **confirmed**, tier C --
"`table` + `collapse` semantics; genre exists in four systems in different shapes, pick at the
Classes pass"; this first shape favors the plainest accessible option over a bespoke one). Props:
`expanded`/`onToggle` (fully controlled, matching the graduated `Pagination`'s own convention
rather than owning internal expand state -- the "one row expanded at a time" contract lives in the
*caller* holding a single expanded-row id and deriving `expanded={expandedId === row.id}` for
every instance), `datum` (the row's own value, forwarded into `panel` so it never needs a
closure), `colspan` (the panel cell's span -- the summary row's own `<td>` count including the
trailing trigger cell), `summary` (the summary row's `<td>` cells), `panel` (a `Snippet<[T]>`, the
expand region), and `triggerLabel` (an accessible name for the trigger control, since a chevron
glyph alone carries no text).

Keyboard operability rides the native `<button>` element's own Enter/Space activation --
`aria-expanded` lives on that one button, never on the `<tr>` itself (`aria-expanded` is not a
valid attribute on a table row). The whole summary `<tr>` also carries a mouse-only `onclick`
convenience, which is why summary cells should stay non-interactive (plain text, a `StatusChip`,
and similar) -- an interactive control nested inside the row would double-handle the click.
Per-row actions belong in the panel, never inline in a summary cell, for the same reason.

**daisyUI assembly:** `btn`, `btn-ghost`, `btn-xs` for the trigger control. **Verified against the
built `cairn-admin.css`:** all three already compile from cairn's own admin usage.

**Narrow-viewport contract (the Members pass coherence round):** the graduated `AdminTable`'s own
horizontal-scroll fallback means a summary row wider than its viewport scrolls rather than wraps.
The trigger cell is `position: sticky; right: 0` with its own opaque background
(`--color-base-100`, not the zebra stripe's alternating color), so the expand control stays inside
the visible viewport at every scroll position, including the unscrolled one.

The panel cell stays a genuine `<td colspan>`, deliberately not `display: block`: a spanning cell
un-tabled that way still resolves its width against an anonymous fixup row the browser generates
for a block-display child of a `<tbody>`, and that anonymous row's own width is *still* driven by
the table's real column widths (verified empirically). A caller whose panel needs to collapse to
fewer columns at a narrow width instead needs the table itself to never require horizontal scroll
in the first place: Members' own `+page.svelte` hides its lower-priority summary columns under a
`max-width` breakpoint, so the whole row, panel included, fits the viewport with nothing to
scroll.

**Exact class inventory:** `btn`, `btn-ghost`, `btn-xs`.

Tests: `src/tests/toolkit-table.test.ts`.
