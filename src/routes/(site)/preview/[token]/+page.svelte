<!-- @component
The preview mount: the engine's `PreviewBanner` over the SAME article template the public route
renders (`$theme/components/ArticleView.svelte`). The permalink strip a preview needs
(`canonical`, `og:url`, `jsonLd.url`) happens inside cairn's `previewLoad`, so the template gets
the same data shape on both routes. The banner's expiry is formatted here in the site's own date
vocabulary (long month, like `$chassis/date.ts`) plus the hour in Alaska time, since a link that
dies at a specific hour should say so; the zone is fixed so the server and the browser render
the same string and hydration never mismatches. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { PreviewBanner } from '@glw907/cairn-cms/components';
  import ArticleView from '$theme/components/ArticleView.svelte';

  let { data }: { data: PageData } = $props();

  const EXPIRY_FORMAT = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Anchorage',
    timeZoneName: 'short',
  });

  function formatExpiry(iso: string): string {
    return EXPIRY_FORMAT.format(new Date(iso));
  }
</script>

<PreviewBanner preview={data.preview} {formatExpiry} />
<ArticleView {data} />
