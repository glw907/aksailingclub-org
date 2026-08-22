// The events-redesign pass (docs/2026-08-22-events-redesign-design.md): this dedicated route
// shadows the general (site)/[...path] catch-all for this one literal path (SvelteKit always
// prefers a literal segment route over a rest-parameter one). The "events" content entry backs
// this route's `seo` (title, description, canonical) and nothing else: the entry's own body is
// deliberately empty, and this load returns only `seo` from it, since the season page's whole
// structure is the hero, the subscribe bar, the month index, the bands, and the governance coda
// ($theme/events-data.ts).
import type { PageServerLoad } from './$types';
import { buildFragmentResolver, buildLinkResolver } from '@glw907/cairn-cms/delivery';
import { routes } from '$chassis/public-routes';
import { ORIGIN, site } from '$chassis/content';
import { publicMediaResolver, renderMarkdown, siteConfig } from '$theme/cairn.config';
import { buildEventsPage, readEventRows } from '$theme/events-data';

// The full calendar reads D1 at request time, so this page cannot be prerendered the static way
// every other content page is; left dynamic (the project default), same as /admin.
export const prerender = false;

// The same three resolvers the site's own render adapter passes ($theme/cairn.config.ts's
// `rendering.render`), so a `media:`, `cairn:`, or `::include` reference inside an event's
// description resolves exactly as it would in ordinary content instead of rendering bare. Built
// once at module scope: each is a pure function of the committed index, not of the request.
const RESOLVE_LINK = buildLinkResolver(site);
const RESOLVE_FRAGMENT = buildFragmentResolver(site);

export const load: PageServerLoad = async ({ url, platform, setHeaders }) => {
  const entry = await routes.entryLoad({ url });
  const db = platform?.env.CLUB_DB;
  // One read, not two: `readEventRows` already reads `settings.current_season` to bind its own
  // classes query, and a second bare read here would put a D1 failure outside that function's
  // degrade-to-empty guard, 500ing the page instead of quieting the season.
  const { rows, season } = db ? await readEventRows(db) : { rows: [], season: null };

  const events = await buildEventsPage(rows, {
    // The fixed clock the visual suite's server runs with (e2e/site-visual.spec.ts): every
    // past/upcoming judgment on this page moves with the calendar, so a baseline taken against
    // the real date rots the day after it is minted. Read only from `platform.env`, never from a
    // request header or a query string, so nothing a visitor sends can shift what the page calls
    // past. Unset everywhere but the test server, where `buildEventsPage` falls back to today in
    // the club's own timezone.
    today: platform?.env.ASC_FIXED_TODAY,
    currentSeason: season,
    resolveMedia: publicMediaResolver,
    renderMarkdown: (md) =>
      renderMarkdown(md, {
        resolve: RESOLVE_LINK,
        resolveMedia: publicMediaResolver,
        resolveFragment: RESOLVE_FRAGMENT,
      }),
  });

  // Five minutes: long enough to absorb a burst against the D1 read, short enough that an admin
  // who fixes a wrong date sees it on the public page within one coffee refill.
  setHeaders({ 'cache-control': 'public, max-age=300' });

  // `PUBLIC_ORIGIN` (never a request header, per that binding's own doc comment in
  // src/jobs/registry.ts), falling back to the chassis constant: a calendar feed URL a reader
  // subscribes to outlives the request that produced it, so it can never be built from whatever
  // Host a proxy happened to send.
  const origin = platform?.env.PUBLIC_ORIGIN ?? ORIGIN;
  const icsUrl = `${origin}/events/calendar.ics`;
  const webcalUrl = icsUrl.replace(/^https?:/, 'webcal:');
  return {
    seo: entry.seo,
    events,
    icsUrl,
    webcalUrl,
    googleCalendarUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`,
    // Outlook's add-from-web endpoint fetches the feed itself over HTTP, so it takes the plain
    // https URL; only Apple (a client-side handler) and Google's `cid` read the webcal form.
    outlookCalendarUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(icsUrl)}&name=${encodeURIComponent(siteConfig.siteName)}`,
  };
};
