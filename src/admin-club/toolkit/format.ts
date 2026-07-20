// The admin toolkit's formatter primitives (docs/2026-07-20-admin-toolkit-research-survey.md,
// "Formatters as citizens", tier C, unopposed): money, civil dates, timestamps, and age all read
// the same raw shapes (integer cents, a SQLite date or datetime string, an ISO birthdate) across
// every admin screen, so one formatter per concept ends the drift the catalog caught firsthand --
// a stats band reading `$30044` with no thousands separator, and a civil date routed through a
// timestamp formatter reading "4:00 PM" for a day that carries no time at all
// (docs/2026-07-20-admin-toolkit-catalog.md). General-purpose per the toolkit's own contract
// (docs/2026-07-20-members-pass-design.md, "Toolkit births"): every formatter here takes its
// locale and time zone as options with a sensible default rather than assuming ASC's own locale
// or the club's Anchorage timezone, so a second cairn-admin-toolkit consumer in another zone or
// locale is a parameter, not a fork.
//
// `src/admin-club/lib/ui.ts` carries this repo's own, already-consumed formatters
// (`formatCivilDate`, `formatDollars`, `formatCents`, `formatClubTimestamp`); this module is the
// toolkit's own general-contract set, born alongside `StatusChip` and `Pagination` for the
// Members pass and not yet wired to any consumer (Task 7 rewires the screen onto the toolkit).

/** Options for {@link formatMoney}. */
export interface FormatMoneyOptions {
  /** ISO 4217 currency code. Defaults to `'USD'`. */
  currency?: string;
  /** A BCP 47 locale tag. Defaults to `'en-US'`. */
  locale?: string;
}

/**
 * Format signed integer cents (a ledger's `amount_total_cents`/`amount_cents` shape) as a
 * currency string with thousands separators, e.g. `formatMoney(30044)` reads `"$300.44"` rather
 * than the raw-cents artifact `"$30044"`. Negative cents (a refund or a credit) render with a
 * leading minus sign, matching the ledger's own signed-integer convention.
 */
export function formatMoney(cents: number, options: FormatMoneyOptions = {}): string {
  const { currency = 'USD', locale = 'en-US' } = options;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** Options for {@link formatCivilDate}. */
export interface FormatCivilDateOptions {
  /** The word to show for a null or missing date. Defaults to `'Not yet'`. */
  fallback?: string;
  /** A BCP 47 locale tag. Defaults to `'en-US'`. */
  locale?: string;
}

/**
 * Format a civil date (a calendar day with no time of day, e.g. "joined on the 2nd") from an ISO
 * `YYYY-MM-DD` string, or the leading date portion of a full SQLite datetime string. Parses at
 * local midnight so the calendar day never shifts a day west of Greenwich the way a bare
 * `new Date(iso)` UTC parse would, and never routes a civil date through a time-of-day formatter
 * (the "4:00 PM" artifact a timestamp formatter produces for a value that carries no time).
 */
export function formatCivilDate(iso: string | null | undefined, options: FormatCivilDateOptions = {}): string {
  const { fallback = 'Not yet', locale = 'en-US' } = options;
  if (!iso) return fallback;
  const civil = iso.slice(0, 10);
  const parsed = new Date(`${civil}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed);
}

/** Options for {@link formatTimestamp}. */
export interface FormatTimestampOptions {
  /** An IANA time zone name. Defaults to `'America/Anchorage'`, the club's own zone and this
   *  formatter's first client, not its ceiling. */
  timeZone?: string;
  /** A BCP 47 locale tag. Defaults to `'en-US'`. */
  locale?: string;
}

/**
 * Format a SQLite `datetime('now')`-shaped UTC string (`"YYYY-MM-DD HH:MM:SS"`, no offset) as a
 * local date and time in `timeZone`. Swapping the space for `T` and appending `Z` keeps `Date`
 * reading the input as UTC rather than the runtime's own zone (a Cloudflare Worker's runtime zone
 * is UTC, not the club's), the same reasoning {@link formatCivilDate} applies to a bare calendar
 * day.
 */
export function formatTimestamp(sqliteDatetime: string, options: FormatTimestampOptions = {}): string {
  const { timeZone = 'America/Anchorage', locale = 'en-US' } = options;
  const parsed = new Date(`${sqliteDatetime.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return sqliteDatetime;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(parsed);
}

/**
 * Derive a whole-years age from an ISO birthdate (`members.birthdate`'s own shape), as of `asOf`
 * (defaults to now; pass a fixed date for deterministic tests). Turns over on the birthday itself
 * rather than the day after, and reads `null` for a missing or unparseable birthdate so a caller
 * can render its own "age unknown" copy instead of a formatter guessing at it.
 */
export function ageFromBirthdate(birthdateIso: string | null | undefined, asOf: Date = new Date()): number | null {
  if (!birthdateIso) return null;
  const civil = birthdateIso.slice(0, 10);
  const birth = new Date(`${civil}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() || (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
