<!--
@component
The Club section's Settings screen (Task 4): who holds an owner or admin seat, and how long a
waitlist offer stays open before it expires. Both are the kind of setting an owner touches
rarely, so one screen suits them better than two. Every write is owner-only (see the route's own
header comment); an admin still sees the roster and the current window, just not the forms to
change either, the same "sees the section, some actions still refuse" posture Signups already
uses for its own audit-gated writes.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData, ActionData } from './$types';
  import { CsrfField, OfficeList } from '@glw907/cairn-cms/components';
  import { SelectField, TextField } from '@glw907/cairn-cms/admin-fields';
  import { HEADER_CELL, formatCivilDate } from '$admin-club/lib/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let newRoleEmail = $state('');
  let newRole = $state('admin');
  // A one-time seed from the load's current value, not a live mirror (the post-submit re-render
  // would otherwise clobber whatever the owner just typed); `untrack` marks that deliberately, the
  // same idiom the engine's own settings screens use (CairnTidySettings.svelte).
  let offerWindowHours = $state(untrack(() => (data.offerWindowHours == null ? '' : String(data.offerWindowHours))));

  const subtitle = $derived(data.error ?? 'Club roles and the waitlist offer window.');
</script>

<OfficeList eyebrow="Club" title="Settings" {subtitle}>
  {#if form?.error}
    <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 text-sm font-medium text-error" role="alert">
      {form.error}
    </p>
  {/if}

  <div class="grid gap-8 p-6 lg:grid-cols-2">
    <section>
      <h2 class={HEADER_CELL}>Club roles</h2>
      <ul class="list mt-3">
        {#each data.roles as grant (grant.email + grant.role)}
          <li class="list-row items-center">
            <div class="list-col-grow">
              <span class="font-semibold">{grant.email}</span>
              <span class="badge badge-ghost badge-sm ml-2 font-medium">{grant.role === 'owner' ? 'Owner' : 'Admin'}</span>
              <p class="text-xs text-muted">
                Granted by {grant.grantedBy} &middot; {formatCivilDate(grant.grantedAt.slice(0, 10))}
              </p>
            </div>
            {#if data.isOwner}
              <form method="post" action="?/removeRole">
                <input type="hidden" name="email" value={grant.email} />
                <CsrfField />
                <button type="submit" class="btn btn-ghost btn-sm">Revoke</button>
              </form>
            {/if}
          </li>
        {:else}
          <li class="list-row">
            <p class="w-full py-4 text-center text-sm text-muted">No roles granted yet.</p>
          </li>
        {/each}
      </ul>

      {#if data.isOwner}
        <form method="post" action="?/setRole" class="mt-4 flex flex-wrap items-end gap-3">
          <TextField label="Email" name="email" type="email" bind:value={newRoleEmail} />
          <SelectField
            label="Role"
            name="role"
            bind:value={newRole}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'owner', label: 'Owner' },
            ]}
          />
          <CsrfField />
          <button type="submit" class="btn btn-sm">Grant</button>
        </form>
      {/if}
    </section>

    <section>
      <h2 class={HEADER_CELL}>Waitlist offer window</h2>
      <p class="mt-1 text-sm text-muted">
        How long a class waitlist offer stays open before it expires and the spot frees up.
      </p>
      {#if data.isOwner}
        <form method="post" action="?/updateOfferWindow" class="mt-3 flex flex-wrap items-end gap-3">
          <TextField label="Hours" name="offerWindowHours" bind:value={offerWindowHours} />
          <CsrfField />
          <button type="submit" class="btn btn-sm">Save</button>
        </form>
      {:else}
        <p class="mt-3 text-sm font-semibold">{data.offerWindowHours} hours</p>
      {/if}
    </section>
  </div>
</OfficeList>
