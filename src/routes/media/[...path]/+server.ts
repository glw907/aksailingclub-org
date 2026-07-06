// The media delivery route: the engine factory streams content-addressed bytes from the R2
// bucket the adapter named (MEDIA_BUCKET). It sits outside /admin and owns its own security
// headers.
import { createMediaRoute } from '@glw907/cairn-cms/sveltekit';
import { runtime } from '$chassis/cairn.server.js';

export const GET = createMediaRoute(runtime);
