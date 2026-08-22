// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): this dedicated route
// shadows the general (site)/[...path] catch-all for this one literal path (SvelteKit always
// prefers a literal segment route over a rest-parameter one), so the "events" pages content
// entry keeps its editable editorial intro (rendered through the exact same plumbing the
// catch-all uses, via the shared `routes` in $chassis/public-routes), while the season page
// below it is the events-redesign pass's own long, anchorable listing ($theme/events-data.ts).
//
// Task 1 note: the season bands and their alternating-photo composition (`EventsSubscribeBar`,
// `EventsIndex`, `EventBand`, `EventsGovernance`) are Task 2's own build; this file currently
// only wires the widened data layer through so the route keeps compiling and testing green
// between tasks (the season listing itself is temporarily absent from the rendered page).
import type { PageServerLoad } from './$types';
import { routes } from '$chassis/public-routes';
import { ORIGIN } from '$chassis/content';
import { publicMediaResolver, renderMarkdown } from '$theme/cairn.config';
import { buildEventsPage, readEventRows } from '$theme/events-data';
import { readCurrentSeason } from '$theme/season-data';

// The full calendar reads D1 at request time, so this page cannot be prerendered the static way
// every other content page is; left dynamic (the project default), same as /admin.
export const prerender = false;

export const load: PageServerLoad = async ({ url, platform }) => {
  const entry = await routes.entryLoad({ url });
  const db = platform?.env.CLUB_DB;
  const [rows, currentSeason] = db ? await Promise.all([readEventRows(db), readCurrentSeason(db)]) : [[], null];

  const events = await buildEventsPage(rows, {
    currentSeason,
    resolveMedia: publicMediaResolver,
    renderMarkdown: (md) => renderMarkdown(md),
  });
  const icsUrl = `${ORIGIN}/events/calendar.ics`;
  return {
    ...entry,
    events,
    icsUrl,
    webcalUrl: icsUrl.replace(/^https?:/, 'webcal:'),
    googleCalendarUrl: `https://www.google.com/calendar/render?cid=${encodeURIComponent(icsUrl.replace(/^https?:/, 'webcal:'))}`,
  };
};
