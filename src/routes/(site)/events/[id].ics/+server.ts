// The events-redesign pass: the per-event page's own add-to-calendar endpoint, one VEVENT rather
// than the whole season (`(site)/events/calendar.ics`, which every row feeds). Shadows the
// (site)/[...path] catch-all the same way every other events route does; never prerendered, since
// CLUB_DB is read at request time.
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ORIGIN } from '$chassis/content';
import { readEventRow } from '$theme/events-data';
import { buildSingleEventIcs } from '$theme/ics';

export const prerender = false;

export const GET: RequestHandler = async ({ params, platform, setHeaders }) => {
  const db = platform?.env.CLUB_DB;
  if (!db) error(503, 'Events are not available right now.');

  // A failed read is a 503 with a `Retry-After`, never the 404 an absent row gets: a calendar
  // client that gets a 404 can reasonably drop the subscription, which a transient D1 failure
  // should never cause (the same distinction `[id]/+page.server.ts` draws).
  const read = await readEventRow(db, params.id);
  if (read.status === 'failed') {
    setHeaders({ 'retry-after': '60' });
    error(503, 'Events are not available right now.');
  }
  if (read.status === 'absent') error(404, 'No such event.');

  const body = buildSingleEventIcs(read.row, ORIGIN);
  if (!body) error(404, 'This event has no date to add to a calendar yet.');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // The id comes from the URL, so it is encoded before it lands inside a quoted header
      // parameter, where a stray quote or newline would otherwise split the header.
      'Content-Disposition': `attachment; filename="${encodeURIComponent(params.id)}.ics"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
