# Assets trial build: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the classes-pass
> precedent: nothing writes into that repo from here. Paste these into the friction log when
> cairn is free, then delete this file. The frame (Geoff, 2026-07-21): the component library
> improves as we go, so each finding is an improvement to make rather than a complaint to
> archive.

Six findings from the Assets trial build (2026-07-30), the pass that rebuilt
`/admin/club/assets` and `/admin/club/asset-requests` under the design-capture trial's control
conditions. Every one carries a measurement taken against the running page, not an inspection of
source. Findings 1 to 4 are new; 5 and 6 were found by the builders themselves during their own
done-gate runs.

## The pattern behind findings 1 to 4

Three builds now (Members, Classes, Assets) have produced the same shape of result: the token
layer holds and the composition layer does not. Across twelve captures and six independent
coherence readers this pass, **not one tell landed on type roles, gap-role values, chip registers,
or color.** Of the seven consensus tells that did land, five cluster in one place: composing form
fields. Both screens, independently, by builders who could not see each other's work.

The structural reason is worth stating, because it suggests the repair. A builder cannot
accidentally comply with the token layer. They either write `type-label` or they do not, a rule
sees which, and the package ships the thing that makes the right choice automatic. Neither
property holds for composition. "Verify a row using the inline register at the form's actual
rendered width" is a reminder, and a builder who does remember it finds that `SelectField` and
`TextField` are hard-wired to the register that breaks. Following the grammar was harder than
ignoring it.

The coverage contract already half-admits this: it pre-classifies form composition-width misses as
tells against written guidance, because no audit rule samples a mid-desktop width against a
multi-column grid. That category marks exactly where the capture claims territory it has no
mechanism to hold.

**The proposed principle: every composition claim needs either a component that makes it automatic
or a check that makes deviation visible. Prose alone is the known failure mode.**

## Finding 1: the packaged admin stylesheet has no form-control normalization

**Severity: highest here. It affects every consuming site, on every screen carrying a textarea.**

Measured against the running Deny dialog on `/admin/club/asset-requests`:

| Property | Computed value |
| --- | --- |
| `textarea` `font-family` | `monospace` |
| `body` `font-family` | `"Times New Roman"` |
| `textarea` `resize` | `both` |
| `fieldset` border | `2px rgb(239, 239, 239)` (browser default) |
| `textarea` border | `1px oklab(...)` (daisyUI's own) |

`cairn-admin.css` sets no `font-family` on `.textarea` and carries no global form-control
normalization, so `body` never receives the admin's own face and native browser defaults leak
through wherever a component class does not explicitly override them. Browsers default `textarea`
to monospace. The result is that **every textarea in every cairn admin renders in the browser's
monospace default**, with a native resize grip, inside a native `fieldset` border sitting
concentrically outside the textarea's own.

All three of three independent coherence readers flagged this unprompted, each describing it as an
unstyled default standing beside styled controls. None of them could see the cause.

Engine-level because it is a framework default leaking through the packaged artifact, the same
shape as DaisyUI's plain `.btn` rendering an invisible edge on a dark ground (substrate pass,
finding 5). A site patching it in its own scoped `<style>` leaves every sibling site to rediscover
it.

**Proposed shape:** a form-control normalization layer in `cairn-admin.css` (the Tailwind
preflight's `font: inherit` on form elements is the conventional form), plus a `font-family` on
`.textarea`, and a decision on whether `resize` and the native `fieldset` border are cairn's to
own. Mechanically detectable, so it belongs in `cairn-audit`: a rendered rule comparing a form
control's computed `font-family` against the body's would have caught it on any consuming site.

## Finding 2: `form-anatomy.md`'s own worked example does not compile

The exemplar prescribes `gap-x-6 gap-y-4` for a two-column form grid. Neither class reaches the
built `cairn-admin.css`. `cairn-audit`'s own `no-uncompiled-class` rule already flags exactly that
pair as pre-existing errors in this repo's `ClassForm.svelte` and `EventForm.svelte`, which are
part of the standing 96.

So the skill prescribes a recipe the packaged stylesheet cannot render, and the audit then convicts
the consumers who follow it. Found independently by two builders this pass, each of whom checked
the built sheet before reaching for the recipe rather than after.

**Proposed shape:** run `no-uncompiled-class` over the skill's own `references/*.md` exemplars as
part of cairn's own gate. The rule already exists and has simply never been pointed at the teaching
material. This is close to free and it closes the whole class permanently, not just this instance.

## Finding 3: the field register that works is not exposed

`SelectField`, `TextField`, and `FieldLabel` are hard-wired to the inline control-adjacent register
(`FieldLabel`'s `flex items-center` row, label sized to its own text). Inside any multi-column
grid that register staircases: each control begins wherever its own label happens to end, so
stacked fields share neither a left nor a right edge.

Measured on `/admin/club/assets` before the fix, at 1440: the right column's `Search household` and
`Description` inputs sat directly above one another on different left AND different right edges,
while the left column's pair aligned by coincidence. At 390, `Asset type` and `Search household`
each wrapped onto two lines inside their own field row while `Household` and `Description` did not.
Three of three readers flagged it; two also flagged the same staircase inside the Edit-type dialog,
where a small surface makes it the dominant shape.

The stacked register that fixes it already exists inside the package and is used by
`FieldInput.svelte` and `ConceptList.svelte`. It is not exported, so every consumer re-derives it
by hand after failing a read.

**Proposed shape:** expose the stacked field-label register as a bundled primitive, and treat a
composition claim with no component behind it as a bug in the capture rather than a builder's
problem. Also mechanically detectable: whether sibling controls in one grid column share a left
edge is a `getBoundingClientRect` comparison.

## Finding 4: `one-filled-action` and the grader prompt disagree about what one surface is

**This is a contradiction inside the capture, and it needs a ruling before it can be repaired.**

On `/admin/club/assets`, the selected segment of the `By asset / By person / Waitlist` view
switcher carried the same saturated accent fill as the `Assign` submit. Two of three independent
readers failed the screen on grader item b for it.

`cairn-audit`'s rendered `one-filled-action` rule passes that page, in both themes, at error tier.
It partitions the screen into header and card landmarks and compares fills only within one
landmark. The grader prompt's item b instructs a reader to treat the main content as its own
surface, which puts the switcher and the submit together.

Both ship in the same package and both are claimed: the coverage contract states that
`one-filled-action` is audit-enforced at error tier and that the surface partition is itself audit
logic. So a tell that the capture claims to make a build failure shipped anyway, because its two
halves do not agree on the boundary.

**Proposed shape:** a ruling from Geoff on which model is right, then align the other to it. Not an
implementation task until that lands. Worth noting the fix a builder reached for once told: cairn's
own `btn-active`, already the selected-state treatment in `Pagination.svelte` and
`ListToolbar.svelte`, which suggests the grader's reading is the intended one and the rule's
partition is too generous.

## Finding 5: daisyUI pins every `.list-row` child to `grid-row-start: 1`

Found by the `/admin/club/asset-requests` builder during its own grader run, diagnosed through
Chrome DevTools Protocol's `CSS.getMatchedStylesForNode` rather than by guessing.

At 390 a long action label squeezed the `.list-row` grid's content column toward zero width,
wrapping an asset-type name one character per line. The repair needed two overrides rather than
one: daisyUI pins every `.list-row` child to `grid-row-start: 1` in a rule separate from the
container's own `grid-template-columns`, so overriding the container alone does nothing. The child
pin has to be released and re-pinned per breakpoint.

Engine-level because it recurs in any consumer using `.list-row` with a variable-width trailing
action, which is the common admin row shape.

## Finding 6: `.list-row`'s reserved leading column leaves an empty gutter

Measured on `/admin/club/asset-requests` at 390 before the fix: the card's own left edge sat at
x=16 and its content began at x=73, about 57px of empty reserved column, while the divider rule and
the trailing action ran out to near the card's right edge at x=374. The block reads as pushed
right, with wrapped text crowding the right edge against an empty left band.

The cause is the component's leading slot (for an icon or avatar) going unoccupied. Three of three
readers flagged the asymmetry, though they split on which checklist item it landed against, which
is itself a signal that the grammar has no vocabulary for it.

Classified against the coverage contract this is a **capture gap** rather than a miss: section 2
explicitly disclaims axis-scoped gap variants, and nothing in the shipped material states that a
component's own reserved leading column must be occupied or collapsed.

**Proposed shape:** either collapse the slot when empty, or state the requirement in the list
exemplar. Mechanically detectable as a container whose left inset materially exceeds its right.

## A validation asset this pass produced

Any new rendered rule proposed above can be validated rather than assumed. This pass leaves a
labeled corpus: twelve captures at 390 and 1440 in both themes plus interaction states, each with a
3-of-3 grader verdict and a specific tell list, and a matching set of the same screens after the
fixes. A candidate rule should fire on the round-1 captures and go quiet on the round-2 ones. Lint
rules rarely get a regression suite that good, and it will decay as soon as the screens move again.

## A process finding that is not cairn's

Recorded here because it belongs beside the others, but it is a workstation and trial-design
finding rather than an engine one.

**The trial's control conditions were unsatisfiable before the first dispatch.** This repo's
`CLAUDE.md:10` is `@docs/STATUS.md`, so every session in the repo auto-loads STATUS, and
`docs/STATUS.md:155-157` names the trial's withheld measurement outright, by its `STANDING_CHIP`
variable name, with the gloss "the state invisible against its own row is the one saying a
household owes money." That entry predates the trial. No dispatch discipline could have protected
the measurement.

Two further channels compounded it: the plan and spec sit in `docs/` in the working repo, and agent
memory carried findings between supposedly uncoordinated builder sessions. Any future trial needing
withheld measurements needs a clean-room repo or a measurement that does not depend on withholding.
