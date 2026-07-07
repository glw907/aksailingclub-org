<!-- @component
/admin/club: the section's own landing — the needs-attention strip (design doc: "pending signup
reviews + asset requests + offers nearing expiry, each a count drilling through to its inbox").
Matches the Signups screen's own `stats` recipe (docs/internal/admin-design-system.md). -->
<script lang="ts">
  import type { PageData } from './$types';
  import { HEADER_CELL } from '$admin-club/lib/ui';

  let { data }: { data: PageData } = $props();

  const nothingPending = $derived(data.pendingSignups === 0 && data.pendingRequests === 0 && data.offersNearExpiry === 0);
</script>

<h1 class="m-0 text-2xl font-semibold text-base-content">Club</h1>
<p class="mt-1 text-sm text-muted">
  {nothingPending ? 'Nothing needs attention right now.' : 'A few things need a look.'}
</p>

<div class="stats stats-vertical lg:stats-horizontal mt-6 w-full rounded-box border border-[var(--cairn-card-border)] bg-base-100 shadow-[var(--cairn-shadow)]">
  <a href="/admin/club/signups" class="stat">
    <div class={HEADER_CELL}>Signup reviews</div>
    <div class="stat-value text-xl" class:text-warning={data.pendingSignups > 0}>{data.pendingSignups}</div>
    <div class="stat-desc">Pending background review</div>
  </a>
  <a href="/admin/club/asset-requests" class="stat">
    <div class={HEADER_CELL}>Asset requests</div>
    <div class="stat-value text-xl" class:text-warning={data.pendingRequests > 0}>{data.pendingRequests}</div>
    <div class="stat-desc">Awaiting a decision</div>
  </a>
  <div class="stat">
    <div class={HEADER_CELL}>Offers nearing expiry</div>
    <div class="stat-value text-xl" class:text-warning={data.offersNearExpiry > 0}>{data.offersNearExpiry}</div>
    <div class="stat-desc">Claim windows closing within 24 hours</div>
  </div>
</div>
