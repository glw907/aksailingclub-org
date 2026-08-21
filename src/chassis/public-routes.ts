// The one PublicRoutesConfig literal, and the one createPublicRoutes() instance built from it,
// shared by every site route that needs the same entry-render/SEO/media plumbing for a single
// content entry: the (site) catch-all's prerendered load, `/events` (which blends this plumbing
// with a live D1 read the catch-all's prerendered load cannot do), and `/preview/[token]` (the
// runtime route that reads the same config through `previewLoad`). Built once here rather than
// per route, so no caller can drift its own copy of this config out of step with the others.
import { createPublicRoutes, type PublicRoutesConfig } from '@glw907/cairn-cms/delivery';
import { site, ORIGIN, SITE_DESCRIPTION } from '$chassis/content';
import { cairn, publicMediaResolver, mediaEnabled, siteConfig } from '$theme/cairn.config';

export const publicRoutesConfig: PublicRoutesConfig = {
  site,
  render: cairn.rendering.render,
  origin: ORIGIN,
  siteName: siteConfig.siteName,
  description: SITE_DESCRIPTION,
  feeds: { rss: ORIGIN + '/feed.xml', json: ORIGIN + '/feed.json' },
  // The same resolver the body render path uses, so the read path resolves a frontmatter `image`
  // hero into the `heroImage` projection the template and the SEO head read.
  resolveMedia: publicMediaResolver,
  // Arms the engine's media.resolver_absent diagnostic: with media on, dropping resolveMedia
  // above logs a warning instead of silently shipping a broken hero image.
  assetsEnabled: mediaEnabled,
};

export const routes = createPublicRoutes(publicRoutesConfig);
