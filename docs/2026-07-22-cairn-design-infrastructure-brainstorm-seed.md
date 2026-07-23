# Cairn design-infrastructure initiative — brainstorm seed (2026-07-22)

Seed for the brainstorm sitting that opens AFTER the Members refinement release lands
and this session closes. The initiative is cairn-side; the sitting launches from
`~/Projects/cairn-cms`. This doc carries the thesis, the evidence, and the proposed
structure so the fresh session starts grounded, not cold.

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
