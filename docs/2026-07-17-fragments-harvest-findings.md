# Fragments harvest: findings for cairn's friction log

> **These entries are not filed yet.** They belong in
> `~/Projects/cairn-cms/docs/internal/docs-friction-log.md` under "Open findings", and this file
> is a staging copy, not their home. Filing was blocked at close: cairn-cms sits on a live
> session's `design/invisible-craft-polish` branch, so appending there would both race that
> session and land ASC's harvest inside another pass's branch. **Paste this block into the
> friction log once that branch merges, then delete this file.**
>
> Source: the ASC fragments migration, cairn 0.87.0's first consumer outside the showcase. The
> log was cleared 2026-07-16 and already carries the invisible-craft pass's own entries, so these
> append rather than open it. This block discharges the standing DX-harvest mandate for the
> fragments surface, developer seat only; the editor seat is outstanding and named below.
>
> Two entries are worth someone's attention sooner than the rest: an include renders its own
> source text to the page when `resolveFragment` is missing, and the changelog's promised build
> failure on a dangling include does not survive a common SvelteKit setting. Both ship green.

- **An include renders its own source text to the public page when `resolveFragment` is not
  forwarded** (developer; ASC fragments migration, 2026-07-17). The adoption recipe names the
  forward as one of four seams, and dropping it is a one-line omission with no signal anywhere:
  `check` (0/0), `test` (1333 passing), and `build` all stay green, and `cairn:manifest` even
  indexes the fragment correctly, which reads as proof the wiring is done. The consuming page
  then ships `::include{fragment="id"}` as literal body text to readers. The mechanism is that
  `remarkResolveIncludes` no-ops when the resolver is absent, so the unvisited leaf directive
  falls through to `remarkDirectiveStamp`, whose job is restoring an accidental prose colon
  ("4:00") to literal text — the include is indistinguishable from a typo at that point. A
  missing resolver is a wiring fault, not prose, and could refuse rather than round-trip.

- **The promised build failure on a dangling include does not survive
  `prerender.handleHttpError: 'warn'`** (developer; ASC fragments migration, 2026-07-17). The
  changelog promises "a build fails on [a dangling include], the same way it fails on a dangling
  `cairn:` link". Under that SvelteKit policy the fragment-not-found 500 is downgraded to a
  console warning indistinguishable from the site's pre-existing dead links, so
  `cairn:manifest && check && build` all report success while the consuming page 500s for real
  visitors. The policy is not exotic: ASC adopted it to tolerate dead links, and
  `cairnManifest`'s own header comment already cites it as the reason THAT check runs in
  `buildStart`, outside the prerender lifecycle. The include check has no such carve-out and
  could take the same one. Separately, the error that does print names the route and the
  fragment id but never the source markdown file or the include's line, bottoming out in
  compiled SSR internals.

- **Dropping the manifest glob blinds the admin while the public site serves the fragment
  happily** (developer; ASC fragments migration, 2026-07-17). The two globs are documented as one
  step ("glob its directory into `createSiteIndexes` and the manifest plugin"), which reads as
  one fact stated twice rather than two independently load-bearing seams. Omit the manifest one
  and `cairn:manifest` exits 0 silently, `check` and `build` stay green, and the delivery layer
  resolves and splices the fragment into production pages — while the committed manifest never
  learns it exists, so the picker cannot offer it and the Included-in list, rename-rewrite, and
  delete-refusal guards are all blind to it. The verification derives from the same glob config
  it is meant to check, so nothing can catch it. The mirror case (dropping the
  `createSiteIndexes` glob, P7) fails loudly and correctly: an SSR module-eval guard names the
  concept and lists the globs it did get.

- **0.87.0 re-derives every excerpt, and a consumer learns it from a red build** (developer; ASC
  fragments migration, 2026-07-17). `10619010` taught `toPlainText` to strip directive markers,
  which is right, but it silently changes the derived summary of any entry whose body contains a
  directive. A manifest committed under 0.86.x is therefore stale the instant the bump lands, and
  the build fails on it. The window's only `Consumers must:` line covers embedded routing, so the
  failure arrives unannounced and reads as unrelated content drift: ASC's adopting agent
  misdiagnosed it as pre-existing staleness and "verified" that with a `git stash`, which cannot
  show it, since a stash reverts source but never `node_modules`. One line ("regenerate your
  content manifest; derived excerpts changed") would have cost nothing. Worth noting the fix is
  real: two ASC pages carry no explicit `description` and had been shipping raw `:::contact-form`
  and `:::callout[...]` markup as their meta descriptions.

- **The `fragments` routing requirement is enforced far from where it is declared** (developer;
  ASC fragments migration, 2026-07-17). Omitting `routing: 'embedded'` on the reserved key, or
  setting `routing: 'page'`, leaves `check` fully green: `ConceptConfig.routing` is a flat union
  with no per-key narrowing, and `defineConcept` validates only the URL policy despite its own
  doc comment promising a bad declaration "fails at module load rather than at a defaulted
  render". `normalizeConcepts` does catch it, every time, with a clear and actionable message —
  but only at build. Either the type could narrow the reserved key or the doc comment could stop
  promising module-load validation it does not do.

- **The docs undersell the include boundary as "any post or page"** (developer; ASC fragments
  migration, 2026-07-17). Both the changelog and `reuse-content-across-entries.md` enumerate two
  concepts, but the real rule in `content-routes-core.js` is every concept except `fragments`
  itself. ASC's bulletins include a fragment exactly as posts and pages do, confirmed through
  manifest, gate, and a prerendered render. A developer reading the literal text would assume a
  third concept is unsupported or untested. Naming the true exclusion costs one word and buys the
  general rule.

- **Fragments cannot serve an inline fact** (developer; ASC fragments migration, 2026-07-17). An
  include is a block splice, so a fragment cannot land inside a table row or mid-sentence. ASC's
  survey found this decides real cases: the club's Discord channel vocabulary wants an inline
  include and gets none, and a `$300/season` mooring fee that lives in a fee-table row on one
  page and a facts block on another cannot converge on one source. Both stay duplicated, pinned
  by a site-side agreement test instead. Not a defect — the block rule is coherent — but the
  block-only nature is load-bearing for what fragments can and cannot deduplicate, and the docs
  leave a reader to infer it.

- **Confirmed as documented.** A fragment's computed permalink 404s and stays out of
  `sitemap.xml`, `feed.xml`, and `feed.json` (P6). 0.87.0's embedded-routing enforcement holds
  against a real embedded concept: ASC's `notifications` is absent from `site.all()`, misses
  `byPermalink`, reports `routable()` false, and is excluded from the sitemap, while its home
  banner still renders because it reads the concept's own index. The adoption recipe in
  `reuse-content-across-entries.md` read true against a real five-concept site with nothing
  needing adaptation or a second reading.

- **The editor seat is unprobed, not clean** (maintainer; ASC fragments migration, 2026-07-17).
  ASC deferred its eight editor probes rather than run them against 0.87.0, because the
  unreleased invisible-craft branch rebuilds the surfaces they target (the include chip, the fold
  pill, the preview boundary, the publish blast radius). They run when ASC moves to 0.88.0. Read
  the absence of editor findings here as "not yet looked", never as "nothing to find".
