# Members pass: cairn harvest findings

> The cairn-bound findings from the Members pass (the first `admin-screen-passes`
> pass). Filed for the harvest per the DX-harvest mandate. The two rulings below were
> settled mid-pass; the build findings section is appended at pass close, when the
> toolkit has been shaken by its first consumer.

## Ruling: the admin toolkit ships inside the cairn package, behind a subpath export (Geoff, 2026-07-20)

The toolkit publishes into `@glw907/cairn-cms` itself, exposed through a dedicated
subpath export (shape: `@glw907/cairn-cms/admin-toolkit`), never as a sibling npm
package. The grounds:

- The toolkit's heavy part already lives in cairn. Its daisy class vocabulary exists
  only because the blessed-set safelist compiles into `cairn-admin.css`, cairn's own
  bundle. A separate package would not make cairn leaner where it counts; component
  source is inert until imported and tree-shakes to zero for consumers that skip it.
- Atomic versioning. Components lean on exact daisy class names the safelist
  guarantees. One package means the safelist and its consumers version together, and
  the toolkit READMEs' class inventories live in the repo whose build they audit. Two
  packages mint a skew hazard (toolkit vX needing classes admin-CSS vY tree-shook out)
  and a second range every site must keep agreeing with the first.
- One ritual, one ceremony. The daisy absorption ritual (below) stays a single
  in-repo procedure, and cairn-release stays the only release process. A second
  package doubles versioning, changelog, publish, and doc-gate ceremony for one
  maintainer and three consumer sites, against the simplify-it doctrine.
- The subpath is the future seam. It keeps the main export surface clean, makes the
  toolkit legible as its own product, and is the line along which a split would
  happen if a genuine engine-less consumer ever appears. Until then a split is
  speculative structure.

Publication remains consumer-gated (the kit-first ruling): components are born in
the ASC theme layer, Members shakes them, and they move to cairn with the generality
already proven. The subpath ruling settles where they land, not when.

## Ruling: harvest cadence is wave-by-graduation, not per-pass and not end-of-series (Geoff, 2026-07-20)

A component graduates into cairn when its second consuming screen has used it with
the contract unchanged, or when cairn's own admin screens want it (engine pull beats
calendar). Each graduating cohort batches into one cairn release under the normal
release doctrine, so the series produces a few harvest releases, not one per pass
and not a single big-bang harvest at the end. The grounds:

- The cost asymmetry: a wrong contract published in cairn is a breaking change
  across every consumer; the same mistake in ASC's theme layer is one local
  refactor. One consumer exercises only part of a general contract; the second
  screen is the shakedown that earns publication.
- Iteration speed: a local tweak is a commit; a published tweak is a release plus a
  dependency bump on every site. Components stay local while their churn rate is
  high.
- Against end-of-series: Money is deliberately late, a big-bang harvest is a large
  hard-to-review pass, and waiting delays the harvest's real payoff (cairn's own
  admin adopting the toolkit).

Consequence for this pass: the Members set stays in the ASC theme layer at close.
The first harvest wave is expected after the next screen pass (Classes or Assets)
proves which contracts held. Each wave shrinks ASC's local surface: the site swaps
local copies for the `admin-toolkit` subpath imports and deletes them.

## Ruling: cairn dogfoods the toolkit (Geoff, 2026-07-20)

Cairn's own admin screens strive to use the component library wherever a toolkit
component fits, rather than keeping parallel bespoke implementations. This makes
the engine itself a standing consumer: every cairn admin surface exercises the
contracts, engine needs pull components through graduation (the "engine pull"
trigger above), and a daisy upgrade or contract change is proven against cairn's
own screens before any site feels it. Practically, each harvest wave should
include an adoption sweep of cairn's existing admin screens for the components
that wave publishes; new engine admin surfaces reach for the toolkit first and
add bespoke markup only where no component fits.

## Engine item: the daisy absorption ritual (Geoff, 2026-07-20)

Cairn owns the daisyUI dependency for admin surfaces, so cairn gets a scheduled
update ritual rather than ad hoc bumps:

- Automated bump PRs (Dependabot or Renovate on `daisyui`).
- Per release: read the daisy changelog, rebuild, verify every blessed-set class
  still compiles into `cairn-admin.css`, run the visual suite, and note new daisy
  components worth adopting into the toolkit.
- The audit surface is the per-component class inventory each toolkit README entry
  carries, which makes an upgrade's blast radius mechanical to grep.

## Queued: the toolkit-organization cairn pass (Geoff, 2026-07-20)

Once the Members pass lands, a follow-up cairn pass organizes the component
library and sets cairn up as its consumer: establish the `admin-toolkit` subpath
export structure (module layout, the contract-doc convention the toolkit READMEs
seed, the doc-gate coverage for the new surface) and prepare the engine's own
admin screens for adoption per the dogfooding ruling above. This is the receiving
structure for the first harvest wave, so it precedes or opens that wave. Filed in
cairn-cms's ROADMAP ("Next" tier, evolving the 2026-07-15 component-kit entry) at
ff0d3f34.

## Build findings (appended at pass close)

1. **The safelist idiom works and is auditable.** cairn 0.88.3's
   `src/lib/components/admin-css-safelist.ts` sits inside the admin CSS build's
   existing source-scan glob, so the blessed classes ride the normal pipeline with
   a commented rationale, and a build test asserts all 21 previously-missing
   classes compile. The pattern is the right shape for future blessed-set growth.
2. **The class-inventory gap generalizes to utilities, and it fails silently.**
   The safelist covers component families, but `bg-warning/15`, `text-warning`,
   and `text-warning-content` do not compile in the packaged sheet, and markup
   using them renders as plain unstyled text with every mechanical gate green
   (the Overdue chip shipped invisible until the coherence round caught it).
   Engine candidate: a check that flags class literals in site admin code with no
   match in the packaged `cairn-admin.css`, turning this silent failure into a
   gate. This is the pass-B harvest finding upgraded from "document the
   inventory" to "detect the miss."
3. **Safelist follow-up:** `stats-horizontal`/`stats-vertical` were deliberately
   omitted; add them in the release that ships StatBand's consuming pass.
4. **ExpandableRow's narrow-width behavior is part of the genre contract.** A
   `<td colspan>` panel can never be narrower than the table's computed column
   widths, and a `display: block` escape breaks table layout at every width
   (proven empirically; documented in the component header). The working idiom:
   pin the trigger cell sticky-right, and have the consumer hide low-priority
   summary columns at narrow widths so the whole row fits the viewport. The
   harvested contract must state this; it is not discoverable from the happy
   path.
5. **`badge-ghost` is a zebra hazard.** Ghost's fill resolves to
   `--color-base-200`, one of the zebra stripe colors, so ghost chips melt on
   alternating rows. StatusChip's assembly is `badge-outline` (or soft with a
   real border); record it as chip-assembly doctrine when the chip harvests.
6. **View transitions and in-place list updates do not mix.** Snapshot layers
   paint as full-viewport overlays outside any container's clipping, so a
   same-route `goto('?...')` filter update leaks the old, taller list below the
   new card's border. Guard: skip `startViewTransition` when `route.id` is
   unchanged. Files as a consumer-guide note for any cairn site using the
   standard onNavigate cross-fade pattern beside admin list screens.
7. **Contract completeness needs a probing consumer.** ListToolbar's overflow
   disclosure shipped with CSS-only focus-within behavior and gained real
   disclosure semantics (state toggle, aria-expanded/aria-controls) only in the
   coherence fix round, despite Members never exercising it. Unexercised
   contract surface should get its aria/interaction semantics at birth or be
   cut from the first version.
8. **Admin visual gating is probes plus coherence reads, not pixel-diff.** This
   repo deliberately excludes admin screens from the e2e visual suite, so the
   toolkit's visual regression story in cairn should assume the same: probe
   pages and fresh-context reads, not baselines.
9. **Graduation status (per the wave-by-graduation ruling):** all six components
   (AdminTable, ExpandableRow, ListToolbar, StatusChip, Pagination, the
   formatters) shipped their first consumer and survived the coherence rounds;
   none graduated at pass close. UPDATE (Geoff, 2026-07-20, post-close): cairn
   itself now stands as a component consumer, which activates the engine-pull
   trigger — the first harvest wave can open at the toolkit-organization pass,
   with cairn's own admin screens serving as each component's second consumer,
   rather than waiting on the Classes or Assets pass. A contract that bends
   under cairn's screens still blocks that component's graduation, same rule.
