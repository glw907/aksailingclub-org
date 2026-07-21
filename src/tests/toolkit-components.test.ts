import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StatusChip, { STATUS_CHIP_DOT_CLASS } from '$admin-club/toolkit/StatusChip.svelte';
import Pagination, { computeItemRange, computePageWindow } from '$admin-club/toolkit/Pagination.svelte';

describe('StatusChip', () => {
  it('covers the full tone vocabulary with a matching status-dot class', () => {
    expect(STATUS_CHIP_DOT_CLASS).toEqual({
      neutral: 'status-neutral',
      info: 'status-info',
      success: 'status-success',
      warning: 'status-warning',
      danger: 'status-error',
    });
  });

  it('renders every tone as a badge carrying its status dot and label', () => {
    for (const [tone, dotClass] of Object.entries(STATUS_CHIP_DOT_CLASS)) {
      const { body } = render(StatusChip, { props: { tone: tone as never, label: 'Current' } });
      expect(body).toContain('class="badge');
      expect(body).toContain(dotClass);
      expect(body).toContain('Current');
    }
  });

  it('defaults to the sm size and switches to xs on request', () => {
    const sm = render(StatusChip, { props: { tone: 'neutral', label: 'Former' } });
    expect(sm.body).toContain('badge-sm');
    expect(sm.body).toContain('status-sm');

    const xs = render(StatusChip, { props: { tone: 'neutral', label: 'Former', size: 'xs' } });
    expect(xs.body).toContain('badge-xs');
    expect(xs.body).toContain('status-xs');
  });

  it('carries an optional legend into the tooltip and the accessible name, and omits both without one', () => {
    const withLegend = render(StatusChip, {
      props: { tone: 'warning', label: 'Overdue', legend: 'Full benefits continue for 30 days.' },
    });
    expect(withLegend.body).toContain('title="Full benefits continue for 30 days."');
    expect(withLegend.body).toContain('aria-label="Overdue: Full benefits continue for 30 days."');

    const withoutLegend = render(StatusChip, { props: { tone: 'warning', label: 'Overdue' } });
    expect(withoutLegend.body).not.toContain('title=');
    expect(withoutLegend.body).not.toContain('aria-label=');
  });
});

describe('computePageWindow', () => {
  it('returns every page when the count is small', () => {
    expect(computePageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns nothing for a zero or negative page count', () => {
    expect(computePageWindow(1, 0)).toEqual([]);
    expect(computePageWindow(1, -3)).toEqual([]);
  });

  it('windows down to first, last, and a run around the current page', () => {
    expect(computePageWindow(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });

  it('never puts an ellipsis where the run is already adjacent', () => {
    expect(computePageWindow(1, 20)).toEqual([1, 2, 'ellipsis', 20]);
    expect(computePageWindow(20, 20)).toEqual([1, 'ellipsis', 19, 20]);
  });

  it('clamps an out-of-range current page into the window instead of overflowing it', () => {
    expect(computePageWindow(999, 20)).toEqual([1, 'ellipsis', 19, 20]);
    expect(computePageWindow(0, 20)).toEqual([1, 2, 'ellipsis', 20]);
  });
});

describe('computeItemRange', () => {
  it('computes the first page of a range', () => {
    expect(computeItemRange(1, 20, 149)).toEqual({ first: 1, last: 20, total: 149 });
  });

  it('clamps the last page to the total, not a full page size', () => {
    expect(computeItemRange(8, 20, 149)).toEqual({ first: 141, last: 149, total: 149 });
  });

  it('reads null for a non-positive page size or total', () => {
    expect(computeItemRange(1, 0, 149)).toBeNull();
    expect(computeItemRange(1, 20, 0)).toBeNull();
  });

  it('reads null for a page past the last item (a stale page after the list shrank)', () => {
    expect(computeItemRange(99, 20, 149)).toBeNull();
  });
});

describe('Pagination', () => {
  it('renders the range line when totalItems and pageSize are both given', () => {
    const { body } = render(Pagination, {
      props: { page: 1, pageCount: 8, onPageChange: () => {}, totalItems: 149, pageSize: 20, itemLabel: { one: 'household', many: 'households' } },
    });
    expect(body).toContain('Showing 1');
    expect(body).toContain('149');
    expect(body).toContain('households');
  });

  it('uses the singular noun when the total is exactly one', () => {
    const { body } = render(Pagination, {
      props: { page: 1, pageCount: 1, onPageChange: () => {}, totalItems: 1, pageSize: 20, itemLabel: { one: 'household', many: 'households' } },
    });
    expect(body).toContain('of 1 household');
    expect(body).not.toContain('of 1 households');
  });

  it('omits the range line when totalItems is not given', () => {
    const { body } = render(Pagination, { props: { page: 1, pageCount: 8, onPageChange: () => {} } });
    expect(body).not.toContain('Showing');
  });

  it('renders no page nav at all for a single page', () => {
    const { body } = render(Pagination, { props: { page: 1, pageCount: 1, onPageChange: () => {} } });
    expect(body).not.toContain('join');
  });

  it('marks the current page with aria-current and disables Previous at the first page', () => {
    const { body } = render(Pagination, { props: { page: 1, pageCount: 5, onPageChange: () => {} } });
    expect(body).toContain('aria-current="page"');
    expect(body).toMatch(/disabled="[^>]*aria-label="Previous page"/);
  });

  it('disables Next at the last page', () => {
    const { body } = render(Pagination, { props: { page: 5, pageCount: 5, onPageChange: () => {} } });
    expect(body).toMatch(/disabled="[^>]*aria-label="Next page"/);
  });
});
