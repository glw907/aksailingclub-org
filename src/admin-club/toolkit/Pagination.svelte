<!-- @component
The admin toolkit's page navigation (docs/2026-07-20-admin-toolkit-research-survey.md,
"Pagination" -- confirmed, tier C, `join` + `btn`, daisyUI's own idiom). General contract: `page`
and `pageCount` drive the nav on their own; `totalItems`/`pageSize` are optional and only add the
"Showing X-Y of N <items>" range line, so a consumer that already knows its own page count but not
a raw item total (or vice versa) still gets a working pager.

Every class below (`join`, `join-item`, `btn`, `btn-sm`, `btn-active`, `btn-disabled`) is in
cairn's admin CSS safelist or already compiles from cairn's own admin usage (verified against the
built `cairn-admin.css`, the same methodology StatusChip's own header comment explains); the
wrapper layout and range-line color live in this component's own scoped CSS for the same reason
StatusChip's do -- `/admin/**` routes load only the precompiled bundle, so an unverified Tailwind
utility string would silently fail to render there.

A page count beyond a handful windows down to first, last, and a run around the current page
(`computePageWindow`, exported from this file's module context so the windowing logic is unit
tested without mounting the component); a single page renders no nav at all, only the range line
if one applies.
-->
<script module lang="ts">
  /** One entry in a windowed page list: a real page number, or a gap marker between two runs. */
  export type PageWindowItem = number | 'ellipsis';

  /** The inclusive item range a page covers, plus the total it's drawn from. */
  export interface ItemRange {
    first: number;
    last: number;
    total: number;
  }

  /**
   * Reduce `1..pageCount` to a bounded set of page buttons: every page when `pageCount` is small
   * (7 or fewer), otherwise the first page, the last page, and a run of up to three pages around
   * `page`, with an `'ellipsis'` marker standing in for each skipped gap. `page` is clamped into
   * `[1, pageCount]` before windowing, so an out-of-range current page never produces an
   * out-of-range window entry. Returns `[]` for `pageCount <= 0`.
   */
  export function computePageWindow(page: number, pageCount: number): PageWindowItem[] {
    if (pageCount <= 0) return [];
    const current = Math.min(Math.max(page, 1), pageCount);
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

    const pages = new Set<number>([1, pageCount, current]);
    if (current - 1 >= 1) pages.add(current - 1);
    if (current + 1 <= pageCount) pages.add(current + 1);
    const sorted = [...pages].sort((a, b) => a - b);

    const result: PageWindowItem[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
      result.push(sorted[i]);
    }
    return result;
  }

  /**
   * The inclusive 1-based item range `page` covers at `pageSize`, clamped to `totalItems`.
   * Returns `null` for a non-positive `pageSize`/`totalItems`, or a `page` past the last item (a
   * stale page after the underlying list shrank), so the caller can render no range line rather
   * than a nonsensical one.
   */
  export function computeItemRange(page: number, pageSize: number, totalItems: number): ItemRange | null {
    if (pageSize <= 0 || totalItems <= 0) return null;
    const first = (Math.max(page, 1) - 1) * pageSize + 1;
    if (first > totalItems) return null;
    const last = Math.min(page * pageSize, totalItems);
    return { first, last, total: totalItems };
  }
</script>

<script lang="ts">
  import { itemNoun, type ItemLabel } from './format';

  interface Props {
    /** The current page, 1-based. */
    page: number;
    /** The total number of pages. */
    pageCount: number;
    /** Called with the target page number when a page or Previous/Next control is activated. */
    onPageChange: (page: number) => void;
    /** The underlying list's total item count. Omit to skip the range line. */
    totalItems?: number;
    /** Items per page. Required alongside `totalItems` to compute the range line. */
    pageSize?: number;
    /** The range line's noun in both grammatical numbers. Defaults to
     *  `{ one: 'item', many: 'items' }`. */
    itemLabel?: ItemLabel;
  }

  let {
    page,
    pageCount,
    onPageChange,
    totalItems,
    pageSize,
    itemLabel = { one: 'item', many: 'items' },
  }: Props = $props();

  const pageWindow = $derived(computePageWindow(page, pageCount));
  const range = $derived(
    totalItems != null && pageSize != null ? computeItemRange(page, pageSize, totalItems) : null,
  );
</script>

<div class="toolkit-pagination">
  {#if range}
    <p class="toolkit-pagination-range">
      Showing {range.first}&ndash;{range.last} of {range.total} {itemNoun(range.total, itemLabel)}
    </p>
  {/if}
  {#if pageCount > 1}
    <nav aria-label="Pagination" class="join">
      <button
        type="button"
        class="join-item btn btn-sm"
        disabled={page <= 1}
        aria-label="Previous page"
        onclick={() => onPageChange(page - 1)}
      >
        «
      </button>
      {#each pageWindow as item, i (i)}
        {#if item === 'ellipsis'}
          <span class="join-item btn btn-sm btn-disabled" aria-hidden="true">&hellip;</span>
        {:else}
          <button
            type="button"
            class="join-item btn btn-sm {item === page ? 'btn-active' : ''}"
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onclick={() => onPageChange(item)}
          >
            {item}
          </button>
        {/if}
      {/each}
      <button
        type="button"
        class="join-item btn btn-sm"
        disabled={page >= pageCount}
        aria-label="Next page"
        onclick={() => onPageChange(page + 1)}
      >
        »
      </button>
    </nav>
  {/if}
</div>

<style>
  .toolkit-pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .toolkit-pagination-range {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
  }
</style>
