// Advisory quota headroom for the account's Cloudflare Email Sending allowance (the design
// doc's ruling 7, `docs/2026-08-25-email-announce-design.md:101-114`). Both send surfaces
// (Compose's review step, the announce form) show this figure so an admin sees how much
// daily headroom remains before a large send; it never blocks a send, since `sendClubEmail`
// itself never throws on an over-quota account and simply logs the overflow as failed rows.
//
// The account id is a `wrangler.toml` [vars] value (see that file's own comment: it mirrors
// the top-level `account_id` deploy field at line 4, which the Worker runtime cannot read),
// and the token is an OPTIONAL Worker secret this module codes against by name only. Minting
// it is a Geoff-attended dashboard chore (see the design doc); until then, every call here
// degrades to `null` and callers render "headroom unknown" rather than blocking.

/** The binding shape this module needs: a structural subset of whatever the consuming site's
 *  own `Platform.env` carries, mirroring `EmailBindingEnv`'s own reasoning in `club-email.ts`.
 *  Both fields are optional: `CLOUDFLARE_ACCOUNT_ID` is set in every environment via
 *  `wrangler.toml`'s `[vars]`, but `CLOUDFLARE_EMAIL_SENDING_TOKEN` may never be minted at
 *  all (a supported, permanent state, not a transient gap). */
export interface EmailLimitsBindingEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL_SENDING_TOKEN?: string;
}

/** The account's daily Email Sending quota headroom, already reduced to the three figures
 *  the screens render. `remaining` is clamped at zero rather than going negative when the
 *  account is already over quota. */
export interface EmailQuotaHeadroom {
  quota: number;
  sentToday: number;
  remaining: number;
}

/** The live response shape from `GET /accounts/{account_id}/email/sending/limits`, the
 *  verbatim nested body the design doc quotes:
 *  `{"result":{"quota":{"value":200,"unit":"day"},"usage":{"sent":0,"over_quota":false,"resets_at":null}},"success":true}`.
 *  Only the fields this module reads are typed; the API carries more (`unit`, `over_quota`,
 *  `resets_at`) that no caller here needs. */
interface EmailSendingLimitsResponse {
  success: boolean;
  result?: {
    quota?: { value?: number };
    usage?: { sent?: number };
  };
}

const REQUEST_TIMEOUT_MS = 3000;

/**
 * Read the account's current Email Sending quota headroom. Returns `null` on every failure
 * path (a missing account id or token, a non-200 response, a request that aborts past the
 * 3-second timeout, or a thrown fetch), never throws, and never blocks a caller: this is an
 * advisory read only.
 */
export async function getEmailQuotaHeadroom(env: EmailLimitsBindingEnv): Promise<EmailQuotaHeadroom | null> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_EMAIL_SENDING_TOKEN;
  if (!accountId || !token) return null;

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/limits`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as EmailSendingLimitsResponse;
    if (body.success !== true) return null;

    const quota = body.result?.quota?.value;
    if (typeof quota !== 'number') return null;

    const sentToday = typeof body.result?.usage?.sent === 'number' ? body.result.usage.sent : 0;
    return { quota, sentToday, remaining: Math.max(0, quota - sentToday) };
  } catch {
    return null;
  }
}
