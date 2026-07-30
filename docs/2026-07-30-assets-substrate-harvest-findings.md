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

2. **The toggle-action control is an engine-level primitive (Geoff, 2026-07-30).** ASC's
   retention control on `/my-account/renew` established the pattern: a fixed-size slot holding
   two absolutely positioned states, `use:enhance` wiring with a per-key in-flight busy state
   that also closes the double-submit window, and a reduced-motion-aware crossfade between
   them. It was built self-contained in that one route during the pass, and this finding was
   first filed as an observation to lift later. **Geoff's call supersedes that: cairn should
   own it, alongside findings 1 and 3.** The mechanics are generic, and a form action that
   toggles a row into a settled state is a shape every consuming site reaches for, so the
   family wants one implementation rather than each site rediscovering the enhance wiring and
   the reduced-motion branch.

   What cairn ships: the two-state slot with a stable footprint so a row never reflows as its
   state changes, the enhanced-form wiring keyed per row, the in-flight busy state that refuses
   a second submit, and the motion treatment with its reduced-motion path. The state must flip
   on the action's own success and never optimistically, since a control that animates ahead of
   the write and then disagrees with the database is worse than one that does not animate.

   The open design question for the cairn pass, which does not block it: how the done state is
   parameterised. Icon, colour and copy vary by use (Requested here, Cancelled or Released
   elsewhere), and ASC's single instance is not enough to settle whether that wants slots, a
   variant enum, or plain props. Decide it against a second real surface if cairn has one to
   hand; otherwise choose the least binding option, since widening later is additive and
   narrowing is not.

   Accessibility rides with the primitive rather than the caller. ASC's instance carries a
   visible short label plus visually hidden text naming the row's own subject, so repeated
   controls in one list do not present one accessible name many times, and the visible label
   stays a leading substring of the accessible name (WCAG 2.5.3, which a bare `aria-label`
   would violate). A primitive that leaves this to each call site will be got wrong.

3. **The label-and-value row wants an engine primitive with an explicit wrap contract, plus a
   sibling-consistency check (Geoff, 2026-07-30).** Geoff's second observation was that the row
   wrapping he reported should also be an engine-level fix. The pattern is family-wide and the
   primitive belongs in cairn; the automatic part does not.

   The recurring construction is a row with a label on one side and a value on the other,
   usually a wrapping flex with `justify-content: space-between`. When the content exceeds the
   line, whichever element loses the race drops, and sibling rows in the same list end up with
   different shapes. ASC hit it twice in one file on this pass: on `/my-account/renew` the
   membership-tier row drops its price to a second line, but only on the selected tier, because
   that row alone carries a `CURRENT PLAN` chip; and the retention rows below drop their control
   for the longer asset-type names but not the shorter ones. Both read to the owner as the same
   defect. The same construction appears in ASC's gear, directory and spine rows.

   **A silent default is the wrong answer here, unlike finding 1.** Which element should hold
   its slot and which should yield is a statement about what the row means, and a primitive that
   guesses will be wrong somewhere without saying so. What cairn should ship is a row primitive
   whose contract makes the choice explicit at the call site, so a consumer declares that the
   price holds and the chip wraps rather than discovering it at 390.

   **The mechanical half is the sibling-consistency check, and it is the stronger half.** Rows
   in one list having different heights or different structure at a given viewport needs no
   judgment about intent to detect, and it is exactly what both of Geoff's reports are. It
   belongs in `cairn-audit` beside finding 1's centering check, run across the tested viewport
   set, so a row that reshapes itself for one item's content length is caught where it happens
   rather than when someone reads a screenshot.

   ASC fixes its own two instances site-side in this pass rather than waiting on a cairn
   release, and drops that local handling when the primitive ships.

4. **`asset_types.id` renames are a foreign-key event, and the migration recipe should say
   so.** ASC's 0034 migration renamed three `asset_types` primary keys. Three tables declare
   `REFERENCES asset_types(id)` with no `ON UPDATE CASCADE`, and remote D1 enforces foreign
   keys, so a plain `UPDATE` of the referenced key fails while child rows still hold the old
   value. The technique that works without ever disabling enforcement is insert-repoint-delete:
   insert the new-id row alongside the old so every child's key stays valid throughout, repoint
   the children, then delete the old row. Worth carrying in cairn's migration guidance, since
   any consuming site with a natural-key lookup table hits the same wall the first time it
   renames one.
