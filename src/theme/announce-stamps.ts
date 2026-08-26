// src/theme/announce-stamps.ts
//
// The `publishedAt` seam over the committed content manifest, read only by the Announce list's
// ordering (`routes/admin/club/announce/+page.server.ts`). An eager `import.meta.glob` over the
// committed `src/content/.cairn/index.json`, the idiom `cairn.config.ts`'s own `mediaManifest`
// already uses for `media.json`: a glob with no match degrades to `{}` rather than a build-time
// module-not-found, so a fresh site with no committed manifest still builds. The route never
// imports the manifest JSON itself, so a future manifest shape change has one call site to
// update.
//
// `orderByPublished` (the pure sort) also lives here rather than in the route's own
// `+page.server.ts`: SvelteKit's route-module analysis rejects any export from a `+page.server.ts`
// outside its fixed vocabulary (`load`, `actions`, `prerender`, ...), which a plain `npm run build`
// catches but `npm run check`/`npm test` do not, so this placement is load-bearing, not stylistic.
import type { ContentSummary } from '@glw907/cairn-cms/delivery';
import type { Manifest, ManifestEntry } from '@glw907/cairn-cms';

const globResult = import.meta.glob('../content/.cairn/index.json', { eager: true, import: 'default' });

function readManifest(result: Record<string, unknown>): Manifest {
  const [raw] = Object.values(result);
  return raw && typeof raw === 'object' ? (raw as Manifest) : { version: 1, entries: [] };
}

const manifest = readManifest(globResult);

/** Every post's first-publish stamp, keyed by post id. Entries outside the `posts` concept, and
 *  posts published before the field existed (or never published at all), are simply absent; the
 *  announce list's ordering falls back to a post's own `date` for those. */
export const postPublishedAt: Map<string, string> = new Map(
  manifest.entries
    .filter((entry): entry is ManifestEntry & { publishedAt: string } => entry.concept === 'posts' && Boolean(entry.publishedAt))
    .map((entry) => [entry.id, entry.publishedAt]),
);

/** A post's own display-order moment, in epoch milliseconds: its manifest `publishedAt` stamp
 *  when one exists (a full ISO instant), otherwise its civil `date` normalized to UTC midnight.
 *  Never a raw string compare, since `date` ("2026-03-02") and `publishedAt`
 *  ("2026-03-02T18:04:11Z") sort incorrectly against each other lexically. A post with neither
 *  value sorts to the very back (epoch 0) rather than throwing. */
function orderingEpochMs(row: Pick<ContentSummary, 'id' | 'date'>, stamps: ReadonlyMap<string, string>): number {
  const publishedAt = stamps.get(row.id);
  if (publishedAt) {
    const parsed = Date.parse(publishedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (row.date) {
    const parsed = Date.parse(`${row.date}T00:00:00Z`);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

/** The pure sort behind the announce list's "newest first": every post ordered by
 *  {@link orderingEpochMs} descending. Exported so a test stamps a fixture entry directly and
 *  calls this without reading the real manifest. Sorting runs over the WHOLE row array; the
 *  caller slices to its own recent-window limit afterward, so a backdated `date` with a newer
 *  `publishedAt` can still displace an otherwise-more-recent post out of the visible window,
 *  matching what "newest first" actually means once a stamp exists. */
export function orderByPublished<T extends Pick<ContentSummary, 'id' | 'date'>>(rows: readonly T[], stamps: ReadonlyMap<string, string>): T[] {
  return [...rows].sort((a, b) => orderingEpochMs(b, stamps) - orderingEpochMs(a, stamps));
}
