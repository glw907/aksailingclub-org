<!-- @component
The events-redesign pass (docs/2026-08-22-events-redesign-design.md): a thin link-preview stub.
A shared `/events/[id]` link unfurls with this page's own title, description, and noindex
robots tag (`CairnHead`, fed by `+page.server.ts`'s `seo`), then a zero-delay meta refresh sends
a real browser on to the event's own anchor on the season page; the visible link is the fallback
for a browser with refresh disabled. A client-side navigation into this route never triggers that
refresh, so the component bounces on mount as well. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';

  let { data }: { data: PageData } = $props();

  // The meta refresh below only fires on a full document load, so a client-side navigation into
  // this route (a link followed from elsewhere on the site) would otherwise strand the reader on
  // the stub. `replaceState` keeps the stub out of the history, so Back returns to where the
  // reader actually came from rather than bouncing them forward again.
  onMount(() => {
    goto(data.target, { replaceState: true });
  });
</script>

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<svelte:head>
  <meta http-equiv="refresh" content="0; url={data.target}" />
</svelte:head>

<p><a href={data.target}>{data.title}</a></p>
