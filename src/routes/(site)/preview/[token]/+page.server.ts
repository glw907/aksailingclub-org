// The share-a-draft preview mount (cairn 0.95's preview feature, docs/plans/2026-08-21-cairn-0.95-adoption.md
// T4). Lives inside the `(site)` layout group deliberately: the group's own layout carries the
// theme stylesheets and chrome (`(site)/+layout.svelte`), and mounting outside it would render an
// unstyled page. `previewLoad` takes the SAME `publicRoutesConfig` object
// `(site)/[...path]/+page.server.ts` composes its public routes from ($chassis/public-routes.ts),
// so this route can never render a draft through a different composition than the public page it
// will eventually become. This site has no `withReferences`/entry-data module (no concept here
// declares a reference field), so the load returns `previewLoad`'s own result directly, no `.then`.
import type { PageServerLoad } from './$types';
import { previewLoad } from '@glw907/cairn-cms/sveltekit';
import { runtime } from '$chassis/cairn.server.js';
import { publicRoutesConfig } from '$chassis/public-routes.js';

// REQUIRED: a preview link is a bearer credential (whoever holds the URL can read the draft with
// no session). Prerendering this route would bake a token into a static asset every build ships;
// previewLoad itself throws a descriptive build-time error if this line is ever dropped, but the
// line stays the documented, load-bearing default rather than relying on that backstop alone.
export const prerender = false;

export const load: PageServerLoad = (event) => previewLoad(runtime, publicRoutesConfig, event);
