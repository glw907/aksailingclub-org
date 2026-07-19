<!-- @component
The public /committees "At a Glance" table, fed from live asc-club data (T6b, roles spec decision
6): officers (member_positions kind='officer') then each active committee's derived chair/co-chair
names, exactly what the hand-maintained markdown table published, so taking a chair or officer seat
updates the public page automatically. Mounted as a `committees-at-a-glance` island
(markdown/components.ts): with no JavaScript the static build() fallback (a pointer to the member
directory) shows instead, and while the read is in flight a quiet placeholder holds the space. An
empty or failed read renders the same directory pointer the fallback carries. Reads through
`getCommitteesAtAGlance` (committees-at-a-glance.remote.ts). -->
<script lang="ts">
  import { getCommitteesAtAGlance } from '$theme/committees-at-a-glance.remote';

  // No props: an index signature keeps this island assignable to IslandRegistry's
  // Component<Record<string, unknown>> signature, the same constraint the other island components
  // document.
  let {}: Record<string, unknown> = $props();
</script>

{#await getCommitteesAtAGlance()}
  <p class="cag-loading" aria-busy="true">Loading committee assignments…</p>
{:then data}
  {#if !data || (data.officers.length === 0 && data.committees.length === 0)}
    <p>
      See current committee chairs and officers in the
      <a href="/my-account/committees">member portal</a>.
    </p>
  {:else}
    <table class="cag-table">
      <thead>
        <tr><th scope="col">Role</th><th scope="col">Who</th></tr>
      </thead>
      <tbody>
        {#each data.officers as officer (officer.title)}
          <tr><th scope="row">{officer.title}</th><td>{officer.name}</td></tr>
        {/each}
        {#each data.committees as committee (committee.name)}
          <tr><th scope="row">{committee.name}</th><td>{committee.who || '—'}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
{:catch}
  <p>
    See current committee chairs and officers in the
    <a href="/my-account/committees">member portal</a>.
  </p>
{/await}

<style>
  .cag-loading {
    margin: 0;
    color: var(--color-muted);
  }
</style>
