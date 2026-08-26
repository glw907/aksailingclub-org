# Email + Announce close round A (2026-08-26)

The consolidated pre-baseline fix list from the pass-end review gate (svelte,
daisyui-a11y, cloudflare-workers, web-auth-security) and the fresh-context coherence
read. Every item is prescribed; nothing here reopens a probe-ratified composition.
Items the conductor deferred instead are in
`docs/2026-08-25-email-announce-harvest-findings.md`.

## Task A: email screens (index, compose, template editor)

Files: `src/routes/admin/club/email/+page.svelte`,
`src/routes/admin/club/email/compose/+page.svelte`,
`src/routes/admin/club/email/[id]/+page.svelte`, plus a scoped stylesheet touch if a
shared list reset is cleaner per-page.

1. **Filter selects must not stack at 1440.** `.email-filter-controls` computes to
   234px so the two selects wrap into a column on a wide band (the coherence read's
   loudest tell). Constrain the selects (`w-auto`/`max-w` or a basis) so the intended
   inline row renders at 1440; verify by measurement, and confirm the band still wraps
   cleanly at 390.
2. **Unreset `ul` family.** The variable palette's badge list keeps the browser's
   default 40px `padding-inline-start` on compose AND the template editor, and the
   review step's empty recipient sample renders a browser-default list bullet
   ("• No recipients resolved…"). One list reset (padding 0, list-style none) on the
   affected lists resolves all three sightings. Measure the palette's left edge
   aligns with its heading after.
3. **"Send to 0 recipients" must be disabled.** The review step's terminal CTA is
   enabled at zero resolved recipients while the compose step disables Continue on
   empty fields; disable the send button when the count is 0.
4. **Markdown-subset helper.** One muted sentence under the Body (markdown) label
   naming what the minimal renderer supports (bold, paragraphs, horizontal rules;
   links render literally), so the faithful preview stops reading as a bug.
5. **Segment column label register.** The send log's Segment column renders raw keys
   (`current`, `lapsed`) beside the literal `Single`; map known keys to their display
   labels (the segment-label vocabulary Task 1 minted) with raw fallback.
6. **Count vocabulary.** Three counts on one screen must name different things:
   subtitle keeps "N log entries", the filter band's `computeCountLine` switches its
   noun to `send`/`sends` (it counts send attempts), the pager's `itemLabel` becomes
   `group`/`groups` (it pages folded display units). This resolves the two competing
   `role="status"` regions announcing contradictory totals.
7. **Incident toggle a11y.** Put the `▸`/`▾` glyphs in `<span aria-hidden="true">`;
   give the button an `aria-label` that identifies its incident (e.g. "Show 55 sends
   for <error summary>"); keep `aria-expanded`.
8. **Incident toggle reachable at 390.** The expand control sits past the right edge
   of the horizontally scrolling table on a phone. Make the toggle sticky within the
   scroll container (`position: sticky; right: 0` on the button or its wrapper, with
   an opaque ground so rows scroll under it), preserving the probe-ratified right
   placement. Measure at 390: the toggle must be visible without side-scrolling and
   `documentElement` scrollWidth must equal clientWidth.
9. **In-incident pager focus and announcement.** Swap `disabled` for
   `aria-disabled="true"` plus a handler guard on the Prev/Next ends (focus must not
   drop to `<body>`), and give the range line `role="status"` to match the toolkit
   `Pagination`'s contract.
10. **Filtered incident window.** When the template filter narrows an incident, the
    spread carries the unfiltered `firstSentAt`/`lastSentAt`; recompute both from the
    narrowed rows (the way `email-log-groups.ts`'s `buildIncident` does).
11. **Page reset without the one-frame empty flash.** Replace the `$effect` that
    resets `page`/`incidentPage` on filter change with a derived clamp
    (`safePage = $derived(Math.min(page, totalPages))` used for slicing and passed to
    `Pagination`); `incidentPage` already resets in `toggleIncident` and needs no
    effect.
12. **Switcher group name.** `role="group"` on the `div.join` carrying
    `aria-label="Email view"`.
13. **Confirm dialog name + warning wiring.** `aria-labelledby` pointing at the
    dialog's heading (the house idiom every sibling modal carries); drop the
    `role="alert"` on the over-quota sentence and tie it to the dialog with
    `aria-describedby`; prefix the sentence with "Warning:" so the emphasis is not
    font-weight alone.
14. **Compose step-transition focus.** On landing→edit, edit→review, and
    review→landing, move focus to the new step's heading (`tabindex="-1"` +
    `.focus()` in the transition handlers). Do not alter the six load-bearing
    behaviors.
15. **`svelte-ignore a11y_autofocus` justification.** One comment line at each of the
    two suppressions (compose confirm, template-editor reset confirm) saying the safe
    action in a modal takes focus deliberately.
16. **Member-row ground measurement.** `.email-member-row` introduces a third ground
    (`color-mix` of base-200 at 35%) that `scripts/verify-chip-registers.mjs` never
    measures; add that ground to the script's measured set for the warning chip. If
    the measurement fails the standard, adjust the ground tint minimally until it
    passes; report the numbers.
17. **Reset button chrome at 390.** The coherence read saw "Reset to default" render
    as bare bold text with no button chrome at 390 on the template editor; verify the
    button carries `.btn` chrome at 390 and fix its placement if it wraps out of its
    cluster.
18. **Row hover/focus parity.** The two new `hover:bg-base-200/60` row treatments
    (email index, announce list — announce belongs to Task B; fix the email one here)
    gain a `:focus-within` counterpart per the design-probe parity rule.

## Task B: announce screens, portal section, members desk, shared lib

Files: `src/routes/admin/club/announce/+page.svelte`,
`src/routes/admin/club/announce/[id]/+page.svelte`,
`src/routes/(site)/my-account/profile/+page.svelte` and its `+page.server.ts` (only
if a status payload tweak is needed), `src/routes/admin/club/members/[id]/+page.svelte`,
`src/admin-club/lib/ui.ts`, the two server files importing `itemNoun` from
admin-toolkit, `src/tests/announce-list-order.test.ts`, and
`src/theme/*.css` only if a scoped rule needs a shared home.

19. **Checkbox edge contrast (a11y blocker).** DaisyUI's unchecked `.checkbox`
    border measures ~1.5:1 light / ~1.75:1 dark against the 3:1 floor. Give the
    portal Notifications checkbox and the two announce-form checkboxes an explicit
    border color (via `--input-color` or a scoped rule; remember `@layer` cannot
    restyle daisy components — unlayered, dual selector for dark) that measures
    ≥3:1 against its resting ground in BOTH themes, verified by canvas readback
    against the BUILT css, numbers reported.
20. **Portal Notifications row must hold as a row (coherence ASSEMBLY verdict).**
    The helper sentence consumes the card width and the checkbox wraps to a naked
    control at the left margin even at 1440. Wrap the control in a visible `<label>`
    (fixing the aria-label-only naming, the missing `aria-describedby` link to the
    helper sentence, and the 20px target in one move — mirror the announce form's
    label-wrapped checkboxes), and constrain the text block (`flex-1` + `min-w-0` or
    a basis) so description-left/control-right survives at both widths. Keep the
    markup shaped so a second channel row is additive.
21. **Perceivable save confirmation (a11y blocker).** The Notifications save renders
    only the page-top banner, off-screen for this mid-page section and not a live
    region. Render an inline `role="status"` line inside the Notifications section
    from this action's own `form?.saved`/failure result. Keep `update({ reset:
    false })` and the CSRF field exactly as they are.
22. **Members-desk toggle naming.** The per-row "Email: on/off" button gains a
    per-row accessible name (`aria-label` including the member's name, the assets
    idiom) and `aria-pressed={emailOptIn}`.
23. **Roster action group wraps.** Add `flex-wrap` to the roster row's action group
    (six controls, ~430px, clips at 390); verify at 390.
24. **Channel casing and meta honesty.** Normalize the announce list's channel
    display to the `#general` lowercase form the form's banner uses; the Discord
    block's right meta must not assert "#general" while the select shows
    "General (not configured)" — render the meta from the resolved configured state
    ("not configured" when unconfigured).
25. **Preview legends.** The two `sr-only` fieldset legends both read "Preview";
    rename to "Email preview" and "Discord preview".
26. **Fieldset overflow check.** The two channel-block `<fieldset>`s keep the UA
    `min-inline-size: min-content`; check the announce form at 390 and add
    `min-inline-size: 0` if any inner scrollbar or overflow appears.
27. **Announce-list row focus parity.** The announce list's `hover:bg-base-200/60`
    gains its `:focus-within` counterpart (Task A item 18's sibling).
28. **`itemNoun` out of the server bundle.** Re-export `itemNoun` from
    `$admin-club/lib/ui` and switch the two `+page.server.ts` imports (announce/[id],
    compose) to it; no admin-toolkit import remains in server files.
29. **Pin the manifest seam.** One assertion in `announce-list-order.test.ts` (or a
    tiny sibling test) that `postPublishedAt` builds from the real committed manifest
    non-trivially (the map covers the manifest's post count), so a silently empty
    glob cannot leave a green suite around a dead feature.

## Acceptance, both tasks

`npm run check` 0/0; `npm test` exit 0; measurements reported with numbers (items 1,
2, 8, 16, 19, 23, 26); no probe-ratified composition altered (the incident row's
neutral ground and right-side toggle, the chip pair, the channel blocks, the subject
in the Email block); the six compose load-bearing behaviors untouched; no baseline
PNGs minted (any local Playwright use passes `--ignore-snapshots`; `git status
--porcelain e2e/` clean).
