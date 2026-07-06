<!-- @component The public news archive, grouped by year (see +page.server.ts's header comment for
     why this page exists). Plain content, not part of the north star's own design contract; it
     reads the same prose tokens as an article body without wrapping in `.prose`, since it is a
     list of links, not running text. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';

  let { data }: { data: PageData } = $props();

  const dateFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  function formatDate(iso: string): string {
    return dateFmt.format(new Date(iso));
  }
</script>

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<h1 class="m-0 font-display text-step-5 font-semibold leading-tight tracking-tight text-base-content">News</h1>

{#each data.years as [year, entries] (year)}
  <section class="mt-xl">
    <h2 class="m-0 border-b border-card-border pb-2xs font-display text-step-2 font-semibold text-base-content">
      {year}
    </h2>
    <ul class="mt-s flex flex-col gap-xs">
      {#each entries as post (post.id)}
        <li class="flex flex-wrap items-baseline gap-xs">
          <a href={post.permalink} class="font-semibold text-primary">{post.title}</a>
          {#if post.date}<time datetime={post.date} class="text-step--1 text-muted">{formatDate(post.date)}</time>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/each}
