# Assets substrate pass: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the classes-pass
> precedent: nothing writes into that repo from here. Paste these into the friction log when
> cairn is free, then delete this file. The frame (Geoff, 2026-07-21): the component library
> improves as we go, so each finding is an improvement to make rather than a complaint to
> archive.

## Filed during execution (2026-07-30)

1. **Vertical centering of padded labels wants an engine-level default, not a per-component
   patch (Geoff, 2026-07-30).** Geoff noticed the `CURRENT PLAN` chip's text sitting
   off-centre in its pill on ASC's `/my-account/renew`, and his framing is the finding: there
   should be a global way to manage vertical centering so it is easy and correct by default,
   and it belongs in the engine rather than in each consuming site's own component sheet. ASC
   built and then deliberately reverted a `line-height: 1` patch to its own
   `.asc-availability-chip`; a site-level fix to one chip is the wrong altitude for a rule
   every padded label on every cairn site needs.

   **The measured evidence, so cairn does not re-derive it.** On ASC's events-page chip
   (13.12px uppercase text, `padding: 0.1rem 0.5rem`, inheriting the ambient line-height) the
   ink sits **1.0px LOW** in the pill, not high: 6.59px above the cap line against 4.59px
   below the baseline. `line-height: 1` reduces that to 0.43px low but shrinks the pill from
   23.19px to 18.31px, a real layout change wherever the chip appears. `line-height: 1.5`
   measures best of the three at 0.15px low. Note that the descender-space explanation
   predicts the opposite direction and does not survive measurement, so reason from readings
   here rather than from the usual account of why uppercase labels look off-centre.

   **The measurement method, which is itself worth having in cairn.** Read the baseline from
   real layout: append a zero-size `inline-block` with `vertical-align: baseline` and take its
   `getBoundingClientRect().bottom`. Take glyph extents from canvas
   `TextMetrics.actualBoundingBoxAscent`/`Descent` for the element's own resolved font.
   Deriving the baseline from font metrics alone produced numbers that disagreed with what the
   page actually rendered.

   **The mechanism to evaluate first**: CSS `text-box-trim` / `text-box-edge`, shorthand
   `text-box: trim-both cap alphabetic`, which removes the unfilled ascent and descent
   allowance at its source instead of compensating for it downstream. That is the
   correct-by-default behaviour Geoff asked for, applied once in the token or component layer
   so every site inherits it. It needs a browser-support check and a fallback, since consuming
   sites are public.

   **Pair it with a `cairn-audit` check.** A mechanism that depends on someone noticing a 1px
   offset is not a default. The check measures ink box against padding box for padded inline
   labels, in the same shape as the existing mechanical checks, so every consuming site gets
   the rule without writing its own. ASC's `scripts/design-probe.mjs` carries site-local checks
   of exactly this kind (`checkTouchTargets`, `checkOverflow`, `checkHoverFocusParity`) and is
   the wrong home for a family-wide rule.

   Tracked site-side in `docs/2026-07-07-polish-backlog.md`, deferred by Geoff to a subsequent
   pass.

2. **A toggle-action primitive, if a second surface wants it.** ASC's retention control on
   `/my-account/renew` established a pattern worth naming: a fixed-size slot holding two
   absolutely positioned states, `use:enhance` wiring with a per-key in-flight busy state that
   also closes the double-submit window, and a reduced-motion-aware crossfade between states.
   It was built self-contained in one route on purpose rather than abstracted from a single
   example. A shared primitive would need to parameterise the done-state visual, since the
   icon, colour and copy vary by use (Requested here, Cancelled or Released elsewhere), while
   keeping those mechanics. Filed as an observation, not a request: lift it when a second
   surface needs the behaviour.

3. **`asset_types.id` renames are a foreign-key event, and the migration recipe should say
   so.** ASC's 0034 migration renamed three `asset_types` primary keys. Three tables declare
   `REFERENCES asset_types(id)` with no `ON UPDATE CASCADE`, and remote D1 enforces foreign
   keys, so a plain `UPDATE` of the referenced key fails while child rows still hold the old
   value. The technique that works without ever disabling enforcement is insert-repoint-delete:
   insert the new-id row alongside the old so every child's key stays valid throughout, repoint
   the children, then delete the old row. Worth carrying in cairn's migration guidance, since
   any consuming site with a natural-key lookup table hits the same wall the first time it
   renames one.
