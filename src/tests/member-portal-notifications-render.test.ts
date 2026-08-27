// The Notifications section's own render assertions (Task 3): a static SSR render, matching
// `members-page-toolbar.test.ts`'s own `render`-from-`svelte/server` idiom, since neither claim
// below needs hydration or interaction.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../routes/(site)/my-account/profile/+page.svelte';
import type { PageData } from '../routes/(site)/my-account/profile/$types';

function data(clubEmailOptIn: boolean): PageData {
  return {
    member: { id: 'mem-1', householdId: 'hh-1', name: 'Scratch Member', email: 'member@example.com', archivedAt: null },
    csrf: 'token',
    profile: { email: 'member@example.com', phone: '+19075551234', birthdate: '1990-05-01', directoryVisibility: 'partial' },
    notifications: { clubEmailOptIn },
    boats: [],
    preview: { hasPositions: false, hasMemberships: false, boatCount: 0, hasAddress: false },
  };
}

function emailToggleMarkup(body: string): string {
  const match = body.match(/<input[^>]*name="clubEmailOptIn"[^>]*>/);
  if (!match) throw new Error('clubEmailOptIn input not found in rendered markup');
  return match[0];
}

describe('/my-account/profile Notifications section', () => {
  it('renders a Notifications section with one Email row', () => {
    const { body } = render(Page, { props: { data: data(false), form: null } });
    expect(body).toContain('Notifications');
    expect(body).toContain('Email');
    expect(body).toContain('go to the head of household');
  });

  it('renders the email toggle unchecked when club_email_opt_in is off', () => {
    const { body } = render(Page, { props: { data: data(false), form: null } });
    expect(emailToggleMarkup(body)).not.toMatch(/\bchecked\b/);
  });

  it('renders the email toggle checked when club_email_opt_in is on', () => {
    const { body } = render(Page, { props: { data: data(true), form: null } });
    expect(emailToggleMarkup(body)).toMatch(/\bchecked\b/);
  });
});
