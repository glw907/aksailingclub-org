<!-- @component
ASC's public site footer: an owned, copy-in chrome component on the token layer. Task 1's
placeholder chrome; Task 3 replaces the look with the ratified navy-deep closing band per the
north star. It sits on `base-200` over a top hairline and carries the site name, a footer nav,
and a fine-print line. The inner content caps at `--container-measure`, matching the header and
the article/home reading column.
-->
<script lang="ts">
  import { siteConfig } from '$theme/cairn.config';

  /** A footer-nav entry: the visible label and the path it links to. */
  type NavItem = { label: string; href: string };

  /** The footer's nav targets. Task 3 replaces this with the site's real link set. */
  const nav: NavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'Feed', href: '/feed.xml' },
  ];
</script>

<footer class="site-footer mt-2xl border-t border-base-300 bg-base-200">
  <div class="mx-auto flex max-w-measure flex-wrap items-center justify-between gap-m px-m py-xl">
    <a href="/" class="inline-flex items-center gap-[0.55rem] text-muted no-underline">
      <svg class="h-[1.4rem] w-[1.4rem] text-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3 5 20h14Z" />
      </svg>
      <span class="font-display text-step-1 font-semibold tracking-tight">{siteConfig.siteName}</span>
    </a>

    <nav class="site-nav flex flex-wrap items-center gap-s text-step--1" aria-label="Footer">
      {#each nav as item (item.href)}
        <a href={item.href} class="inline-flex min-h-11 items-center text-muted no-underline hover:text-base-content">
          {item.label}
        </a>
      {/each}
    </nav>

    <p class="w-full border-t border-card-border pt-s text-step--1 text-muted">
      &copy; {new Date().getFullYear()} Alaska Sailing Club &middot; a 501(c)(3) nonprofit
    </p>
  </div>
</footer>

<style>
  .site-nav a {
    border-radius: 2px;
    transition: color 0.15s;
  }
  .site-nav a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .site-nav a {
      transition: none;
    }
  }
</style>
