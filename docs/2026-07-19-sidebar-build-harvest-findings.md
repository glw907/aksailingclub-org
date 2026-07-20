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

## 3. A dangling navLayout href passes every gate silently (validation gap)

`resolveNavLayout`/`resolveEntry` validate an entry's href against built-in admin views
(the parseAdminPath collision authority) but never against route existence. Deleting a
route while its nav entry stays declared leaves a sidebar link that 404s live, and
check/test/build all stay green (proven in pass B T2: the Signups route deletion left
the round-1 nav entry dangling and the full gate passed). The engine cannot know a
site's route manifest at config time, but the guide could ship a testing recipe (assert
every site-entry href resolves against the app's route table, SvelteKit's `$app/paths`
or a glob over `src/routes`), or the SvelteKit adapter could cross-check at server
start where the manifest is knowable.

## 4. Resolved nav entries expose no effective icon NAME for engine defaults (testability gap)

A resolved engine-ref entry carries `iconName` only when the site declared an override; an
entry riding an engine default resolves to a Svelte component with no exported name, and
`ENGINE_NAV_ICONS`/`ENGINE_CONCEPT_DATED_ICON` are internal to `dist/components`. ASC's
"25 distinct icons" ratified requirement therefore tests against a hand-mirrored table of
the engine defaults, which a future cairn bump can silently invalidate (the svelte-reviewer
flagged the false-green surface). Either export the name map, or carry the effective icon
name on the resolved entry, and the consumer test becomes real.

## 5. Admin routes are styleable only from cairn's own compiled class inventory (major DX gap)

`cairn-admin.css` is compiled inside the package from cairn's own screens' class usage; a
site's `/admin/**` pages load ONLY that sheet (the site's Tailwind/daisyUI build serves the
`(site)` group). Any daisy or utility class a site's admin markup uses that cairn's screens
never used is silently dead: ASC's Overview needs-attention strip declared daisyUI
`stats stats-vertical lg:stats-horizontal` + `stat-value`/`stat-desc`/`text-warning` and
NONE of those exist in the sheet, so the strip rendered as an unstyled stack (and the
nonzero-count warning tint never rendered) from the membership-admin pass until pass B
caught it in a coherence capture. Site-side workaround: Svelte scoped `<style>` blocks on
package tokens (`--cairn-card-border`, `--cairn-warning-ink`, `--color-muted`), applied to
the strip in pass B. Engine-side fixes worth weighing: publish the class inventory (or a
safelist contract) a site may rely on, document the scoped-style idiom as THE supported
path for site-authored admin screens, or let a site append its own compiled admin sheet.

## 6. Shell nav spacing: a collapsed group loses its boundary breathing room (engine polish)

The pass-B coherence read measured the sidebar's group rhythm: an open group's last item
to the next header runs ~42px, but a collapsed header stacked above the next header sits
at ~33px, systematically, in every role tree and both themes. Collapsed groups pack at
near item pitch and the rhythm inconsistency is visible on the flagship admin view. The
spacing lives in the shell (`space-y-1` scroll area + per-group padding), so a site
cannot correct it; a collapsed section wants the same group-boundary margin an open one
gets. Related minor notes from the same read: the light-theme drawer scrim at 390 is on
the transparent side, and the dark-theme primary button's boundary is subtle on near-black.

## 7. The concept new-entry button says "New <plural label>" (engine copy)

The engine's new-entry button composes "New" + the concept's label verbatim, and concept
labels are plural by convention ("Posts"), yielding "New Posts" where "New Post" is the
natural copy. A singular-form field on the concept declaration (or a smarter compose)
fixes it engine-side; every cairn site with plural concept labels shows the same tell.
