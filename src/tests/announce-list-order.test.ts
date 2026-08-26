// The Announce screen's list (Email + Announce pass, Task 9): the `publishedAt ?? date` ordering
// pure function, and the rendered chip pair plus count line. Kept in its own file (rather than
// folded into `announcements.test.ts`, which Task 1 owns) since neither touches the send action
// or the `announcements` table this file's sibling covers.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { orderByPublished } from '$theme/announce-stamps';
import type { AnnounceListRow } from '../routes/admin/club/announce/+page.server';
import Page from '../routes/admin/club/announce/+page.svelte';
import type { PageData } from '../routes/admin/club/announce/$types';

describe('orderByPublished', () => {
  it('sorts a backdated `date` with a newer `publishedAt` first', () => {
    const backdatedButRecentlyPublished = { id: 'reprint', date: '2020-01-01' };
    const genuinelyRecent = { id: 'fresh', date: '2026-01-01' };
    const stamps = new Map([['reprint', '2026-08-20T00:00:00Z']]);

    const ordered = orderByPublished([genuinelyRecent, backdatedButRecentlyPublished], stamps);

    expect(ordered.map((row) => row.id)).toEqual(['reprint', 'fresh']);
  });

  it('falls back to `date` for an unstamped entry', () => {
    const older = { id: 'older', date: '2020-01-01' };
    const newer = { id: 'newer', date: '2021-01-01' };

    const ordered = orderByPublished([older, newer], new Map());

    expect(ordered.map((row) => row.id)).toEqual(['newer', 'older']);
  });

  it('never raw-string-compares: a lexically-earlier `publishedAt` still beats a bare `date`', () => {
    // "2026-03-02" (bare date, civil UTC midnight) sorts AFTER "2026-02-05T23:00:00Z" (a full
    // instant) by epoch ms even though "2026-02" < "2026-03" lexically -- both compare correctly
    // here because the function never compares the raw strings.
    const stampedEarlierInTheDay = { id: 'stamped', date: '2020-01-01' };
    const bareDateOnly = { id: 'bare', date: '2026-03-02' };
    const stamps = new Map([['stamped', '2026-03-02T23:00:00Z']]);

    const ordered = orderByPublished([bareDateOnly, stampedEarlierInTheDay], stamps);

    expect(ordered.map((row) => row.id)).toEqual(['stamped', 'bare']);
  });
});

function data(posts: AnnounceListRow[]): PageData {
  return { shell: { public: true, siteName: 'ASC', theme: 'cairn-admin' }, posts, error: null };
}

const notAnnounced: AnnounceListRow = {
  id: 'post-1',
  title: 'Spring Regatta Recap',
  date: '2026-05-01',
  announced: null,
};

const announced: AnnounceListRow = {
  id: 'post-2',
  title: 'Membership Open for 2026',
  date: '2026-03-02',
  announced: { createdAt: '2026-03-03 14:00:00', emailCount: 12, discordChannel: 'fleet' },
};

describe('/admin/club/announce list: the chip pair', () => {
  it('renders the quiet "Announced" chip, inside its marker span, for an announced row', () => {
    const { body } = render(Page, { props: { data: data([announced]) } });
    expect(body).toContain('asc-admin-chip-quiet');
    expect(body).toMatch(/asc-admin-chip-quiet[\s\S]*?>Announced</);
  });

  it('renders the hairline-outline "Not announced" chip for a row with no announcement', () => {
    const { body } = render(Page, { props: { data: data([notAnnounced]) } });
    expect(body).toContain('asc-admin-chip-outline');
    expect(body).toMatch(/asc-admin-chip-outline[\s\S]*?>Not announced</);
  });

  it('keeps both the email count and the Discord channel as muted detail beside the chip', () => {
    const { body } = render(Page, { props: { data: data([announced]) } });
    expect(body).toContain('email to 12');
    expect(body).toContain('#Fleet');
  });
});

describe('/admin/club/announce list: the visible count line', () => {
  it('renders a role="status" count line inside OfficeList, above the table', () => {
    const { body } = render(Page, { props: { data: data([announced, notAnnounced]) } });
    const statusMatch = body.match(/<p[^>]*role="status"[^>]*aria-live="polite"[^>]*>\s*2 posts\s*<\/p>/);
    expect(statusMatch).not.toBeNull();
    expect(body.indexOf(statusMatch![0])).toBeLessThan(body.indexOf('<table'));
  });
});
