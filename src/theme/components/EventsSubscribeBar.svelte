<!-- @component
The season page's calendar-subscribe bar (docs/2026-08-22-events-redesign-design.md, "Calendar
subscription"), landed as probe 7's ratified one quiet line: a muted lead phrase, then four
entries as plain navy inline controls separated by a middot, no icons and no caps label. Apple
Calendar and Google Calendar keep their already-shipped link mechanics (a `webcal://` URL, and
the same URL as Google's `cid` query param); Outlook is new (`outlook.live.com`'s own
add-from-web endpoint, which fetches the feed server-side and so takes the plain `https://`
URL); the fourth entry is a "Copy feed address" button for every other calendar app, since
Thunderbird, Fastmail, Proton, and the phone apps all just want a plain feed URL pasted in. The
address itself only appears once copying has failed (an insecure context, a denied permission):
shown always, it would compete with the line's own quiet register for a fallback most readers
never need. -->
<script lang="ts">
  interface Props {
    /** The `webcal://` feed URL, Apple Calendar's own link and the `cid` query param Google
     *  reads (see the header comment: "feed URL" in the design doc's table means this
     *  already-webcal-formatted value, not the plain `https://` one below). */
    webcalUrl: string;
    googleCalendarUrl: string;
    outlookCalendarUrl: string;
    /** The plain `https://…/calendar.ics` URL: the address shown on a failed copy, and the one
     *  string the copy button ever touches. */
    icsUrl: string;
  }

  let { webcalUrl, googleCalendarUrl, outlookCalendarUrl, icsUrl }: Props = $props();

  /** The copy attempt's announcement, read by the live region below: empty until the reader
   *  presses the button, then the outcome. The button's own label never changes, so a reader
   *  partway through pressing it never watches the control they are on rename itself. Either
   *  outcome clears after two seconds, so a second attempt re-announces its own result. */
  let copyStatus = $state('');
  /** Whether the address fallback shows, set on a failed copy and cleared again the moment a
   *  copy succeeds. Independent of `copyStatus`'s two-second reset: a reader reading the address
   *  by hand needs it to stay put longer than an announcement does. */
  let copyFailed = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  async function copyFeedAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(icsUrl);
      copyStatus = 'Copied the feed address';
      copyFailed = false;
    } catch {
      copyStatus = 'Copy failed';
      copyFailed = true;
    }
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (copyStatus = ''), 2000);
  }

  // A pending reset would otherwise fire against a destroyed component (a reader who copies and
  // navigates away inside the two-second window).
  $effect(() => () => clearTimeout(copyTimeout));
</script>

<p class="ev-subscribe-line" role="group" aria-labelledby="ev-subscribe-label">
  <span class="ev-subscribe-lead" id="ev-subscribe-label">Add to your calendar:</span>
  <a href={webcalUrl}>Apple Calendar</a><span class="ev-sep" aria-hidden="true"> · </span>
  <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"
    >Google Calendar<span class="sr-only"> (opens in a new tab)</span></a
  ><span class="ev-sep" aria-hidden="true"> · </span>
  <a href={outlookCalendarUrl} target="_blank" rel="noopener noreferrer"
    >Outlook<span class="sr-only"> (opens in a new tab)</span></a
  ><span class="ev-sep" aria-hidden="true"> · </span>
  <button type="button" onclick={copyFeedAddress}>Copy feed address</button>
  {#if copyFailed}
    <input class="ev-subscribe-address" type="text" readonly value={icsUrl} aria-label="Calendar feed address" />
  {/if}
</p>
<!-- Present from first paint, not mounted on the first copy: a live region a browser inserts
     into the page at the moment its text changes is not reliably announced. -->
<span class="sr-only" role="status">{copyStatus}</span>

<style>
  /* Probe 7: the subscribe bar as one quiet line. Every value maps to a theme token. */
  .ev-subscribe-line {
    margin: var(--spacing-s) 0 0;
    font-size: var(--text-step--1);
    font-weight: 500;
    color: var(--color-muted);
  }
  .ev-subscribe-line a,
  .ev-subscribe-line button {
    font: inherit;
    color: var(--color-primary);
    background: none;
    border: 0;
    /* The controls stay quiet text, but padding-block alone (never padding-inline, which would
       widen the visible gaps between entries) lifts each one to a real touch target. */
    padding-block: var(--spacing-3xs);
    padding-inline: 0;
    cursor: pointer;
    text-decoration: none;
  }
  .ev-subscribe-line a:hover,
  .ev-subscribe-line button:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .ev-subscribe-line a:focus-visible,
  .ev-subscribe-line button:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .ev-sep {
    opacity: 0.6;
  }
  /* The failed-copy fallback: shown only then, so a reader whose clipboard permission is denied
     can still select the address by hand. */
  .ev-subscribe-address {
    display: inline-block;
    margin-left: var(--spacing-2xs);
    max-width: 100%;
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
