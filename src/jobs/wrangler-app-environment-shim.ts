// A module alias target for wrangler's own esbuild bundling pass, wired via wrangler.toml's
// top-level `alias` field (esbuild's `alias` config, per Cloudflare's own module-aliasing docs).
// Needed only because `scripts/wire-scheduled-handler.mjs` appends a raw, un-Vite-processed
// `import { runScheduledJobs } from '../../src/jobs/runner.ts'` straight into the built
// `_worker.js` (see that script's own header for why this is the correct mechanism for wiring a
// Cron Trigger handler onto the adapter's generated Worker). Every other file in this app is
// bundled by Vite, whose SvelteKit plugin resolves the real `$app/environment` virtual module;
// `runner.ts` is the one exception, bundled fresh by wrangler's plain esbuild pass at `wrangler
// dev`/`deploy` time, which has no SvelteKit plugin and cannot resolve a `$app/*` virtual import.
//
// `runner.ts` imports `createD1AuditSink` from `@glw907/cairn-cms/sveltekit`
// (dist/sveltekit/index.js), a single barrel that, as of cairn 0.95.0, also re-exports
// `previewLoad`/`mintPreviewToken` (dist/sveltekit/preview.js), which reads `building` from
// `$app/environment` to refuse running during a prerender build. Wrangler's esbuild pass walks
// the WHOLE barrel it is asked to bundle, not just the one export `runner.ts` actually uses, so
// it hits that unresolvable import even though `runner.ts` never calls anything preview-related.
//
// This shim's values are the correct runtime answer, not a stand-in: by the time wrangler's
// bundled Worker is executing (`wrangler dev --local` or a real deploy), the SvelteKit build has
// already finished, `building` is always false, `browser` is always false (a Worker has no DOM),
// `dev` is always false (this is the deployed/local-served Worker, not the Vite dev server), and
// `version` is not read anywhere on this import path, so an empty string is safe.
export const browser = false;
export const dev = false;
export const building = false;
export const version = '';
