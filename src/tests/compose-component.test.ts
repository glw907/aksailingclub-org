// Compose's own component-level assertions (Email + Announce pass, Task 7): four of the six
// load-bearing behaviors the server-side tests (`compose-actions.test.ts`) cannot reach, since
// they live entirely in the client component's own script (segment presetting, the update-
// without-reset settle, the sample preview, and the cursor-splice insert). This repo's Vitest
// setup has no client `mount()` (`sveltekit-vite-forces-ssr-under-vitest` in agent memory:
// `@sveltejs/kit/vite` forces every `.svelte` file into its SSR compile target whenever
// `process.env.TEST === 'true'`, which Vitest always sets), so each behavior is pinned as a
// direct, DOM-free unit test against the pure functions `+page.svelte`'s own `<script module>`
// block exports -- the same extraction idiom `hero-image-picker.ts` uses for the events pass, one
// level further: a `<script module>` export is importable straight off the `.svelte` file with no
// separate colocated `.ts` module needed.
//
// What this file does NOT claim: that a later `data` prop change leaves an already-mounted
// instance's `segmentKey` untouched. That is the other half of `resolveInitialSegmentKey`'s own
// contract (the `untrack` wrapping it in the component, `+page.svelte:83`), and proving it needs
// a live component instance to change props on, which this repo's Vitest cannot produce. It rests
// on code review and the same `untrack`-plus-`$state`-initializer idiom already used elsewhere in
// this codebase (`assets/+page.svelte`, `email/[id]/+page.svelte`), not on an automated test here.
import { describe, expect, it, vi } from 'vitest';
import type { SubmitFunction } from '@sveltejs/kit';
import {
  buildPreview,
  onSettle,
  resolveInitialSegmentKey,
  spliceVariableToken,
} from '../routes/admin/club/email/compose/+page.svelte';

describe('/admin/club/email/compose component logic', () => {
  describe('resolveInitialSegmentKey (the `?segment=` preset seed, read once through `untrack`)', () => {
    it('seeds the empty string with no preset', () => {
      expect(resolveInitialSegmentKey(null)).toBe('');
    });

    it('seeds the exact preset key', () => {
      expect(resolveInitialSegmentKey('lapsed')).toBe('lapsed');
    });
  });

  describe('buildPreview (the sample-data preview, `renderTemplateWithVariables` with the fixed sample vars)', () => {
    it('substitutes every sample variable into both the subject and the body', () => {
      const preview = buildPreview('Hi {{person_name}}', 'Hi {{person_name}}, visit {{portal_url}} or write {{committee_email}}.');
      expect(preview.subject).toBe('Hi Sample Member');
      expect(preview.text).toBe('Hi Sample Member, visit /my-account or write membership-committee@aksailingclub.org.');
      expect(preview.html).toContain('Sample Member');
    });

    it('renders an empty subject and body the same way an ordinary empty render would', () => {
      const preview = buildPreview('', '');
      expect(preview.subject).toBe('');
      expect(preview.text).toBe('');
    });
  });

  describe('spliceVariableToken (insertVariable\'s own splice math, `{{token}}` at the textarea selection bounds)', () => {
    it('inserts the token at a collapsed cursor and reports the post-insert cursor position', () => {
      const result = spliceVariableToken('Hi , welcome', 'person_name', 3, 3);
      expect(result.body).toBe('Hi {{person_name}}, welcome');
      expect(result.cursor).toBe(3 + '{{person_name}}'.length);
    });

    it('replaces a selected range rather than inserting inside it', () => {
      const result = spliceVariableToken('Hi NAME, welcome', 'person_name', 3, 7);
      expect(result.body).toBe('Hi {{person_name}}, welcome');
    });

    it('inserts at the end when the cursor sits past the current body length', () => {
      const result = spliceVariableToken('Hi', 'portal_url', 2, 2);
      expect(result.body).toBe('Hi{{portal_url}}');
      expect(result.cursor).toBe(2 + '{{portal_url}}'.length);
    });
  });

  describe("onSettle (the review-transition settle, `update({ reset: false })`)", () => {
    it('calls update with reset: false, never the SubmitFunction default of reset: true', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const submit: SubmitFunction = onSettle();
      const afterSubmit = await submit({} as unknown as Parameters<SubmitFunction>[0]);
      expect(typeof afterSubmit).toBe('function');
      await (afterSubmit as unknown as (opts: { update: typeof update }) => Promise<void>)({ update });
      expect(update).toHaveBeenCalledExactlyOnceWith({ reset: false });
    });
  });
});
