// Healthz endpoint shim at the site root, OUTSIDE /admin so the auth guard does not gate it.
// Exercises the engine's signing self-test through the real PKCS#1 path. Always returns 200
// JSON so the response is safe to assert against and an operator can tell "key missing" apart
// from "server crashed".
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { healthLoad } from '@glw907/cairn-cms/sveltekit';
import { runtime } from '$chassis/cairn.server.js';

// A site that defaults to prerender=true must force this dynamic, or it gets prerendered to a
// build-time ok:false and can 404 at runtime.
export const prerender = false;

export const GET: RequestHandler = async (event) => {
  try {
    return json(await healthLoad(event, runtime));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ ok: false, checks: { githubAppSigning: { ok: false, detail } } });
  }
};
