// The row form's shared validation (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`; hardened in the reviewer fan-out fix round): the ledger's `save`
// and `create` actions post the same field set, so this one parser is the single place their
// acceptance rules agree. Rewritten from the pre-ledger `events/new` and `events/[id]` shared
// parser: the posted-slug requirement is gone (the slug is derived, see `+page.server.ts`'s
// `create` action), and `recurrence` and `linkSeriesId` join the parsed shape, since the row form
// now carries both.
import { EVENT_CATEGORIES, EVENT_RECURRENCES, type EventCategory, type EventRecurrence, type EventWrite } from '$admin-club/lib/events-store';

/** `media:<slug>.<hash>` with a 16-hex hash, `HeroImageField`'s own hidden-input contract. */
const HERO_TOKEN_PATTERN = /^media:[a-z0-9-]+\.[0-9a-f]{16}$/;

/** `YYYY-MM-DD`, the shared shape every date field here validates against, and the same pattern
 *  `+page.server.ts`'s own `setDate` action (the inline date-cell save) imports from here, so the
 *  row form's dates and the date-cell's own inline save accept exactly the same shape. */
export const DATE_FIELD = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:MM`, a `type="time"` input's own posted shape. */
const TIME_FIELD = /^\d{2}:\d{2}$/;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A blank field parses to `{ value: null }`; a non-blank field is checked against `pattern`,
 *  returning `{ value }` on a match or `{ error: message }` otherwise. Shared by every
 *  YYYY-MM-DD/HH:MM field below so the "empty means clear, non-empty means valid shape" rule is
 *  expressed once. */
function parseOptionalPattern(
  entry: FormDataEntryValue | null,
  pattern: RegExp,
  message: string,
): { value: string | null } | { error: string } {
  const value = emptyToNull(entry);
  if (value === null) return { value: null };
  return pattern.test(value) ? { value } : { error: message };
}

/**
 * Parse and validate a posted row-form submission. A title and a valid `recurrence` and
 * `category` are required; `startDate`/`endDate` must be `YYYY-MM-DD` and `startTime`/`endTime`
 * must be `HH:MM` when posted at all (blank clears the field); an end date before the start date
 * is rejected; `heroImage` accepts either an empty value (-> `null`) or a `media:slug.hash` token
 * that both matches the shape AND names an entry in `allowedHeroTokens` (the load's own
 * `HERO_LIBRARY`, passed in by the caller rather than read here, so this module stays free of the
 * media manifest); every other blank posts as `null`. `linkSeriesId` is optional and passes
 * through unchanged (the caller decides whether it names a real, different series).
 *
 * `write` carries every `EventWrite` column except `slug`: the slug is never posted (it stays
 * derived from the title, per the design's "no slug field" ruling), so the caller supplies it --
 * `create` derives a fresh one, `save` carries the existing row's own slug through unchanged.
 * `recurrence` and `linkSeriesId` are not `EventWrite` columns (they write to `event_series`,
 * through `setSeriesTitleAndRecurrence` and `linkEventToSeries`), so they ride alongside it
 * rather than inside it.
 */
export function parseEventForm(
  form: FormData,
  allowedHeroTokens: ReadonlySet<string>,
): { write: Omit<EventWrite, 'slug'>; recurrence: EventRecurrence; linkSeriesId: string | null } | { error: string } {
  const title = form.get('title');
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'A title is required.' };
  }
  const recurrenceEntry = form.get('recurrence');
  if (typeof recurrenceEntry !== 'string' || !EVENT_RECURRENCES.includes(recurrenceEntry as EventRecurrence)) {
    return { error: 'A valid recurrence is required.' };
  }
  const category = form.get('category');
  if (typeof category !== 'string' || !EVENT_CATEGORIES.includes(category as EventCategory)) {
    return { error: 'A valid category is required.' };
  }

  const heroImage = emptyToNull(form.get('heroImage'));
  if (heroImage !== null) {
    if (!HERO_TOKEN_PATTERN.test(heroImage)) return { error: 'That hero image reference is not valid.' };
    if (!allowedHeroTokens.has(heroImage)) return { error: 'That hero image is not in the library.' };
  }

  const startDate = parseOptionalPattern(form.get('startDate'), DATE_FIELD, 'Enter a date as YYYY-MM-DD.');
  if ('error' in startDate) return startDate;
  const endDate = parseOptionalPattern(form.get('endDate'), DATE_FIELD, 'Enter a date as YYYY-MM-DD.');
  if ('error' in endDate) return endDate;
  if (startDate.value !== null && endDate.value !== null && endDate.value < startDate.value) {
    return { error: 'The end date is before the start date.' };
  }

  const startTime = parseOptionalPattern(form.get('startTime'), TIME_FIELD, 'Enter a time as HH:MM.');
  if ('error' in startTime) return startTime;
  const endTime = parseOptionalPattern(form.get('endTime'), TIME_FIELD, 'Enter a time as HH:MM.');
  if ('error' in endTime) return endTime;

  return {
    write: {
      title: title.trim(),
      category: category as EventCategory,
      shortDescription: emptyToNull(form.get('shortDescription')),
      longDescription: emptyToNull(form.get('longDescription')),
      startDate: startDate.value,
      startTime: startTime.value,
      endDate: endDate.value,
      endTime: endTime.value,
      location: emptyToNull(form.get('location')),
      heroImage,
      heroImageAlt: emptyToNull(form.get('heroImageAlt')),
    },
    recurrence: recurrenceEntry as EventRecurrence,
    linkSeriesId: emptyToNull(form.get('linkSeriesId')),
  };
}
