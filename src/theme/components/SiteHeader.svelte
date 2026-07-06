<!-- @component
ASC's public site header: an owned, copy-in chrome component on the token layer. This is Task
1's placeholder chrome (a sticky band over `base-100`, the primary nav driven from
`site.config.yaml`'s committed menu, and the light/dark toggle); Task 3 replaces the look with
the ratified "club grounds" chrome (the gold active-nav mark, the navy-deep footer) per the north
star. The nav reads `site.config.yaml`'s `primary` menu through `extractMenu`, so an editor's
nav edit in `/admin` takes effect with no code change. The current route's nav link gets
`aria-current="page"` and the accent colour.

The theme toggle sets `data-theme` on `<html>` between `asc` (light) and `asc-dark`, and persists
the choice to an `asc-site-theme` cookie (path `/`, a year) so it survives a reload; the inline
script in `app.html` reads that same cookie before first paint. With no stored choice,
`data-theme` stays unset and `theme.css`'s own `prefers-color-scheme` block follows the OS
setting, live, with no JS at all.
-->
<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { extractMenu } from '@glw907/cairn-cms';
  import { resolveTheme, toggleTheme as chassisToggleTheme, type ThemeToggleConfig } from '$chassis/theme-toggle.js';
  import { siteConfig } from '$theme/cairn.config';

  const nav = extractMenu(siteConfig, 'primary', 2);

  /**
   * Whether a nav item points at the page being viewed. The home link matches only the exact
   * root; a deeper link matches its own path or anything nested under it.
   */
  function isCurrent(href: string): boolean {
    const path = page.url.pathname;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(`${href}/`);
  }

  /** The two explicit theme choices; theme.css defines both as named DaisyUI themes. */
  type Theme = 'asc' | 'asc-dark';

  /** This theme's own names and cookie, fed to the chassis toggle mechanism below. */
  const themeConfig: ThemeToggleConfig<Theme> = { light: 'asc', dark: 'asc-dark', cookieName: 'asc-site-theme' };

  // The icon is correct on first paint even before any explicit choice exists (resolveTheme reads
  // `<html>`'s live data-theme, set by the head script, or falls back to the system scheme).
  // Never called during SSR (`browser` guards every call site).
  let theme = $state<Theme>(browser ? resolveTheme(themeConfig) : 'asc');

  /** Flips the explicit theme via the chassis mechanism, which also persists the choice. */
  function toggleTheme(): void {
    theme = chassisToggleTheme(themeConfig, theme);
  }
</script>

<header class="site-header sticky top-0 z-20 border-b border-card-border">
  <div class="mx-auto flex max-w-measure flex-wrap items-center justify-between gap-m px-m py-xs">
    <a href="/" class="inline-flex items-center gap-[0.55rem] text-base-content no-underline">
      <svg class="h-[1.55rem] w-[1.55rem] text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3 5 20h14Z" />
      </svg>
      <span class="whitespace-nowrap font-display text-step-1 font-semibold tracking-tight">
        {siteConfig.siteName}
      </span>
    </a>

    <div class="flex flex-wrap items-center gap-s">
      <nav class="site-nav flex flex-wrap items-center gap-s text-step--1" aria-label="Primary">
        {#each nav as item (item.url ?? item.label)}
          {@const current = item.url ? isCurrent(item.url) : false}
          <a
            href={item.url}
            aria-current={current ? 'page' : undefined}
            class="inline-flex min-h-11 items-center px-xs no-underline {current
              ? 'font-semibold text-primary'
              : 'font-medium text-muted hover:text-base-content'}"
          >
            {item.label}
          </a>
        {/each}
      </nav>

      <button
        type="button"
        onclick={toggleTheme}
        aria-label={theme === 'asc-dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        class="theme-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-muted hover:text-base-content"
      >
        {#if theme === 'asc-dark'}
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M3 12h2M19 12h2M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42" />
          </svg>
        {:else}
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.4 14.9A8.5 8.5 0 1 1 9.6 4.1a7 7 0 0 0 10.8 10.8z" />
          </svg>
        {/if}
      </button>
    </div>
  </div>
</header>

<style>
  .site-header {
    background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
  }
  .site-nav a {
    letter-spacing: 0.01em;
    border-radius: 2px;
    transition: color 0.15s;
  }
  .site-nav a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .theme-toggle {
    transition: color 0.15s;
  }
  .theme-toggle:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .site-nav a,
    .theme-toggle {
      transition: none;
    }
  }
</style>
