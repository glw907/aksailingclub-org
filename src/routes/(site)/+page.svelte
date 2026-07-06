<!-- @component ASC's Task-1 placeholder home: a plain post listing, standing in until Task 3
     builds the north-star composition. -->
<script lang="ts">
  import type { PageData } from './$types';
  import { siteConfig } from '$theme/cairn.config';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{siteConfig.siteName}</title>
</svelte:head>

<h1 class="m-0 font-display text-step-5 font-semibold leading-tight tracking-tight">
  {siteConfig.siteName}
</h1>

{#if data.posts.length > 0}
  <ul class="mt-l flex flex-col gap-s">
    {#each data.posts as post (post.id)}
      <li>
        <a href={post.permalink} class="font-semibold text-primary">{post.title}</a>
        {#if post.date}<time datetime={post.date} class="ml-xs text-step--1 text-muted">{post.date}</time>{/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="mt-l text-muted">No posts yet.</p>
{/if}
