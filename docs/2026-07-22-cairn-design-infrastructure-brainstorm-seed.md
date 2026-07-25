# Cairn design-infrastructure initiative — brainstorm seed (2026-07-22)

Seed for the brainstorm sitting that opens AFTER the Members refinement release lands
and this session closes. The initiative is cairn-side; the sitting launches from
`~/Projects/cairn-cms`. This doc carries the thesis, the evidence, and the proposed
structure so the fresh session starts grounded, not cold.

## The question (Geoff, 2026-07-22, verbatim)

**"Can we capture cairn's design language in such a way that an AI agent can reliably
use and repeat it?"** Everything below serves this question. It is empirical, not
rhetorical: the Members evidence already shows the answer is yes WHERE capture
happened (token'd and contracted decisions repeated reliably across three
uncoordinated build sessions) and no where it didn't (everything left as rendered
precedent got reinvented). So the brainstorm's real subject is the capture FORMS and
their reliability ordering — the working hypothesis, to be tested rather than
assumed: tokens and typed contracts > canonical exemplars to imitate > written rules
> rendered precedent, with mechanical gates catching what none of the forms carry,
and in-context delivery (a skill loaded at build time) mattering as much as the
capture itself. The Assets pass is the controlled trial and the success criterion is
already defined: a first build that lands resolved without a refinement round.

## Geoff's thesis (2026-07-22, verbatim in substance)

Given the rise of agentic coding, it can be much easier for a developer to make a
coherent suite of tools for an organization using a system like cairn than to string
together loosely connected hosted tools. That is only true if it is easy for a
developer to start with "base cairn" and build new functionality that integrates well
with the whole. The admin component-library exercise demonstrated a weakness in
either the idea or the implementation.

## The diagnosis (from the Members refinement round's evidence)

The weakness is the implementation, and it is specific: cairn's design language lived
in its rendered pixels, not in forms legible at build time. Where the language existed
as written contract (color roles, the 11px label recipe, the 10px chip size, the
shared header-cell token), three uncoordinated build sessions produced screens the
audit lenses graded already-right. Where it existed only as precedent (type scale,
spacing rhythm, focus vocabulary, screen anatomy, action placement), every builder
invented: seven unrelated type sizes, a buried primary action, sibling screens that
disagreed. The failure tracks the missing spec surface almost exactly.

The agentic-specific lesson: a human designer absorbs a design language by looking;
an agent composes from what is legible at build time — component defaults, tokens,
written rules, checkable gates. Component-library defaults (daisy) compose
functionally but not visually, so assembly from defaults yields locally-correct,
globally-incoherent screens. The thesis is conditionally true; this initiative builds
the condition.

Counter-evidence FOR the thesis, same week: the 0.90.0 release lands the mobile
action fix, header-gap fix, chip, hover, and panel treatments on Classes without
anyone touching Classes — package-level compounding no string of hosted tools gives.

## Proposed structure (five layers, to be brainstormed, not pre-decided)

1. Design language ships in the package as contract: ruled type scale, spacing
   rhythm, focus/state vocabulary, register rules (one filled action per surface,
   chip passivity, facet quietness), screen anatomy — tokens where possible, written
   standard where not. (The ASC round produced first versions: the scale, the toolbar
   grammar, the anatomy ruling — see the round-1 arc log and the admin design
   standard doc in aksailingclub-org.)
2. Primitives cover the recurring anatomy so builders compose rather than style:
   the admin toolkit (mostly graduated at 0.90.0), PageHeader adoption, EmptyState,
   the queued destination-picker pattern.
3. Documentation built for agent consumption: a "building a cairn admin screen"
   guide (anatomy, annotated exemplar screen, per-component contracts), delivered
   through a loadable skill so a builder agent carries the standard in-context at
   build time.
4. Enforcement in the engine: a `cairn audit` mechanical gate (off-scale font sizes,
   non-token colors, a second filled button per surface, focus-visible coverage, and
   the non-compiling-class detector — three occurrences to date, all with green
   gates); possibly a new-screen scaffold so work starts from the anatomy.
5. The proof loop: the ASC Assets pass (paused mid-functional-brainstorm; its state
   is in the ASC session record and STATUS) builds against the finished structure
   and measures how close the first build lands to "resolved" versus Members and
   Classes, which each took a build pass plus a refinement round. If Assets still
   needs a full refinement round, the idea has a deeper problem than implementation.

## Sequencing

Release lands (workflow wf_f012ed48-01a) → close ceremony in the ASC session (admin
design standard doc, decisions.md, STATUS, cairn ROADMAP filing pointing here) →
session closes → fresh brainstorm sitting from ~/Projects/cairn-cms.

RESUME PROMPT for the fresh session (launch directory ~/Projects/cairn-cms):
"Start the cairn design-infrastructure brainstorm: read
~/Projects/aksailingclub-org/docs/2026-07-22-cairn-design-infrastructure-brainstorm-seed.md
and cairn's ROADMAP entry, then open the brainstorm with Geoff
(superpowers:brainstorming) on the five-layer structure. The ASC Assets pass is the
validation trial and stays paused until the structure exists."

## Brainstorm state (2026-07-24, banked from the ASC sitting before the move to cairn-cms)

The brainstorm opened in the ASC repo (STATUS.md's resume prompt pointed there); Geoff
moved it to cairn-cms mid-flight. Everything below is SETTLED with Geoff in that
sitting — the cairn session resumes at design section 3 of 3 and does not re-ask these.

- **Audience**: package-shipped from day one. The standard, exemplar, skill, and audit
  all live in the cairn-cms package where any consumer's agent can load them; no
  workstation-first detour.
- **Sequencing**: full structure before the Assets trial, so a trial failure indicts
  the idea rather than a half-built implementation.
- **Surface scope**: admin only. Public-facing pages should share the design cues, as
  a later initiative.
- **Composition** (approved): mechanics-forward minus the scaffold. Grammar tokens;
  the standard doc plus annotated Members exemplar; a packaged skill (SKILL.md under
  the package's `skills/`, installed and freshness-checked by `cairn-doctor`); and a
  two-mode `cairn-audit` bin (static lint over source and built CSS, plus a rendered
  mode for the checks only a live page can carry: one filled action per surface,
  focus-visible coverage). The new-screen scaffold is deferred until the trial shows
  an anatomy-shaped miss. Cairn's per-command bin pattern (cairn-manifest/-doctor/
  -media-seed) is the precedent `cairn-audit` follows.
- **Narrative layer is a deliverable**: a rationale doc in cairn's docs stating the
  bet (agentic coding inside a capture-complete system beats stringing hosted tools
  for any org needing a "CMS Plus"; ASC is the proof case) and the condition (an
  agent composes from what is legible at build time). README positioning distills
  from it, and a front-page treatment on cairn's public face rides as an explicit
  deliverable.
- **Design section 1 approved**: type roles AND relational spacing roles ship as
  engine grammar tokens (`--cairn-type-*`, `--cairn-gap-control/-label/-group/
  -section`, indentation roles) — builders pick relationships by name, never pixel
  values. Toolkit components migrate to the tokens pixel-identically (existing visual
  baselines as no-drift proof). The palette/grammar token boundary is written and
  audit-enforced: sites re-tune palette tokens, never grammar tokens.
- **Design section 2 approved, with two additions**: primitives gap-closure
  (destination-picker, EmptyState, PageHeader adoption — nothing speculative); the
  standard doc written for an agent's context window with the annotated exemplar as
  its load-bearing half; PLUS the extension grammar (the derivation ladder for
  when no primitive fits, one worked derivation shown step by step, the
  coherence-read gate shipped as a grader prompt in the skill, and the
  graduation feedback loop so consumer inventions flow back to the toolkit).
- **THE CENTRAL QUESTION (Geoff, verbatim in substance)**: whether the invisible
  feel — spacing rhythm, font treatment, color tinting, indentation, optical
  alignment — can be captured systematically enough that a fresh agent reliably
  applies it to cairn admin work. It is an honest open question, not assumed
  answerable. The ratified capture translation for the craft chapter: tokenize where
  tokenizable; numeric rule where measurable but not tokenizable (two weights max
  per surface, tabular-nums on numeric columns, optical-alignment offsets as
  numbers, neutrals always derived from the palette's neutral role); before/after
  paired renders where only demonstrable (assembled vs resolved, one line naming
  the difference); audit rule where mechanical. Acceptance test for the chapter: an
  agent that has never seen a cairn screen, given a plain daisy component and the
  chapter, moves it measurably toward the cairn feel without human art direction.
  The invisible-polish catalogue (ASC's 2026-07-15 brief) graduates into the cairn
  standard as this chapter's source material.

**Remaining for the cairn sitting**: design section 3 (the audit rule inventory and
rendered-mode mechanics, the Assets proof-loop measurement design, initiative
sequencing and versioning), then the spec to cairn-cms
`docs/superpowers/specs/`, spec self-review, Geoff's review, writing-plans.

UPDATED RESUME PROMPT (launch directory ~/Projects/cairn-cms): "Resume the cairn
design-infrastructure brainstorm mid-flight: read
~/Projects/aksailingclub-org/docs/2026-07-22-cairn-design-infrastructure-brainstorm-seed.md
INCLUDING its 'Brainstorm state (2026-07-24)' section — audience, sequencing, scope,
composition, and the craft-capture chapter are settled there; do not re-ask them.
Continue superpowers:brainstorming with Geoff at design section 3 of 3 (cairn-audit
mechanics, the Assets proof loop, sequencing), then write the spec to
docs/superpowers/specs/."
