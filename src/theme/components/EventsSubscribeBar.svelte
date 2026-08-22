<!-- @component
The season page's calendar-subscribe bar (docs/2026-08-22-events-redesign-design.md, "Calendar
subscription"): four entries in the page's existing quiet register, widened from the prior
two-link build. Apple Calendar and Google Calendar keep their already-shipped link mechanics
(a `webcal://` URL, and the same URL as Google's `cid` query param); Outlook is new
(`outlook.live.com`'s own add-from-web endpoint); the fourth entry is a "Copy feed address"
button for every other calendar app, since Thunderbird, Fastmail, Proton, and the phone apps all
just want a plain feed URL pasted in. All four read their glyph from the shared icon set
(`$theme/markdown/icons.ts`) rather than a hand-inlined SVG, per the events-redesign build's own
constraint. -->
<script lang="ts">
  import { ICON_PATHS } from '$theme/markdown/icons';

  interface Props {
    /** The `webcal://` feed URL, Apple Calendar's own link and the `cid`/`url` query param both
     *  Google and Outlook read (see the header comment: "feed URL" in the design doc's table
     *  means this already-webcal-formatted value, not the plain `https://` one below). */
    webcalUrl: string;
    googleCalendarUrl: string;
    outlookCalendarUrl: string;
    /** The plain `https://…/calendar.ics` URL, the one string the copy button ever touches. */
    icsUrl: string;
  }

  let { webcalUrl, googleCalendarUrl, outlookCalendarUrl, icsUrl }: Props = $props();

  /** The copy button's label state: `'idle'` by default, `'copied'` after a successful write, or
   *  `'failed'` when the clipboard call itself rejects (an insecure context, a denied permission).
   *  Either outcome resets to idle after two seconds, so a second attempt re-announces its own
   *  result. */
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  async function copyFeedAddress() {
    try {
      await navigator.clipboard.writeText(icsUrl);
      copyState = 'copied';
    } catch {
      copyState = 'failed';
    }
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (copyState = 'idle'), 2000);
  }
</script>

<div class="ev-subscribe">
  <span class="ev-subscribe-label">Add the season to your calendar</span>
  <div class="ev-subscribe-row">
    <a class="ev-subscribe-link" href={webcalUrl}>
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['calendar-dots']} /></svg>
      Apple Calendar
    </a>
    <a class="ev-subscribe-link" href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['arrows-clockwise']} /></svg>
      Google Calendar
    </a>
    <a class="ev-subscribe-link" href={outlookCalendarUrl} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS['envelope-simple']} /></svg>
      Outlook
    </a>
    <button class="ev-subscribe-link" type="button" onclick={copyFeedAddress}>
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={ICON_PATHS.copy} /></svg>
      {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy feed address'}
    </button>
  </div>
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
    gap: 0.15rem var(--spacing-m);
  }
  .ev-subscribe-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font: inherit;
    font-size: var(--text-step--1);
    font-weight: 500;
    color: var(--color-muted);
    text-decoration: none;
    background: none;
    border: 0;
    padding: 0;
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
</style>
