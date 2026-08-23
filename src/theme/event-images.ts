// The events deep-look pass: a fixed filename-to-media-token map for the club's D1-sourced event
// and class photography. `hero_image` used to only ever name a legacy filename ("bnac.jpg"), not
// a cairn `media:` reference, since the photo lived in the club's read-only ops D1
// (`$theme/events-data.ts`); there was no frontmatter field to hang a `fields.image` on, the same
// reasoning `home-images.ts` documents for the home page's fixed photography. The 14 source files
// (`~/Projects/aksailingclub-legacy/static/events/images/`) were pulled into the media library
// once, content-hashed; one of them (`end-of-season-party.jpg`) turned out to be the exact same
// bytes already uploaded as the home hero photo (`sunset-sail-dock`), so it reuses that entry
// rather than duplicating it, the dedup working as designed.
//
// The events-admin pass (Task 5) gave `events` its own writable `hero_image` field through the
// admin's hero picker, which stores a real `media:slug.hash` token straight into the column
// rather than a legacy filename, so `resolveEventImageUrl` below now tries that form first and
// only falls back to this fixed map when the stored value does not parse as a token.
import { parseMediaToken, type MediaResolve } from '@glw907/cairn-cms/media';

const EVENT_IMAGE_TOKENS: Record<string, string> = {
  'spring-work-party.jpg': 'media:spring-work-party.3ad6a065151bca0a',
  'icebreaker-regatta.jpg': 'media:icebreaker-regatta.269df7f24f1b6072',
  'firecracker-regatta.jpg': 'media:firecracker-regatta.ae5a9345fbdd6df3',
  'pirate-race-youth-cup.jpg': 'media:pirate-race-youth-cup.1df76cccb2448b6f',
  'fireweed-ladies-race.jpg': 'media:fireweed-ladies-race.a35f27a8b70ba44c',
  'governors-cup.jpg': 'media:governors-cup.c90f78621e7639ae',
  'bnac.jpg': 'media:bnac.29d75df78f196b2e',
  'northern-lights-regatta.jpg': 'media:northern-lights-regatta.8e99511edc8a8ba6',
  'fall-work-party.jpg': 'media:fall-work-party.6f5a1099cc1e6702',
  'end-of-season-party.jpg': 'media:sunset-sail-dock.ee278d04cc0db8e2',
  'adult-intro-class-1.jpg': 'media:adult-intro-class-1.a660579bd31517ff',
  'youth-intro-class-1.jpg': 'media:youth-intro-class-1.9c08687cac54de80',
  'adult-intro-class-2.jpg': 'media:adult-intro-class-2.02f488eb2fe199d8',
  'youth-intro-class-2.jpg': 'media:youth-intro-class-2.091a328187aa5733',
};

/**
 * Resolve a D1 row's `hero_image` value to its delivery URL, or undefined when the row has no
 * image or the value resolves to nothing. Accepts two forms: a stored `media:slug.hash` token
 * (events-admin pass, Task 5 -- the ledger's own hero picker writes one of these directly, and
 * without this arm a hero picked through the admin would silently drop on the public page), tried
 * first via `parseMediaToken`; and, only when that fails to parse, one of the 14 legacy filenames
 * this module's `EVENT_IMAGE_TOKENS` map still carries from the pre-admin ops-D1 migration. The
 * caller supplies the row's own `hero_image_alt` for display text; this only resolves which bytes
 * to show, matching `resolveMedia`'s own contract (undefined on any miss degrades to the
 * type-colored placeholder, never a broken image).
 */
export function resolveEventImageUrl(
  value: string | null,
  resolveMedia: MediaResolve,
): string | undefined {
  if (!value) return undefined;
  const directRef = parseMediaToken(value);
  if (directRef) return resolveMedia(directRef);
  const token = EVENT_IMAGE_TOKENS[value];
  if (!token) return undefined;
  const ref = parseMediaToken(token);
  if (!ref) return undefined;
  return resolveMedia(ref);
}
