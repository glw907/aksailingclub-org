# Events page redesign: the design contract

Brainstormed with Geoff on 2026-08-22 and ratified in that sitting. This is the
`events-redesign` initiative in `ROADMAP.md`. It replaces the season-spine listing at `/events`
and the per-event detail pages with one long, anchorable season page. The locked site recipes
apply unchanged: A1 quieted bands, B1 editorial pacing, the C7 gold-star taxonomy
(`docs/2026-07-06-asc-phase-1-design.md`), the image standard (`docs/image-standard.md`), and
the resolved-craft bar (`docs/2026-07-15-asc-invisible-polish-brief.md`).

## Decisions taken in the brainstorm

Events stay D1 domain records in `asc-club`, read by a site-owned page. The brainstorm
considered cairn's standing no-events-concept ruling (cairn-cms
`docs/superpowers/specs/2026-08-05-engine-harvest-decisions.md`, ruling 4) and leaves it
closed on purpose: nothing about this page is content-shaped, and the engine gets no ask.

One page carries the whole season. NN/g's scrolling research supports a long page when every
section serves one task, and the club's calendar is one task: about twelve events and five
classes a year, each one row, recurring annually (the Governor's Cup, the holiday party). A
visible index of in-page links at the top is the research's condition for a page this long.

The page runs chronologically through the season for events and classes, then ends with a
photo-less section for board, committee, and governance meetings.

A past event stays in place, quieted: it keeps its photo and description, its date reads as
past, and its register link drops. The page opens at the next upcoming event. Annual
recurrence is why the record stays readable all year ("what is the Governor's Cup" is a
March question).

The per-event detail route survives only as a thin link-preview carrier, because a URL
fragment never reaches the server and a shared `/events#slug` would otherwise unfurl as the
generic page.

## Page structure

The route is `/events`, server-rendered on each request (it reads `CLUB_DB`). Top to bottom:

1. The light hero, without a promise sentence (probe rounds 2 and 3 found any sentence in
   the italic slot reads as marketing cadence): the "Events" eyebrow over the title "The
   2026 Season", the year derived at request time from the rows on the page (the classes'
   `season` column, else the year of the first dated event), so it updates itself each
   season and keeps naming last season through the winter until new rows land. The image
   standard assigns Events no hero photo; the season's own photographs follow immediately.
2. The calendar-subscribe bar, one quiet line naming all four entries (see "Calendar
   subscription"), following the hero at the same close spacing with no hairline of its own.
3. The month index: one per month that has at least one event, plus "Meetings", ratified as
   the header block's own closing tab row (probe 4/8): body size in the display face, navy,
   attached to a hairline that is also the first season band's own top edge, the month holding
   the next-upcoming band marked current on the gold active-nav underline. Sticky at 1440 only
   if the probe round shows it earns its place; never sticky below 48rem.
4. The season bands, one per event or class, in `start_date` order. Events with no date sort
   after the dated ones, within the month their `date_history` fallback names, as the
   current listing already does.
5. The governance coda.
6. The existing honest empty-state line when the season holds nothing.

On load, when the URL carries no fragment, the page scrolls to the first band whose event
has not ended. The server computes which band that is; the client performs the scroll
without animation so the first paint and the landing position agree.

## An event band

Each event or class is a `<section id={slug}>` on the sage band ground. Inside it a
two-column grid holds the photo and the text column, and the photo's side alternates band by
band down the page, the composition the home page's Fleet and Facilities bands already use.

The photo is the row's `hero_image` (a class's own image from migration 0003), taking five of
twelve columns at 1440 (about 480 by 320 px). The band declares a 3:2 crop (`data-crop="3/2"` on
the `<img>`, this repo's own declared-crop convention), so a source that is not already 3:2 is
center-cropped to it rather than letterboxed: the band's rhythm down the page depends on every
photo holding the same shape. The text column carries, in order:

- the month as the chapter heading at the band's top edge, only on the first band of a month,
  ratified at the h2 step with a short gold rule beneath it (probe 8: it is the season's own
  outline, not a small label the first row alone carries);
- the title at the h3 step, plain text rather than a link (the `<section id>` around it is the
  share anchor, and a heading that links to its own anchor is a dead end for anyone who follows
  it), preceded by the gold star when the row is a class or clinic (C7); races, work parties, and
  socials carry no mark;
- a facts line: weekday and date (or the date range), the time when `start_time` is set, the
  location when set, and the fee for a class;
- the long description (`long_description`, or a class's `description`), four to six lines at
  the site's measure for the live rows, which balances the photo's height without padding;
- one navy link. A class with open registration gets "Register"; a waitlisted class gets
  "Join the waitlist"; every other row gets "Add to calendar", the per-event `.ics`.

The one fireweed control the page may carry is the register button on the first upcoming
class with open registration. Every other link is navy. A past event keeps its photo and
description, drops the register link, and takes the quieted date treatment.

Below 48rem the grid collapses: the photo stacks above the text at full width, still 3:2 and
uncropped.

A row with no `hero_image` renders the text column at the full band width, with no empty
photo slot. The two live rows without one are the pre-spring work party and the Annual
Meeting, and the meeting belongs to the coda anyway.

## The governance coda

One heading, "Meetings and governance", then a plain table: date, meeting, place. No photos
and no bands; the quiet hairline register the portal's committees section already uses. Every
row with `category = 'governance'` lands here, regardless of date, so the Annual Meeting
leaves the chronology. Its anchor works the same way as a band's.

Each row also carries the meeting's own short description under its name, and below 48rem the
place restacks as a second muted line there rather than dropping out with the column.

## Calendar subscription

The subscribe bar offers four entries, ratified (probe 7) as one quiet line: a muted "Add to
your calendar:" lead phrase, then the four entries as plain navy inline links or a button, no
icons, separated by a middot:

| Entry | Link |
|---|---|
| Apple Calendar and any iCal client | `webcal://<host>/events/calendar.ics` (already shipped) |
| Google Calendar | `https://calendar.google.com/calendar/r?cid=<feed URL>` (already shipped) |
| Outlook | `https://outlook.live.com/calendar/0/addfromweb?url=<feed URL>&name=<site name>` |
| Any other app | the plain `https://<host>/events/calendar.ics` URL with a copy button |

The Outlook link prompts Outlook.com and the Outlook desktop apps; a Microsoft 365 account
takes the `outlook.office.com` form of the same path. The copy button covers Thunderbird,
Fastmail, Proton, and the phone apps that ask for a feed address; the plain URL itself only
appears on the page when that copy fails (an insecure context, a denied permission), as the
fallback a reader can still select by hand, rather than sitting visible on every load. The
per-band "Add to calendar" link stays a one-event `.ics` download; a one-off event needs no
subscription.

## The detail route

`/events/[id]` stops being a page. It becomes a thin route that serves a minimal HTML
document carrying the event's Open Graph title, photo, and description, a `canonical` link to
`/events`, a `noindex` robots tag, and a zero-delay meta refresh to `/events#<slug>` with a
visible link as the fallback. A link unfurler reads the tags; a browser arrives at the band.
The `[id].ics` and `calendar.ics` endpoints are unchanged.

## Data

`src/theme/events-data.ts` widens its `CLUB_DB` query to carry `short_description`,
`long_description`, `start_time`, `end_time`, `location`, `hero_image`, `hero_image_alt`,
and a class's `fee` and `description`, and it splits governance rows from the chronology.
No schema change: every field exists in `migrations/asc-club/0001_substrate` and 0003. The
`EVENTS_DB` rule in `CLAUDE.md` is untouched; this page reads `asc-club`, this site's own
database.

## Process

The probe-iteration process governs the visual work. One HTML probe renders the band at 1440
and 390, in both themes, with three live rows (a regatta, a class, a work party) pulled from
`asc-club` rather than fixtures, for Geoff's verdict; the subscribe bar and the coda ride the
same probe. The build then runs on its own branch through the repo's gates, regenerates the
visual baselines through `ci.yml`'s `update_snapshots` dispatch, and ends with Geoff's
before/after on dev under the one-check rule. The pass closes with the fresh-context
coherence read at 390 and 1440 and files any engine-level mechanic it surfaces in its
harvest-findings doc.

## Out of scope

Race registration with member and non-member pricing (the polish backlog's item; the bands
are its eventual home, and nothing here forecloses it). Weekly series such as Wet Wednesday
racing: the 2026 calendar has none, and the page shows what the table holds. The admin Events
screen, which is its own `admin-screen-passes` pass.
