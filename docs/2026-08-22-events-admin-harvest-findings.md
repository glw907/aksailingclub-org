# Events admin pass: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the assets-substrate
> precedent (`docs/2026-07-30-assets-substrate-harvest-findings.md`). Nothing writes into that
> repo from here. Paste these into the friction log when cairn is free, then delete this file.
> Each is a UI mechanic or an engine contract gap, never a site design choice.

1. **The media-library picker has no reuse seam for a site's own admin screen.** The published
   package ships `dist/components/MediaPicker.svelte` and `MediaInsertPopover.svelte`, but
   neither appears in `dist/components/index.d.ts`, `mediaLibraryEntry` and `MediaLibraryEntry`
   are absent from `dist/media/index.d.ts`, and `package.json`'s `exports` map has no
   `./components/*` wildcard, so no legal import path reaches them. ASC's `events-store.ts` and
   `classes-store.ts` each carried a "picker seam not wired" comment since pass 2.1; this pass
   rebuilt the field locally (`HeroImageField.svelte`) over `readCommittedManifest`, and the
   first coherence read graded that rebuild the least resolved surface on the page. What cairn
   wants: export `MediaPicker` and `mediaLibraryEntry`, plus a documented loader for a site's
   `/admin` route to project the committed library (a sibling of `mediaLibraryLoad`).

2. **`ExpandableRow` has no interactive-summary-cell seam.** Its row-level `onclick` and its
   "summary cells stay non-interactive" contract are right for a read-only summary, but a ledger
   with an inline-editable cell has to hand-roll `stopPropagation` on click and keydown inside a
   `svelte-ignore`d wrapper. The component wants an opt-out: an inert-cell wrapper snippet, or a
   documented `data-` escape the row handler honors. Evidence:
   `src/routes/admin/club/events/+page.svelte`, the date cell.

3. **Panel-follows-summary-width failed at its third consumer.** The Classes pass filed the
   `*-narrow-hide` column-drop recipe; the events ledger applied it and still measured a 640px
   summary row inside a 356px wrapper at 390, with the expanded panel cut mid-word. The recipe
   drops columns but says nothing about the width a cell's own form controls demand. The
   contract belongs in `ExpandableRow` as a measured rule (`scrollWidth === clientWidth` at the
   family's 320 and 390 viewports), and `cairn-audit` can check it mechanically for any
   `AdminTable` whose rows carry a form.

4. **`use:enhance` without `reset: false` is a trap with a documented failure this repo has now
   hit twice.** A successful action result resets the form; Svelte 5's `bind:value` re-syncs
   bound inputs to their defaults and unbound hidden inputs (`CsrfField`, ids) go blank and are
   never rewritten, so the next submit 403s. The email compose screen documented it in July; the
   events row form repeated it in August. `CsrfField` (or a cairn `enhanceKeep` helper) should
   own the `reset: false` default, or `cairn-audit` should flag a bare `use:enhance` on a form
   that carries `CsrfField`.

5. **A bare `<ul>` inside a toolkit panel gets UA disc bullets.** The Classes close failed on it
   (2026-07-21) and the roll-forward confirmation repeated it. `cairn-admin.css`'s admin scope
   should reset list markers inside `.toolkit-*` containers, leaving an explicit `list-style`
   for the rare list that wants one.

6. **`--color-warning` is not a foreground token in the admin theme.** Two new surfaces reached
   for it as ink (the class-row star, a "Needs alt" cue) and measured 1.6:1 and 2.1:1. The
   admin theme already defines `--cairn-warning-ink` for exactly this; the token's name invites
   the mistake. A `cairn-audit` rule that flags `color: var(--color-{warning,success,error})`
   on text in admin scope would catch it at build time. The second coherence read found a
   sibling mismatch in the same admin theme: `.input:focus`/`.select:focus`/`.textarea:focus`
   (and their `:focus-within` pairs) set `--input-color: var(--color-base-content)`, so a text
   field's own outline and underline both read a near-black ring while every `.btn` gets the
   sheet's unqualified `:focus-visible` rule's primary-toned one -- two different focus rings on
   one screen with no site-level reason for the split. `EventRowForm.svelte` patches it locally
   with an `!important` override; the admin theme wants one focus-ring token both paths read.

7. **A disclosure panel in a toolbar is a toolkit primitive, not a per-screen build.**
   `ListToolbar`'s overflow menu already carries the right mechanics (`aria-expanded`,
   `aria-controls`, focus into the panel, Escape, focus return); the roll-forward confirmation
   had to copy them by hand and missed all four on the first pass. A `ToolbarDisclosure` (or
   exposing the overflow's internals) lets every confirming action inherit them.

8. **`fakeD1` cannot exercise a constraint.** Every store and migration test asserts SQL text,
   so a `NOT EXISTS` guard, a UNIQUE collision, and a batch's atomicity are unverified by the
   suite by construction; three reviewers independently found collision paths the green gate
   could not see. The consuming sites want a shared SQLite-backed harness (`better-sqlite3` or
   wrangler's local D1) that applies a repo's migrations and runs the store against them, as an
   optional second tier beside `fakeD1`.

9. **`previewRollForward` and the media library both ship in every list load.** A per-season
   plan computed for a panel the officer may never open, and a 53-entry library serialized for
   a picker that renders at most once, are the same shape: data a disclosure needs that the
   list does not. SvelteKit's streamed promises fit, but the toolkit has no convention for
   "load this when the panel opens"; a documented pattern (a `+server.ts` sibling, or a
   streamed slot on `ExpandableRow`) would stop each screen choosing differently.

10. **A contrast probe that parses only `rgba()` reports 21:1 for everything on a modern
    sheet.** The third coherence read found the family's probe regex returns `null` for
    `oklch()`/`oklab()` computed colors, falls back to black-on-white, and passes every pair.
    Every measured number from earlier reads on oklch surfaces is suspect. The fix (render the
    color to a 1x1 canvas and read the pixel, compositing alpha up the ancestor chain) belongs
    in `cairn-audit`'s checker, not each site's probe script.

11. **`ExpandableRow`'s trigger is a 24px target.** At 390 it is the only way to open a row and
    it sits under the family's own ~30px floor (and the polish brief's 44px). The trigger's hit
    area belongs to the component, not to each consuming screen's scoped styles.
