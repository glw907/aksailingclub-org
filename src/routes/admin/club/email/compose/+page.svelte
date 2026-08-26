<!--
@component
The Compose screen (`/admin/club/email/compose`): a landing history list plus a compose-then-
review flow for a one-off segment email. Three steps live in one component rather than three
routes (there is nothing to deep-link to mid-draft): `landing` (past blasts, "New email"),
`compose` (segment picker, subject, body, a click-to-insert variable palette, a live sample-data
preview), and `review` (the server's own resolved recipient count and a sample roster, "Send test
to me", and a confirm dialog whose own button reads "Send to N recipients" -- the design's own
count-acknowledging gate). Every form here posts through this route's three actions and uses
`use:enhance` only to avoid a full-page reload between steps; the actions themselves are the real
gate; nothing here trusts a count this component computed on its own.

**Register sweep + headroom (Email + Announce pass, Task 7).** Dead classes replaced against the
precompiled `cairn-admin.css` (`w-fit`, `text-success`, `ml-1`, `max-w-none` all never compile),
the four status banners moved from an always-rendered-with-ternary-classes shape to plain
`{#if}` blocks (matching `email/[id]/+page.svelte`'s own idiom), the blast history table zebra-
striped with `EmptyState` for the zero-blast case, and the failed-count badge moved onto the
warning-tint chip register. The review step adds Task 2's advisory quota headroom line (quota,
sent today, remaining, or "unknown" when the read fails) and one muted line naming the
household-per-email rule; the confirm dialog adds a plain warning sentence when the resolved
recipient count exceeds the remaining headroom. Unknown headroom never blocks a send.
-->
<script module lang="ts">
  import { renderTemplateWithVariables, type RenderedTemplate } from '$admin-club/lib/club-email';
  import type { SubmitFunction } from '@sveltejs/kit';

  /** Sample values for the compose/review step's own live preview only -- never what a real send
   *  renders with (each recipient's own `sendSegmentBlast` call resolves `person_name` from that
   *  recipient, `portal_url`/`committee_email` from the send-time env, see `bulk-email.ts`).
   *  Module-level, not instance state, so `buildPreview` below is a plain function this repo's
   *  Vitest setup can call directly with no component instance (this repo's Vitest has no client
   *  `mount()`, `sveltekit-vite-forces-ssr-under-vitest` in agent memory). */
  const PREVIEW_SAMPLE_VARS = { person_name: 'Sample Member', portal_url: '/my-account', committee_email: 'membership-committee@aksailingclub.org' };

  /** The compose/review step's own sample-data render, the one call both steps' preview panes
   *  use. Exported so the wiring (subject/body through `renderTemplateWithVariables` with the
   *  fixed sample vars) is pinned by a direct unit test rather than resting on a mounted render
   *  this repo's Vitest setup cannot produce. */
  export function buildPreview(subject: string, body: string): RenderedTemplate {
    return renderTemplateWithVariables(subject, body, PREVIEW_SAMPLE_VARS);
  }

  /** Resolve the `?segment=` deep-link preset (`+page.server.ts`'s own `resolvePresetSegmentKey`)
   *  into this screen's initial `segmentKey` state, read once at mount through `untrack` below --
   *  a later navigation to a different `segment` param remounts this route from a different
   *  sidebar entry, it does not update this value in place. */
  export function resolveInitialSegmentKey(presetSegmentKey: string | null): string {
    return presetSegmentKey ?? '';
  }

  /** Splice `{{token}}` into `body` at the textarea's own cursor bounds, returning the new body
   *  and where the cursor should land after the insert. Pulled out of `insertVariable` so the
   *  splice math is directly testable with no textarea and no component instance. */
  export function spliceVariableToken(body: string, token: string, start: number, end: number): { body: string; cursor: number } {
    const snippet = `{{${token}}}`;
    return { body: body.slice(0, start) + snippet + body.slice(end), cursor: start + snippet.length };
  }

  /** Every plain form on this screen: refresh `data`/`form` from the server's own response (the
   *  same `update()` the household desk's dialogs call) without a full-page navigation.
   *  `reset: false` is load-bearing, not cosmetic: SvelteKit's default `update()` also resets the
   *  underlying native `<form>`, and Svelte 5's `bind:value` re-syncs an input back to its own
   *  `defaultValue` on a native reset. With the default `reset: true`, the compose form's own
   *  `bind:value`-d `segmentKey`/`subject`/`body` state would be wiped back to `''` the instant
   *  the `review` action's response settles -- the compose-to-review transition would silently
   *  clear the very draft it is supposed to carry into review, and the review step's hidden
   *  inputs would then post an empty draft to `?/send`. */
  export function onSettle(): SubmitFunction {
    return () => async ({ update }) => {
      await update({ reset: false });
    };
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import { EmptyState, FieldLabel, itemNoun, OfficeList, SelectInput, StatusChip, TextInput } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatClubTimestamp, formatHeadroomLine } from '$admin-club/lib/ui';
  import type { ComposeReviewResult, ComposeSendResult, ComposeTestResult } from './+page.server';
  // The register re-entry's shared chip stylesheet (assets-register Task 1): a per-page
  // side-effect import, this screen's own marker span below keys off it.
  import '$theme/admin-chip-registers.css';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const initialPreset = untrack(() => resolveInitialSegmentKey(data.presetSegmentKey));
  let step: 'landing' | 'compose' | 'review' = $state(initialPreset ? 'compose' : 'landing');
  let segmentKey = $state(initialPreset);
  let subject = $state('');
  let body = $state('');
  let bodyField: HTMLTextAreaElement | undefined = $state();
  let sendDialog: HTMLDialogElement | undefined = $state();

  let review: ComposeReviewResult | null = $state(null);
  let testStatus: ComposeTestResult | null = $state(null);
  let sendResult: ComposeSendResult | null = $state(null);

  const preview = $derived(buildPreview(subject, body));

  /** The review step's own "N recipient(s)" phrase, pluralized in one place for the four spots that
   *  render it (the step subtitle, the send button, and the confirm dialog's heading and button).
   *  Empty off the review step; only ever rendered inside the `step === 'review' && review` block. */
  const recipientCountLabel = $derived.by(() => {
    // The local read is load-bearing: `svelte-check` narrows a `$state` variable read directly
    // inside a `$derived` expression to `never`, so `review` has to land in a local first.
    const resolved = review;
    return resolved ? `${resolved.recipientCount} ${itemNoun(resolved.recipientCount, { one: 'recipient', many: 'recipients' })}` : '';
  });

  /** The account's advisory send-quota headroom (Task 2's `getEmailQuotaHeadroom`, read once at
   *  load): the line the review step shows, or "unknown" when the read failed or the token was
   *  never minted -- a supported, permanent state, never an error. */
  const headroomLine = $derived(formatHeadroomLine(data.headroom));

  /** Whether this send's resolved recipient count exceeds the remaining headroom. `null` headroom
   *  never trips this: unknown headroom reads as unknown and never blocks or warns (the 2026-07-14
   *  ruling stands -- there is no hard cap, the gate is a human seeing the number). */
  const overHeadroom = $derived.by(() => {
    const resolved = review;
    return resolved !== null && data.headroom !== null && resolved.recipientCount > data.headroom.remaining;
  });

  /** The compose step's own page-top banner: any `fail()` this route's actions return with no
   *  `kind` and no `stage: 'review'` tag (the `review` action's own field-validation failures,
   *  the only kind-less failure that can happen while still on the compose step). */
  const composeError = $derived(
    form && 'error' in form && !('kind' in form) && !('stage' in form && form.stage === 'review') ? form.error : null,
  );

  /** The review step's own inline banner, near its own actions: the `send` action's field-
   *  validation failures (`stage: 'review'`, see the server action), unified with the review
   *  step's existing `test`-send failure display rather than the page-top banner (item 9). */
  const sendError = $derived(form && 'error' in form && 'stage' in form && form.stage === 'review' ? form.error : null);

  // Every action's result routes here: `review` advances the step and seeds this screen's own
  // review state, `test` only ever updates the inline test-send status, `send` returns to the
  // landing list (whose blast history `update()`'s own `invalidateAll` just refreshed) and clears
  // the draft.
  $effect(() => {
    if (!form || !('kind' in form)) return;
    if (form.kind === 'review') {
      review = form;
      testStatus = null;
      step = 'review';
    } else if (form.kind === 'test') {
      testStatus = form;
    } else if (form.kind === 'sent') {
      sendResult = form;
      review = null;
      testStatus = null;
      segmentKey = '';
      subject = '';
      body = '';
      step = 'landing';
    }
  });

  function startCompose() {
    sendResult = null;
    step = 'compose';
  }

  /** Insert `{{token}}` at the body textarea's own cursor (the email template edit screen's own
   *  click-to-insert idiom, `email/[id]/+page.svelte`). */
  function insertVariable(token: string) {
    if (!bodyField) return;
    const start = bodyField.selectionStart ?? body.length;
    const end = bodyField.selectionEnd ?? body.length;
    const { body: nextBody, cursor } = spliceVariableToken(body, token, start, end);
    body = nextBody;
    queueMicrotask(() => bodyField?.setSelectionRange(cursor, cursor));
    bodyField.focus();
  }

  const VARIABLE_TOKENS = ['person_name', 'portal_url', 'committee_email'];

  /** The confirm dialog's own submit handler. Cannot use `method="dialog"`: `use:enhance`'s own
   *  dev-mode guard throws for any form whose `method` is not `"post"`. So this is an ordinary
   *  `method="post"` form and the dialog is closed explicitly here, at submit time, rather than
   *  relying on `method="dialog"`'s own implicit close -- there is no reason to keep the confirm
   *  modal open while the send itself is in flight. */
  function onSendSubmit(): SubmitFunction {
    return () => {
      sendDialog?.close();
      return async ({ update }) => {
        await update({ reset: false });
      };
    };
  }
</script>

<a href="/admin/club/email" class="mb-4 inline-flex items-center gap-1 type-body text-muted hover:text-primary">
  <span aria-hidden="true">&larr;</span> Back to Email
</a>

{#if composeError}
  <p class="mb-4 rounded-box border border-[var(--cairn-card-border)] px-4 py-3 type-body font-medium text-error" role="alert">
    {composeError}
  </p>
{/if}

{#if step === 'landing'}
  <OfficeList
    eyebrow="Club"
    title="Compose"
    subtitle={data.error ?? `${data.blasts.length} past ${itemNoun(data.blasts.length, { one: 'blast', many: 'blasts' })}.`}
  >
    {#snippet action()}
      <button type="button" class="btn btn-primary btn-sm" onclick={startCompose}>New email</button>
    {/snippet}

    {#if sendResult}
      <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-muted" role="status">
        Sent to {sendResult.segmentLabel}: {sendResult.sentCount} delivered{sendResult.failedCount > 0 ? `, ${sendResult.failedCount} failed` : ''}.
      </p>
    {/if}

    {#if data.blasts.length === 0}
      <EmptyState heading="No blasts yet" message="Every one-off segment email sent from this screen shows up here." />
    {:else}
      <table class="table compose-blasts-table">
        <caption class="sr-only">Past segment blasts, newest first</caption>
        <thead>
          <tr>
            <th class={HEADER_CELL}>Segment</th>
            <th class={HEADER_CELL}>Subject</th>
            <th class="{HEADER_CELL} w-32">Recipients</th>
            <th class="{HEADER_CELL} w-40">Actor</th>
            <th class="{HEADER_CELL} w-40">Sent</th>
          </tr>
        </thead>
        <tbody>
          {#each data.blasts as blast (blast.id)}
            <tr class="transition-colors hover:bg-base-200/60">
              <td class="type-body">{blast.segmentLabel}</td>
              <td class="type-body text-muted">{blast.subject}</td>
              <td class="type-body tabular-nums text-muted">
                <span class="inline-flex items-center gap-2">
                  <span>{blast.sentCount} / {blast.recipientCount}</span>
                  {#if blast.failedCount > 0}
                    <span class="asc-admin-chip-warning">
                      <StatusChip tone="warning" register="quiet" label={`${blast.failedCount} failed`} size="xs" />
                    </span>
                  {/if}
                </span>
              </td>
              <td class="type-body text-muted">{blast.actor}</td>
              <td class="whitespace-nowrap type-body tabular-nums text-muted">{formatClubTimestamp(blast.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </OfficeList>
{:else if step === 'compose'}
  <OfficeList eyebrow="Club" title="Compose" subtitle="Pick a segment, write the email, then review who it reaches.">
    <form method="post" action="?/review" use:enhance={onSettle()}>
      <div class="grid gap-section p-6 lg:grid-cols-2">
        <section class="flex flex-col gap-4">
          <SelectInput
            label="Segment"
            name="segmentKey"
            bind:value={segmentKey}
            options={data.segmentOptions.map((option) => ({ value: option.key, label: option.label }))}
          />
          <TextInput label="Subject" name="subject" bind:value={subject} />
          <FieldLabel label="Body (markdown)">
            <textarea bind:this={bodyField} class="textarea textarea-sm w-full font-mono" name="body" rows="12" bind:value={body}
            ></textarea>
          </FieldLabel>
          <div>
            <h2 class={HEADER_CELL}>Variables</h2>
            <p class="mt-1 type-meta text-muted">Click one to insert it into the body at your cursor.</p>
            <ul class="mt-2 flex list-none flex-wrap gap-2">
              {#each VARIABLE_TOKENS as token (token)}
                <li>
                  <button type="button" class="badge badge-outline font-mono" onclick={() => insertVariable(token)}>
                    {`{{${token}}}`}
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        </section>

        <section>
          <h2 class={HEADER_CELL}>Sample-data preview</h2>
          <p class="mt-1 type-meta text-muted">Rendered with placeholder values, through the same render a real send uses.</p>
          <p class="mt-2 type-body font-medium">{preview.subject}</p>
          <div class="prose compose-preview mt-2 rounded-box border border-[var(--cairn-card-border)] p-4 type-body">
            {@html preview.html}
          </div>
        </section>
      </div>

      <div class="flex justify-between gap-2 border-t border-[var(--cairn-card-border)] p-6">
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => (step = 'landing')}>Back</button>
        <div class="flex gap-2">
          <CsrfField />
          <button type="submit" class="btn btn-primary btn-sm" disabled={!segmentKey || !subject || !body.trim()}>
            Continue to review
          </button>
        </div>
      </div>
    </form>
  </OfficeList>
{:else if step === 'review' && review}
  <OfficeList eyebrow="Club" title="Review" subtitle="{review.segmentLabel}: {recipientCountLabel}.">
    {#if testStatus}
      <p
        class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium {testStatus.ok ? 'text-muted' : 'text-error'}"
        role="status"
      >{testStatus.ok ? `Test sent to ${data.editorEmail}.` : `Test failed: ${testStatus.error}`}</p>
    {/if}

    <div class="border-b border-[var(--cairn-card-border)] px-6 py-3">
      <p class="m-0 type-body text-muted">{headroomLine}</p>
      <p class="m-0 mt-1 type-body text-muted">
        A membership-wide send reaches one email per household: the head of household, plus anyone who has opted in.
      </p>
    </div>

    <div class="grid gap-section p-6 lg:grid-cols-2">
      <section>
        <h2 class={HEADER_CELL}>Sample of {review.sample.length} of {review.recipientCount} recipients</h2>
        <ul class="mt-2 flex flex-col gap-1 type-body">
          {#each review.sample as recipient (recipient.memberId)}
            <li>{recipient.personName} &lt;{recipient.email}&gt;</li>
          {:else}
            <li class="text-muted">No recipients resolved for this segment.</li>
          {/each}
        </ul>
      </section>

      <section>
        <h2 class={HEADER_CELL}>Rendered email</h2>
        <p class="mt-2 type-body font-medium">{preview.subject}</p>
        <div class="prose compose-preview mt-2 rounded-box border border-[var(--cairn-card-border)] p-4 type-body">
          {@html preview.html}
        </div>
      </section>
    </div>

    {#if sendError}
      <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">{sendError}</p>
    {/if}

    <div class="flex flex-wrap justify-between gap-2 border-t border-[var(--cairn-card-border)] p-6">
      <button type="button" class="btn btn-ghost btn-sm" onclick={() => (step = 'compose')}>Back</button>
      <div class="flex flex-wrap gap-2">
        <form method="post" action="?/test" use:enhance={onSettle()}>
          <CsrfField />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="body" value={body} />
          <button type="submit" class="btn btn-sm">Send test to me</button>
        </form>
        <button type="button" class="btn btn-primary btn-sm" onclick={() => sendDialog?.showModal()}>
          Send to {recipientCountLabel}
        </button>
      </div>
    </div>
  </OfficeList>

  <dialog bind:this={sendDialog} class="modal">
    <div class="modal-box">
      <h2 class="type-heading font-bold">Send to {recipientCountLabel}?</h2>
      <p class="py-2 type-body text-muted">{review.segmentLabel}. This cannot be undone.</p>
      {#if overHeadroom && data.headroom}
        <p class="py-2 type-body font-medium" role="alert">
          This send's {review.recipientCount} recipients would exceed today's remaining quota of {data.headroom.remaining}.
        </p>
      {/if}
      <form method="post" action="?/send" use:enhance={onSendSubmit()}>
        <CsrfField />
        <input type="hidden" name="segmentKey" value={review.segmentKey} />
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="body" value={body} />
        <input type="hidden" name="confirm" value="on" />
        <div class="modal-action">
          <!-- svelte-ignore a11y_autofocus -->
          <button type="button" class="btn" autofocus onclick={() => sendDialog?.close()}>Cancel</button>
          <button type="submit" class="btn btn-primary">
            Send to {recipientCountLabel}
          </button>
        </div>
      </form>
    </div>
  </dialog>
{/if}

<style>
  /* `/admin/**` renders against the precompiled `cairn-admin.css`; every rule below is either
     plain CSS (a custom-property color, a class this route's own markup uses with no compiled
     utility for it) or a class already verified compiled elsewhere in this route family
     (`email/+page.svelte`'s own header explains the constraint this file inherits). */

  .compose-blasts-table tbody tr:nth-child(even) {
    background-color: var(--color-base-200);
  }

  /* `max-w-none` never compiles into `cairn-admin.css` (no shipped admin component references
     it), so the prose preview's own max-width reset lives here instead. */
  .compose-preview {
    max-width: none;
  }

  /* Acknowledges a class from this site's own `admin-chip-registers.css` (a per-page side-effect
     import above), which `cairn-audit`'s `no-uncompiled-class` rule cannot see -- it only reads
     the packaged `cairn-admin.css`. The declaration mirrors that stylesheet's own base rule
     exactly, so it is a real rule with no risk of drifting from what actually renders. */
  .asc-admin-chip-warning {
    display: contents;
  }
</style>
