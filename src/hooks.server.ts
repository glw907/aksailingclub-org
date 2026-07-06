// The engine's auth guard owns /admin gating: the magic-link session cookie, CSRF, and the
// admin-route dispatch. This site has no registry-only dev-backend hook (@glw907/cairn-cms-dev
// is a monorepo-only devDependency, unpublished by design); a local admin smoke test seeds a D1
// session row directly instead (see the admin smoke-test process in the cairn-cms repo's
// docs/internal/admin-smoke-test.md).
import { createAuthGuard } from '@glw907/cairn-cms/sveltekit';

export const handle = createAuthGuard();
