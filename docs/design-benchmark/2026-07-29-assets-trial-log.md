# The Assets pass trial log

The running record for the design-capture trial pre-registered in
`docs/plans/2026-07-29-cairn-design-trial-assets.md`. The plan is the protocol; this file is
what actually happened. Deviations are recorded as findings, never as silent adjustments.

## Pre-trial chores

### Chore 1: the cairn bump

`@glw907/cairn-cms` moved from `^0.90.0` (resolving 0.90.1) to `^0.91.0`. Post-bump gates:
`npm run check` 0 errors / 0 warnings across 1003 files, `npm run build` green.

`npx cairn-doctor` reports 14 passed, 2 failed, 2 skipped. Both failures are 403s on
Cloudflare zone-setting *reads* (Always Use HTTPS, HSTS), so they are token-scope failures
rather than measured misconfiguration. Pre-existing, unrelated to this pass, filed rather
than chased.

### Chore 2: the skill install and the Tailwind exclusion

`npx cairn-doctor --fix` installed 8 files into `.claude/skills/cairn-admin-screens/`
(`SKILL.md` plus 7 references). `src/theme/theme.css` gained `@source not "../../.claude"`,
so Tailwind's automatic source detection stops compiling the exemplars' quoted utility
tokens (including retired ones shown as annotated counter-examples) into the site sheet.

### Chore 3 opened on a finding: cairn 0.91.0 silently broke 300 consumer markup sites

**This is the pass's first finding, and it is a substrate defect, not a protocol deviation.**

The plan expected the type-grammar sweep to be a mechanical adoption: corpus C measured 265
of ASC's 298 `type-scale` findings as pixel-identical renames. The post-upgrade audit instead
reports a different shape entirely:

| Rule | Corpus C (0.90.1) | This run (0.91.0) |
| --- | ---: | ---: |
| `no-uncompiled-class` | 99 | 411 |
| `type-scale` | 298 | 9 |
| `stock-default-hazards` | 12 | 12 |
| `reduced-motion`, `focus-parity` | 2 | 2 |
| **Total errors** | **411** | **434** |

The 298 `type-scale` findings did not become renames. They became `no-uncompiled-class`
errors, because **0.91.0's own type-grammar migration removed the size utilities from the
shipped admin stylesheet.** Cairn migrated its internal screens onto `type-*` roles, Tailwind
therefore stopped generating the named steps into `dist/components/cairn-admin.css`, and every
consumer admin screen that reached cairn's sheet for those utilities lost them on the bump.

Measured directly against the two shipped sheets (`grep` for the class rule, method validated
against `type-body`, `card-shell`, `gap-control`, `btn-ghost`, `text-base-content`, all present
as expected):

| Class | In 0.90.1 sheet | In 0.91.0 sheet | ASC sites affected |
| --- | :---: | :---: | ---: |
| `text-sm` | yes | **no** | 239 |
| `text-xs` | yes | **no** | 24 |
| `text-lg` | yes | **no** | 23 |
| `gap-6` | yes | **no** | 9 |
| `text-2xl` | yes | **no** | 3 |
| `tracking-tight` | yes | **no** | 2 |
| | | | **300** |

ASC's admin routes load only the packaged `cairn-admin.css` (the repo's own code comments
record this in four places as the "silent-non-compile trap"), so these 300 sites have no other
sheet to fall back on.

The upgrade guide's adoption recipe asserts the opposite: "When you cross `0.91.0` ... your
custom admin screens keep rendering exactly as they did." For a consumer whose admin markup
reaches cairn's sheet for a named size step, that claim is false, and the release shipped as
non-breaking. `badge-ghost` (12 sites) also left the sheet, but that one is the announced
`Consumers must:` migration and is correct.

**Independent corroboration.** Renaming exactly the four pixel-identical classes dropped the
audit from 411 `no-uncompiled-class` errors to 137, and 137 minus the three classes still
outstanding (`text-xs` 24, `badge-ghost` 12, `tracking-tight` 2) leaves **99**, exactly the count
corpus C recorded for this rule against ASC at 0.90.1. The two measurements agree on ASC's own
pre-existing debt, which is what makes the newly-dead set attributable to the release.

A method note, since it bears on the numbers. The first pass at this split grepped each class
rule out of the two shipped sheets, and that grep put `ml-1` in the newly-dead column because
`.ml-1` also matches inside `.ml-1\.5`. `ml-1` is in fact always-dead. The differential for the
six regression classes survives (none has a decimal sibling, and the audit confirms all six
independently), but the pre-existing figure moved from 90 to the correct 99. The audit's own
before/after is the measurement of record; the sheet grep was the hypothesis that pointed at it.

### The three-way split of the 411 `no-uncompiled-class` errors

**1. Newly dead in 0.91.0, a cairn regression (300 sites).** Repaired by renaming onto the
grammar role, which is also the forward-correct end state. Five of the six are pixel-identical,
verified against the utility definitions in the shipped sheet:

| From | To | Size / leading | Identical? |
| --- | --- | --- | :---: |
| `text-sm` (239) | `type-body` | 0.875rem / 1.25rem | yes |
| `text-lg` (23) | `type-heading` | 1.125rem / 1.75rem | yes |
| `text-2xl` (3) | `type-title` | 1.5rem / 2rem | yes |
| `gap-6` (9) | `gap-section` | 1.5rem | yes |
| `text-xs` (24) | `type-meta` **or** `type-label` | 0.8125rem or 0.6875rem | **no** |
| `tracking-tight` (2) | no role exists | — | **no** |

`.type-heading` sets only `font-size` and `line-height`; the changelog's "18px, bold, the
display face" describes the recipe it unifies, not the utility, so the rename carries no weight
or family change.

The 12px problem has no mechanical answer: the closed scale runs 13px (`meta`) then 11px
(`label`), so no role carries 0.75rem. Cairn hit the same wall on its own screens and resolved
120 twelve-pixel sites "onto `type-meta` or `type-label` by the relationship each site
expresses". ASC's 24 sites take the same per-site judgment, and each one changes size by 1px or
2px against how it rendered at 0.90.1.

**2. Announced migration (12 sites).** `badge-ghost` to `StatusChip register="quiet"` or
`.cairn-chip-quiet`, per 0.91.0's `Consumers must:` line.

**3. ASC's own pre-existing debt (99 sites).** Absent from *both* sheets, so never once rendered
as authored. These are real repairs, not renames: `divide-y` and
`divide-[var(--cairn-card-border)]` (7 each, the trap STATUS already names twice), `ml-1` (8),
`w-fit` (7), `text-warning` (6), `max-w-none` (5), `first:pt-0` / `last:pb-0` (5 each),
`text-success` (4), the `print:*` family (10 across the certificate route), and the rest
singletons. Only 5 of the 99 fall on the Assets pass's own surfaces; see "Chore 5 and the
standing debt" below for how the other 94 are routed.

Also outstanding: 9 `type-scale` errors, all `text-xl` (1.25rem / 20px), which is genuine
off-scale drift with no role. Each takes a role or a counted suppression with its reason.

### Chores 3 and 4 as executed

Geoff's ruling (2026-07-29, two questions, both taking the recommendation): repair ASC forward
onto the grammar roles and file the cairn regression rather than pausing the trial for a 0.91.1;
resolve the twelve-pixel sites per relationship rather than by a blanket rule.

The audit walked down in five measured steps, each verified before the next:

| Step | Errors | Suppressed |
| --- | ---: | ---: |
| post-upgrade baseline | 434 | 0 |
| 274 pixel-identical renames | 160 | 0 |
| 24 twelve-pixel sites resolved | 134 | 0 |
| `tracking-tight` dropped | 134 | 0 |
| 21 `badge-ghost` sites migrated | 110 | 0 |
| off-scale titles and stat suppressions | 96 | 5 |
| the Assets surfaces cleaned | 96 | 5 |

**The 274 pixel-identical renames.** `text-sm` to `type-body` (239), `text-lg` to `type-heading`
(23), `text-2xl` to `type-title` (3), `gap-6` to `gap-section` (9), across 27 files. Verified
identical against the shipped utility definitions rather than assumed: `.type-heading` sets only
`font-size` and `line-height`, so the changelog's "18px, bold, the display face" describes the
recipe it unifies and not the utility. No variant-prefixed forms existed, which is what made a
token-boundary rename safe; a `sm:text-sm` would not have survived it, since the grammar
utilities are safelisted bare.

**The 24 twelve-pixel sites, by relationship.** The signature certificate's 11 `<dt>` and section
labels all carry the uppercase eyebrow recipe, so they took `type-label`. The other 13 are helper
text under form fields and row qualifiers (a version stamp, a prior holding, "Wants to learn"),
which took `type-meta`.

One site needed catching by hand, and it is worth recording as a process note. A file-scoped
rename gave `type-label` (11px) to the certificate's `<pre>` carrying `contentSnapshot`, the
actual signed waiver text on a legal record that prints. That is document body, not a label, and
it went to `type-body`. The blanket instrument was wrong for exactly one site in the file, and the
only thing that caught it was reading the count discrepancy (12 where 11 were expected) rather
than trusting the total.

**`tracking-tight`, dropped rather than replaced.** Two page-title h1s carried it dead. Queried
before deciding, per the skill: `cairn-audit norms page-title` reports `letter-spacing: normal`
across 5 sites. That is already what these h1s render, so removing the class changes nothing and
removes a lie from the markup.

**The 21 `badge-ghost` sites, all to the quiet register.** Every one is a put-away state
(Hidden, Archived, Lapsed, Refunded, Not billed) or a taxonomy qualifier (a committee kind, a role,
Member/Applicant, an event category), which is what `quiet` is for. Nothing was promoted to
`bounded`: that would be a design change smuggled into a mechanical migration, and StatusChip's
palette mapping is already an open item on Geoff's queue.

The documented `base-300` hazard was checked rather than assumed. The quiet fill is
`color-mix(in oklab, base-content 14%, base-300)`, and the constraint is that it cannot be trusted
on a ground at or near `base-300`. ASC's admin tables carry no `table-zebra` and no `bg-base-300`
anywhere; row hover is `bg-base-200/60` on all 9 sites. The chip reads darker than its ground, so
the constraint does not bite here.

Seven of the 21 sat in `src/admin-club/lib/` (`ui.ts`, `member-format.ts`), outside the audit's
default `static.scope` and therefore invisible to the audit while rendering on audited screens.
Filed as harvest finding 4.

**Off-scale titles.** Four hand-rolled documents-family h1s rendered 20px/600 against a ratified
page-title norm of 24px/700 that every other admin h1 already meets. They moved to
`type-title font-bold`. This is a deliberate visible change and belongs in Geoff's before/after.

**Five counted suppressions.** The `stat-value text-xl` sites on Money (4) and asset-requests (1)
are 20px, off the closed scale. Both screens have their own passes ahead (Money deliberately
deferred per ROADMAP; asset-requests rebuilt by this very trial), so each directive names that
reason rather than pre-empting those passes. Note that `stat-value` does compile (2rem/800), so
the money screen's own comment claiming the stats CSS renders inert is wrong for
`stat-value`/`stat-desc`/`stat-title` and right only for the container variants.

A directive-placement gotcha, worth knowing: "next line" resolves to the next AST node, so
inserting an explanatory comment between a directive and its element silently detaches it. The
run reports the finding again while still counting the directive, which reads as a passing
suppression next to a failing rule. The explanation has to go above the directive, not below it.

### Chore 5 and the standing debt

The Assets pass's own surfaces (`assets/`, `asset-requests/`) are **error-clean**, which is what
the trial needs: a builder inheriting pre-existing errors on their own screens cannot separate
their own misses from the site's, and metric 3 counts mid-build audit catches.

96 errors remain site-wide: 94 dead classes across 17 other screens, plus one `reduced-motion` and
one `focus-parity` on the admin dashboard. **These are routed to each screen's own pass rather
than absorbed here**, per the standing rule that discovered work goes to the pass that first leans
on it, not the pass that found it. Only 5 of the 99 were ever on the Assets perimeter. The
distribution, for whichever pass picks each up: Money 18, Members detail 18, the signature
certificate 15, Announce detail 7, Email compose 6, the classes waitlist 6, Email detail 5,
Documents 5, Committees 3, and eight screens with one or two each.

The rendered half of chore 5 has **not** run yet. It needs a local `wrangler dev` with a seeded D1
session row and `CAIRN_AUDIT_COOKIES`, which is also the door the edit-desk hydration defect has to
be diagnosed through. Both are the next session's opening work.

### Gates at the close of the chores

`npm run check` 0 errors / 0 warnings (1003 files). `npm test` 2003 tests across 153 files, exit 0.
`npm run build` green. The `.claude` exclusion verified in the built sheet: four tokens quoted only
in the skill's exemplars (`badge-ghost`, `cairn-chip-bounded`, `type-subtitle`, `gap-group`) are
absent from ASC's own compiled CSS, against a control token that is present. That confirms the
outcome; it does not on its own prove the directive was load-bearing, since Tailwind might not have
scanned `.claude` regardless.

**Not yet run, and all still owed:** the rendered audit baseline, the visual-baseline regeneration
(0.91.0's `PageHeader` margin fix plus the h1 and chip changes move rendering, so `ci.yml`'s
`update_snapshots` dispatch is required), Geoff's before/after, the edit-desk hydration diagnosis,
and the trial itself.

### The largest visible change came from outside the audit's reach

`HEADER_CELL` (`src/admin-club/lib/ui.ts`) is the shared uppercase micro-label on every admin
table column header and eyebrow: 118 uses across 18 screens. It carried
`text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted`, and the size literal
never compiled into the packaged sheet. **The admin's most-used label recipe has rendered at the
inherited size for its entire life, under a green gate.** `0.6875rem` is exactly
`--cairn-type-label`, so the repair is `type-label`, which is also what the list exemplar
prescribes for a column header.

The audit never saw it, and no config makes it: the static substrate is `svelte/compiler` over
markup, and `src/admin-club/` holds 34 `.ts` files with no component in it. Adding the directory
to `static.scope` leaves the scanned-file count at 29. Confirmed the config was genuinely being
read by appending a nonexistent path and watching the documented fail-loud fire. Filed as harvest
finding 4, upgraded from a scope-defaults note to a substrate limitation.

**This is the pass's biggest rendering change and the one that most needs Geoff's eyes**: every
admin column header moves from roughly body size to 11px. It is the same direction as the
certificate route's `<dt>` labels, which moved the same way.

### Two method corrections, both mine, both caught by re-measuring

Recorded because the pattern is the lesson, not the arithmetic.

The sheet-grep hypothesis was wrong twice, in opposite directions, and each time the fix was to
check the escaping rather than trust the count. First, `.ml-1` matched inside `.ml-1\.5`, which
put `ml-1` in the regression column when it was always-dead. Second, and more costly, a `grep -F`
for `tracking-\[0.08em\]` missed the real CSS form `tracking-\[0\.08em\]` (the literal dot is
escaped too), which read as absent. On that false reading `tracking-[0.08em]` was cut from
`HEADER_CELL` as dead. It compiles, it had been working all along, and cutting it would have
silently dropped letterspacing from 118 sites. Restored.

What surfaced both: a count that did not reconcile. The first showed up as a pre-existing figure
of 90 against corpus C's 99; the second as an audit that declined to flag a token the grep called
dead, which prompted a systematic false-negative hunt across all 210 admin class tokens. That hunt
found no rule defect at all. The 28 candidates it turned up are names defined in components' own
`<style>` blocks, which `no-uncompiled-class` is documented to accept, so the rule was right and
the grep was wrong. **`cairn-audit` was the reliable instrument at every step; the hand-rolled
sheet grep was the unreliable one.** A finding against the engine gets held to the engine's own
standard of proof before it is filed.
