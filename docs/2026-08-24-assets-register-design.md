# Assets register re-entry: the design contract

The `admin-screen-passes` entry for `/admin/club/assets` and `/admin/club/asset-requests`,
brainstormed with Geoff 2026-08-24. This pass re-enters the two screens at the events-admin
series bar. It changes register, not function: the functional layer landed in the 2026-07-30
substrate and trial passes, and the 2026-07-29 functional design
(`docs/2026-07-29-assets-functional-design.md`) stands unreopened. Budget: 1.5M agent tokens,
checkpoint every four tasks.

## Why the screens re-enter

The trial rebuild passed unanimous cold coherence reads on 2026-07-30, against the bar of
that date. The bar has moved since: cairn went `^0.91.1` to `^0.96.0`, the events-admin pass
ratified a toolkit-wide chip grammar (`docs/design-benchmark/decisions.md`, the 2026-08-24
entries), and the series ledger added register standards the Assets screens predate. The
2026-08-24 survey of the live files found the drift: payment standing renders through
`StatusChip` while the waitlist type badge and the New/Retention kind badge are hand-rolled
`.badge` spans that bypass the component; no chip carries the ratified tinted-ground grammar;
the Assets screen hand-rolls its empty states while asset-requests uses the packaged
`EmptyState`; and legacy free-text descriptions render verbatim, including all-caps imports.

## The rulings (Geoff, 2026-08-24)

1. **Register re-entry only.** No new features. The pass covers probe rounds from the real
   admin shell, the chip grammar, toolkit unification, and the riders below. Fee collection,
   member waitlist join, and capacity mechanics stay closed.
2. **Collapsibility is judged at the probe.** The 2026-07-20 walkthrough asked for
   collapsible per-type lists; the trial rebuild kept groups open. The probe renders the real
   41-assignment scroll at 1440 and 390, and Geoff rules there.
3. **Descriptions display-normalize.** Conservative recase at render time only (all-caps
   words to title case, boat-name patterns left alone), same idiom as the member-name
   recasing. Stored values stay untouched.
4. **The owed before/after folds into this pass.** One before/after at pass close covers the
   2026-07-30 trial rebuild and this pass's register work; the review-queue entry retires.
   It still gates the apex.
5. **The member surface is renamed.** "Gear" is wrong: a mooring, an RV spot, or a rack slot
   is not gear. `/my-account/gear` becomes `/my-account/storage`, labeled "Storage &
   moorings", matching the content pages' vocabulary. Nobody uses the system yet (Geoff,
   2026-08-24), so the rename is a clean route move: update every inbound link (portal
   landing, decision emails, admin copy) and add no redirect. Label and route only; the
   screen's design is out of scope.
6. **Admin vocabulary stays "Assets".** Sidebar labels, screen titles, routes, and the
   `asset_*` schema are unchanged.

## Binding inputs

- `docs/design-benchmark/decisions.md`, both 2026-08-24 entries: the tinted-ground chip
  grammar (tone color mixed into the row ground in oklab, the 1.16–1.47:1 contrast band as
  the standard, one font weight across chips, hairline-outline vs filled for
  transient-vs-settled states), and the settle round's reflow lessons.
- `docs/2026-08-22-events-admin-harvest-findings.md`, finding 12: the grammar belongs to
  cairn's `StatusChip`; this site carries it as admin-scope CSS overrides until the engine
  ships it. This pass's chip work is evidence for that ask and files back to it.
- `docs/2026-07-15-asc-invisible-polish-brief.md`: the resolved-craft catalogue, applied at
  build time.
- `docs/2026-07-29-assets-functional-design.md` and the substrate harvest
  (`docs/2026-07-30-assets-substrate-harvest-findings.md`): the functional contract and the
  filed mechanics. Nothing in them reopens.
- `docs/HISTORY.md`, the events-admin and events-probe-settle entries: the series bar and
  the measurement methods (reserved column widths, canvas-resolved colors, per-pair tint
  tuning, `scrollWidth === clientWidth` at 390).

## The probe round

One probe page per screen, built the settled way: the dev page's own shell, compiled CSS and
fonts inlined, live D1 rows, both themes, 1440 and 390 (the `build.py` pattern at
`~/.local/asc-data/probes/events-redesign/`). The probes present candidates; Geoff rules.

Questions the probes carry:

- **Chip unification.** Every chip on both screens moves onto `StatusChip` with the
  tinted-ground grammar: payment standing on the semantic tones (success, warning, neutral),
  New/Retention and the waitlist type label brought off hand-rolled spans. Tints are tuned
  per theme/stripe pair into the measured band, not to one percentage.
- **The category-color fork, deliberately open.** Do the four asset types get category tints
  of their own (the way racing/class/social took the public Season palette), or do type
  labels stay on the quiet neutral? The probe shows both.
- **Collapsibility**, per ruling 2, judged against the real scroll.
- **Descriptions recased**, shown in place on real rows.
- **Empty-state and toolkit unification**, shown where it changes what renders. The
  waitlist and requests empty states matter: empty is the normal state (both tables hold
  zero live rows) and the functional design makes it first-class.

## The build, per settle

Implementer→diff-reviewer chains per task through the Agent tool (under six tasks, no
workflow). The expected tasks: the chip/register work from the verdicts, empty-state and
toolkit unification, the description recasing, the member-surface rename (ruling 5), and the
`asset_requests` unique-index migration. The migration is scratch-proven with forward,
rollback, and verify steps, then applied live; its index shape matches the app-level
duplicate guard, which already blocks re-requests beyond `pending`. Full repo gate at close;
baselines regenerate only through the `ci.yml` dispatch if rendering changes; a fresh-context
cold coherence read at 390 and 1440 in both themes closes the pass.

## Out of scope

- Any payment-collection mechanism. The coexistence sentence stands.
- The `/my-account/storage` screen's design (the rename is ruling 5's label-and-route move).
- Full CRUD on asset types.
- Implementing the `StatusChip` grammar in cairn itself. The site-carried override is the
  mechanism; the engine ask stays finding 12.

## Acceptance

- Cold coherence read CLEAN at 390 and 1440, both themes, fresh context.
- Chip contrast measured into the 1.16–1.47:1 band per theme/stripe pair, colors resolved
  through the canvas method.
- `scrollWidth === clientWidth` at 390 on both screens.
- Gate green: `npm run check` 0/0, `npm test`, the e2e suite, baselines CI-regenerated.
- The unique-index migration verified live.
- Geoff's single before/after on dev (ruling 4), the apex gate.
- Harvest findings filed per the standing engine-mechanics rule before the pass reports done.
