// The household desk roster row's own opt-in control (Email + Announce pass, Task 4): a static
// SSR render, matching `member-portal-notifications-render.test.ts`'s own `render`-from-
// `svelte/server` idiom, since neither claim below needs hydration or interaction.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../routes/admin/club/members/[id]/+page.svelte';
import type { PageData } from '../routes/admin/club/members/[id]/$types';
import type { HouseholdDesk } from '$admin-club/lib/households-store';
import type { HouseholdStanding } from '$member-auth/lib/standing';

const standing: HouseholdStanding = {
  status: 'current',
  lastSeason: 2026,
  tier: 'individual',
  pricePaid: 90,
  paidAt: '2026-01-15',
  formerAt: null,
  formerSource: null,
};

const desk: HouseholdDesk = {
  id: 'hh-1',
  name: 'Scratch Household',
  city: 'Anchorage',
  primaryMemberId: 'mem-1',
  roster: [
    {
      id: 'mem-1',
      name: 'Primary Member',
      email: 'primary@example.com',
      phone: null,
      birthdate: null,
      directoryVisibility: 'visible',
      archived: false,
      isPrimary: true,
    },
  ],
  memberships: [],
  assets: [],
};

function data(emailOptIns: Record<string, boolean>): PageData {
  return {
    shell: { public: true, siteName: 'ASC', theme: 'cairn-admin' },
    desk,
    timeline: [],
    standing,
    currentSeason: 2026,
    tierPrices: { individual: 90, family: 150, 'young-adult': 45 },
    emailOptIns,
    openAddMember: false,
    error: null,
  };
}

function optInButtonMarkup(body: string): string {
  const match = body.match(/<form method="post" action="\?\/setEmailOptIn">[\s\S]*?<\/form>/);
  if (!match) throw new Error('setEmailOptIn form not found in rendered markup');
  return match[0];
}

describe('household desk roster row: the club-email opt-in control', () => {
  it('renders "off" state when the member has not opted in', () => {
    const { body } = render(Page, { props: { data: data({ 'mem-1': false }), form: null } });
    const markup = optInButtonMarkup(body);
    expect(markup).toContain('Email: off');
    expect(markup).toMatch(/name="optedIn"\s+value="1"/);
  });

  it('renders "on" state when the member has opted in', () => {
    const { body } = render(Page, { props: { data: data({ 'mem-1': true }), form: null } });
    const markup = optInButtonMarkup(body);
    expect(markup).toContain('Email: on');
    expect(markup).toMatch(/name="optedIn"\s+value="0"/);
  });
});
