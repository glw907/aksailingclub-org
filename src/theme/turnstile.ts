// The site-owned half of this site's Turnstile wiring: the public site key and the client API's
// ambient type. Verification itself moved to `@glw907/cairn-cms/cloudflare`'s `verifyTurnstile` in
// the `0.94.0-rc.1` migration; the copy that lived here (ported from ecxc.ski's own
// contact.remote.ts, the duplication that motivated the seam) is deleted. The packaged verifier is
// strictly stricter than the copy was: it fails closed on a fetch throw, a non-200, an unparseable
// body, and an over-length token, where this file's version would have thrown or trusted a
// malformed body.

/**
 * The club's own Turnstile site key, the same public key the pre-rebuild site already registered
 * with Cloudflare (safe to embed: the site key ships inside the served HTML by design, unlike the
 * paired secret key, which stays a Worker secret).
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAACaRcPmackdot0hZ';

declare global {
  interface Window {
    /** Cloudflare's Turnstile client API (`api.js`): present once that script has executed,
     *  `undefined` before then and during SSR. Any explicit-render caller (a widget added to the
     *  DOM after the page's initial paint, which Turnstile's implicit auto-render never picks up;
     *  see the class-signup page's own `turnstileExplicit` action) needs this ambient type. */
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string }) => string;
      remove: (widgetId: string) => void;
      ready: (callback: () => void) => void;
    };
  }
}
