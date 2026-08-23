# Events admin: the design contract

Brainstormed with Geoff on 2026-08-22 and ratified in that sitting. This is the Events entry
of the `admin-screen-passes` series in `ROADMAP.md`, and the third screen in that series after
Members and Classes. It replaces the list-plus-detail-page screen at `/admin/club/events`
with a series ledger, adds the season roll-forward, and wires the hero photo the redesigned
public `/events` page needs (`docs/2026-08-22-events-redesign-design.md`). The admin register
is cairn's own (`cairn-admin-screens`), built from the toolkit catalogued in
`docs/2026-07-20-admin-toolkit-catalog.md`.

## Decisions taken in the brainstorm

The screen serves one dominant job: the annual season setup, done in a burst by one or two
officers. About a dozen events recur every year. Their dates cannot be shifted by a year,
because they land on weekends, and three of them track an anchor outside the club's control
(the Ice Breaker and the Governor's Cup follow holidays; BNAC follows the national event).
The officer therefore dates each event by hand, and the screen's job is to make that fast:
show the last two seasons' dates beside each event, and show the whole season at a glance
while the dates go in.

Each event is either annual or once-off, and the officer can switch an event between the
two. "Start the next season" copies only the annual ones. A once-off switched to annual
becomes the first year of a series; an annual switched to once-off stays in its history and
is left out of the next roll.

The roll copies everything except the dates: descriptions, location, category, the hero
photo and its alt text, and the recurrence. A rolled event is undated and invisible. Saving
a date publishes it. There is no separate publish step during setup.

Of the three shapes shown for the dating job (a series ledger, a three-year month strip, and
the current chronological list with a history column), the series ledger won. It is the
Events list itself, year-round, rather than a setup view beside a plain list.

The full edit happens in place: the toolkit's ExpandableRow opens the form beneath the
ledger row, so the prior seasons stay in view while the officer edits. The `[id]` detail
page goes away.

An event leaves the calendar by being hidden for the year; the row stays in the ledger so
history is intact. A series is retired separately, which stops it rolling forward. Hard
delete exists only for an entry that has never been visible.

Classes appear in the ledger as read-only rows with a link to the Classes screen, so the
officer dating the season sees every collision the public page will show. Registration,
fee, and `drop_in` are `classes` columns and stay the Classes screen's job; the open
`fleet_tuneup` drop-in question is a Classes decision and is out of this pass.

## Data model

The change is one `asc-club` migration in the repo's verified-migration shape (forward,
rollback, verify, README), scratch-proven before it touches the live database. `EVENTS_DB`
is untouched, per the read-only rule in `CLAUDE.md`.

A new `event_series` table carries the identity that survives across seasons:

| Column | Meaning |
| --- | --- |
| `id` | Text primary key. |
| `title` | The series name, shown as the ledger row's label. |
| `recurrence` | `annual` or `once`, a CHECK constraint. |
| `retired_at` | Null while the series rolls forward; a timestamp once retired. |
| `created_at`, `updated_at` | As on every `asc-club` table. |

The `events` table gains `series_id` (a foreign key to `event_series`, NOT NULL) and
`season` (INTEGER NOT NULL, the same meaning as `classes.season`). Its `slug` uniqueness
moves from a global UNIQUE to `UNIQUE (season, slug)`, again as `classes` has it, because a
rolled event keeps its slug. `start_date` stays nullable; an undated event is one whose
`start_date` is null.

The migration gives every existing event a series of its own, annual by default, with
`season` derived from `start_date`'s year (the current season from `settings.current_season`
for any row without a date). The officer links years by hand where it matters: the form
offers "This is the 2027 instance of an existing series", which moves the row onto that
series and removes the orphaned one. Nothing in the migration guesses at links by title.

Category, location, the descriptions, and the hero stay on the event row, so one year can
differ from the last without rewriting history. `visible` stays a stored column. The save
path sets it when a date is saved on an undated event and clears it on Hide; the officer
never ticks it directly.

The public `/events` query (`src/theme/events-data.ts`) and the home Season band's query
(`src/theme/season-data.ts`) keep filtering on `visible = 1`. Each gains a `season` filter
in place of its date-range derivation where one exists, and nothing else. An undated event
never reaches a public page because it is invisible.

## The ledger

The route stays `/admin/club/events`. The page reads the current season from
`settings.current_season` and shows, per series, the two prior seasons' dates and the
current season's. Only the current season's cell is editable inline: a date or a date
range, saved on blur or Enter through a form action. Saving a date on an undated event
also publishes it. The two prior cells are read-only text; a series that did not run in a
year shows an empty cell.

Rows order by the prior season's chronology. An undated row keeps the position its series
held last year, so the ledger reads as the season's order while the dates go in. A
once-off event new this season sorts by its own date, or at the end while undated.

Class rows come from the `classes` table for the same three seasons, marked with the class
chip and the gold star the public page uses, with their dates read-only and the row's
action a link to `/admin/club/classes`.

The toolbar carries the season selector, the to-do count ("5 undated"), filters for undated
and for classes, the "New event" action, and "Start the next season". The last shows a
confirmation that counts what it will create (annual, not retired, not already present in
the next season) and what it skips (once-off, retired, already rolled), then runs as one
form action that inserts the undated, invisible copies and advances nothing else: the
officer switches `current_season` when the new season is ready, as the Classes rollover
already expects.

The toolkit supplies AdminTable for the density contract, ListToolbar, the chip vocabulary
(one dressing for category chips, which fixes the catalog's "four different dressings"
finding), the empty-state recipe for a season with no rows, and the "no edited-by column"
ruling from the current screen until the audit sink has a season of history.

## The row form

ExpandableRow opens the full event beneath its ledger row, following the panel-follows-
summary-width contract the Classes pass recorded. The fields are title, recurrence, category,
start and end date, start and end time, location, the short and long descriptions (prose
textareas in the body face, which retires the monospace treatment), and the hero photo with
its alt text through cairn's media-library picker. The thumbnail derives from the hero and
has no field. The series link control ("instance of an existing series") sits with the
recurrence field and appears only for a row whose series has a single year.

Actions follow the toolkit's action-link discipline, in the form's footer rather than a
floating red control. "Hide this year" and "Show" toggle `visible`. "Retire series" sets
`retired_at` and is reversible. "Delete" appears only for an event that has never been
visible, and asks for confirmation. Every action runs through `clubAdminAction` with an
audit call, as today.

The `[id]` route is removed. Its URL redirects to the ledger with that row opened, so a
bookmarked edit link still lands.

## Gates and close

Tests cover the migration (forward, rollback, and verify against the live row count), the
roll-forward action's selection rule and its idempotence (a second run creates nothing),
the visibility rule on save and Hide, the series-link move, and the ledger's ordering.
`npm run check`, `npm test`, and the build run in each task's chain. CI regenerates the
visual baselines through the `ci.yml` dispatch, never a local run.

The pass closes in the series' shape: the domain reviewer fan-out (svelte, a11y, security,
workers), a fresh-context coherence read of the ledger at 390 and 1440 asking the
expert-tells question, Geoff's before/after on dev, and the harvest doc for cairn. The
media-library picker's reuse seam for a site's own `/admin/club` screen is the first
harvest finding, since the current form carries a comment saying it is not wired. The live
`asc-club` migration applies only after the scratch proof, and the public `/events` page is
re-read after it, since both public queries change.

Out of scope: any change to `EVENTS_DB`; the Classes screen, including `fleet_tuneup`; a
roll-forward for classes; and any public-page design change.
