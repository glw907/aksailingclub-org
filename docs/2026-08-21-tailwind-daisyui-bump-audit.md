# Tailwind 4.3.3 / DaisyUI 5.7.20 feature audit

Scope: what shipped in Tailwind 4.3.x (this repo was already on 4.3.2, so the delta from this
bump is only 4.3.3) and DaisyUI 5.6.14 to 5.7.20 that this site's own templates (`src/theme`,
`src/routes/(site)`, `src/member-portal`, `src/member-auth`, `src/member-signup`) could use.
Admin surfaces rendered through packaged cairn-cms components are out of scope.

## Tailwind

4.3.3 is fix-only (watch-mode reliability, canonicalization edge cases, a Firefox iframe
preflight issue). No new utility. Reaching back to 4.2.0 and 4.3.0 for utilities this site could
adopt but hasn't: the logical-property utility set (`pbs-*`/`pbe-*`, `mbs-*`/`mbe-*`,
`inset-s-*`/`inset-e-*`, `inline-*`/`block-*`) and `scrollbar-thin`/`scrollbar-color`. This site
doesn't write these properties as Tailwind utility classes in markup at all; `margin-inline`,
`padding-block`, and `container-type: inline-size` already appear as plain CSS declarations in
`src/theme/site.css`, `src/theme/asc-components.css`, and `src/chassis/prose.css` (predating
these utility classes and functionally equivalent). No file:line would change. `@container-size`
and `tab-*` (tab-size) have no matching need anywhere in the templates checked. Recommendation:
nothing to adopt from Tailwind here.

## DaisyUI

| Feature/fix (5.6.14 to 5.7.20) | Site usage found | Recommendation |
|---|---|---|
| `menu-paged` modifier (nested-menu keyboard nav) | `SiteHeader.svelte:234` uses `.menu` for the members dropdown, but it's a flat one-level list (no nested `<ul>` inside `<li>`) | Not applicable; nothing here has a nested menu to page through |
| `select` arrow no longer rotates on focus-without-open (#4655) | `.select` appears in ~15 files across admin, `/join/apply`, `/my-account/*`, `ContactForm.svelte` | Free correctness fix, ships automatically, no site change needed |
| `fieldset-legend` iOS stretch fix (`margin-inline-end: auto`, #4627) | Used in `ContactForm.svelte`, `DonateForm.svelte`, and six more `/my-account/*` screens; `join/apply/+page.svelte:160,179,218,259` scopes only typography (`.fieldset-legend` font/color) at line 331, no width override | Free fix, no conflict with the site's own override, no change needed |
| `btn-active` colors/layers/specificity fixes (#4594, layer reorder, #4632) | `admin/club/assets/+page.svelte:210,578-580` carries a local override: `btn-active`'s default mix (still toward `#000` even after 5.7.20, confirmed by grepping the rebuilt `theme.css`) reads fine in light but nearly vanishes in `cairn-admin-dark`, so the site remixes toward `--color-base-content` instead | The 5.7 fixes address specificity/layering (making `btn-active` reliably win), not the color-mix target; the site's override is still load-bearing. Nothing to retire. |
| checkbox/radio `.btn` color-when-checked fix (#4677) | No file uses `class="checkbox ... btn"` or `class="radio ... btn"` anywhere in the templates checked | Not applicable |
| animate `radial-progress`/`progress` value, reduced-motion respect | No `.progress`, `.radial-progress`, `.loading`, or `.toast` classes in scope | Not applicable |

## Headline

This bump carries no feature this site should build against; it's worth taking purely for the
`select` and `fieldset-legend` bug fixes it lands for free, since both classes are already used
across the join and portal forms. The one item worth a second look later is confirming the
`btn-active` dark-mode override at `admin/club/assets/+page.svelte:578` is still correct once (if
ever) DaisyUI changes what color `btn-active` mixes toward by default, since the fix mechanism
(specificity/layering) and the color choice (toward black) are two separate things and only the
former moved in 5.7.
