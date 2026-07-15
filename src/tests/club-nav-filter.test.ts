import { describe, expect, it } from 'vitest';
import type { Editor } from '@glw907/cairn-cms';
import type { ContentEvent, ResolvedLayoutNode } from '@glw907/cairn-cms/sveltekit';
import { fakeD1 } from './_fake-d1';
import { filterClubNav } from '$admin-club/lib/club-roles';

const clubSection: ResolvedLayoutNode = {
  label: 'Club',
  children: [{ label: 'Events', iconName: 'calendar', href: '/admin/club/events', ownerOnly: false }],
};
const otherEntry: ResolvedLayoutNode = { label: 'Widgets', iconName: 'wrench', href: '/admin/widgets', ownerOnly: false };
const ITEMS: ResolvedLayoutNode[] = [clubSection, otherEntry];

function eventWith(env: unknown): ContentEvent {
  return { url: new URL('https://x.dev/admin'), request: new Request('https://x.dev/admin'), locals: {}, platform: { env } } as unknown as ContentEvent;
}

const editor: Editor = { email: 'e@example.com', displayName: 'E', role: 'club-admin', capability: 'editor' };

describe('filterClubNav', () => {
  it('drops the Club section for an editor with no club role', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [] } });
    const filtered = await filterClubNav(ITEMS, { editor, event: eventWith({ CLUB_DB: db }) });
    expect(filtered).toEqual([otherEntry]);
  });

  it('keeps the Club section for an editor with a club role', async () => {
    const { db } = fakeD1({ allResults: { 'FROM club_roles': [{ role: 'club-admin' }] } });
    const filtered = await filterClubNav(ITEMS, { editor, event: eventWith({ CLUB_DB: db }) });
    expect(filtered).toEqual(ITEMS);
  });

  it('fails closed (drops Club) when CLUB_DB is not bound', async () => {
    const filtered = await filterClubNav(ITEMS, { editor, event: eventWith({}) });
    expect(filtered).toEqual([otherEntry]);
  });
});
