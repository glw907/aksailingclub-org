# events-redesign, round 1 arc log

One line per probe and verdict; distilled into `decisions.md` at settle, then removed.
Contract: `docs/2026-08-22-events-redesign-design.md`. Probe pages live machine-local at
`~/.local/asc-data/probes/events-redesign/` (`events-probe-1.html`, and `-june` with the clock
at June 1 so the Register and fireweed states show); `build.py` rebuilds them from live rows.

- 2026-08-22 probe 1: the full page (hero, four-entry subscribe bar, month index, sixteen
  alternating bands from live rows, governance coda), 1440 and 390, light theme. Own read:
  flipped bands first gave the photo the wide track (fixed: 7fr 5fr on `.is-flip`).
  Awaiting Geoff's verdict per region.
- Data finding, not design: `classes.fleet_tuneup` has `drop_in = 0` while its description
  says "No registration required", so it renders a Register button. Geoff to rule which is
  right; the build honors `drop_in`.
- 2026-08-22 Geoff's verdict on probe 1: keep everything ("a remarkably good first pass");
  the one change is the title line, which read as marketing. Process lesson recorded in agent
  memory (`feedback_probe_from_real_shell`).
- 2026-08-22 probe 2: the title line is plain fact ("The 2026 season, May through November.",
  the year and range derived from the rows at build time); alternative offered: bare "Events"
  with no second line. Nothing else changed. Awaiting the title verdict; if kept, the arc
  settles.
