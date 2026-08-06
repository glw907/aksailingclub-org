// The scheduled entrypoint the Cloudflare Cron Trigger invokes (wired via
// `scripts/wire-scheduled-handler.mjs`, see that script's own header for the mechanism and
// why it exists; `wrangler.toml`'s `[triggers]` names the schedule). Runs every job in `JOBS`
// (registry.ts) independently: one throwing job is caught and audited as a failure, never
// blocking the jobs after it, and every job (success or failure) writes exactly one `audit_log`
// row for the tick, actor `'system:cron'`.
//
// Those rows go through cairn's own packaged `createD1AuditSink` rather than a hand-rolled insert
// (`0.94.0-rc.1` sanctioned calling the sink directly with a site's own domain events; the sink
// was already generic, and the ruling made the direct call supported rather than a workaround).
// A scheduled tick has no signed-in editor and no `adminAction` wrapper behind it, so the actor is
// this module's own `'system:cron'` rather than an editor email, and every action name this file
// writes is namespaced under `job.` so a tick's rows stay distinguishable from admin-action rows
// in the shared table.
import type { D1Database } from '@cloudflare/workers-types';
import { createD1AuditSink } from '@glw907/cairn-cms/sveltekit';
import type { AdminActionAuditSink } from '@glw907/cairn-cms/sveltekit';
import { resolveClubDb } from '$admin-club/lib/club-db';
import { JOBS, type JobRunnerEnv, type SendBudget } from './registry';

const CRON_ACTOR = 'system:cron';

/** The per-tick email send cap (the 2026-07-14 incident's own guard rider): well under the
 *  account's real sending quota, so a blast of catch-up sends (an import, a backfill, a long
 *  cron outage) hits this ceiling long before it hits the account's own. */
export const PER_TICK_SEND_CAP = 50;

/** The real, capped {@link SendBudget}: `reserve` grants up to `cap` sends total across every job
 *  sharing this instance, then returns `false` for the rest of the tick. The first caller to
 *  exhaust it writes the one `job.send_cap_hit` audit row (`capLogged` guards against a second job
 *  also running dry against the same spent budget writing a duplicate). */
class TickSendBudget implements SendBudget {
  private remaining: number;
  private capLogged = false;

  constructor(
    private readonly audit: AdminActionAuditSink,
    private readonly cap: number,
  ) {
    this.remaining = cap;
  }

  async reserve(jobName: string): Promise<boolean> {
    if (this.remaining > 0) {
      this.remaining -= 1;
      return true;
    }
    if (!this.capLogged) {
      this.capLogged = true;
      this.audit({
        actor: CRON_ACTOR,
        action: 'job.send_cap_hit',
        entity: 'jobs',
        entityId: jobName,
        detail: `cap=${this.cap} interrupted_job=${jobName}`,
      });
    }
    return false;
  }
}

/** Build the real per-tick send budget, shared by every job in one `runScheduledJobs` call.
 *  Exported so a test can exercise the cap directly against a job's own `run`, the same way
 *  `runner.ts` itself does. `waitUntil` is passed straight through to the audit sink, so a test
 *  that omits it accepts the same drop risk `createD1AuditSink` documents for that argument. */
export function createSendBudget(
  db: D1Database,
  cap: number = PER_TICK_SEND_CAP,
  waitUntil?: (promise: Promise<unknown>) => void,
): SendBudget {
  return new TickSendBudget(createD1AuditSink(db, waitUntil), cap);
}

/**
 * Run every registered job once, in order. `env` is the raw Worker bindings object the `scheduled`
 * handler receives (typed `unknown` at this boundary, narrowed internally, the same convention
 * `resolveClubDb`/`ClassSignupEnv` already use elsewhere in this site rather than requiring every
 * caller to satisfy the engine's full platform-binding shape). If `CLUB_DB` itself is not bound,
 * the whole tick is skipped (logged, never thrown): there is nowhere to write even a failure
 * audit row without it.
 *
 * `waitUntil` comes from the `scheduled` handler's own `ExecutionContext`
 * (`scripts/wire-scheduled-handler.mjs` binds it before passing it), and every audit row this tick
 * writes rides it. The audit sink returns before its insert settles, so without it the last rows a
 * tick writes can be dropped when this function's own promise resolves.
 */
export async function runScheduledJobs(env: unknown, waitUntil?: (promise: Promise<unknown>) => void): Promise<void> {
  const platformEnv = env as JobRunnerEnv;
  const db = resolveClubDb(env);
  if (!db) {
    console.error('jobs/runner: CLUB_DB is not bound; skipping this scheduled tick entirely.');
    return;
  }

  const now = new Date();
  const audit = createD1AuditSink(db, waitUntil);
  const budget = createSendBudget(db, PER_TICK_SEND_CAP, waitUntil);
  for (const job of JOBS) {
    let detail: string;
    try {
      const summary = await job.run(platformEnv, { db, now, budget });
      detail = `examined=${summary.examined} acted=${summary.acted}${summary.detail ? ` (${summary.detail})` : ''}`;
      console.log(`jobs/runner: "${job.name}" ok -- ${detail}`);
    } catch (err) {
      detail = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`jobs/runner: "${job.name}" threw`, err);
    }
    audit({ actor: CRON_ACTOR, action: 'job.run', entity: 'job', entityId: job.name, detail });
  }
}
