// The Club section's own action wrapper (pass 2.1 Task 6, rider 1): every `/admin/club/**`
// write needs the club-role precondition, not just the section's layout guard, because
// SvelteKit dispatches a matched form action directly and never re-runs an ancestor layout's
// `load` first.
//
// Since the `0.94.0-rc.1` migration this is a thin naming layer over cairn's own
// `createSectionAction` (`0.93.0`), which packages exactly what this file used to hand-roll:
// `adminAction`'s editor resolution, CSRF and single form read, then the per-editor rate limit,
// the site access map's own `canReach` check, the `ownerOnly` capability stack, and the
// `CLUB_DB` resolution, each refusal audited under this call site's own `action`/`entity`. The
// composition this file argued for is the composition the engine now ships.
//
// Two behaviors moved with it, both deliberate. Authorization now derives its target from
// `event.route.id` rather than `event.url.pathname`, so a POST to `/admin/club/classes/[id]`
// authorizes against the bracket route id; the site's access map keys on path prefixes
// (`/admin/club`, and the two Communication widenings), and a prefix match is unaffected by the
// switch. And the rate-limit refusal no longer writes an audit row: back-pressure is not a
// domain-state change, and it logs `admin.action.rate_limited` instead.
import { createSectionAction } from '@glw907/cairn-cms/sveltekit';
import type { SectionActionContext, SectionActionOptions } from '@glw907/cairn-cms/sveltekit';
import type { D1Database } from '@cloudflare/workers-types';
import { resolveClubDb } from './club-db';

/** The platform bindings a club action's handler sees on `event.platform.env`. This is the site's
 *  whole `App.Platform['env']`, not a narrow slice of it: `createSectionAction` types
 *  `CairnEvent<Env>['platform']['env']` as whatever `Env` says, so naming only what this factory
 *  itself reads (`CLUB_DB`, `RATE_LIMIT_ADMIN`) would hide `PUBLIC_ORIGIN`, `EMAIL`, and the
 *  Discord webhooks that the section's own handlers read off the same object. `Env` does not infer
 *  from `resolveDb`'s parameter alone, so it is annotated on the factory call below rather than
 *  left to collapse to `{}`. */
type ClubSectionEnv = App.Platform['env'];

/** What a `clubAdminAction` handler receives: the engine's own verified `editor`/`audit`, plus the
 *  resolved `CLUB_DB` handle, already checked by the wrapper so no handler re-resolves it. A
 *  handler that needs the acting editor's role reads `ctx.editor.role`/`ctx.editor.capability`
 *  directly; both are already the wrapper-checked values by the time a handler runs. `ctx.audit`
 *  defaults its `action`/`entity` from the call site's own options, so the common emit names only
 *  `entityId`/`detail`. */
export type ClubActionContext = SectionActionContext<D1Database>;

/** This section's own options, `SectionActionOptions` under the name the section's call sites
 *  already use. `action`/`entity` are the audit verbs (reused on every denial and as `ctx.audit`'s
 *  own default), `ownerOnly` requires owner CAPABILITY on top of the map check rather than instead
 *  of it, and `deniedMessage` overrides the shared 403 copy with a domain-specific one. */
export type ClubActionOptions = SectionActionOptions;

/**
 * The Club section's guarded action factory. Coverage table item 3
 * (docs/2026-07-15-payments-live-smoke-design.md section 2b) is the rate limit below: every admin
 * POST, keyed per editor email, sharing one `RATE_LIMIT_ADMIN` budget across every club action.
 */
export const clubAdminAction = createSectionAction<ClubSectionEnv, D1Database>({
  resolveDb: (env) => resolveClubDb(env),
  rateLimit: {
    resolve: (env) => env?.RATE_LIMIT_ADMIN,
    key: (ctx) => `editor:${ctx.editor.email}`,
  },
});
