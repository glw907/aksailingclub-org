<!-- @component
The season page's calendar-subscribe bar (docs/2026-08-22-events-redesign-design.md, "Calendar
subscription"): four entries in the page's existing quiet register, widened from the prior
two-link build. Apple Calendar and Google Calendar keep their already-shipped link mechanics
(a `webcal://` URL, and the same URL as Google's `cid` query param); Outlook is new
(`outlook.live.com`'s own add-from-web endpoint, which fetches the feed server-side and so takes
the plain `https://` URL); the fourth entry is a "Copy feed address" button for every other
calendar app, since Thunderbird, Fastmail, Proton, and the phone apps all just want a plain feed
URL pasted in. The address itself is on the page beside the button, so a reader whose clipboard
is unavailable can still select it by hand. All four read their glyph from the shared icon set
(`$theme/markdown/icons.ts`) rather than a hand-inlined SVG, per the events-redesign build's own
constraint. -->
<script lang="ts">
  import { ICON_PATHS } from '$theme/markdown/icons';

  interface Props {
    /** The `webcal://` feed URL, Apple Calendar's own link and the `cid` query param Google
     *  reads (see the header comment: "feed URL" in the design doc's table means this
     *  already-webcal-formatted value, not the plain `https://` one below). */
    webcalUrl: string;
    googleCalendarUrl: string;
    outlookCalendarUrl: string;
    /** The plain `https://…/calendar.ics` URL: the address shown on the page, and the one string
     *  the copy button ever touches. */
    icsUrl: string;
  }

  let { webcalUrl, googleCalendarUrl, outlookCalendarUrl, icsUrl }: Props = $props();

  /** The copy attempt's announcement, read by the live region below: empty until the reader
   *  presses the button, then the outcome. The button's own label never changes, so a reader
   *  partway through pressing it never watches the control they are on rename itself. Either
   *  outcome clears after two seconds, so a second attempt re-announces its own result. */
  let copyStatus = $state('');
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  async function copyFeedAddress() {
    try {
      await navigator.clipboard.writeText(icsUrl);
      copyStatus = 'Copied the feed address';
    } catch {
      copyStatus = 'Copy failed';
    }
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (copyStatus = ''), 2000);
  }

  // A pending reset would otherwise fire against a destroyed component (a reader who copies and
  // navigates away inside the two-second window).
  $effect(() => () => clearTimeout(copyTimeout));
</script>

<div class="ev-subscribe" role="group" aria-labelledby="ev-subscribe-label">
  <span class="ev-subscribe-label" id="ev-subscribe-label">Add the season to your calendar</span>
  <div class="ev-subscribe-row">
    <a class="ev-subscribe-link" href={webcalUrl}>
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['calendar-dots']} /></svg>
      Apple Calendar
    </a>
    <a class="ev-subscribe-link" href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['globe-simple']} /></svg>
      Google Calendar<span class="sr-only"> (opens in a new tab)</span>
    </a>
    <a class="ev-subscribe-link" href={outlookCalendarUrl} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['envelope-simple']} /></svg>
      Outlook<span class="sr-only"> (opens in a new tab)</span>
    </a>
    <button class="ev-subscribe-link" type="button" onclick={copyFeedAddress}>
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS.copy} /></svg>
      Copy feed address
    </button>
    <input class="ev-subscribe-address" type="text" readonly value={icsUrl} aria-label="Calendar feed address" />
  </div>
  <!-- Present from first paint, not mounted on the first copy: a live region a browser inserts
       into the page at the moment its text changes is not reliably announced. -->
  <span class="sr-only" role="status">{copyStatus}</span>
</div>

<style>
  /* The subscribe bar: the page's existing quiet register (ported from the two-link build this
     replaces), now four entries wide. Every value maps to a theme token. */
  .ev-subscribe {
    margin-top: var(--spacing-m);
    padding-top: var(--spacing-xs);
    border-top: var(--border) solid var(--color-card-border);
  }
  .ev-subscribe-label {
    display: block;
    font-size: var(--text-step--1);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-muted);
    margin-bottom: 0.4rem;
  }
  .ev-subscribe-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-2xs) var(--spacing-m);
  }
  /* The entries stay visually the same quiet text links; the vertical padding is what lifts each
     one to a real touch target (about 30px tall at the bar's own type step) without giving them
     a button's chrome. */
  .ev-subscribe-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding-block: var(--spacing-3xs);
    font: inherit;
    font-size: var(--text-step--1);
    font-weight: 500;
    color: var(--color-muted);
    text-decoration: none;
    background: none;
    border: 0;
    padding-inline: 0;
    cursor: pointer;
  }
  .ev-subscribe-link:hover {
    color: var(--color-primary);
  }
  .ev-subscribe-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .ev-subscribe-link svg {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }
  .ev-subscribe-link:hover svg {
    opacity: 1;
  }
  /* The address the copy button copies, shown rather than hidden: the copy can fail (an insecure
     context, a denied permission), and a reader on a phone often wants to select it by hand
     anyway. Sized to the URL it holds, so it never stretches the row. */
  .ev-subscribe-address {
    flex: 1 1 22ch;
    min-width: 0;
    max-width: 34ch;
    padding: var(--spacing-3xs) var(--spacing-2xs);
    font-family: var(--font-mono);
    font-size: var(--text-step--2);
    color: var(--color-muted);
    background: var(--color-base-100);
    border: var(--border) solid var(--color-card-border);
    border-radius: var(--radius-field);
  }
  .ev-subscribe-address:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
