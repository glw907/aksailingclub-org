import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailQuotaHeadroom } from '$admin-club/lib/email-limits';

const ENV = { CLOUDFLARE_ACCOUNT_ID: 'acct-123', CLOUDFLARE_EMAIL_SENDING_TOKEN: 'token-abc' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getEmailQuotaHeadroom', () => {
  it('parses the verbatim live response body into quota, sentToday, and remaining', async () => {
    // The exact body measured against this account on 2026-08-25 (the plan's Task 2 quote).
    const body = { result: { quota: { value: 200, unit: 'day' }, usage: { sent: 0, over_quota: false, resets_at: null } }, success: true };
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
    vi.stubGlobal('fetch', fetchSpy);

    const headroom = await getEmailQuotaHeadroom(ENV);

    expect(headroom).toEqual({ quota: 200, sentToday: 0, remaining: 200 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct-123/email/sending/limits');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-abc' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('clamps remaining at zero when sent today meets or exceeds quota', async () => {
    const body = { result: { quota: { value: 200, unit: 'day' }, usage: { sent: 250, over_quota: true, resets_at: null } }, success: true };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));

    expect(await getEmailQuotaHeadroom(ENV)).toEqual({ quota: 200, sentToday: 250, remaining: 0 });
  });

  it('returns null when the account id is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await getEmailQuotaHeadroom({ CLOUDFLARE_EMAIL_SENDING_TOKEN: 'token-abc' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when the token secret is not minted (the supported, permanent state)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await getEmailQuotaHeadroom({ CLOUDFLARE_ACCOUNT_ID: 'acct-123' })).toBeNull();
    expect(await getEmailQuotaHeadroom({})).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }));

    expect(await getEmailQuotaHeadroom(ENV)).toBeNull();
  });

  it('returns null when success is not true', async () => {
    const body = { result: { quota: { value: 200 }, usage: { sent: 0 } }, success: false };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));

    expect(await getEmailQuotaHeadroom(ENV)).toBeNull();
  });

  it('returns null when result.quota.value is missing', async () => {
    const body = { result: { usage: { sent: 0 } }, success: true };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));

    expect(await getEmailQuotaHeadroom(ENV)).toBeNull();
  });

  it('returns null when the fetch aborts past the 3-second timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'TimeoutError';
        return Promise.reject(error);
      }),
    );

    expect(await getEmailQuotaHeadroom(ENV)).toBeNull();
  });

  it('returns null when fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        throw new Error('network down');
      }),
    );

    expect(await getEmailQuotaHeadroom(ENV)).toBeNull();
  });
});
