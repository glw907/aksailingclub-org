# Pass B (asc-sidebar-build) — cairn DX harvest findings

> Running log of cairn contract/DX deficiencies surfaced while building the ASC sidebar
> (the standing DX-harvest mandate). Filed here as they land; folded into the cairn
> harvest at pass close.

## 1. The Help fallback-foot idiom is undocumented (docs)

The engine deliberately leaves `help` out of its zero-config arrangement so it resolves
into the fallback foot, and `help` is engine-open to every editor capability (the access
map cannot name it). Together those make the foot the designed home for Help under any
declared `navLayout`: filing Help inside a section gives a single-group role (a
Publisher-shaped session) a lonely extra group holding only Help, and there is no way to
gate or duplicate it (a screen referenced twice throws). ASC nearly shipped Help inside
its Website group because no consumer-facing doc names the idiom. The navLayout guide
should state it plainly: leave `help` (and any screen that must stay universal)
unreferenced; the foot is its home. Geoff's ruling 2026-07-19: "foot is perfect, and
that might be something to bring back to the chassis."

## 2. Role-dependent collapsed defaults ride navFilter, not the collapsed seam (docs, maybe API)

`NavLayoutSection.collapsed` is a static declaration, but ASC's ratified defaults are
per-role (Administrator/Club manager: Club + Communication open; Publisher:
Communication; Webmaster: Communication + Website). The shipped escape hatch is
`navFilter` (per-request, same-shape return, `collapsed` carried on resolved sections),
which works but stretches the seam's "filter" framing — the doc comment describes
hiding items, not rewriting presentation state. Worth either a doc note blessing the
rewrite (the shell honors whatever `collapsed` the filtered items carry) or a dedicated
per-request hook. ASC pass B is the living consumer example.
