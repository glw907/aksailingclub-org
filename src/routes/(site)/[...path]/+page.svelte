<script lang="ts">
  import type { PageData } from './$types';
  import { CairnHead } from '@glw907/cairn-cms/delivery/head';
  import { siteConfig } from '$theme/cairn.config';
  import { GOVERNANCE_SUBPAGE_SLUGS } from '$theme/redirects';

  let { data }: { data: PageData } = $props();

  const isPost = $derived(data.entry.concept === 'posts');
  // Bulletins are dated the same as posts (a bulletin's date is its whole point), but carry no
  // tags field of their own, so the date line is shared while the tags list below stays post-only.
  const showDate = $derived(isPost || data.entry.concept === 'bulletins');

  // The old site's governance subpages (bylaws, articles of incorporation, and the rest) each
  // carried a "back to Governance" link and a one-line subtitle under the title (completion-pass
  // manifest item 10); GOVERNANCE_SUBPAGE_SLUGS is derived from the same redirect map that already
  // knows which pages those are.
  const isGovernanceSubpage = $derived(
    data.entry.concept === 'pages' && GOVERNANCE_SUBPAGE_SLUGS.has(data.entry.slug),
  );
  const subtitle = $derived(data.entry.frontmatter.description as string | undefined);
  // The pages concept's own title-adjacent hero (Strand 3 of the presentation round, adapted from
  // the old education page's photo-beside-the-title device): a page's hero sits next to its own
  // title, not stacked full-width above it the way a post's hero (`.hero` below) already does.
  // Posts and bulletins keep that existing contained treatment untouched.
  const isPageHero = $derived(data.entry.concept === 'pages' && Boolean(data.heroImage));

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

  /** One heading captured from the rendered article, for the table of contents. rehype-slug (the
   *  render pipeline's default) gives every h2/h3 an id; this reads that id back off the
   *  already-rendered HTML string rather than re-parsing markdown, so it stays in lockstep with
   *  whatever the render pipeline emitted. Ported from the astropaper-theme's own reference
   *  implementation, the family pattern for this device. */
  interface TocItem {
    id: string;
    text: string;
    level: 2 | 3;
  }

  // Named HTML entities the render pipeline's stringify step can emit inside heading text (the
  // five XML-predefined entities, plus the non-breaking space markdown sometimes carries).
  const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

  /** Decode a numeric (`&#38;`/`&#x26;`) or named (`&amp;`) HTML entity back to its character.
   *  extractToc pulls heading text out of already-serialized HTML by stripping tags with a plain
   *  regex, which leaves any entity the stringifier wrote (rehype-stringify entity-encodes `&` in
   *  text nodes) undecoded; left alone, that raw markup lands in a Svelte text expression and
   *  prints literally ("Adult &amp; Teen Track") instead of the character it stands for. */
  function decodeEntities(text: string): string {
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
      if (body[0] === '#') {
        const codePoint = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
      }
      return body in NAMED_ENTITIES ? NAMED_ENTITIES[body] : match;
    });
  }

  function extractToc(html: string): TocItem[] {
    const items: TocItem[] = [];
    const headingRe = /<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
    for (const match of html.matchAll(headingRe)) {
      const level = Number(match[1]) as 2 | 3;
      const text = decodeEntities(match[3].replace(/<[^>]*>/g, '').trim());
      if (text) items.push({ level, id: match[2], text });
    }
    return items;
  }

  // The pitch/reference genre split (the design-polish pass, 2026-07-07): a page named here
  // renders everything ABOVE the given heading id as a plain, photography-paced flow (no panels,
  // no TOC, the persuasive pitch a prospective member reads start to finish), and scopes the
  // density-gated panel + sticky-TOC treatment below to everything from that heading on (the
  // reference material a reader navigates rather than reads straight through). Keyed by the
  // pages concept's own flat slug, the same key GOVERNANCE_SUBPAGE_SLUGS uses. A page not listed
  // here (every other long document, bylaws included) keeps the single-flow density-gated
  // template unchanged.
  const PITCH_SPLIT_HEADING_ID: Record<string, string> = {
    education: 'swim-test-capsize-drill-and-life-jackets',
  };

  /** Splits rendered HTML immediately before the heading carrying `headingId`: everything before
   *  that heading's own opening tag is `above`, that heading through the end of the document is
   *  `below`. Falls back to putting the WHOLE document in `below` (never in `above`) when the id
   *  is not found, so a content edit that renames or removes the split heading degrades to the
   *  old single-flow, fully-panelized template rather than silently dropping the tail of the
   *  page. */
  function splitAtHeadingId(html: string, headingId: string): { above: string; below: string } {
    const match = new RegExp(`<h[23] id="${headingId}"`).exec(html);
    if (!match) return { above: '', below: html };
    return { above: html.slice(0, match.index), below: html.slice(match.index) };
  }

  const pitchSplitId = $derived(
    data.entry.concept === 'pages' ? PITCH_SPLIT_HEADING_ID[data.entry.slug] : undefined,
  );

  // The craft sweep's band-alternation fix (2026-07-07): a handful of `pages`-concept docs are
  // long enough to read as one flat, monotonous white column (committees, members, visiting-the-
  // club) but are editorial/prose content rather than a lookup reference a visitor navigates
  // section by section, so the panel/TOC treatment below (built for bylaws-style reference
  // documents) is the wrong device for them — it wraps every short section in identical bordered
  // white cards, which is exactly the "cards mark objects, bands mark sections, nothing gets
  // both" violation A1 warns against. These three reuse the pitch mechanism whole-page (bandPitch
  // below, already proven on education's own pitch) instead: alternating full-bleed bands, no
  // TOC, no panels. A page not listed here keeps the ordinary density-gated template.
  const BAND_WHOLE_PAGE_SLUGS = new Set(['committees', 'members', 'visiting-the-club']);
  const bandWholePage = $derived(
    data.entry.concept === 'pages' && BAND_WHOLE_PAGE_SLUGS.has(data.entry.slug),
  );
  const pitchSplit = $derived(pitchSplitId ? splitAtHeadingId(data.html, pitchSplitId) : null);
  // On a split page, only the material below the split heading is subject to the density gate
  // and the panel/TOC treatment; on every other page `referenceHtml` is the whole document,
  // matching the template's pre-split behavior exactly.
  const referenceHtml = $derived(pitchSplit ? pitchSplit.below : data.html);
  const pitchHtml = $derived(pitchSplit ? pitchSplit.above : '');

  /** Wraps the pitch in alternating full-bleed bands, split at each top-level `<h2>` (the design-
   *  polish pass, 2026-07-07): a persuasive pitch this long (hero through the last registration
   *  card, on education) read as one uninterrupted white column with no section pacing at all
   *  (A1's band recipe: "bands mark sections"). The intro paragraph ahead of the first heading
   *  joins that first heading's own band rather than getting a sliver band of its own. `.prose`
   *  itself stays a plain reading column even on a split page (`site.css`'s "no bands on content
   *  pages" rule is unchanged for every non-pitch page); a `.pitch-band` breaks out of it the same
   *  way `site.css`'s `.cairn-place-full` already does for a full-bleed figure. */
  function bandPitch(html: string): string {
    const starts = [...html.matchAll(/<h2 id="[^"]+"[^>]*>/g)].map((match) => match.index);
    if (starts.length === 0) return html;
    const chunks = starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
    const preamble = html.slice(0, starts[0]);
    if (preamble.trim()) chunks[0] = preamble + chunks[0];
    return chunks
      .map((chunk, i) => `<div class="pitch-band ${i % 2 === 0 ? 'pitch-band-a' : 'pitch-band-b'}">${chunk}</div>`)
      .join('');
  }

  const pitchBandedHtml = $derived(bandPitch(pitchHtml));

  // A band-whole-page doc (committees, members, visiting-the-club) reuses bandPitch over its
  // entire body rather than just a pitch prefix: there is no reference-material tail to hand off
  // to, so the whole document bands.
  const bandWholePageHtml = $derived(bandWholePage ? bandPitch(data.html) : '');

  // Gated on a heading count, not a hardcoded slug list, so this generalizes to any page that
  // grows into a long reference document rather than special-casing bylaws and the new-member
  // guide by name (spec B1: "in-page TOCs on the longest pages"). Eight or more h2/h3 headings is
  // the density where a document reads as a reference to navigate rather than prose to read
  // straight through. Computed over `referenceHtml`, not the raw document, so a split page's TOC
  // both scopes to and covers the material it actually governs, complete rather than truncated.
  // `bandWholePage` opts out unconditionally: those docs get the band treatment above instead,
  // regardless of how many headings they carry (committees crosses the 8-heading gate on its
  // own). `toc` is forced empty for them, which already makes `showToc` false below with no
  // separate `bandWholePage` check needed.
  const toc = $derived(bandWholePage ? [] : extractToc(referenceHtml));
  const showToc = $derived(toc.length >= 8);
  // The section-panel treatment (the presentation round's Strand 2) is the pages concept's own
  // template device, not a general density-gated feature: a long post or bulletin still earns the
  // sticky gutter TOC below, but its body stays plain prose, unpanelled.
  const showPanels = $derived(showToc && data.entry.concept === 'pages');

  /** Splits rendered HTML at each top-level heading boundary: everything before the first such
   *  heading (the lede under the title) is the preamble, and each heading through the content up
   *  to (but excluding) the next one is one section. Splits on `<h2>` when the document has any;
   *  a document whose own sections are numbered one level deeper (the Mat-Su land agreement's
   *  "Section N" headings are all `###`, with no `##` at all) falls back to `<h3>`, so its
   *  sections still split into the panel/TOC grid instead of the whole document silently
   *  collapsing into one giant preamble ahead of an empty section list (the craft sweep's finding,
   *  2026-07-07: the TOC rendered only after the entire document, since nothing here ever split
   *  it out). Shares extractToc's assumption that a heading is always a top-level block in the
   *  render output, never nested inside another element. */
  function splitAtH2(html: string): { preamble: string; sections: string[] } {
    const level = /<h2 id="[^"]+"[^>]*>/.test(html) ? 2 : 3;
    const starts = [...html.matchAll(new RegExp(`<h${level} id="[^"]+"[^>]*>`, 'g'))].map(
      (match) => match.index,
    );
    if (starts.length === 0) return { preamble: html, sections: [] };
    const preamble = html.slice(0, starts[0]);
    const sections = starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
    return { preamble, sections };
  }

  /** Wraps one section's markup in the contained-panel shell (the site's border/radius/shadow
   *  surface family), and marks its own lede, the paragraph immediately after the heading, so it
   *  reads with a touch more weight than the paragraphs that follow it. Only the paragraph
   *  directly adjacent to the heading qualifies, not the first `<p>` anywhere in the section: a
   *  section that opens straight into a callout or a subheading, with no lede paragraph of its
   *  own, is left alone rather than mis-marking a paragraph buried deeper in the section. */
  function toPanel(sectionHtml: string): string {
    const withLede = sectionHtml.replace(/(<\/h2>\s*)<p>/, '$1<p class="panel-lede">');
    return `<section class="content-panel">${withLede}</section>`;
  }

  // Splits `referenceHtml`, not the raw document: on a split page that is already just the
  // material below the pitch/reference boundary, so `preambleHtml` (rare there, since the split
  // heading is itself an h2) and `sectionsHtml` only ever cover the reference material this
  // template panelizes.
  const split = $derived(showToc ? splitAtH2(referenceHtml) : null);
  const preambleHtml = $derived(split ? split.preamble : referenceHtml);
  const sectionsHtml = $derived(
    split ? split.sections.map((section) => (showPanels ? toPanel(section) : section)).join('') : '',
  );

  // The sticky gutter TOC's active-section highlight (Strand 2): an IntersectionObserver per
  // heading, biased toward the top of the viewport (a large negative bottom rootMargin), the
  // standard scrollspy technique, so "active" tracks whichever section is at the top of the
  // reading area rather than merely anywhere onscreen. No transition is declared on the highlight
  // style anywhere in this file's style block below, so there is nothing to gate behind
  // prefers-reduced-motion: the swap is already instant.
  let activeId: string | null = $state(null);
  const highlightedId = $derived(activeId ?? toc[0]?.id ?? null);

  $effect(() => {
    if (!showToc) return;
    const headings = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeId = entry.target.id;
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  });
</script>

{#snippet tocList(activeItemId: string | null)}
  <ul class="m-0 list-none p-0">
    {#each toc as item (item.id)}
      <li class={item.level === 3 ? 'ml-m' : ''}>
        <a href={`#${item.id}`} class={item.id === activeItemId ? 'toc-active' : ''}>{item.text}</a>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet titleBlock()}
  {#if showDate && data.entry.date}
    <p class="post-date">{formatDate(data.entry.date)}</p>
  {/if}
  <h1>{data.entry.title}</h1>
  {#if subtitle}
    <p class="page-subtitle not-prose">{subtitle}</p>
  {/if}
{/snippet}

<CairnHead seo={data.seo} titleTemplate={(title) => `${title} — ${siteConfig.siteName}`} />

<article class="prose">
  {#if isGovernanceSubpage}
    <a href="/governance/" class="not-prose back-link">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M19 12H5M11 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Governance
    </a>
  {/if}
  {#if isPageHero}
    <div class="page-title-hero not-prose">
      <div class="page-title-hero-text">
        {@render titleBlock()}
      </div>
      <figure class="page-title-hero-figure">
        <img src={data.heroImage?.url} alt={data.heroImage?.alt} />
      </figure>
    </div>
  {:else}
    {#if data.heroImage}
      <figure class="hero">
        <img src={data.heroImage.url} alt={data.heroImage.alt} />
        {#if data.heroImage.caption}
          <figcaption>{data.heroImage.caption}</figcaption>
        {/if}
      </figure>
    {/if}
    {@render titleBlock()}
  {/if}
  {#if bandWholePage}
    <!-- The craft sweep's band-whole-page treatment (2026-07-07): the entire body, banded into
         alternating full-bleed sections like the pitch above, with no TOC and no panel chrome
         (see BAND_WHOLE_PAGE_SLUGS's own comment for why these three docs opt out of the ordinary
         panel/TOC template). -->
    {@html bandWholePageHtml}
  {:else}
    {#if pitchSplitId}
      <!-- The pitch: everything above the split heading, banded into alternating sections (the
           design-polish pass, 2026-07-07) with no panels and no TOC. -->
      {@html pitchBandedHtml}
      <!-- The pitch-to-reference hand-off (the design-polish pass, 2026-07-07): the genre shift
           from persuasion prose to a boxed, navigable reference section was previously silent and
           abrupt (a finding against education, where the pitch ends mid-registration and the
           reference material starts at "Swim Test, Capsize Drill..."). A labeled divider announces
           the shift explicitly instead of leaving the reader to infer it from the narrower measure
           and the panel chrome alone. -->
      <div class="pitch-reference-divider not-prose">
        <span class="pitch-reference-label">Reference &amp; policies</span>
      </div>
    {/if}
    {#if showToc}
      <details class="toc mobile-toc">
        <summary>Table of contents</summary>
        <nav aria-label="Table of contents">
          {@render tocList(null)}
        </nav>
      </details>
    {/if}
    <!-- The lede/preamble sits in its own measure-capped wrapper (the craft sweep's fix,
         2026-07-07): a TOC page's `.prose` box widens past the plain reading measure to make room
         for the sticky gutter (the media query below and site.css's matching `.site-main` rule),
         and with no cap of its own the preamble's running prose stretched to that full wide box
         (up to ~58rem, well past a comfortable line length) while every section below it stayed
         narrow inside its own panel padding. A no-op on a page with no TOC, since `.prose` never
         widens there in the first place. -->
    <div class="prose-lede">
      {@html preambleHtml}
    </div>
    {#if showToc}
      <div class="article-toc-shell">
        <div class="article-sections">
          {@html sectionsHtml}
        </div>
        <aside class="page-toc-sticky">
          <p class="page-toc-heading">On this page</p>
          <nav aria-label="Table of contents">
            {@render tocList(highlightedId)}
          </nav>
        </aside>
      </div>
    {/if}
  {/if}
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

  /* The governance subpage "back to Governance" link (manifest item 10), restoring the live
     site's own secondary-page back-link. */
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: var(--spacing-s);
    color: var(--color-muted);
    text-decoration: none;
    font-size: var(--text-step--1);
  }
  .back-link:hover {
    color: var(--color-primary);
  }

  /* The subtitle line under the title (manifest item 10): a distinct, quieter line, not another
     prose paragraph. Capped to the plain reading measure (the craft sweep's fix, 2026-07-07): a
     direct `.prose` child with no max-width of its own, it ran the full wide TOC-gutter measure
     on a doc like ascca-bylaws or bylaws (`description` doubling as this line), the widest, most
     prominent line on the page and the one a reader reads as the lede. */
  .page-subtitle {
    max-width: var(--container-measure);
    margin: 0 0 var(--spacing-m);
    font-size: var(--text-step-0);
    color: var(--color-muted);
  }

  /* The pitch's section bands (the design-polish pass, 2026-07-07): each `.pitch-band` breaks out
     to the full viewport width the same way `site.css`'s `.cairn-place-full` already does for a
     figure (`left: 50%` plus a matching negative `transform`, which centers a 100vw box on the
     viewport regardless of this ancestor's own padding, as long as the ancestor itself is
     centered, which `.site-main` always is). The band's own vertical padding carries the section
     rhythm; adjacent bands touch directly, reading as one continuous strip whose background
     alternates at the seam, the same "no gap, color does the work" reading `bg-base-200`
     home-page sections without a border already use. Every selector reaching into this raw-HTML
     content is `:global()`, the same reason `.content-panel`'s own rules below are: Svelte's
     scoped-CSS hash never reaches an element `{@html}` injects. */
  .prose :global(.pitch-band) {
    width: 100vw;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    padding: var(--spacing-xl) var(--spacing-m);
  }
  .prose :global(.pitch-band-b) {
    background: var(--color-base-200);
  }
  /* Re-centers the band's own content to the plain reading measure and reapplies the owl-selector
     flow rhythm one level deeper than `.prose > * + *` reaches now that a band wraps each
     section: the same re-declaration `.content-panel`'s own rules use below, so a heading's
     `--flow-space` (prose.css) still governs the gap above it exactly as it did as a direct
     child. */
  .prose :global(.pitch-band > *) {
    max-width: var(--container-measure);
    margin-inline: auto;
  }
  /* A card grid re-centers to the WIDE measure, not the plain reading measure the rule above
     gives every other band child (a regression the round-2 review caught, 2026-07-07): the
     reading-measure cap starves `.asc-cards`' own `repeat(auto-fill, minmax(14rem, 1fr))`
     (asc-components.css) of the columns it needs, dropping a three-across card row to two with
     the third card orphaned onto its own line. `--container-measure-wide` matches what the
     card grid rendered at before the band wrapped it (this page always earns the wide prose
     measure, since it always carries a TOC), and the band itself is already a full-bleed strip,
     so a wider child here never overflows it. */
  .prose :global(.pitch-band > .asc-cards) {
    max-width: var(--container-measure-wide);
  }
  .prose :global(.pitch-band > * + *) {
    margin-top: var(--flow-space);
  }

  /* The pitch-to-reference hand-off: a labeled rule announcing the reference section starts here,
     rather than the reader inferring the genre shift from the narrower measure and panel chrome
     alone (the design-polish pass's finding, 2026-07-07). Sits in the plain reading column (no
     band of its own); the reference material past it stays exactly as before. */
  .pitch-reference-divider {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    margin-top: var(--spacing-l);
  }
  .pitch-reference-divider::before,
  .pitch-reference-divider::after {
    content: '';
    flex: 1 1 auto;
    height: var(--border);
    background: var(--color-card-border);
  }
  .pitch-reference-label {
    flex: 0 0 auto;
    font-family: var(--font-display);
    font-size: var(--text-step--1);
    font-weight: 700;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--color-muted);
  }

  /* Strand 3 (the presentation round): the pages concept's title-adjacent hero, adapted from the
     old education page's photo-beside-the-title device. `titleBlock` (h1 and the optional
     subtitle) nests one level deeper here than prose.css's own `.prose > h1` selector expects, so
     the two rules below restate that selector's declarations for this specific nesting rather than
     losing them; every other title-block rule (`.post-date`, `.page-subtitle`) is already its own
     class-scoped rule and needs no restating. */
  .page-title-hero {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-m);
  }
  .page-title-hero-text > h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-step-5);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
  }
  .page-title-hero-text > h1 + * {
    margin-top: var(--spacing-m);
  }
  .page-title-hero-figure {
    margin: 0;
  }
  .page-title-hero-figure img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-box);
  }
  @media (min-width: 48rem) {
    .page-title-hero {
      flex-direction: row;
      align-items: center;
    }
    .page-title-hero-text {
      flex: 1 1 auto;
      min-width: 0;
    }
    /* A percentage basis, not a fixed rem, so the split holds steady whether the row measures the
       plain reading column (44rem) or the wider one a long TOC page earns (58rem): the craft
       pass's fix (2026-07-07), replacing a fixed 20rem that read as a small photo pinned to the
       row's right edge on a wide page (education among them) with acres of near-empty title
       column beside it. 44% gives the photo real presence, matching the old education page's own
       photo-beside-the-title device, without letting it dominate a short one- or two-line title. */
    .page-title-hero-figure {
      flex: 0 0 44%;
    }
  }

  /* The table of contents disclosure: the same chevron-rotate gesture as the FAQ directive
     (prose.css), re-expressed locally since this is page-owned raw markup, not an engine
     directive's own class. Collapsed by default: a long legal document's TOC can run to dozens
     of entries, and a reader who wants it opts in rather than scrolling past it. */
  .toc {
    --flow-space: var(--spacing-s);
    border-bottom: var(--border) solid var(--color-card-border);
    padding-block: var(--spacing-2xs);
  }
  .toc summary {
    display: flex;
    align-items: center;
    gap: var(--spacing-2xs);
    cursor: pointer;
    font-weight: 650;
    color: var(--color-base-content);
    list-style: none;
  }
  .toc summary::-webkit-details-marker {
    display: none;
  }
  .toc summary::before {
    content: '\25B8';
    display: inline-block;
    transition: transform 0.15s ease;
  }
  .toc[open] summary::before {
    transform: rotate(90deg);
  }
  .toc nav {
    margin-top: var(--spacing-2xs);
  }
  .toc a {
    color: var(--color-primary);
  }
  @media (prefers-reduced-motion: reduce) {
    .toc summary::before {
      transition: none;
    }
  }

  /* Strand 2 (the 2026-07-07 presentation round): the section-panel + sticky-gutter-TOC device
     for a long reference page (education, racing, bylaws, and any other page the density gate
     above fires on), adapted from the old site's own parceled-panel-plus-sticky-TOC pattern
     rather than copied outright. `.content-panel`/`.panel-lede` are injected server-side, straight
     into the rendered HTML string, by toPanel() in the script block above, so Svelte's own
     scoped-CSS mechanism never sees them the way it sees everything else in this file's template:
     a plain scoped selector compiles to (for example) `.content-panel.svelte-xxxx`, which never
     matches an element `{@html}` injected with no such class. Every selector segment that reaches
     into that injected markup below is wrapped in `:global(...)`; the real template elements
     around it (`.article-toc-shell`, `.article-sections`, `.page-toc-sticky`) scope normally. */
  .article-toc-shell {
    --flow-space: var(--spacing-xl);
  }
  /* The preamble's own measure cap (the craft sweep, 2026-07-07): see the template comment above
     this element for why it exists. Capped independent of `.prose`'s own width, which the media
     query below widens only to make room for the sticky TOC gutter, not to stretch running prose
     text. The owl-selector flow rhythm is redeclared one level deeper than `.prose > * + *`
     reaches now that this wrapper sits between them, the same idiom `.content-panel` uses on
     itself further down. */
  .prose-lede {
    max-width: var(--container-measure);
  }
  .prose-lede > :global(* + *) {
    margin-top: var(--flow-space);
  }
  .article-sections {
    min-width: 0;
  }
  /* `.prose`'s own max-width (chassis/prose.css) caps the *whole* article at the plain reading
     measure; site.css's exception widens `.site-main` for this template, but the inner `.prose`
     cap would otherwise still pinch the grid below back down to that same narrower width, leaving
     the TOC gutter with nowhere to sit but a lot of empty space past it. Past 1200px, where the
     gutter is actually in play, let the prose box grow to match. */
  @media (min-width: 1200px) {
    .prose:has(> .article-toc-shell) {
      max-width: var(--container-measure-wide);
    }
  }
  .article-sections:has(:global(.content-panel)) {
    background: var(--color-base-200);
    border-radius: var(--radius-box);
    padding: var(--spacing-m);
  }
  .article-sections > :global(* + *) {
    margin-top: var(--spacing-xl);
  }
  .prose :global(.content-panel) {
    /* Redeclared here, the same owl-selector idiom `.toc` uses on itself just above: with no
       redeclaration this custom property inherits `.article-toc-shell`'s own `--spacing-xl`,
       matching the panel-to-panel gutter exactly and reading as one loose, undifferentiated gap
       from a heading straight through to its own lede (the panel-rhythm sweep's finding,
       2026-07-07). Half the gutter, per the site's own "large fixed inter-section rhythm, half
       within sections" spacing rule (docs/2026-07-06-asc-phase-1-design.md), binds a panel's
       heading to its own content while the panel-to-panel gap stays the more decisive break. */
    --flow-space: var(--spacing-m);
    background: var(--color-base-100);
    border: var(--border) solid var(--color-card-border);
    border-radius: var(--radius-box);
    box-shadow: var(--cairn-shadow);
    padding: var(--spacing-m);
  }
  .prose :global(.content-panel > * + *) {
    margin-top: var(--flow-space);
  }
  /* The lede treatment: font-weight alone (not a color or size change), the quieter of the two
     devices the plan offered, so a panel's opening line reads with a touch more presence without
     competing against the h2 immediately above it. */
  .prose :global(.content-panel .panel-lede) {
    font-weight: 450;
  }
  @media (min-width: 48rem) {
    .article-sections:has(:global(.content-panel)) {
      padding: var(--spacing-l);
    }
    .prose :global(.content-panel) {
      padding: var(--spacing-l);
    }
  }

  /* The mobile/tablet collapsible TOC (the pre-existing `.toc` recipe above) and the wide-viewport
     sticky gutter TOC render the same `tocList` snippet twice and toggle by breakpoint, rather
     than mounting and unmounting one or the other: both exist with no JavaScript at all, so a
     no-JS reader on a narrow viewport still gets the disclosure and a no-JS reader past 1200px
     still gets a plain (unhighlighted) sticky list. */
  .page-toc-sticky {
    display: none;
  }
  @media (min-width: 1200px) {
    .article-toc-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 14rem;
      gap: var(--spacing-l);
      align-items: start;
    }
    .mobile-toc {
      display: none;
    }
    .page-toc-sticky {
      display: block;
      position: sticky;
      /* Reuses site.css's own --header-clearance, the sticky header's height plus its padding, so
         a sticky-scrolled TOC clears the header the same way an in-page anchor jump already does. */
      top: var(--header-clearance);
      max-height: calc(100vh - var(--header-clearance) - var(--spacing-l));
      overflow-y: auto;
      border: var(--border) solid var(--color-card-border);
      border-radius: var(--radius-box);
      padding: var(--spacing-s) var(--spacing-m);
      /* A long reference doc's TOC (bylaws' 76 entries, mat-su's 35) runs well past this box's own
         max-height; overflow-y:auto already scrolls it, but a static view of the box otherwise
         gives no cue that more entries sit below the fold (the craft sweep's finding, 2026-07-07:
         a scrollable TOC read as truncated at the box's own edge, on platforms whose overlay
         scrollbar only paints on hover). Two devices: an always-rendered thin scrollbar (a no-op
         on a page short enough to need no scrolling), and the classic four-layer "scroll shadow"
         background below, which fades and shadows the trailing edge only while there is more list
         to scroll to (the two inner gradients repaint the background color over the shadow near
         each edge and scroll WITH the content via `local`; the two radial-gradient shadows stay
         fixed to the box's own edges via `scroll`, so the visible shadow is only whatever peeks
         out from under the repainted cover, i.e. nothing at the start/end of the list). */
      scrollbar-width: thin;
      scrollbar-color: var(--color-muted) transparent;
      background:
        linear-gradient(var(--color-base-100) 30%, transparent) top / 100% 2.5rem local no-repeat,
        linear-gradient(transparent, var(--color-base-100) 70%) bottom / 100% 2.5rem local no-repeat,
        radial-gradient(
            farthest-side at 50% 0,
            color-mix(in oklab, var(--color-base-content) 20%, transparent),
            transparent
          )
          top / 100% 0.75rem scroll no-repeat,
        radial-gradient(
            farthest-side at 50% 100%,
            color-mix(in oklab, var(--color-base-content) 20%, transparent),
            transparent
          )
          bottom / 100% 0.75rem scroll no-repeat,
        var(--color-base-100);
    }
  }
  .page-toc-heading {
    margin: 0 0 var(--spacing-2xs);
    padding-bottom: var(--spacing-2xs);
    border-bottom: var(--border) solid var(--color-card-border);
    font-family: var(--font-display);
    font-size: var(--text-step--1);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-muted);
  }
  /* site.css's own `.site-main .prose a:not(.asc-card-link)` rule (three classes, unlayered) sets
     every prose link to the primary link color; it out-specifies a plain `.page-toc-sticky nav a`
     (one class), so the quiet default state below needs the same three-class weight to actually
     win, not just declare a different value. `.site-main` belongs to the layout component, not
     this one, so it needs `:global()`; `.prose` is this component's own element and scopes as
     usual. */
  :global(.site-main) .prose .page-toc-sticky nav a {
    display: block;
    padding: 0.25rem 0;
    color: var(--color-base-content);
    text-decoration: none;
  }
  :global(.site-main) .prose .page-toc-sticky nav a:hover {
    color: var(--color-primary);
  }
  /* No transition on the active state: the highlight swap is already instant, so there is nothing
     to gate behind prefers-reduced-motion. */
  :global(.site-main) .prose .page-toc-sticky nav .toc-active {
    color: var(--color-primary);
    font-weight: 650;
  }
</style>
