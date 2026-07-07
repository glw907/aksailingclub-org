// The one server-side composition point. The runtime composes once here, and every server
// route that needs it (the /admin mount, /healthz, /media) imports it instead of re-running
// composeRuntime per route.
import { composeRuntime } from '@glw907/cairn-cms';
import { createCairnAdmin } from '@glw907/cairn-cms/sveltekit';
import { cairn, siteConfig } from '$theme/cairn.config.js';
import { filterClubNav } from '$admin-club/lib/club-roles';

export const runtime = composeRuntime({ adapter: cairn, siteConfig });
// Task 4: `navFilter` hides the Club section for a signed-in editor with no club role, so a
// content editor without a club grant never sees a link into a section its own `+layout.server.ts`
// guard would then refuse.
export const admin = createCairnAdmin(runtime, { navFilter: filterClubNav });
