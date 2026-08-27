<!--
@component
The Announce form: pick which channels a published post's own summary reaches. "Summary" is the
one field every channel shares -- pre-populated, editable text, never a placeholder
(`data.post.summary`, `deriveAnnouncementSummary`'s own priority: an explicit author `description`
frontmatter verbatim, else a sentence-aware trim of the whole flattened body); the value shown IS
what sends unless the author edits it. Each channel then renders that same summary in its own
shape, never the identical text in two boxes (Geoff's own correction, 2026-07-08): "Subject" is
email-only (defaults to the post's title), and the Discord preview shows the summary truncated to
a tight embed description. Two small, independently readable preview panes prove that split
rather than asserting it.

**Channel blocks (Email + Announce pass, Task 10, probe C's ratified composition).** The shared
Summary block sits on top; below it, one structurally parallel block per channel, each carrying
its own enable control, its own channel-specific fields, and its own preview -- a third channel
(SMS) joins as another block with no rework, which is the point. The subject field moved inside
the Email block (probe verdict 5, it is email-only); the Email block also carries the audience
line (the household model's live recipient count) and Task 2's advisory quota headroom line. The
Discord preview gets a real accent border and preserved newlines (a real embed description can
carry the author's own blank lines) via the two scoped classes below, since neither Tailwind class
that used to name them compiles against the precompiled admin stylesheet.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { ActionData, PageData } from './$types';
  import { CsrfField } from '@glw907/cairn-cms/components';
  import { FieldLabel, itemNoun, OfficeList, TextInput } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatClubTimestamp, formatHeadroomLine } from '$admin-club/lib/ui';
  import { buildAnnouncementEmailContent } from '$admin-club/lib/announcements';
  import { renderTemplatePreviewHtml } from '$admin-club/lib/club-email';
  import { buildStoryNotice, truncateForEmbed } from '$admin-club/lib/discord';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // A one-time seed from the load's own current post, not a live mirror (the `untrack` idiom
  // `classes/[id]/+page.svelte` and `email/[id]/+page.svelte` both already establish): a
  // post-submit re-render must not clobber whatever the editor just typed. Re-derived fresh on
  // every visit to this route (a new post id re-runs this seed, see the `{#key}` below), never
  // carried over from a prior post.
  let subject = $state(untrack(() => data.post?.title ?? ''));
  let message = $state(untrack(() => data.post?.summary ?? ''));
  let emailAll = $state(true);
  let notifyDiscordOn = $state(false);
  let discordChannel = $state(untrack(() => data.defaultChannel));

  const emailPreview = $derived(
    data.post ? renderTemplatePreviewHtml(buildAnnouncementEmailContent({ subject, message, url: data.post.url }).body) : '',
  );
  const discordPreview = $derived(
    data.post ? buildStoryNotice({ channel: discordChannel, title: data.post.title, message, url: data.post.url }) : null,
  );

  /** The Email block's own audience line: the live household-model recipient count the load
   *  resolved (`data.audienceCount`, the same `currentMemberEmails` read the `send` action itself
   *  resolves again from scratch before actually sending), spelling out the household rule so
   *  "current households" in the checkbox label above reads as more than a relabel. */
  const audienceLine = $derived(
    `${data.audienceCount} ${itemNoun(data.audienceCount, { one: 'recipient', many: 'recipients' })}: one per household, the head of household plus anyone who has opted in.`,
  );

  /** The account's advisory send-quota headroom (Task 2's `getEmailQuotaHeadroom`, read once at
   *  load), the same wording Compose's own review step uses: "unknown" is a supported, permanent
   *  state, never an error, and this line never blocks a send. */
  const headroomLine = $derived(formatHeadroomLine(data.headroom));

  /** The Discord block's own right-side meta (close round item 24): whether the currently
   *  selected `discordChannel` actually has a webhook configured, read from the same
   *  `data.channelOptions` the `<select>` itself renders "(not configured)" from -- so the meta
   *  line can never assert a bare "#general" while the picker shows "General (not configured)"
   *  right beside it. */
  const selectedChannelConfigured = $derived(data.channelOptions.find((option) => option.value === discordChannel)?.configured ?? false);
</script>

<a href="/admin/club/announce" class="mb-4 inline-flex items-center gap-1 type-body text-muted hover:text-primary">
  <span aria-hidden="true">&larr;</span> Back to Announce
</a>

{#if !data.post}
  <div class="rounded-box border border-[var(--cairn-card-border)] bg-base-100 p-6 py-10 text-center shadow-[var(--cairn-shadow)]">
    <p class="type-body text-muted">{data.error ?? 'No such published post.'}</p>
  </div>
{:else}
  <!-- Keyed on the post's own id, the same reasoning `classes/[id]/+page.svelte`'s own comment
       documents: without it, navigating between two posts on this same dynamic route reuses the
       component instance and the seeded `$state` above never re-runs. -->
  {#key data.post.id}
    <OfficeList eyebrow="Club" title={data.post.title} subtitle="Announce this post by email and/or Discord.">
      {#if form?.error}
        <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">
          {form.error}
        </p>
      {/if}
      {#if form && 'ok' in form && form.ok}
        <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-muted" role="status">
          Sent: {form.emailCount} member email{form.emailCount === 1 ? '' : 's'}{form.discordChannel ? `, Discord #${form.discordChannel}` : ''}.
        </p>
      {/if}
      {#if data.previous}
        <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium" role="status">
          Already announced {formatClubTimestamp(data.previous.createdAt)}
          ({data.previous.emailCount > 0 ? `email to ${data.previous.emailCount}` : 'no email'}{data.previous.discordChannel
            ? `, #${data.previous.discordChannel}`
            : ''}). Sending again notifies members and/or Discord a second time.
        </p>
      {/if}

      <form method="post" action="?/send">
        <div class="border-b border-[var(--cairn-card-border)] p-6">
          <FieldLabel label="Summary">
            <textarea class="textarea textarea-sm w-full" name="message" rows="6" bind:value={message}></textarea>
          </FieldLabel>
          <p class="mt-2 type-meta text-muted">
            Shared by every channel: the email body leads with this, and Discord shows a short version of it.
          </p>
        </div>

        <fieldset class="border-b border-[var(--cairn-card-border)] p-6">
          <legend class="sr-only">Email</legend>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="flex items-center gap-2 type-body font-semibold">
              <input type="checkbox" class="checkbox checkbox-sm" name="emailAll" bind:checked={emailAll} />
              Email current households
            </label>
            <span class="type-body text-muted">{audienceLine}</span>
          </div>
          <div class="mt-4 grid gap-section lg:grid-cols-2">
            <div class="flex flex-col gap-3">
              <TextInput label="Subject" name="subject" bind:value={subject} />
              <p class="m-0 type-meta text-muted">{headroomLine}</p>
            </div>
            <div>
              <h2 class={HEADER_CELL}>Email preview</h2>
              <p class="mt-2 type-body font-medium">{subject}</p>
              <div class="prose announce-preview mt-2 rounded-box border border-[var(--cairn-card-border)] p-4 type-body">
                {@html emailPreview}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset class="border-b border-[var(--cairn-card-border)] p-6">
          <legend class="sr-only">Discord</legend>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="flex items-center gap-2 type-body font-semibold">
              <input type="checkbox" class="checkbox checkbox-sm" name="notifyDiscord" bind:checked={notifyDiscordOn} />
              Discord
            </label>
            <span class="type-body text-muted">{selectedChannelConfigured ? `#${discordChannel}` : `#${discordChannel} (not configured)`}</span>
          </div>
          <div class="mt-4 grid gap-section lg:grid-cols-2">
            <div class="flex flex-col gap-3">
              <FieldLabel label="Channel">
                <select class="select select-sm" name="discordChannel" bind:value={discordChannel} disabled={!notifyDiscordOn}>
                  {#each data.channelOptions as option (option.value)}
                    <option value={option.value} disabled={!option.configured}>
                      {option.label}{option.configured ? '' : ' (not configured)'}
                    </option>
                  {/each}
                </select>
              </FieldLabel>
            </div>
            <div>
              <h2 class={HEADER_CELL}>Discord preview</h2>
              {#if discordPreview}
                <div class="announce-discord-preview mt-2 rounded-box bg-base-200/60 p-4 type-body">
                  <a class="font-semibold text-primary hover:underline" href={discordPreview.url} target="_blank" rel="noreferrer">
                    {discordPreview.title}
                  </a>
                  <p class="announce-discord-preview-text mt-1 type-body">{discordPreview.description}</p>
                  {#if message.trim().length > 0 && truncateForEmbed(message) !== message.trim()}
                    <p class="mt-2 type-meta text-muted">Truncated for Discord's embed limit.</p>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </fieldset>

        <div class="flex justify-end gap-2 p-6">
          <CsrfField />
          <button type="submit" class="btn btn-primary btn-sm">Send</button>
        </div>
      </form>
    </OfficeList>
  {/key}
{/if}

<style>
  /* `/admin/**` renders against the precompiled `cairn-admin.css`; every rule below covers a
     class that never compiles there (verified against
     `node_modules/@glw907/cairn-cms/dist/components/cairn-admin.css`), the same constraint
     `compose/+page.svelte`'s own header documents. */

  /* `max-w-none` never compiles (no shipped admin component references it): the prose email
     preview's own max-width reset lives here instead. */
  .announce-preview {
    max-width: none;
  }

  /* `border-l-4`/`border-primary` never compile: the Discord embed preview's own 4px accent
     border, the probe's own ratified composition, lives here as plain CSS instead. */
  .announce-discord-preview {
    border-left: 4px solid var(--color-primary);
  }

  /* `whitespace-pre-line` never compiles: a real Discord embed description can carry the blank
     lines the author actually typed in the shared Summary field, so this preview must preserve
     them rather than collapsing them the way ordinary flowed text would. */
  .announce-discord-preview-text {
    white-space: pre-line;
  }

  /* Checkbox edge contrast (close round item 19, a11y blocker). DaisyUI's `.checkbox` border
     color defaults to `--input-color`'s own fallback, `color-mix(in oklab, var(--color-base-
     content) 20%, transparent)`, which measures well under the 3:1 non-text floor against the
     card ground in both themes. `--color-primary` here is the admin shell's own established
     primary accent (the packaged `cairn-admin`/`cairn-admin-dark` themes' own purple, distinct
     from this site's public navy -- `--color-primary` is already theme-adjusted per
     `[data-theme]`, so the same rule text picks up the right value in each shell), and one rule
     -- unwrapped, like every other override in this block, since daisyUI's own utilities compile
     inside a Tailwind `@layer` a component's plain scoped style always outranks -- covers both
     themes with no dual selector needed.

     Canvas readback against the BUILT css (a synthetic page loading the real compiled
     `cairn-admin.css`, an unchecked `.checkbox checkbox-sm` against `--color-base-100`, sampled
     a few device px inside the 1px stroke at 4x device scale to avoid anti-aliased edge blending
     -- WCAG relative-luminance contrast): `cairn-admin` (light) 5.82:1, `cairn-admin-dark`
     5.43:1. The public site's own identical fix (`site.css`) measured 9.72:1 / 7.55:1. All four
     clear the 3:1 floor by a wide margin. */
  .checkbox {
    border-color: var(--color-primary);
  }
</style>
