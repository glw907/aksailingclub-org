# Events redesign build pass

> For agentic workers: each task runs as the implementer → `diff-reviewer` → gate chain
> (`site-implementer`, `sonnet`; `diff-reviewer`, `claude-opus-5`). Five tasks, so the chain
> dispatches per task with the Agent tool, not the workflow. Steps use checkbox syntax.

**Goal:** Replace the `/events` season-spine listing and the per-event detail pages with one
long, anchorable season page of alternating photo bands, a governance coda, and a four-entry
calendar-subscribe bar, exactly as probe 3 rendered it.

**Spec:** `docs/2026-08-22-events-redesign-design.md` (the ratified contract; executors read
it with this plan). **Reference render:** `~/.local/asc-data/probes/events-redesign/
events-probe-3.html` and `-june.html` (the Register and fireweed states), with `probe.css`
beside them carrying the ratified values; `build.py` shows how every field maps to markup.
The build must match probe 3 visually at 1440 and 390; the probe's CSS is the starting point
for the component styles, translated to the theme's tokens (it already uses them).

**Architecture:** `src/theme/events-data.ts` keeps owning the `CLUB_DB` read and grows the
per-row fields the bands need plus the page-level facts (season year, next-upcoming id,
governance split). `src/routes/(site)/events/+page.svelte` composes four new theme components
(`EventsSubscribeBar`, `EventsIndex`, `EventBand`, `EventsGovernance`). `/events/[id]`
shrinks to a link-preview stub that forwards to the anchor. The ICS endpoints are untouched.

**Branch:** `events-redesign-build` (the stale `events-redesign` branch and its worktree at
`~/Projects/asc-worktrees/events-redesign` are fully merged; leave them alone).

**Token ceiling:** 1.5M. **Checkpoint interval:** after tasks 2 and 4 (write STATUS).

## Global constraints

- Engine `@glw907/cairn-cms ^0.96.0`; Node 24; no new dependencies.
- Colors by role (CLAUDE.md): navy is the only link color; gold marks only (the class star,
  the index hover underline); fireweed at most once on this page (the Register button on
  the first upcoming class that takes registration); sage band neutrals.
- Every value in component CSS maps to a theme token (`theme.css`, `tokens.css`); no
  hardcoded colors, sizes, or fonts. Scoped `<style>` per component, unlayered, as the home
  page does.
- `EVENTS_DB` is never touched; this page reads `CLUB_DB` (`asc-club`). No schema change.
- Comments follow `svelte-conventions` / `ts-conventions` (TSDoc, `@component` blocks, no em
  dashes in code comments).
- The gate for every task: `npm run check` (0 errors, 0 warnings), `npm test`, `npm run
  build`. Visual baselines regenerate only through `ci.yml`'s `update_snapshots` dispatch
  (task 5), never locally.
- Copy: the page title is the "Events" eyebrow over "The {year} Season"; no promise
  sentence. Every other string comes from the rows or from the probe's markup verbatim.

---

### Task 1: The data layer

**Files:** modify `src/theme/events-data.ts`; modify `src/tests/events-data.test.ts`.

**Outcome.** `buildEventsPage` returns what the new page renders and nothing the old spine
needed.

**Acceptance criteria.**
- `EventCard` carries, in addition to today's fields: `longHtml` (the rendered
  `long_description`, or a class's `description`; rendered through the same markdown path
  `toEventCard` already uses), `time` (a formatted `start_time`, `"1 p.m."`, `"10:30 a.m."`,
  or `undefined`), `location`, `fee` (`number | undefined`, classes only), `track`
  (`'adult-teen' | 'youth' | undefined`), `dropIn` (boolean, from `classes.drop_in`; the
  column exists in the live `asc-club` database, confirm with `PRAGMA table_info(classes)`
  against `--remote` and add it to `CLASSES_QUERY`), `isPast` (true when the end date, else
  the start date, is before today, computed with a `today` parameter so tests are
  deterministic), and `dateLabel` in the probe's vocabulary: `"Saturday, May 23"` for one
  day, `"September 5–7"` for a range in one month, `"September 28 – October 2"` across
  months, `"Date to be announced"` when undated.
- `EventsPageData` becomes `{ seasonYear, nextUpcomingId, months, governance }`: `months`
  is an ordered list of `{ name, id, events }` for every month that has at least one
  non-governance row (undated rows sort last, under the month their `date_history` fallback
  names, as today); `governance` is every `category = 'governance'` row regardless of date,
  in date order; `nextUpcomingId` is the route id of the first non-governance row that is
  not past (`undefined` when all are past); `seasonYear` is `settings.current_season` when
  set, else the year of the first dated row.
- `monthSections` / `offSeason` / `meetings` / `tocLinks` / `truncateSummary` and the
  registration-badge fields the spine used are removed, along with their tests, unless
  `ClassSchedule.svelte` or `ArticleView`'s markdown registry still consumes them (check
  before deleting; `SpineRow.svelte` stays if `ClassSchedule.svelte` uses it).
- `registrationState` for a class is `'open' | 'waitlisted' | 'closed'`, mapped from the
  existing SQL CASE: its `open` stays `open`; its `full` (enrolled at capacity, the waitlist
  still takes names) becomes `waitlisted`; its `closed` (a live offer or a non-empty
  waitlist) stays `closed`. `registrationUrl` stays `/classes/{id}/signup`.
- Tests cover: each `dateLabel` shape; `isPast` against a fixed `today` on both sides of a
  range; a governance row leaving the chronology; `nextUpcomingId` with all-past rows;
  `seasonYear` from settings and from rows; `dropIn` true and false.

**Interfaces produced.** `buildEventsPage(rows, { today, currentSeason, resolveMedia,
renderMarkdown }) => Promise<EventsPageData>` with the shape above; `EventCard` as above.

- [ ] Write the failing tests for the new shape.
- [ ] Implement; run `npx vitest run src/tests/events-data.test.ts`.
- [ ] Gate; commit `feat(events): carry the band fields and page facts from events-data`.

### Task 2: The season page

**Files:** create `src/theme/components/EventsSubscribeBar.svelte`,
`src/theme/components/EventsIndex.svelte`, `src/theme/components/EventBand.svelte`,
`src/theme/components/EventsGovernance.svelte`; modify `src/routes/(site)/events/+page.svelte`
and `+page.server.ts`; modify `src/content/pages/events.md` (drop the `promise` line);
delete `src/theme/components/EventsListing.svelte` (and `SpineRow.svelte` only if task 1
found no other consumer); add `src/tests/events-page.test.ts` (a server-render test of
`+page.svelte` with a fixture `EventsPageData`, the pattern `src/tests` already uses for
component renders).

**Outcome.** `/events` renders probe 3: hero, subscribe bar, month index, bands, coda.

**Acceptance criteria.**
- Hero: the existing `events-hero` markup with the eyebrow "Events" and the title
  `The {seasonYear} Season`; the `promise` frontmatter path is gone from this route.
- `EventsSubscribeBar` renders four entries in the probe's order and register: Apple
  Calendar (`webcal://` link), Google Calendar
  (`https://calendar.google.com/calendar/r?cid={feed URL}`, replacing today's
  `google.com/calendar/render`), Outlook
  (`https://outlook.live.com/calendar/0/addfromweb?url={feed URL}&name={site name}`, URL-
  encoded), and a "Copy feed address" `<button>` that writes the `https://…/calendar.ics`
  URL to the clipboard and swaps its label to "Copied" for two seconds (a `$state` flag; no
  library). The two new icons join `src/theme/markdown/icons.ts` (`envelope-simple`,
  `copy`, Phosphor-regular paths like the rest) and all four entries draw from that set
  instead of hand-inlined SVG.
- `EventsIndex` renders one in-page link per month in `months` plus "Meetings"
  (`#meetings`), the probe's `.ev-index` styling. Not sticky.
- `EventBand` takes one `EventCard` and `flip: boolean` and renders the probe's band: a
  `<section id={routeId}>` with the grid, the 3:2 uncropped photo (alternating side via
  `flip`, the 5/7 column split on both orientations), the month running head when
  `showMonth` is passed, the title at the h2 step with the gold star for a class, the facts
  line (date label, time, location, fee as `Free`/`$100`, the track label `Adults and teens
  13+` / `Ages 8–12`) with the probe's separators, the body HTML, and exactly one action:
  `Register` (navy link, or the fireweed button when `primary` is passed) for a class that
  is not past, takes registration (`!dropIn`), and is `open`; `Join the waitlist` for
  `waitlisted`; nothing for `closed` or past; `Add to calendar` (the per-event `.ics`) for
  everything else that is not past. A past band gets the probe's quieted treatment (photo
  desaturated, ` · Past` on the facts line, no action). A row without a photo renders text
  at full band width with no empty slot.
- Bands alternate sage and white by position, hairlines between, as the probe's
  `nth-child` rules do; the first band of each month carries the running head and the
  month's anchor id.
- `EventsGovernance` renders the `#meetings` heading and the three-column hairline table
  (When, Meeting, Where), the Where column hidden below 48rem, each row anchored by its
  route id. No placeholder board-meeting row (the probe's was a placeholder).
- `+page.svelte` passes `primary` to the first band whose card id equals `nextUpcomingId`
  and whose state is `open` and `!dropIn`, so fireweed appears at most once; and on mount,
  when `location.hash` is empty and `nextUpcomingId` is set, scrolls that section into view
  with `behavior: 'instant'` (a `$effect` guarded by `browser`).
- At 390 every band stacks photo over text, full width; no horizontal scroll at 320.
- The render test asserts: one `<section>` per row with its id; the star only on classes;
  the fireweed class on exactly one element for a fixture with two open classes; no action
  on a past band; the governance row outside the band list; four subscribe entries with the
  exact Google and Outlook hrefs for a fixture feed URL.

**Interfaces consumed.** Task 1's `EventsPageData` and `EventCard`.

- [ ] Write the failing render test.
- [ ] Build the four components and rewire the route; compare against the probe at 1440
      and 390 with a Playwright screenshot of `npm run dev` (own correction only).
- [ ] Gate; commit `feat(events): the season page`.

### Task 3: The link-preview stub

**Files:** modify `src/routes/(site)/events/[id]/+page.server.ts` and `+page.svelte`;
modify `src/tests/events-detail-route.test.ts`.

**Outcome.** `/events/{id}` exists only so a shared link unfurls with the event's own title,
photo, and description, then lands the reader on `/events#{id}`.

**Acceptance criteria.**
- The load still 404s on an unknown id and still builds `seo` through `buildSeoMeta`, now
  with `robots: 'noindex'` and `canonicalUrl` pointing at `/events` (no fragment; a canonical
  cannot carry one). It returns `{ seo, target: '/events#{id}', title }` and nothing else
  (no prev/next, no full card).
- `+page.svelte` renders `CairnHead` with that `seo`, a `<meta http-equiv="refresh"
  content="0; url=/events#{id}">` in `<svelte:head>`, and a one-line body: the title as a
  link to the target, the only visible content (for a browser with refresh disabled).
- `prerender` stays `false`. The response is a normal SvelteKit page (200), so every
  unfurler that follows the old URL reads the tags.
- Tests: the load returns the target and the `noindex` robots meta; the 404 path still
  throws; the page markup contains the refresh tag with the right target.

- [ ] Write the failing tests; implement; gate.
- [ ] Commit `feat(events): shrink the detail route to a link-preview stub`.

### Task 4: The design probe and the e2e spec

**Files:** modify `scripts/design-probe.mjs`; modify `e2e/site-visual.spec.ts`.

**Outcome.** The standing gates know the new page.

**Acceptance criteria.**
- `design-probe.mjs` gains `/events` checks in its existing style: every `.ev-photo img`
  (or the component's equivalent class) measures at a 3:2 ratio within 1px at 1440 and
  390; at most one element carries the fireweed background on the page; every `<section>`
  under the season list has an `id` and an `h2`; the month index's links all resolve to an
  element id on the page; no horizontal overflow at 320.
- `e2e/site-visual.spec.ts`'s `events — light` test asserts the new content markers (the
  "The … Season" title, at least one `.ev-band`, the `#meetings` heading) instead of the
  spine's, keeps the full-page screenshot and the per-width loop, and keeps the two ICS
  tests unchanged. Do not run the visual spec locally to mint PNGs; the stale baselines
  fail in CI until task 5 regenerates them, which is expected.
- A new e2e test `events detail stub — redirects` fetches `/events/governors-cup` with
  `request.get` and asserts the refresh meta and the `noindex` robots tag in the body.

- [ ] Implement; run `node scripts/design-probe.mjs` against `npm run dev` for `/events`.
- [ ] Gate (`check`, `test`, `build`); commit `test(events): probe and e2e coverage for the
      season page`.

### Task 5: Baselines, docs, and the close

**Files:** visual baselines under `e2e/` (CI-generated); modify `docs/STATUS.md`,
`docs/HISTORY.md`, `docs/design-benchmark/decisions.md`, `ROADMAP.md`,
`docs/design-benchmark/ledger.md`; delete `docs/design-benchmark/
events-redesign-round-1-arc.md`; create `docs/2026-08-22-events-redesign-harvest-findings.md`.

**Outcome.** The pass is closed the way this repo closes passes.

**Acceptance criteria (conductor-executed, not an implementer task).**
- PR opened from `events-redesign-build`; `gh workflow run ci.yml -f update_snapshots=true
  --ref events-redesign-build` regenerates the baselines on the runner; the log (not the
  conclusion) is read, and the committed PNGs are reviewed at 1440 and 390 in the main
  loop against probe 3.
- Pass-end reviewer fan-out: `svelte-reviewer`, `daisyui-a11y-reviewer` (the table, the
  copy button's live label, focus on the index links), `cloudflare-workers-reviewer` (the
  widened query); a fresh-context coherence read at 390 and 1440 asking the assembly-tells
  question.
- `decisions.md` gains the settled events decisions with reasoning (one long page, chrono
  plus coda, quieted past, the title, the four subscribe entries, the stub route), distilled
  from the arc log, which is then deleted. `ledger.md` gains the page's verdict.
- `ROADMAP.md`'s `events-redesign` entry is marked DONE with the date; `HISTORY.md` gets
  the pass entry (what landed, what the gate caught, what not to rediscover); `STATUS.md`
  points at Geoff's before/after on dev as the next action and stays under 60 lines.
- The harvest doc lists any engine-level mechanic the build surfaced (candidates already
  visible: a copy-to-clipboard control with a timed label swap; a `scroll-to-anchor on
  load` behavior; an alternating two-column photo band as a composition primitive).
- Merge is Geoff's, after the before/after on dev.

- [ ] Dispatch the baseline regeneration and read the log.
- [ ] Run the reviewer fan-out and the coherence read; fix what survives.
- [ ] Write the docs; commit `docs: close the events-redesign pass`.
