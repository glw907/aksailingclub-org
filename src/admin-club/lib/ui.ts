// Screen-agnostic presentation primitives every /admin/club/* screen shares, so the office-list
// table recipe, the civil-date parse, and the whole-dollar formatting each have one home rather
// than a copy per screen (the same extraction member-format.ts did for the member-specific chip
// vocabularies once a second consumer needed them). Member-domain chips and labels stay in
// member-format.ts, which reads `ChipStyle` from here.

import type { EmailQuotaHeadroom } from './email-limits';

/** A count-line noun in both grammatical numbers: `one` is the singular form, used when the count
 *  is exactly 1; `many` is the plural, used for every other count, zero included ("0 households").
 *  Mirrors `@glw907/cairn-cms/admin-toolkit`'s own `ItemLabel`. */
export interface ItemLabel {
  one: string;
  many: string;
}

/** Pick the grammatical number for a count surface: `one` at exactly 1, `many` otherwise. `label`
 *  also accepts a plain string, which is invariant across every count.
 *
 *  A local copy of `@glw907/cairn-cms/admin-toolkit`'s `itemNoun`, not a re-export (close round
 *  item 28 originally re-exported it here so no server file had to import the toolkit package
 *  directly). That barrel also carries `.svelte` components, and Vite's SSR build leaves a
 *  package import like this one external in the server chunk rather than inlining it; wrangler
 *  dev's own esbuild pass then tries to bundle that external barrel and fails, because esbuild
 *  has no loader configured for `.svelte` files. `npm run build` never surfaces this (Vite
 *  bundles the whole graph itself), so the break only shows up against wrangler's own bundler.
 *  The fix is the same one item 28 already established for the two server files: the toolkit
 *  package never enters the server import graph. This copy keeps the exported name and call-site
 *  shape identical to the toolkit's own function. */
export function itemNoun(count: number, label: string | ItemLabel): string {
  if (typeof label === 'string') return label;
  return count === 1 ? label.one : label.many;
}

/** One chip's display: the label it reads, and the badge classes carrying its color. */
export interface ChipStyle {
  label: string;
  cls: string;
}

/** The uppercase micro-label the screens share for an eyebrow and every table column header:
 *  one design token so a header can't drift a screen at a time.
 *
 *  On `type-label` rather than the `text-[0.6875rem]` literal it carried until 2026-07-29. The
 *  literal resolved to the same 11px but never compiled into the precompiled `cairn-admin.css`
 *  these screens render against, so every header rendered at the inherited size instead. Living
 *  in a `.ts` module, it was also invisible to `cairn-audit`, whose static substrate reads markup
 *  through `svelte/compiler` and so never sees a class string a plain module exports.
 *  `tracking-[0.08em]` stays: unlike the size literal, that one does compile into the shipped
 *  sheet, so it has been doing its work all along. */
export const HEADER_CELL = 'type-label font-semibold uppercase tracking-[0.08em] text-muted';

/** The two-state ops visibility badge the Events and Classes rows both render off a SQLite
 *  `visible` boolean: the shown state gets the filled primary tint, hidden stays a ghost chip.
 *  Distinct from member-format.ts's three-state directory `VISIBILITY_CHIP`, which answers a
 *  different question (how a member appears in the public directory). */
export const OPS_VISIBILITY_CHIP: Record<'visible' | 'hidden', ChipStyle> = {
  visible: { label: 'Visible', cls: 'badge-sm border-transparent bg-primary/10 font-medium text-primary' },
  hidden: { label: 'Hidden', cls: 'cairn-chip-quiet badge-sm font-medium' },
};

const civilDateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** A civil date ("the regatta is on the 24th", "joined on the 2nd") is a calendar day, not an
 *  instant, so it parses at local midnight on purpose: appending T00:00:00 keeps `Date` from
 *  reading a bare YYYY-MM-DD as UTC and shifting it a day west of Greenwich. `fallback` is the
 *  empty-date word the screen wants ("TBD" for an unscheduled ops date, the default "Not yet"
 *  for a date that simply hasn't happened). */
export function formatCivilDate(iso: string | null, fallback = 'Not yet'): string {
  if (!iso) return fallback;
  // Some writers store a full SQLite datetime ("2026-06-14 19:22:57"); the civil-date
  // portion is the display contract either way.
  const civil = iso.slice(0, 10);
  const parsed = new Date(`${civil}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : civilDateFmt.format(parsed);
}

/** Whole US dollars (every dues, fee, and payment amount in this data is a plain integer, no
 *  cents anywhere), so this is string formatting, not currency math. A null amount reads as an
 *  em dash. */
export function formatDollars(amount: number | null): string {
  return amount == null ? '—' : `$${amount}`;
}

/** US dollars and cents off the ledger's own signed integer-cents amounts (`transactions.
 *  amount_total_cents`, `transaction_lines.amount_cents`): the money-ledger domain is the one
 *  place in this app that carries fractional dollars (a `$324` dues row is still whole, but a
 *  processor fee or a partial refund is not), so this stays a separate formatter from the whole-
 *  dollar `formatDollars` above rather than folding cents-awareness into every caller of that one. */
export function formatCents(amountCents: number): string {
  const sign = amountCents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(amountCents) / 100).toFixed(2)}`;
}

// Pinned to the club's own timezone rather than `undefined` (the runtime's local zone): this
// renders on the server, and a Cloudflare Worker's runtime zone is UTC, not Alaska's. `undefined`
// would print a SQLite UTC timestamp as if it were already Anchorage wall-clock, nine or eight
// hours off (depending on daylight saving) for the one audience who actually reads this, the
// club's own admins.
const clubTimestampFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Anchorage',
});

/** Format a SQLite `datetime('now')`-shaped UTC string ("YYYY-MM-DD HH:MM:SS", no offset) as an
 *  Anchorage-local date and time: swapping the space for `T` and appending `Z` keeps `Date`
 *  reading the input as UTC rather than local time, the same reasoning `formatCivilDate`'s own
 *  comment gives for a bare calendar day. The waitlist offer's countdown
 *  (`class_offers.expires_at`) is this module's own consumer. */
export function formatClubTimestamp(sqliteDatetime: string): string {
  const parsed = new Date(`${sqliteDatetime.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? sqliteDatetime : clubTimestampFmt.format(parsed);
}

/** The advisory send-quota line both send surfaces render word for word (Compose's own review
 *  step and the Announce form's Email block), so the wording has one home rather than a copy per
 *  screen. A `null` headroom is a supported, permanent state (the read failed, or the Email
 *  Sending token was never minted), never an error, and never blocks a send. */
export function formatHeadroomLine(headroom: EmailQuotaHeadroom | null): string {
  if (!headroom) return 'Daily send headroom is unknown.';
  return `Daily quota ${headroom.quota}, sent today ${headroom.sentToday}, ${headroom.remaining} remaining.`;
}
