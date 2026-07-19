// return-path.ts's own coverage (member-waivers T5b): the closed allowlist a `?next=` value must
// match exactly, and the completion coda's own label lookup.
import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT_LABEL, isSafeNextPath, nextPathLabel } from '$member-portal/lib/return-path';

describe('isSafeNextPath', () => {
  it('accepts every allowlisted target', () => {
    expect(isSafeNextPath('/my-account/renew')).toBe(true);
    expect(isSafeNextPath('/my-account/classes')).toBe(true);
    expect(isSafeNextPath('/my-account/sign?context=renewal')).toBe(true);
  });

  it('refuses an arbitrary path, an off-origin URL, and null', () => {
    expect(isSafeNextPath('/my-account')).toBe(false);
    expect(isSafeNextPath('https://evil.example/phish')).toBe(false);
    expect(isSafeNextPath('/my-account/renew?extra=1')).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
  });
});

describe('nextPathLabel', () => {
  it('labels the two completion-coda targets', () => {
    expect(nextPathLabel('/my-account/renew')).toBe('Back to renewal');
    expect(nextPathLabel('/my-account/classes')).toBe('Back to class signup');
  });

  it('falls back to the default label for a sign deep link or an unrecognized value', () => {
    expect(nextPathLabel('/my-account/sign?context=renewal')).toBe(DEFAULT_NEXT_LABEL);
    expect(nextPathLabel(null)).toBe(DEFAULT_NEXT_LABEL);
    expect(nextPathLabel('/something/else')).toBe(DEFAULT_NEXT_LABEL);
  });
});
