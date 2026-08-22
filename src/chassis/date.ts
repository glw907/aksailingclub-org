// This site's one date vocabulary. Every date-bearing public surface (the home page, an article's
// own meta line, the news archive, a tag page) formats through one of these two helpers, so a
// reader never sees two different date shapes on the same site. `en-US` long-month, not the
// showcase's `en-GB` short-month: this site's four call sites already agreed on "9 July 2026"
// before this module existed; this only centralizes the four private `Intl.DateTimeFormat`
// instances that duplicated it. Every other date site on this build (the member portal, /admin,
// the certificate route, the Season band) carries its own vocabulary and stays untouched.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * Render an ISO `YYYY-MM-DD` date as the site's full label, e.g. "9 July 2026".
 * @param iso An ISO `YYYY-MM-DD` date string.
 */
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/**
 * Render an ISO `YYYY-MM-DD` date as the site's year-less label, e.g. "9 July", for a listing
 * where the year is implied by a surrounding group heading (the news archive's own year sections).
 * @param iso An ISO `YYYY-MM-DD` date string.
 */
export function formatDayMonth(iso: string): string {
  return DAY_MONTH_FORMAT.format(new Date(iso));
}
