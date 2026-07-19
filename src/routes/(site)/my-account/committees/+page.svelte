<!-- @component
/my-account/committees (member-directory pass T6b, the Round 3 ratified composition): the club's
committees as quiet hairline sections in the portal register (no card chrome, contained reading
width, zero fireweed, zero gold). Every member sees each active committee's description, chair(s)
linked to the directory, and roster (a comma-flowed run of active members' names shown regardless
of directory_visibility; contact never appears here). The member affordance is Request to join (a
quiet navy outline button), its pending state, or Leave. Chairs and board members additionally see
management affordances in the chromeless text-action register (`.portal-text-action`): a chair sees
their committee's pending queue and roster-with-remove and an add-member control; a board member
sees those on every committee plus Change chair, New committee, Edit, and Archive. Every affordance
here is mirrored by a SERVER-SIDE guard in +page.server.ts; the template never enforces a predicate
on its own. -->
<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';
  import type { PortalCommittee } from '$member-portal/lib/committees';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  /** A chair name links to the directory prefiltered on that name (reachability lives in the
   *  directory, where the visibility dial is enforced in one place). */
  function directoryHref(name: string): string {
    return `/my-account/directory?q=${encodeURIComponent(name)}`;
  }

  /** The committee's own active members (chairs first, then roster), for the board's Change-chair
   *  picker: appointing a chair is a role update on an existing active membership. */
  function activeMembers(committee: PortalCommittee): { committeeMemberId: string; name: string }[] {
    return [
      ...committee.chairs.map((c) => ({ committeeMemberId: c.committeeMemberId, name: c.name })),
      ...committee.roster.map((r) => ({ committeeMemberId: r.committeeMemberId, name: r.name })),
    ];
  }
</script>

<svelte:head>
  <title>Committees — My Account — {siteConfig.siteName}</title>
</svelte:head>

<a href="/my-account" class="portal-back-link">&larr; My account</a>

<h1 class="portal-page-title">Committees</h1>
<p class="mt-s max-w-measure-wide text-step-0 text-muted">
  The club's committees. See who serves, ask to join, or manage the ones you lead.
</p>

{#if form && 'error' in form && form.error}
  <p class="mt-s max-w-measure-wide rounded-field border border-error bg-error/10 px-s py-xs text-step--1 text-error">{form.error}</p>
{/if}

{#if data.view.viewerIsBoard}
  <details class="portal-committee-page-manage">
    <summary class="portal-text-action portal-text-action-primary">+ New committee</summary>
    <form method="POST" action="?/createCommittee" class="portal-committee-form">
      <input type="hidden" name="csrf" value={data.csrf} />
      <fieldset class="fieldset">
        <legend class="fieldset-legend portal-field-label">Name</legend>
        <input class="input w-full" type="text" name="name" required />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend portal-field-label">Description</legend>
        <textarea class="textarea w-full" name="description"></textarea>
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend portal-field-label">Kind</legend>
        <select name="kind" class="select w-full">
          <option value="established">Established</option>
          <option value="standing">Standing</option>
        </select>
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend portal-field-label">Sort order</legend>
        <input class="input w-full" type="number" name="sortOrder" value="0" />
      </fieldset>
      <button type="submit" class="btn btn-primary self-start">Create committee</button>
    </form>
  </details>
{/if}

<div class="portal-committees">
  {#each data.view.committees as committee (committee.id)}
    <section class="portal-committee">
      <div class="portal-committee-headings">
        <h2 class="portal-committee-name">{committee.name}</h2>
        {#if committee.kind === 'standing'}
          <p class="portal-committee-standing">Standing committee</p>
        {/if}
      </div>

      <!-- Member affordance (top-right desktop / full-width mobile). Absent for a manager acting
           on a committee via the management chrome below; present per the viewer's own relation. -->
      <div class="portal-committee-action">
        {#if committee.viewerRelation.kind === 'member'}
          <p class="portal-committee-state"><span class="em">You're a member</span></p>
          <form method="POST" action="?/leave" class="portal-committee-state-sub">
            <input type="hidden" name="csrf" value={data.csrf} />
            <input type="hidden" name="committeeMemberId" value={committee.viewerRelation.committeeMemberId} />
            <button type="submit" class="portal-text-action">Leave</button>
          </form>
        {:else if committee.viewerRelation.kind === 'pending'}
          <p class="portal-committee-state">Request sent — awaiting chair approval</p>
          <form method="POST" action="?/cancelRequest" class="portal-committee-state-sub">
            <input type="hidden" name="csrf" value={data.csrf} />
            <input type="hidden" name="committeeMemberId" value={committee.viewerRelation.committeeMemberId} />
            <button type="submit" class="portal-text-action">Cancel request</button>
          </form>
        {:else if !committee.viewerCanManage}
          <form method="POST" action="?/request">
            <input type="hidden" name="csrf" value={data.csrf} />
            <input type="hidden" name="committeeId" value={committee.id} />
            <button type="submit" class="portal-committee-join">Request to join</button>
          </form>
        {/if}
      </div>

      {#if committee.description}
        <p class="portal-committee-desc">{committee.description}</p>
      {/if}

      <div class="portal-committee-chairs">
        {#if committee.chairs.length === 0}
          <p class="portal-committee-chairs-empty">No chair yet.</p>
        {:else}
          {#each committee.chairs as chair (chair.committeeMemberId)}
            <span class="row">
              <span class="role">{chair.role === 'chair' ? 'Chair' : 'Co-chair'}</span>
              <span class="dash">—</span>
              <a href={directoryHref(chair.name)}>{chair.name}</a>
            </span>
          {/each}
        {/if}
      </div>

      {#if committee.viewerCanManage}
        <!-- Pending queue (managers only) -->
        <div class="portal-committee-queue">
          <p class="portal-committee-queue-label">Requests{committee.pending.length > 0 ? ` · ${committee.pending.length}` : ''}</p>
          {#if committee.pending.length === 0}
            <p class="portal-committee-queue-empty">No pending requests.</p>
          {:else}
            <ul>
              {#each committee.pending as request (request.committeeMemberId)}
                <li>
                  <span class="qname">{request.name}</span>
                  <span class="qactions">
                    <form method="POST" action="?/approve">
                      <input type="hidden" name="csrf" value={data.csrf} />
                      <input type="hidden" name="committeeMemberId" value={request.committeeMemberId} />
                      <button type="submit" class="portal-text-action portal-text-action-primary">Approve</button>
                    </form>
                    <form method="POST" action="?/decline">
                      <input type="hidden" name="csrf" value={data.csrf} />
                      <input type="hidden" name="committeeMemberId" value={request.committeeMemberId} />
                      <button type="submit" class="portal-text-action">Decline</button>
                    </form>
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- Managed roster: stacked lines so each name carries a Remove target -->
        <div class="portal-committee-roster-manage">
          <span class="count">Members · {committee.roster.length}</span>
          {#if committee.roster.length === 0}
            <p class="portal-committee-roster-empty">No members yet.</p>
          {:else}
            <ul>
              {#each committee.roster as member (member.committeeMemberId)}
                <li>
                  <span>{member.name}</span>
                  <form method="POST" action="?/removeMember">
                    <input type="hidden" name="csrf" value={data.csrf} />
                    <input type="hidden" name="committeeMemberId" value={member.committeeMemberId} />
                    <button type="submit" class="portal-text-action">Remove</button>
                  </form>
                </li>
              {/each}
            </ul>
          {/if}
          <details class="portal-committee-add">
            <summary class="portal-text-action portal-text-action-primary">+ Add member</summary>
            <form method="POST" action="?/addMember" class="portal-committee-form">
              <input type="hidden" name="csrf" value={data.csrf} />
              <input type="hidden" name="committeeId" value={committee.id} />
              <fieldset class="fieldset">
                <legend class="fieldset-legend portal-field-label">Member</legend>
                <select name="memberId" class="select w-full" required>
                  <option value="" disabled selected>Choose a member…</option>
                  {#each data.memberOptions as option (option.memberId)}
                    <option value={option.memberId}>{option.name}</option>
                  {/each}
                </select>
              </fieldset>
              <button type="submit" class="btn btn-primary btn-sm self-start">Add member</button>
            </form>
          </details>
        </div>

        {#if data.view.viewerIsBoard}
          <div class="portal-committee-board">
            <details class="portal-committee-appoint">
              <summary class="portal-text-action">Change chair / co-chair</summary>
              <form method="POST" action="?/setRole" class="portal-committee-form">
                <input type="hidden" name="csrf" value={data.csrf} />
                <fieldset class="fieldset">
                  <legend class="fieldset-legend portal-field-label">Member</legend>
                  <select name="committeeMemberId" class="select w-full" required>
                    <option value="" disabled selected>Choose a member…</option>
                    {#each activeMembers(committee) as active (active.committeeMemberId)}
                      <option value={active.committeeMemberId}>{active.name}</option>
                    {/each}
                  </select>
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend portal-field-label">Role</legend>
                  <select name="role" class="select w-full">
                    <option value="chair">Chair</option>
                    <option value="co-chair">Co-chair</option>
                    <option value="member">Member</option>
                  </select>
                </fieldset>
                <button type="submit" class="btn btn-primary btn-sm self-start">Update role</button>
              </form>
            </details>

            <details class="portal-committee-edit">
              <summary class="portal-text-action">Edit</summary>
              <form method="POST" action="?/editCommittee" class="portal-committee-form">
                <input type="hidden" name="csrf" value={data.csrf} />
                <input type="hidden" name="committeeId" value={committee.id} />
                <fieldset class="fieldset">
                  <legend class="fieldset-legend portal-field-label">Name</legend>
                  <input class="input w-full" type="text" name="name" value={committee.name} required />
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend portal-field-label">Description</legend>
                  <textarea class="textarea w-full" name="description">{committee.description ?? ''}</textarea>
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend portal-field-label">Kind</legend>
                  <select name="kind" class="select w-full">
                    <option value="established" selected={committee.kind === 'established'}>Established</option>
                    <option value="standing" selected={committee.kind === 'standing'}>Standing</option>
                  </select>
                </fieldset>
                <button type="submit" class="btn btn-primary btn-sm self-start">Save changes</button>
              </form>
            </details>

            <form method="POST" action="?/archiveCommittee" class="portal-committee-archive">
              <input type="hidden" name="csrf" value={data.csrf} />
              <input type="hidden" name="committeeId" value={committee.id} />
              <button type="submit" class="portal-text-action">Archive</button>
            </form>
          </div>
        {/if}
      {:else}
        <!-- Read roster: comma-flow run + a quiet count -->
        {#if committee.roster.length === 0}
          <p class="portal-committee-roster portal-committee-roster-empty">No members yet.</p>
        {:else}
          <p class="portal-committee-roster">
            <span class="count">Members · {committee.roster.length}</span>{committee.roster.map((m) => m.name).join(', ')}
          </p>
        {/if}
      {/if}
    </section>
  {/each}
</div>
