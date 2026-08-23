// The row form's shared validation (events-admin pass, Task 5, `docs/plans/
// 2026-08-22-events-admin.md`): the ledger's `save` and `create` actions post the same field
// set, so this one parser is the single place their acceptance rules agree. Rewritten from the
// pre-ledger `events/new` and `events/[id]` shared parser: the posted-slug requirement is gone
// (the slug is derived, see `+page.server.ts`'s `create` action), and `recurrence` and
// `linkSeriesId` join the parsed shape, since the row form now carries both.
import { EVENT_CATEGORIES, EVENT_RECURRENCES, type EventCategory, type EventRecurrence, type EventWrite } from '$admin-club/lib/events-store';

/** `media:<slug>.<hash>` with a 16-hex hash, `HeroImageField`'s own hidden-input contract. */
const HERO_TOKEN_PATTERN = /^media:[a-z0-9-]+\.[0-9a-f]{16}$/;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Parse and validate a posted row-form submission. A title and a valid `recurrence` and
 * `category` are required; `heroImage` accepts either an empty value (-> `null`) or a
 * `media:slug.hash` token; an end date before the start date is rejected; every other blank
 * posts as `null`. `linkSeriesId` is optional and passes through unchanged (the caller decides
 * whether it names a real, different series).
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
  if (heroImage !== null && !HERO_TOKEN_PATTERN.test(heroImage)) {
    return { error: 'That hero image reference is not valid.' };
  }
  const startDate = emptyToNull(form.get('startDate'));
  const endDate = emptyToNull(form.get('endDate'));
  if (startDate !== null && endDate !== null && endDate < startDate) {
    return { error: 'The end date is before the start date.' };
  }

  return {
    write: {
      title: title.trim(),
      category: category as EventCategory,
      shortDescription: emptyToNull(form.get('shortDescription')),
      longDescription: emptyToNull(form.get('longDescription')),
      startDate,
      startTime: emptyToNull(form.get('startTime')),
      endDate,
      endTime: emptyToNull(form.get('endTime')),
      location: emptyToNull(form.get('location')),
      heroImage,
      heroImageAlt: emptyToNull(form.get('heroImageAlt')),
    },
    recurrence: recurrenceEntry as EventRecurrence,
    linkSeriesId: emptyToNull(form.get('linkSeriesId')),
  };
}
