# Assets register pass: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the assets-substrate
> precedent (`docs/2026-07-30-assets-substrate-harvest-findings.md`). Nothing writes into that
> repo from here. Paste these into the friction log when cairn is free, then delete this file.
> Each is a UI mechanic or an engine contract gap, never a site design choice.

1. **The tinted-ground chip grammar is still site-side; this pass is the second consumer and
   the evidence the engine ask needs.** The events-admin harvest filed it as finding 12:
   `StatusChip` has no register for state chips on tinted or striped grounds. This pass built
   the three-state grammar (quiet tint, warning tint, hairline outline; one font weight; tone
   dot retired) as `src/theme/admin-chip-registers.css` and both Assets screens consume it via
   a per-page side-effect import. The recipe is settled and measured: grounds mix in oklab into
   the row ground inside a 1.16-1.47:1 band per theme/stripe pair, the outline border holds a
   >=3:1 floor, warning ink carries the tone, and the canvas-readback method is the only way to
   verify it (`getComputedStyle` returns unresolved `oklch()`/`color-mix()`). What cairn wants:
   `StatusChip` grows a `register` prop (or the toolkit ships the stylesheet) so the third
   consumer imports nothing. Evidence: `src/theme/admin-chip-registers.css`,
   `scripts/verify-chip-registers.mjs` (26 measurements, both themes, both grounds).

2. **A repeated local helper fired the consolidation trigger: four copies of
   `isUniqueViolation`.** `enrollments.ts`, `household-surgery.ts`, `profile.ts`, and now
   `member-portal/lib/assets.ts` each carry a private D1 unique-violation matcher. The fourth
   copy is the one that got hardened (flatten the `.cause` chain before substring-matching,
   since workerd may put the SQLite text on `error.cause` behind a generic outer message), which
   means three copies are now weaker than the fourth. Detecting a D1 constraint class from an
   error is engine-shaped work: cairn (or a shared site lib at minimum) should own one
   `isUniqueViolation(err, table)` with the cause-chain walk, and the consolidation should adopt
   the `errorText()` shape in `src/member-portal/lib/assets.ts`.

3. **Zebra stripes and edge-padding trims interact destructively, and nothing warns.** The
   pre-existing `:first-child { padding-top: 0 } / :last-child { padding-bottom: 0 }` rhythm
   trim, written for transparent rows, visibly clips the stripe fill on any even-count group
   (8px asymmetry inside a filled band at the group's hardest edge). The fix is parity-scoping
   the trims (`:last-child:nth-child(odd)`). A second stripe mechanic from the sibling screen:
   daisyUI's `.list-row` carries `border-radius: var(--radius-box)` (1rem), so a stripe on it
   renders as a rounded fill inside a square card unless the site zeroes it. Both are mechanics
   any cairn site striping rows will hit; the parity rule is mechanically detectable and belongs
   in `cairn-audit` (a striped selector plus an unconditioned edge-padding trim on the same row
   class).

4. **`font: inherit` in a scoped style silently clobbers utility classes under the no-Preflight
   admin.** `cairn-admin.css` ships no heading reset, so a bare `h2` takes the UA 1.5em/bold,
   and a scoped `.toggle { font: inherit }` (0,2,0) beats `.type-body`/`.font-semibold` (0,1,0)
   on the same element. T2 shipped a 24px/700 heading that every mechanical gate passed; only a
   measured render caught it. The stable idiom: put the typography on the ancestor the control
   inherits from, never utility classes on the element that also gets `font: inherit`.
   Mechanically detectable (`font: inherit` co-occurring with font utility classes on one
   element) and a `cairn-audit` candidate.

5. **`<dialog>` forms that POST natively lose the operator's typed input on `fail()`.** Moving
   an inline form into a dialog changes the failure contract: the re-render closes the dialog,
   resets every `$state` field, and lands the error on a surface the form is no longer on. The
   working pattern (assets screen, close-round A): `use:enhance`, on `result.type === 'failure'`
   keep the dialog open, render a dialog-local `role="alert"` with `tabindex="-1"` and focus it,
   and on success `update({ reset: false })` then close. If cairn's admin toolkit ever ships a
   dialog-form primitive, this failure path is the contract it must own; until then it is a
   recipe every consuming screen must hand-roll.

6. **A `display: contents` chip wrapper drops its own margins.** The register wrapper spans are
   `display: contents`, so spacing utilities on them are silently inert; the consuming screen
   must nest a real box outside (`<span class="ml-2"><span class="asc-admin-chip-quiet">`).
   Worth one line in the wrapper classes' own doc comment when the register moves into cairn.

7. **Collapsed disclosure panels using `hidden` drop out of find-in-page.**
   `hidden="until-found"` restores browser search into collapsed accordion groups without
   changing the ARIA pattern. The assets screen ships plain `hidden` today (ruled acceptable at
   close); if the admin toolkit grows a disclosure-group primitive, `until-found` should be its
   default.

8. **`StatusChip` truncates at `max-width: 10rem` with no self-defense.** Without a `legend`
   the ellipsized label has no `title` and no sr-only fallback, and label content is often
   admin-editable (asset type names here). The site now passes `legend` at the one risky call
   site; the engine fix is `StatusChip` defaulting its `title` to the label whenever it
   truncates.

9. **Per-migration hand probes in the e2e bootstrap do not scale.** `bootstrap-club-db.mjs`
   applies all migrations only on a cold database, so every migration that must reach a warm
   workstation replica needs its own hand-written existence probe (0035 had one; 0037 needed
   another; 0036 has none). The durable fix the file's own header now asks for: a `_migrations`
   ledger table so the bootstrap replays only what is missing. Family-shaped DX, worth solving
   once for every cairn site with a local D1 replica.

## Ruled, recorded so nobody re-litigates

- **No redirect for `/my-account/gear`** (Geoff, 2026-08-24: nobody uses the system yet). Two
  pass-end reviewers independently flagged that already-minted decision-email sign-in tokens
  would land on a 404; the concern is vacuous today because remote `asset_requests` has zero
  rows and no decision email has ever been sent. If that ever stops being true before the
  ruling is revisited, the one-file fix is a `+page.server.ts` issuing `redirect(308)`.
- **The accordion substitution** (a real `<button>` with `aria-expanded`/`aria-controls` over a
  `hidden` panel, not `<details>/<summary>`): the plan's parenthetical asked for native
  disclosure semantics, but the group header must host the Promote form and the Edit button,
  which cannot live inside a `<summary>`. Ratified at close; the a11y sweep graded the outcome
  equivalent or better.
