// The Announce form's own channel-block composition (Email + Announce pass, Task 10): a static
// SSR render against a fixture `PageData`, the same `render` from `svelte/server` idiom
// `events-page.test.ts`/`toolkit-table.test.ts` already use for markup-shape assertions that need
// no hydration. `announce-actions.test.ts` covers the load and the send action; this file covers
// only what those server-side tests cannot reach: the client component's own two-block layout.
//
// The body string is split at the Discord checkbox's own `name` attribute, since the markup is
// structurally ordered (Summary block, then the Email block, then the Discord block): everything
// before that split is the Email block's own render, everything from it on is the Discord block's.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../routes/admin/club/announce/[id]/+page.svelte';
import type { PageData } from '../routes/admin/club/announce/[id]/$types';

const POST = {
  id: '2026-02-27-welcome-new-website',
  title: 'Welcome to the New Website',
  summary: 'Paragraph one.\n\nParagraph two.',
  url: 'https://dev.aksailingclub.org/posts/2026-02-27-welcome-new-website',
};

function fixtureData(overrides: Partial<PageData> = {}): PageData {
  return {
    post: POST,
    previous: null,
    error: null,
    channelOptions: [
      { value: 'leadership', label: 'Leadership', configured: false },
      { value: 'general', label: 'General', configured: true },
    ],
    defaultChannel: 'general',
    headroom: { quota: 200, sentToday: 0, remaining: 200 },
    audienceCount: 89,
    ...overrides,
  } as unknown as PageData;
}

describe('/admin/club/announce/[id] channel blocks', () => {
  it('renders both an email and a Discord block, each with its own enable control and its own preview', () => {
    const { body } = render(Page, { props: { data: fixtureData(), form: null } });
    const discordBlockStart = body.indexOf('name="notifyDiscord"');
    expect(discordBlockStart).toBeGreaterThan(-1);

    const emailBlock = body.slice(0, discordBlockStart);
    const discordBlock = body.slice(discordBlockStart);

    // Email block: its own enable control, its own subject field, and its own preview.
    expect(emailBlock).toContain('name="emailAll"');
    expect(emailBlock).toContain('name="subject"');
    expect(emailBlock).toContain('class="prose announce-preview');

    // Discord block: its own enable control, its own channel select, and its own preview.
    expect(discordBlock).toContain('name="discordChannel"');
    expect(discordBlock).toContain('class="announce-discord-preview');
  });

  it('renders both previews from the one message value', () => {
    const { body } = render(Page, { props: { data: fixtureData(), form: null } });
    // The summary's own first line is the source for both the email body render and the Discord
    // embed description: it appears in both halves of the split body, not just one.
    const discordBlockStart = body.indexOf('name="notifyDiscord"');
    expect(body.slice(0, discordBlockStart)).toContain('Paragraph one.');
    expect(body.slice(discordBlockStart)).toContain('Paragraph one.');
  });

  it('preserves the summary\'s own blank line in the Discord preview', () => {
    const { body } = render(Page, { props: { data: fixtureData(), form: null } });
    const discordBlockStart = body.indexOf('name="notifyDiscord"');
    const discordBlock = body.slice(discordBlockStart);
    expect(discordBlock).toContain('Paragraph one.\n\nParagraph two.');
  });

  it('relabels the email control for the household model, with the live audience count beside it', () => {
    const { body } = render(Page, { props: { data: fixtureData({ audienceCount: 89 }), form: null } });
    expect(body).toContain('Email current households');
    expect(body).toMatch(/89 recipients/);
  });

  it('renders "unknown" headroom without blocking when the read failed', () => {
    const { body } = render(Page, { props: { data: fixtureData({ headroom: null }), form: null } });
    expect(body).toContain('Daily send headroom is unknown.');
  });
});
