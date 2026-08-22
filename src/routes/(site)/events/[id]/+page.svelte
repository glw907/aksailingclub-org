<!-- @component
The events-redesign pass (docs/2026-08-22-events-redesign-design.md): a thin link-preview stub.
A shared `/events/[id]` link unfurls with this page's own title, description, and noindex
robots tag (`CairnHead`, fed by `+page.server.ts`'s `seo`), then a zero-delay meta refresh sends
a real browser on to the event's own anchor on the season page; the visible link is the fallback
for a browser with refresh disabled. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';

  let { data }: { data: PageData } = $props();
</script>

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<svelte:head>
  <meta http-equiv="refresh" content="0; url={data.target}" />
</svelte:head>

<p><a href={data.target}>{data.title}</a></p>
