// The one server-side composition point. The runtime composes once here, and every server
// route that needs it (the /admin mount, /healthz, /media) imports it instead of re-running
// composeRuntime per route.
import { composeRuntime } from '@glw907/cairn-cms';
import { createCairnAdmin } from '@glw907/cairn-cms/sveltekit';
import { cairn, siteConfig } from '$theme/cairn.config.js';

export const runtime = composeRuntime({ adapter: cairn, siteConfig });
export const admin = createCairnAdmin(runtime);
