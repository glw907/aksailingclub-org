<!-- @component
ASC's public site footer: the club-grounds "closing band" (Task 3), matching the north star's own
`<footer>` (flag-navy-deep ground, footer-ink text, a translucent top hairline) exactly, replacing
Task 1's placeholder base-200 band. The same fixed navy-deep ground the home page's own closing CTA
section uses; both read `--color-neutral`/`--color-neutral-content` directly rather than through a
shared component, since they are two independent templates (the footer chrome, the home page's own
markup) that happen to want the same brand device. "News" has no public archive page yet (Task 2's
migration finding: cairn's site resolver has no concept-level index route), so it points at the
home page's own News & Updates band instead of a dead link. -->
<script lang="ts">
  import { siteConfig } from '$theme/cairn.config';

  /** A footer-nav entry: the visible label and the path it links to. */
  type NavItem = { label: string; href: string };

  const nav: NavItem[] = [
    { label: 'Join', href: '/join/' },
    { label: 'Events', href: '/events/' },
    { label: 'News', href: '/#news' },
    { label: 'Governance', href: '/governance/' },
    { label: '♥ Donate', href: '/donate/' },
  ];
</script>

<footer class="site-footer border-t border-white/10 bg-flag-navy-deep py-l">
  <div class="mx-auto flex max-w-measure flex-wrap items-center justify-between gap-s px-m text-step--1 text-footer-ink">
    <span>&copy; {new Date().getFullYear()} {siteConfig.siteName} &middot; a 501(c)(3) nonprofit</span>
    <nav class="flex flex-wrap items-center gap-m" aria-label="Footer">
      {#each nav as item (item.href)}
        <a href={item.href} class="footer-link">{item.label}</a>
      {/each}
    </nav>
  </div>
</footer>

<style>
  .footer-link {
    color: var(--color-footer-ink);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .footer-link:hover {
    color: var(--color-footer-ink-strong);
  }
  .footer-link:focus-visible {
    outline: 2px solid var(--color-footer-ink-strong);
    outline-offset: 2px;
    border-radius: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .footer-link {
      transition: none;
    }
  }
</style>
