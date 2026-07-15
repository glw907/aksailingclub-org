import { describe, expect, it } from 'vitest';
import { resolveCapability } from '@glw907/cairn-cms';
import { roles } from '$theme/cairn.config.js';

describe('the declared role vocabulary', () => {
  it('maps owner to owner capability', () => {
    expect(resolveCapability(roles, 'owner')).toBe('owner');
  });

  it('maps club-admin to editor capability', () => {
    expect(resolveCapability(roles, 'club-admin')).toBe('editor');
  });

  it('maps instructor to none capability', () => {
    expect(resolveCapability(roles, 'instructor')).toBe('none');
  });

  it('maps an undeclared name to none capability', () => {
    expect(resolveCapability(roles, 'guest')).toBe('none');
  });
});
