# Fragments migration and DX/contract harvest: implementation plan

> **For the conductor:** this is an orchestrate-and-verify runbook, Opus-conducted (Geoff's
> downshift ruling, 2026-07-17). The spec is
> `docs/2026-07-17-fragments-migration-design.md`; read it in full before step 0 — it carries
> every judgment (the ratified decisions, the probe matrix, the provisional verdict table)
> so you execute rather than re-derive. Fan-out stages run through the workflow script
> `docs/plans/2026-07-17-fragments-migration.workflow.mjs`, one `Workflow` invocation per
> stage (`args: { stage: '<name>' }`), with your judgment between stages. No per-task
> check-ins with Geoff; batch anything that genuinely needs him into one message at the end.

**Goal:** bump to cairn `^0.87.0`, adopt Fragments, convert the surviving
`docs/fragment-candidates.md` candidates, and harvest fragments' first-consumer DX findings
into cairn's friction log.

## Global constraints

- Branch: `fragments-migration` off `main`; PR to `main` at close (the portal pass's shape).
  A push to `main` deploys dev; the apex is never touched by this pass.
- Gate, after every mutating stage: `npm run check` (0 errors, 0 warnings), `npm test`,
  `npm run build`.
- Content edited outside the admin needs `npm run cairn:manifest` in the same change.
- Visual baselines are CI-canonical: class-a extractions must leave them unchanged (CI's
  `test:e2e` proves it); class-b edits regenerate only via
  `gh workflow run ci.yml -f update_snapshots=true` on the branch, and you read the
  dispatch's log, not its conclusion. Never a local `--update-snapshots` run; remember
  Playwright also mints missing snapshots on a plain first run.
- Probe worktrees are throwaway: nothing in them merges, ever.
- Harvest findings go to `~/Projects/cairn-cms/docs/internal/docs-friction-log.md`,
  perspective-tagged. You (the conductor) write those entries from the agents' structured
  findings; the agents report, you triage and phrase.
- Commits: imperative mood, specific files, `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Conductor steps

### Step 0: preflight

- One-executor check: `pgrep -f aksailingclub-org` for live executors, `git status` for warm
  changes you did not author. Warm uncommitted code is stop-and-investigate, not free progress.
- Confirm the pin is still `^0.86.0` and the latest published cairn is 0.87.0
  (`npm view @glw907/cairn-cms version`). If either moved, stop and reassess against the spec.
- Create the `fragments-migration` branch.
- Read the spec end to end.

### Step 1: adopt (workflow stage `adopt`)

Run `Workflow({ scriptPath: 'docs/plans/2026-07-17-fragments-migration.workflow.mjs', args: { stage: 'adopt' } })`.
One implementer executes spec Stage 0 on the branch: the bump, the empirical notifications
verification, the four adoption seams, gate green, diary entries returned in its structured
result.

Your review gate: read the full diff; verify the concept declaration matches the spec (key
`fragments`, `routing: 'embedded'`); verify the notifications evidence is empirical (an
actual `site.all()`/sitemap check, not reasoning); run the gate yourself; commit. Hold the
diary entries for step 5.

### Step 2: probes (workflow stage `probes`)

Requires step 1 committed on the branch (probe worktrees branch from HEAD). Run stage
`probes`. Developer probes P1 to P7 fan out in isolated worktrees; editor probes E1 to E8 run
as two serial seeded-admin agents (spec Stage 1 defines every probe and the finding schema).

Your judgment after: read every finding (fifteen minimum — a probe with no finding is an
unexecuted probe, send it back); look at the editor agents' screenshots yourself; mark the
green-and-wrong verdicts you agree with; fix any finding that is this site's own contract
failure (dispatch an implementer); hold cairn-side findings for step 5. If E8 (directive and
media parity inside a consumer) shows a real rendering defect, extraction in step 4 is blocked
until you understand it — that probe is what makes the migration safe.

### Step 3: survey (workflow stage `survey`)

Run stage `survey`. Nine read-only agents verify the spec's provisional verdict table against
today's content; a tenth sweeps for duplicates born since 2026-07-15.

Your judgment after: resolve the final verdict table. A flip from the provisional verdict
needs the agent's logged reasoning to actually meet the blocks-only bar (spec "Ratified
decisions" item 2); when in doubt, drop — a dropped candidate costs an agreement-test line, a
wrong convert costs a bad page. Any convert left with one real consumer becomes a drop.
Produce the two lists step 4 consumes: `fragments` (each with id, source block, consumers,
change class per consumer) and `agreements` (each with the canonical fact string and the
files that must carry it).

### Step 4: extract (workflow stage `extract`)

Run stage `extract` with `args: { stage: 'extract', fragments: [...], agreements: [...] }`
from step 3. Extraction runs serially (converts share consumer pages; parallel writers would
race), one implementer per fragment, each gate-green with its own commit; a final implementer
writes `src/tests/content-agreement.test.ts` from the agreements list and the spec's
"agreement test" section.

Your review gate: per-fragment diff review. Class-a changes must be render-neutral — the
extracted fragment's markdown must be byte-identical to what the consumer previously carried;
anything that is not byte-identical is class-b and needs your render read at 390 and 1440.
Verify `docs/fragment-candidates.md` was deleted in the final commit and its drop rationale
survives in the spec.

### Step 5: harvest filing

Write the friction-log entries in `~/Projects/cairn-cms/docs/internal/docs-friction-log.md`
from the held diary and probe findings, perspective-tagged, one entry per real finding
(confirmed-as-documented probes collapse into one "confirmed" line naming them). File the
Discord inline-include gap (spec verdict 9) as a developer finding regardless of what the
probes surfaced. This discharges the DX-harvest mandate for the fragments surface — say so in
the entry block's header line.

### Step 6: close

- Dispatch `code-simplifier` over the changed code (config, chassis seams, the agreement
  test — not the content markdown), apply what survives your review.
- Full gate, push the branch, open the PR. CI must be green including `test:e2e`; if class-b
  edits exist, run the `update_snapshots` dispatch on the branch first and read its log.
- Confirm class-a proof: the site-visual baselines came back unchanged in the PR diff.
- Merge, which deploys dev.
- Update `docs/STATUS.md` (new top entry; apply the trim rule), ROADMAP's
  `fragments-migration` entry, and the project memory topic file.
- Report to Geoff in one message: the before/after material for the class-b pages (390/1440,
  light and dark), the resolved verdict table with any flips, the harvest headline (findings
  count by seat, the green-and-wrong ones named), and the open gate (his before/after; the
  apex untouched).

## Task acceptance criteria

The spec's "Pass-level acceptance" section is the contract. Per stage: **adopt** — gate green,
concept live, empty `src/content/fragments/` served, notifications verification recorded;
**probes** — fifteen findings recorded, worktrees discarded; **survey** — a resolved verdict
table with reasoning for every flip; **extract** — converts live with class-a baselines
unchanged, agreement test passing and meaningful (it must fail if a canonical string is
edited in one file), candidates file deleted; **close** — PR merged, dev deployed, friction
log filed, STATUS/ROADMAP/memory updated.
