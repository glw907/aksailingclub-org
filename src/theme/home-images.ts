// The three fixed home-page photography placements (Task 3): the north star's hero, fleet, and
// facilities panels (docs/superpowers/specs/assets/2026-07-06-asc-home-northstar.html in the
// cairn-cms repo), each a real club photo pulled from the live site's assets into the media
// library with alt text. The home page is a hand-built template, not migrated content (the
// content-migration-findings.md's own note: "the home page ... is not migrated markdown
// content"), so these three are not a frontmatter `fields.image` on some content entry; each is a
// fixed `media:` token resolved directly through the site's own manifest and resolver, the same
// two primitives a frontmatter hero resolves through on an ordinary content route.
import { parseMediaToken, type MediaManifest, type MediaResolve } from '@glw907/cairn-cms/media';

/** One resolved home-page image: its delivery URL and its library alt text. */
export interface HomeImage {
  url: string;
  alt: string;
}

/** Every fixed home-page image, by the north star section it fills. */
export interface HomeImages {
  hero?: HomeImage;
  fleet?: HomeImage;
  facilities?: HomeImage;
}

// The completion pass's restore (manifest item 14): the live site's own home hero
// (`site-header-4x3.jpeg`, already in the library as `site-header-big-lake` from donate.md's own
// hero), not the sunset photo the Task 3 build had picked instead.
const HERO_TOKEN = 'media:site-header-big-lake.eb71d593c9eaf136';
const FLEET_TOKEN = 'media:fleet-racing-spinnakers.aced8df0a45f9553';
const FACILITIES_TOKEN = 'media:clubhouse-and-grounds.ead9645a4e60dd76';

/** Resolve one fixed token against the manifest and resolver, or undefined on any miss (an
 * unresolvable reference degrades to no image rather than a broken one; the section keeps its
 * gradient placeholder, matching the north star's own pre-photography state). */
function resolveHomeImage(token: string, manifest: MediaManifest, resolveMedia: MediaResolve): HomeImage | undefined {
  const ref = parseMediaToken(token);
  if (!ref) return undefined;
  const entry = manifest[ref.hash];
  const url = resolveMedia(ref);
  if (!entry || !url) return undefined;
  return { url, alt: entry.alt };
}

/** Resolve all three home-page placements at once, for the home page's own server load. */
export function homeImages(manifest: MediaManifest, resolveMedia: MediaResolve): HomeImages {
  return {
    hero: resolveHomeImage(HERO_TOKEN, manifest, resolveMedia),
    fleet: resolveHomeImage(FLEET_TOKEN, manifest, resolveMedia),
    facilities: resolveHomeImage(FACILITIES_TOKEN, manifest, resolveMedia),
  };
}
