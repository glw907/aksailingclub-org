# Classes pass: cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, per the fragments
> precedent: a cairn session showed live signals at 2026-07-21 prep (showcase workerd,
> a probe-screenshot viewer), so nothing writes into that repo from here. Paste these
> into the friction log when cairn is free, then delete this file. Findings accumulate
> here through the pass. The frame (Geoff, 2026-07-21): the component library improves
> as we go — each finding is an improvement to make, not a complaint to archive.

## Filed at pass prep (2026-07-21, before execution)

1. **Graduation drift: the toolkit wave re-expressed from a stale snapshot (defect +
   process gap).** cairn 0.89.0's `Pagination` and `ListToolbar` take a plain-string
   `itemLabel` and would render "1 households" — the exact tell ASC's coherence re-read
   caught and fixed (ASC a9a2c8d: `itemNoun` + `ItemLabel { one, many }`). The fix
   landed in ASC's local copies after the harvest note was filed, and the graduation
   wave never diffed the local copies at graduation time. Consequence: a blind subpath
   swap regresses a Geoff-flagged coherence fix. Immediate fix: the classes-pass plan's
   Task 1 (0.89.1, additive `string | ItemLabel` widening, `itemNoun`/`ItemLabel`
   exported from the barrel). Process fix for the wave-by-graduation ritual: graduation
   REQUIRES a diff of the first consumer's live copies against the harvest-time
   snapshot, and the consumer's newer commits win.

2. **The admin-CSS class gate stops at cairn's own templates.**
   `check:admin-css-classes` (0.89.0) checks cairn's admin-toolkit and admin component
   templates against the built sheet — the right gate, but only for cairn. A consumer
   site's hand-written admin markup still hits the silent-non-compile trap with all
   gates green (the Members pass's `bg-warning/15` Overdue chip). The checker now
   exists; export it (or document the recipe) so a site can run the same check over its
   own admin templates against the shipped `cairn-admin.css`. This closes the Members
   harvest finding's consumer half.

3. **Partial graduation needs a blessed consumer pattern.** `ExpandableRow` stayed
   local (correctly — no second consumer yet), so after the swap ASC's toolkit
   directory holds one component whose own imports reach into the subpath, and a README
   that is mostly a pointer. The state is fine but undocumented; the admin-toolkit
   reference could carry two paragraphs on the mid-graduation consumer shape: local
   components import graduated ones from the subpath, local tests cover only local
   contracts, the site README points at cairn for everything graduated.

4. **Every 0.x minor strands every consumer behind its caret range.** `^0.88.0`
   excludes 0.89.0, so each minor needs a manual range bump in each consumer — hit at
   0.85.0 (recorded then) and again now. Small ritual fix: the cairn-release checklist
   carries a known-consumers list (asc-site, ecxc-ski, 907-life) and the release close
   names which were bumped or deliberately left.

5. **Evidence the model works (keep doing this).** 0.89.0 shipped `PageHeader` and
   `EmptyState` ahead of ASC's need for them — this pass adopts both on day one instead
   of hand-rolling. The engine-pull direction of wave-by-graduation is earning its
   keep; worth a line in the toolkit reference's history note when the next wave lands.

## Filed during execution

6. **Task 1 close-out on finding 1 (2026-07-21).** The `itemNoun` graduation landed in
   cairn as the planned additive widening (`string | ItemLabel` on both components'
   `itemLabel`, `itemNoun`/`ItemLabel` exported from the barrel; every count and range
   line routes through the one fix point). Cairn's port also accepts a plain string in
   `itemNoun` itself, which ASC's original never needed — the graduated form is the more
   general contract. The process fix stands as filed: graduation requires a diff of the
   first consumer's live copies against the harvest-time snapshot, and the consumer's
   newer commits win. One naming note for the friction log: cairn-cms has no `build`
   script (`npm run package` is the library build), so a plan or dispatch written from
   the consumer side says "build" and the executor has to map it; the gate list in
   cairn's CONTRIBUTING/README could name the canonical gate commands once.

7. **Task 2 close-out: the graduated contracts needed zero caller-side reconciliation
   (evidence the model works, keep doing this).** The plan flagged a risk ("cairn
   re-expressed `ListToolbar` substantially — segmented filters, count presentation;
   reconcile each caller to the graduated contract") that never materialized in
   practice: `StatusChip`, `Pagination`, `AdminTable`, and `ListToolbar`'s graduated
   props are a strict superset of ASC's own local contracts (`display: 'segmented'`,
   `trailing`, `overflowLabel`, `pageSizeOptions` are all-optional additions), so the
   Members screen's every existing prop call site kept working unchanged — the swap
   was import-path-only. The one real integration point, `itemNoun`'s `string |
   ItemLabel` widening (Task 1), was exactly enough; no other reconciliation surfaced.
