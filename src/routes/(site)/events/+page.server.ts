// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): this dedicated route
// shadows the general (site)/[...path] catch-all for this one literal path (SvelteKit always
// prefers a literal segment route over a rest-parameter one). The "events" content entry still
// backs this route's `seo` (title, description, canonical), but its body copy is no longer
// rendered: the season page's whole structure is the hero, the subscribe bar, the month index,
// the bands, and the governance coda ($theme/events-data.ts), never the entry's own markdown.
import type { PageServerLoad } from './$types';
import { routes } from '$chassis/public-routes';
import { ORIGIN } from '$chassis/content';
import { publicMediaResolver, renderMarkdown, siteConfig } from '$theme/cairn.config';
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
  const webcalUrl = icsUrl.replace(/^https?:/, 'webcal:');
  return {
    ...entry,
    events,
    icsUrl,
    webcalUrl,
    googleCalendarUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`,
    outlookCalendarUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcalUrl)}&name=${encodeURIComponent(siteConfig.siteName)}`,
  };
};
