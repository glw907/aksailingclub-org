// The one server-side composition point. The runtime composes once here, and every server
// route that needs it (the /admin mount, /healthz, /media) imports it instead of re-running
// composeRuntime per route.
import { composeRuntime } from '@glw907/cairn-cms';
import { createCairnAdmin } from '@glw907/cairn-cms/sveltekit';
import { cairn, siteConfig } from '$theme/cairn.config.js';

export const runtime = composeRuntime({ adapter: cairn, siteConfig });
// Initiative 5 Task 4: the declared navLayout tree (cairn.config.ts) gates the Club, Outreach,
// and Boats & Gear groups by role directly, so the site's own per-request nav-hiding hook (which
// read the now-retired `club_roles` table) is gone; role visibility is declarative.
export const admin = createCairnAdmin(runtime);
