import type { PageServerLoad } from './$types';
import { posts } from '$chassis/content';

// ASC's Task-1 placeholder home: a plain post listing (Task 3 replaces this wholesale with the
// north-star composition: the welcome hero, the notification strip, the news grid, the season
// band, the fleet/facilities panels, and the closing CTA).
export const prerender = true;

export const load: PageServerLoad = () => ({ posts: posts.all() });
