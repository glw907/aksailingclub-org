<script lang="ts">
  import type { PageData } from './$types';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';

  let { data }: { data: PageData } = $props();

  const isPost = $derived(data.entry.concept === 'posts');
  // Bulletins are dated the same as posts (a bulletin's date is its whole point), but carry no
  // tags field of their own, so the date line is shared while the tags list below stays post-only.
  const showDate = $derived(isPost || data.entry.concept === 'bulletins');

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  /** Render an ISO `YYYY-MM-DD` date as "14 May 2026". */
  function formatDate(iso: string): string {
    return dateFmt.format(new Date(iso));
  }
</script>

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<article class="prose">
  {#if data.heroImage}
    <figure class="hero">
      <img src={data.heroImage.url} alt={data.heroImage.alt} />
      {#if data.heroImage.caption}
        <figcaption>{data.heroImage.caption}</figcaption>
      {/if}
    </figure>
  {/if}
  {#if showDate && data.entry.date}
    <p class="post-date">{formatDate(data.entry.date)}</p>
  {/if}
  <h1>{data.entry.title}</h1>
  {@html data.html}
  {#if isPost && data.entry.tags.length > 0}
    <ul class="post-tags" aria-label="Tags">
      {#each data.entry.tags as tag (tag)}
        <li>{tag}</li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .post-date {
    font-family: var(--font-display);
    font-size: var(--text-step--1);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-muted);
    margin: 0 0 var(--spacing-2xs);
  }
  .post-tags {
    list-style: none;
    padding: 0;
    margin: var(--spacing-l) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2xs);
  }
  .post-tags li {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-step--1);
    letter-spacing: 0.05em;
    color: var(--color-muted);
    padding: 0.2em 0.55em;
    border: var(--border) solid var(--color-card-border);
    border-radius: var(--radius-selector);
  }
</style>
