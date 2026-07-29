# The Assets pass as the design-capture trial

cairn `0.91.0` is on the registry, which unblocks this pass. The Assets build doubles as
the design-infrastructure initiative's controlled trial: it measures whether the packaged
capture (tokens, norms, the `cairn-admin-screens` skill, `cairn-audit`) lets fresh builder
sessions produce screens that pass a cold coherence read the first time. The protocol is
pre-registered; deviations from it are findings, not adjustments.

## Pre-trial chores (mechanical, before any measurement)

1. Bump `@glw907/cairn-cms` to `^0.91.0`, `npm ci`, run your own gates.
2. `npx cairn-doctor --fix` installs the skill into `.claude/skills/cairn-admin-screens/`.
   Exclude `.claude` from Tailwind's source scanning (the skill's exemplar files carry
   literal utility tokens, including retired ones used as annotated counter-examples).
3. The type-grammar rename sweep: the upgrade guide's "Adopt the admin type grammar"
   recipe (cairn `docs/guides/upgrade-cairn.md`). Corpus C measured 265 of ASC's 298
   `type-scale` findings as pixel-identical renames.
4. Replace the twelve `badge-ghost` uses per the `0.91.0` `Consumers must:` line
   (`StatusChip register="quiet"` for put-away states, the melt is pixel-proven in light
   theme).
5. Re-run `npx cairn-audit` static and rendered (the corpus C door: local `wrangler dev`,
   seeded D1 session row, `CAIRN_AUDIT_COOKIES`); record the post-upgrade baseline counts
   in the trial log. The error tier should be clean before the trial starts.

## Control conditions (spec section 9; violations invalidate the trial)

- Fresh builder sessions, plan-driven, uncoordinated, same process as Members and Classes.
- The dispatch protocol says "load the cairn admin-screens skill" and nothing else about
  design. Any design content in the Assets plan beyond that pointer is a control
  violation. The skill, the audit, and the norms query are the only sanctioned carriers.
- The trial log records what each builder actually had in context.

## The done-gate (the builder's own loop, before declaring any screen done)

Static audit passes; rendered audit passes against the running dev server, both themes;
for any derivation or novel composition, the builder runs the shipped grader prompt
against its own multi-state captures and fixes what it finds. A green audit is reported
as vocabulary-clean, never design-done. Builder-added suppressions are flagged in the
builder's own report and count against metric 4.

## Measurement

- External coherence reads: k=3 per read, consensus 2-of-3, tell union reported. The
  prompt is PINNED: `skills/cairn-admin-screens/references/grader-prompt.md` at the hash
  recorded in cairn `docs/internal/2026-07-grader-calibration-ledger.md`, model
  `claude-opus-5`. Captures: 390 and 1440 plus an interaction state, both themes.
- Four metrics, baselines from Members (reads-to-PASS 2, first-read tells 8) and Classes
  (3, 4): reads-to-PASS (target 1), first-read tell count, mid-build audit catches,
  suppressions added.
- Verdict logic: every first-read tell classifies against the coverage contract (cairn
  `docs/internal/2026-07-assets-trial-coverage-contract.md`), (a) capture-gap (outside
  the claimed perimeter; feeds the ratchet) vs (b) covered-but-missed (inside it; counts
  against the thesis). Classification is against the contract, never the rule inventory.
- Riders: at least one composition the toolkit does not cover (the ladder + norms +
  grader path gets its first read), and the build's token cost recorded against the
  Members and Classes builds.

## Known limits to carry into the log

- `chip-ground-collision` is advisory pending its chroma repair, so the quiet chip
  register is mechanically unguarded; the grader's item c covers it by eye.
- The quiet register is documented as not for grounds at or near `base-300` (row-hover
  zebra tables); the constraint is in the StatusChip reference.
- Advisory-tier noise is a known state (stock-hairline mass, two norms-bands bugs, all
  filed in cairn's ROADMAP); the trial gates on the error tier.

## Separate work item, NOT part of the trial

The edit-desk hydration defect: both `/admin/edit/*` routes SSR correct admin HTML, then
hydrate into the public 404 chrome under local `wrangler dev` (found read-only during
corpus C; mechanism undiagnosed; possibly local-only; 58 corpus findings quarantined
behind it). Diagnose in this repo with the site running before or alongside the trial;
it is a defect diagnosis, not a capture measurement. cairn's rendered audit now refuses
identity-swapped pages instead of silently measuring them, so a recurrence is visible.
