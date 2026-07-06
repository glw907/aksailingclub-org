<!-- @component The public chrome for ASC: an owned, token-driven header, main, and footer in a
     (site) route group. The group is URL-transparent, so these pages keep their paths, and the
     chrome never wraps /admin, which lives outside the group. Both stylesheets link by their
     ?url-resolved URL rather than a static import, so the editor's preview frame can link the
     same assets. -->
<script lang="ts">
  import themeCss from '$theme/theme.css?url';
  import siteCss from '$theme/site.css?url';
  import SiteHeader from '$theme/components/SiteHeader.svelte';
  import SiteFooter from '$theme/components/SiteFooter.svelte';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="stylesheet" href={themeCss} />
  <link rel="stylesheet" href={siteCss} />
</svelte:head>

<div class="flex min-h-dvh flex-col bg-base-100 font-body text-base-content">
  <a
    href="#main"
    class="skip-link absolute left-s top-[-3rem] z-50 rounded-field bg-primary px-[0.9rem] py-[0.5rem] font-semibold text-primary-content no-underline focus:top-s"
  >
    Skip to content
  </a>

  <SiteHeader />

  <!-- `tabindex="-1"` makes the skip-link target programmatically focusable (WCAG 2.4.1). The
       focus is programmatic, so the ring is suppressed below; real controls keep their
       `:focus-visible` rings. -->
  <main id="main" tabindex="-1" class="site-main flex-1">
    {@render children()}
  </main>

  <SiteFooter />
</div>

<style>
  main:focus {
    outline: none;
  }
</style>
