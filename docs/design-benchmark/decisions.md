# Design decisions log

The design-refinement skill's persistent decisions log: every settled design question with
its reasoning. Later rounds never re-litigate a logged decision unless the owner reopens it.
Dates are 2026-07-07/08 (the home convergence arc) unless noted.

## Dose words (the owner's calibration language, quoted)

- "Don't overdo this stuff. The current design is solid. This is just **felt refinement**."
- Education: "**probably shouldn't be quite as 'designed'** [as home] since its function is
  different" … "it also shouldn't read as a well-structured formal document. It should read
  as a **fun, engaging, and informative web page**." (A program brochure done well.)
- "The general vibe should continue to be **fun, relaxed, and inviting**. But there are
  proven rules for creating exactly that effect while also remaining well organized."
- "You don't need to invent a radically new thing. You can fall back on **proven web UI/UX
  design patterns**."

## Settled decisions

- **Bands and full-bleed composition: considered and justified, not an exception list (Geoff,
  2026-07-16, reframing the older home-only rule)**: a page-level full-bleed composition is a
  deliberate design device that each page must earn. It is not forbidden everywhere except a
  named list, and it is not free. The standard is that the page's own function asks for it and
  the pass can say why. The worked examples carry the calibration, in both directions: HOME
  earns it (the north star's alternating bands are the page's whole composition). The MEMBER
  PORTAL earns it (an app surface, not a content page; the full-bleed masthead is the standing
  surface a member reads first, ratified in docs/2026-07-16-portal-redesign-design.md and
  confirmed by Geoff live: "the portal is a somewhat unique screen by design"). EDUCATION did
  NOT earn it: a pass gave it its own pitch-section bands and Geoff ruled them out on dev the
  same day, because a long-form content page's bands were decoration applied to prose, not
  composition the page's function needed. That outcome still stands under this framing. A
  long-form page may still use ONE tinted band around its primary action group (education's
  registration+CTA is the first; owner-amended 2026-07-08). The older "HOME-ONLY, no per-page
  exception" wording is superseded: it was protecting against unjustified bands, and the
  justification test protects against those directly. What a future pass owes is the reasoning,
  written down where the next reader will find it, not a plea for an exception.
- **Full-bleed**: content blocks (photos, card rows, galleries) never stretch viewport-wide
  at wide viewports — they cap at the wide content breakout. Edge-to-edge is fine at tablet
  and below where viewport and measure converge. Background bands may bleed.
- **The triptych (What we do)**: one GROUP-rounded object — radius and clip on the band,
  square interior seams, panels abutting. Not per-panel rounding (creates divots), not sharp
  (it's a framed object among framed objects). Panel captions are true shared grid rows
  (subgrid): titles, descriptions, links at identical y at every width. Copy is the club's
  original wording (owner-supplied), deletion-only trims, description ink full white at 450.
- **The notification (bulletin)**: a bounded card below the hero spanning the full measure —
  the north star's block form wearing the pennant glyph (the pennant is the gold accent; no
  left bar). "Read more →" (non-wrapping). Present, never loud.
- **The Season**: two balanced columns (month-boundary split), hairline month caps, fixed
  date column, four dot categories (gold=classes, green=social, gray=club business,
  blue=racing) pixel-verified for separation, quiet legend row, event names at step -1 with
  dates a step below. Dots center on the name's x-height (no manual nudge — the baseline
  slot does it; em-nudges die with type changes).
- **The fleet list**: a plain spelled-out list ("Six Lido 14s") in the quiet register
  (step -1, mid-muted ink, tight rows) — the club's original sentence as outro. Not
  leader-dots, not numeral columns, no composed summary lines ("Nineteen boats…" was an
  AI-tell flourish; killed).
- **The two-list register**: fleet and facilities lists are siblings — same step, ink, and
  rhythm; device varies only where content differs (counts vs checkmarks).
- **Nav**: no hairline divider before the icon trio — the gap rhythm carries the grouping
  (an invisible spacer preserves the approved distances). Members→Contact spacing has an
  optical correction. Hover dropdowns with enter/exit intent delays.
- **Link idiom** (site-wide tokens): rest underline at 35% translucent primary, hover
  strengthens to full color, focus ring 2px solid primary offset 2 on EVERY link family,
  selection = 28% navy wash.
- **The Questions close (education)**: a short warm text close with the action inline, set
  as the full-width closing card — never a bare centered button.
- **TOC standard**: in-flow jump list for medium pages; gutter rail for long pages, quiet
  register (wayfinding furniture, never a content peer); collapses to an accordion on mobile.
- **Photography**: image identity = asset + crop (content decisions, never free variables);
  derived crops fix focal problems and push to BOTH local and production R2; original-site
  copy and image selections are the specification (typos and defects always fixed, recorded).

- **Education page (round 2, 2026-07-08, commit 9f6bd4a)**: the opening is an INTRO (warm
  lede at the lead register ending in "See class dates →", location woven in, kids-in-
  lifejackets photo, credentials in a body paragraph below). One sage band wraps How to
  Register & Pricing through Ready to Join (the page's single band per the amended ruling).
  The course weekend is a designed schedule in the Season's grammar (day caps, filled/open
  dots = on-water/classroom, legend, prose detail below). Registration path = stacked
  numbered rows (1-2-3 counter badges), not columns. What You'll Learn = three themed
  clusters, two columns desktop. Questions closes as a warm full-width card. TOC at step -2
  muted (wayfinding furniture), <details> accordion on mobile. Owner facts landed: youth
  swim/capsize policy, $500-family-for-child-only, Big Lake drive times (1h15 Anchorage /
  ~25 Wasilla / ~45 Palmer), US Sailing certification. Dose: "fun, engaging, informative
  web page — a program brochure done well, less designed than home."
- **Review state at handoff**: education round 2 is on dev UNREVIEWED by the owner; a lens
  re-read was killed mid-run (fragments found no majors: focus-on-tint correct; a mobile-TOC
  capture was being redone). The owner reviews next; his notes are the next round's input.

- **Education round 3 (2026-07-09, merged to main at 0827c06)**: the round-2 page had a
  hydration DUPLICATION bug (the band wrapper was applied before the divider-group split, the
  split cut through the wrapper's open divs, and the browser's parse repair rendered the whole
  Registration-through-Questions block twice; the owner's "empty green band" and "three tall
  boxes" notes were both this one defect). Invariant now enforced by a regression test: split
  the plain body at group boundaries FIRST, then wrap within each segment; every `{@html}`
  segment must be balanced. Shipped in the round: the band holds ONLY How to Register & Pricing;
  a third divider group ("Preparing for class" over Swim Test / Gear / Camping); the PROMISE
  HERO (eyebrow = page name, h1 = "Come learn to sail on an Alaska lake." in the display italic
  voice, support lede, full-frame 3:2 postcard photo on the wide breakout, gold-dot fact strip
  at the breakout width); valley-first unparenthesized drive times; right-of-way under
  Seamanship & safety (third cluster retitled Racing basics); the redundant gear pull-quote cut;
  membership benefits as a two-column checkmark grid (the facilities device's family, full ink);
  Questions as one full-width closing card; program-section children back on the plain prose
  rhythm (the 2xl gap is the boundary's alone); divider labels at step 0 full ink; the
  registration badge anchored to the card's real padding token (measured 1.4px from title
  center). The hero was picked by the conductor from three parallel static-HTML candidates
  (owner delegated the pick).
- **Hero photography standard**: 3:2 native, shown full frame; boxes are designed to the photo,
  never the photo cropped to a box (the round-2 portrait box beheaded the instructor in a 3:2
  source). The owner shoots mostly 3:2 and supplies orientations on spec when a slot needs one.
- **PROCESS (owner rulings, 2026-07-09, binding on every future round)**: owner notes are
  exploratory probes, not settled directives ("an opportunity for you to change and try out");
  expect 10-15 fast iterations per arc. Iteration is FULLY LOCAL: `npm run dev` plus the
  `.dev-media` fallback (seed once with `node scripts/sync-media-local.mjs`; seeding is now
  `npm run media:seed`, the shipped `cairn-media-seed` bin, engine 0.84.1); the owner reviews
  on localhost; nothing deploys to GitHub or Cloudflare until the design is finalized.
  Per-iteration ceremony is banned: no code-simplifier, no full gate, no e2e per tweak — the
  simplifier and the whole gate run ONCE when the arc settles and the branch merges.
  Turnaround target per iteration: minutes. (The design-refinement skill's dispatch-builders
  shape failed this owner's iteration economics; its next revision needs an exploratory mode.)
- **Engine bug found by the local machinery (filed in cairn-cms ROADMAP)**: the cairn media
  route passes the request `Headers` as R2 `get`'s `onlyIf`; production accepts it, but
  miniflare's dev platform proxy cannot serialize `Headers`, so every `/media` read 500s under
  a consumer's `vite dev`. The site carries a dev-only middleware workaround
  (vite.config.ts `devMediaFallback`) that retires when the fixed engine ships. Retired
  2026-07-08 with the `@glw907/cairn-cms` 0.84.1 upgrade: 0.84.0 fixed the `onlyIf`/`range`
  call site but left a second one (`obj.writeHttpMetadata(headers)` still marshaled a live
  `Headers` instance across the same RPC boundary), which 0.84.1 fixed by reading plain
  `httpMetadata` fields instead. The engine fix landed and the `devMediaFallback` middleware,
  `scripts/sync-media-local.mjs`, and `.dev-media/` are gone.

- **Header hierarchy, resolved (page template system pass, 2026-07-12)**: the round-4 arc's
  open item ("h2 vs h3 reads as one weak step") traced to a root cause, not a per-page fix:
  `--text-step-1` (the lede family) was a literal duplicate of `--text-step-2` (h3's own
  size), so the promise-hero standfirst and h3 rendered identically. Shipped both arc
  candidates together: **A** (`--text-step-1` repinned to `clamp(1.19rem, 1.17rem + 0.1vw,
  1.25rem)`, strictly between body and h3; `.prose h2` weight 600 → 700, so h2 differs from
  h3 in size and weight) plus **B** (a short gold waypoint rule above each `.prose h2`,
  kin to `EventsListing.svelte`'s spine marker). The fix is spine-wide, not education-only:
  the education-only `LONG_FORM_PAGE_SLUGS` gate generalized into a nav-rank tier selector
  (`src/theme/page-tiers.ts`, `isPrimaryPage`), deriving primary status from
  `menus.primary` with no per-page bookkeeping. Every primary page (Education, Racing,
  Events, Join, Members, Contact) now carries the composed hero and the gold marker; the
  hero itself moved from a code map (`LONG_FORM_HERO`) into pages frontmatter (`promise`,
  `facts`) and degrades to a light variant (no photo slot) when a page has no hero photo.
  Bands stay home-only, unaffected.

- **Dedicated-route primary pages mirror the light hero locally (verification round,
  2026-07-12)**: `/events/` never passes through `[...path]`, so the tier gate cannot reach
  it; the route now renders the eyebrow-plus-promise light variant itself, matched
  declaration-for-declaration to the template's, and keeps the calendar's own composition
  (its month waypoints already carry the spine's gold marks, so no prose-h2 tier rule
  there). Consolidate into a shared component when a third consumer appears. Two cosmetic
  carries from the verifier fan-out await the owner's read: home's news-card headings
  shrank with `--text-step-1` (full titles now fit where they ellipsized), and education's
  standfirst sits near body size (distinct from body by ink recession and position only).

- **Hero photos crop 2:1 with per-photo focus; the image standard is codified
  (2026-07-12)**: the owner picked the 2:1 editorial crop from side-by-side candidates
  ("2:1 looks better") with the caution that crop location must not cut heads or break
  composition. A global up-bias failed its second photo (racing's fleet cropped to sky),
  so the crop window is per-photo data: the pages concept's `imageFocus` field, centered
  default, join `50% 30%`, racing `50% 65%`. The full template-by-template imagery rules
  now live in `docs/image-standard.md`; future page builds consult it rather than
  re-deriving. Related fix the probe surfaced: the lede's trailing-CTA styling keyed off
  `a:last-child` and broke racing's mid-sentence link; the CTA is now stamped
  structurally (`lede-cta`) by the split code.

- **Inline figures: 85% flush-left inset on primary pages (ratified at the evening
  close, 2026-07-12)**: the step-down sharpens the hero's seniority on many-figure
  pages. Centered was tried first and the owner read it as right-aligned despite
  measured 49px/49px symmetry; the ragged-right column's hard left anchor makes a
  centered inset read displaced, so flush-left (spare room to the rag side) is the
  ruling. The hero's extra-width breakout is confirmed deliberate (wider-than-column =
  senior; if it ever reads accidental, widen it, never shrink). Per-template, not
  per-page; codified in `docs/image-standard.md`.

- **Submit-button color: fireweed for money/conversion, navy for utility (ratified by the
  conductor 2026-07-16, from the coherence read)**: a form's primary submit spends the
  fireweed budget only when the action is money or membership conversion (join/apply,
  donate, the class fee payment) — the site's genuine "at most twice per page" pop color,
  consistent with the fireweed-budget doctrine (see the club-grounds color story). A form
  whose action is a utility step (contact, a class waitlist join, sign-in) keeps the plain
  navy `.btn-primary`, since none of those asks a visitor to spend money or commit to
  membership.

- **Form field labels: the uppercase tracked muted label is the one idiom (ratified by the
  conductor 2026-07-16, from the coherence read; OVERRULED by Geoff the same day, round 2 of the
  basic-polish pass — see the two-level entry directly below)**: every field label on the site (a
  `<legend class="fieldset-legend">`, or an inline `<label>`'s own visible text) reads in the
  site's eyebrow device — `font-display`, `text-step--1`, weight 700, `tracking-eyebrow`,
  uppercase, `color-muted` — matching ContactForm/DonateForm/the class-signup form/my-account's
  own precedent. A fieldset's group legend carries the same register as a single field's own
  label; there is no separate, quieter treatment for a group heading.

- **Form field labels, two-level register (Geoff, 2026-07-16, overruling the entry above): "the
  labels and form title look too similar"**: a group or section legend (join/apply's "Membership
  tier," "Your details," "Household members," "Classes (optional)," "Liability release") keeps
  the uppercase tracked muted eyebrow unchanged. An individual field's own label (join/apply's
  `.field-label` span; every other form's `.fieldset-legend`, since those forms declare no
  separate group tier) drops to sentence case, weight 600, `text-step--1`, `base-content` ink —
  no tracking, no uppercase, no `font-display` override — so a single field's label reads as a
  plain form label rather than another eyebrow the same weight as the group title above it.
  Applied to all five forms: join/apply, ContactForm, DonateForm, the class-signup form, and
  my-account.

- **Post hero width: A, the reading measure (template round 1, ratified 2026-07-16, Geoff
  live)**: a post's header image renders at the article's own reading measure, not a wider
  breakout. Rider ruling: a post almost always carries one, so the template designs around the
  photo as a structural constant at that measure (placement, aspect ratio, spacing against the
  title block), not as an optional extra.

- **Waitlists: the conformed spec-sheet skeleton, not a status-index mock (template round 1,
  ratified 2026-07-16, Geoff live)**: the structural fork probed between the conformed spec-sheet
  (round 3's own device) and a status-index mock settles on the spec-sheet, the shape round 3
  already landed.

- **CTA matched pair: one geometry, two skins (template round 1, ratified 2026-07-16, Geoff
  live)**: a page-cta's primary and secondary actions share the same `.asc-cta-btn` geometry
  (display, size, weight, padding, radius, transition) instead of two unrelated button families
  (racing's own "Ready to try it?" pair measured inverted, a 62px/18px chassis secondary beside a
  44px/15.2px fireweed primary; the membership-open bulletin's Join/Renew pair carried the same
  defect). Secondary rides an `asc-cta-btn-secondary` modifier: a quiet ghost skin (transparent
  ground, a primary-tinted border, primary ink, no shadow), a one-step hover/active deepening on
  the same axis, the site's one focus recipe. `:::cta-action`'s `kind="secondary"` maps to this
  pair sitewide, not only where a matched pair appears, so every closer with a single secondary
  action (join, new-member-guide, visiting-the-club, it-request, club-boat-use-and-qualification,
  confirmation) inherits the same quieter geometry too.

- **TOC nested tier: a real sub-register, not indent alone (template round 1, ratified
  2026-07-16, Geoff live: "much better")**: a long-form page's own h3 subsections (racing today,
  via `NESTED_TOC_SLUGS`) render one step down from their h2 siblings in the jump-list/gutter-rail
  pair: 0.85x the tier's own top-level size, weight 400, muted ink, a tighter line-height, indented
  0.85rem rather than the deep `ml-m` tab, and grouped close beneath their own h2 with real
  separation between h2 groups. The boxed-panel `.toc`/`.page-toc-sticky` system (bylaws and the
  rest of the long secondary catalog) keeps its own plain indent-only treatment unchanged; only the
  long-form rail/jump-list pair was probed and ratified.

- **The gear door: a rare verb earns a door, not landing real estate (Geoff, 2026-07-16, portal
  redesign pass)**: mock D's rail is reference-only ("links only, never a button"), but the
  landing carried three real asset verbs (Release, Request an asset, Cancel request) the mock
  gave no home. Ruled: `/my-account/gear` becomes the gear-and-moorings home, absorbing the whole
  assets composition (assignment rows with payment standing, waitlist positions, pending requests
  with cancel, the request form, per-row release). The rail tile stays exactly as mock D draws it
  and gains one quiet "Manage gear & moorings" foot link; Gear joins the doors row. Paying an
  outstanding fee is NOT affected: it stays the main column's one weighted action row.
  GROUNDED IN LIVE DATA, not intuition: zero `asset_requests` have ever been filed, zero waitlist
  rows today, 40 active assignments across 148 households. Release and request run to single
  digits per season club-wide. The generalizable rule: landing real estate is priced by
  recognition value, and the rail rows already deliver the recognition ("you hold B-Dock 12");
  a door named by the noun the member is already reading IS the recognition path, so inline
  chrome buys a rare verb no findability and spends the page's calm. What would reverse this:
  real seasonal request churn (a spring mooring scramble). The fix then is a seasonal
  needs-attention pointer linking to the door, never a landing form.

- **The renewal door (Geoff, 2026-07-16, portal redesign pass)**: mock D draws the masthead's
  renewal CTA as one plain fireweed button, so the landing's old tier `<select>` had nowhere to
  live. Rebuilding it as a hidden field defaulting to the household's last tier was NOT a
  survivable simplification: it turns a grown household's one-click renewal into a silent purchase
  of the wrong tier at the wrong price, with nothing catching it. Ruled: the masthead CTA LINKS to
  `/my-account/renew`, a small step that states the tier and price plainly and continues to Stripe.
  The masthead keeps mock D's single button exactly. GROUNDED: 3 of 88 renewals with a prior season
  changed tier (~3.4%) -- rare, and rarer things than this earn a door under the gear ruling above,
  but not zero, and money correctness is not a rounding error. Same shape as [[the gear door]]: a
  rare verb earns a door, and the landing keeps its calm.

- **Release gets a two-step confirm (Geoff, 2026-07-16)**: releasing an assignment gives up a
  scarce club resource with a waitlist behind it, has no member-side undo, and recovery needs an
  admin, yet it shipped as one tap on a quiet button sharing a wrap-flexed row with Pay (plausibly
  mis-tapped at 390px). An inline two-step in the plain-words register, no modal: "This gives up
  your mooring for your household. The club may offer it to the next member. [Release mooring]
  [Keep it]".

- **Em dashes: banned from UI copy sitewide (Geoff, 2026-07-16, from the portal round's own copy
  ruling)**: the round-3 asset-row "name — detail" delimiter retires for structural label/value or
  middot separation. The ruling originated on the portal but binds every future UI copy decision,
  not the portal alone.

- **The signing moment: inline text, accordion as progress (Geoff, 2026-07-18, waivers
  probe rounds 1-2, both fully verdicted same day; built by the waivers pass)**: the legal
  text renders INLINE in the page, never a nested scroll region (NN/g and GOV.UK ground the
  ruling: inner scrolls get overlooked and are awkward on touch; inline is also the most
  conservative reading of full-text display for enforceability). The hairline document list
  IS the progress: signed entries collapse to a receipt line ("Signed {date} as {name}"),
  the current document expands with a quiet "Document i of N" eyebrow, upcoming entries sit
  muted -- no wizard chrome. The document renders as a framed sheet whose bottom edge is the
  signature strip (sage ground, typed name, filled flag-navy Sign -- the portal's first
  filled button; the one weighty act earns it; zero fireweed, zero gold). The sheet omits
  the document's own title (the entry heading carries it). Framing lines come verbatim from
  docs/waivers/signing-framing-copy.md and never characterize legal effect.

- **Household signing (same rounds)**: one Part Two entry PER CHILD with the full text each
  (a signature sits adjacent to the exact text it adopts; bundling releases under one
  signature is the pattern courts distrust); "type once, sign each" -- the first signature
  is typed fresh, later documents prefill the editable name and carried-forward attestation,
  one Sign click per document (flagged to the attorney); the AS 09.65.292 relationship
  attestation is a quiet radio group in the strip, first child unselected. The
  HOUSEHOLD-COMPLETE gate (spec decision 7 as amended 2026-07-18): no payment, no class
  registration, no joined state until every member's signatures are in; an incomplete
  household's moment ends at a WAITING state (who remains, cooldown-guarded nudge, payment
  locked), and one resumption email deep-links payment when the last signature lands.
  Contact-confirm (storage/mooring holders, once, after the last signature) is a
  glance card: read-only rows, filled "This is current", quiet "Update it".

- **Admin sidebar round 2, T1 probe verdicts (Geoff, 2026-07-19, pass B; probes were static
  HTML in real 0.88 chrome, settled in two probes)**: (1) **Icons**: the design's proposed
  25-glyph assignment as-is, except Fragments keeps the engine default `layers` — `puzzle`
  declined because the editor reserves it for component blocks. Three `icon:` overrides ride
  the 0.88 engine-ref seam (Admin access `key-round`, Bulletins `bell`, Waiver text
  `file-pen`); everything else is a site-entry icon or an engine default. (2) **Open/closed
  defaults are role-dependent**, expressed via the `navFilter` seam rewriting `collapsed`
  per session (no cairn change): Administrator and Club manager land with Club +
  Communication open; Publisher with Communication; Webmaster with Communication + Website;
  collapsed groups keep their header sums. (3) **Within-group order**: as proposed with one
  move — Club runs Overview, Members, Committees, Assets, Asset requests, Money, Waivers,
  Club settings, Admin access (Money dropped to sixth, after the two badge queues). (4)
  **Help lives in the engine's fallback foot**, unreferenced by the tree ("foot is
  perfect") — it is engine-open to every capability, so in-group placement gave
  single-group roles a lonely extra group; the foot is universal by construction and the
  idiom is filed for cairn's consumer guide (pass-B harvest). (5) **Roles-matrix
  amendment: Webmaster gains the whole Communication group** (Posts, Bulletins, Email,
  Announce, sends included) alongside Website; Publisher stays Communication-only. The
  access map, matrix drift-guard test, and design matrix update in pass B. (6) **The
  Email-class-members spillover stays (Geoff, 2026-07-19, post-T6)**: the deep link
  inherits the Email screen's map coverage, so Publisher and Webmaster see a collapsed
  Events & Classes group holding that one door — kept deliberately (anyone who can send
  email sees the class-email door; no nav-only map key to hide it).

- **Member standing is Current / Overdue / Former (Geoff, 2026-07-20, Members-pass
  brainstorm; built by the Members pass)**: the reminder sequence is the boundary. Current
  runs inside the household's rolling paid window (paid_at plus one year, never a season
  line); Overdue begins at the boundary and keeps FULL member benefits (portal, member
  pricing, class access) while the sequence runs; Former begins when the +30 stated-final
  touch is sent (or its staleness window passes unsent, so dormant and imported households
  transition too). The transition is recorded, not re-derived on read; payment clears it
  automatically; the household desk carries an audited manual set/clear both directions.
  Grace RETIRES (its job is exactly what Overdue means), and "renewal candidates" retires
  with it — chasing is the reminder sequence's job, and overdue households are one standing
  filter away.

- **The Members screen optimizes for lookup (same brainstorm)**: search-first household
  rows, cursor in search on open, a match on any member's name highlighted in its
  household's row. The row stays one line: household, members primary-first (labeled
  plainly — the unlabeled star retires), standing chip, phone; city and "Tier & Amount"
  leave the row. A row expands in place to the mid-call panel (contacts, members with
  ages, holdings and enrollments with paid state) with exactly three actions: Open
  household, Email household, Add member. Money actions deliberately stay on the desk.
  Default scope is members only (Current + Overdue); Former sits behind the standing
  filter, archived behind the existing toggle; the count line always states its scope.

- **The admin toolkit builds kit-first to GENERAL contracts (Geoff, 2026-07-20)**: this
  is a general-purpose cairn admin toolkit with ASC as first consumer. For convergent
  genres the surveyed systems' agreement IS the contract (standardization, not
  speculation), so each component carries the convergent shape even where Members does
  not exercise it. Generality shapes the contract; a consumer still gates publication —
  components are born in this repo's theme layer and harvest into cairn after Members
  shakes them.

- **daisyUI-first, upgrade-friendly (Geoff, 2026-07-20)**: components compose daisy
  class names and semantics as-is — never fork or copy daisy CSS, never restyle daisy
  internals. The blessed-set safelist in cairn's admin CSS build is the one compile-side
  seam; each toolkit README entry lists the exact daisy classes the component leans on,
  so a daisy upgrade's blast radius is grep-auditable; cairn gains a scheduled daisy
  absorption ritual (bump PRs, changelog read, blessed-set rebuild check, visual suite).

- **Members refinement round 1 ratified (Geoff, 2026-07-22; arc distilled at settle)**:
  V1 the Members subtitle drops (an earned scope line like Classes' "Season 2026"
  stays); V2 the primary action lives in the header slot, intrinsic-width on mobile
  (the OfficeList margin-leak and action-stretch defects fixed upstream); V3 search
  autofocus removed — the near-black ring was the engine's own ink input idiom made
  permanent by autofocus, so the ring stays and the autofocus goes (this closes the
  Members-pass "search focus ring" open item); V4 the one-card anatomy (toolbar and
  table in one card) is the club standard; the engine's bare-toolbar anatomy is
  upstream harvest work. Calibration words: "native, polished and balanced."

- **The ratified filter grammar (same round)**: facets are quiet menu-buttons with the
  applied state in-control ("Standing: Overdue ×", 14rem ellipsis cap, separate clear
  hit area) or content-sized selects restyled to the same 30px/13px family; the
  archived toggle joins the facet family; the applied-pills row retires; the primary
  action is the row's only filled control; the count line sits beneath and always
  states its scope. The coherence coda (2026-07-24): selects must size to content —
  daisyUI's default 20rem select clamp pinned them to 320px and wrapped the toolbar
  into a filter form; fixed upstream in cairn 0.90.1.

- **Refuter-proven component treatments (2026-07-22, live-CSS adversarial rounds)**:
  StatusChip border softens to ~35% currentColor but keeps its 5rem min-width (the hug
  was refuted: ragged column); the expand panel recesses on base-300 with an inset
  hairline (base-200 refuted: it is the zebra color and the panel merged with
  stripes); row hover is a base-content 5% wash including the sticky trigger cell
  (base-200/60 refuted as invisible on stripes, primary-tint refuted as off-idiom);
  the admin content region runs a ruled 6-role type scale (24 title / 14-15 subtitle /
  14 body / 13 meta / 11 label / 10 chip) with tabular-nums on phone and count lines.

- **The design-infrastructure architecture (Geoff's strategy ruling, 2026-07-22)**: the
  long-term goal is that others can build admin components visually in line with the
  interface. Four layers: tokens as the only styling contract (a ruled type + spacing
  scale joins the `--cairn-*` roles; sites re-tune palette tokens, never grammar
  tokens); toolkit primitives covering the recurring screen anatomy; the standard
  living in cairn docs as exemplar-plus-rules (post-round Members is the annotated
  canonical screen); and a shipped `cairn audit`-style mechanical gate. This ruling
  seeds the design-infrastructure brainstorm (its seed doc is in docs/).

- **OPEN**: StatusChip's color mapping onto the admin palette (the never-paid `'none'`
  copy closed during the refinement audit — "Not billed"/"No membership" confirmed in
  source; the focus-ring item closed via V3 above). NEW (measured 2026-07-24, on
  Geoff's queue): `--cairn-card-border` as the facet controls' only boundary is 1.11:1
  light / 1.43:1 dark against base-200, under WCAG 1.4.11's 3:1 — it is the ratified
  quiet hairline, so it stands pending his ruling; a stronger `--input-color` mix in a
  cairn patch would clear it.

- **Events page (Geoff, 2026-08-22, the events-redesign brainstorm and probe arc; contract
  `docs/2026-08-22-events-redesign-design.md`)**: ONE LONG PAGE carries the whole season, each
  event its own anchored section; NN/g's scrolling research supports it when every section
  serves one task, and a dozen annually recurring events is one task. CHRONOLOGICAL through the
  season, then a photo-less "Meetings and governance" coda (a hairline table, the portal's
  committees register). A PAST EVENT STAYS IN PLACE, QUIETED (desaturated photo, a "Past"
  status, no action) and the page opens at the next upcoming event, because annual recurrence
  makes "what is the Governor's Cup" a March question. BAND COMPOSITION is the home page's
  Fleet/Facilities alternation: a 3:2 photo at five of twelve columns beside the text, sides
  alternating, sage and white bands by position; measured against live copy lengths (four to six
  lines balances the photo with no padding). The TITLE is the "Events" eyebrow over "The
  {year} Season", year derived from the rows; probes 1 and 2 proved any sentence in the italic
  promise slot reads as marketing cadence, so the slot carries a label, never a sentence (dose
  words: "marketing-copy-cadence", rejected twice). The STAR stays the only class mark, on the
  3:1 `--color-star-gold-dot` token with a screen-reader label. FIREWEED appears at most once:
  the Register on the first upcoming open class, computed independently of the scroll target.
  The DETAIL ROUTE survives only as a link-preview stub (the event's own OG title, photo, and
  description, noindex, meta refresh to the anchor), because a URL fragment never reaches an
  unfurler. The SUBSCRIBE BAR offers four entries (Apple, Google, Outlook, copy the feed URL).
  Band titles are PLAIN TEXT: a self-link is a broken promise to a screen reader; the section id
  is the share anchor. SMOOTH SCROLLING is site-wide (`html { scroll-behavior: smooth }` with
  the standing reduced-motion override and `scroll-padding-top` for the sticky header); the
  on-load jump stays instant, since only reader-initiated motion should be seen. Events stay D1
  records; cairn's no-events-concept ruling was considered and left closed on purpose.

- **Events page header block and month headings (Geoff, 2026-08-22, the post-merge probe
  round, probes 4 through 8)**: the top of the page "felt like a jumble" with the month bar
  "too small" and the rhythm off. Ruled: the HEADER BLOCK is three elements (title block, ONE
  quiet subscribe line with no caps label, no icons, no hairline, and the feed URL shown only
  after a failed copy; the month TABS). The tabs are attached to the season: body size in the
  display face, the current month on the star-gold underline sitting on the hairline that is
  the first band's top edge (probe 6's cue; "better in terms of making the sections feel
  related"). A sage ground under the bar was tried and rejected ("That definitely doesn't
  work"). Cutting the header to three elements was the fix for busyness ("That does the
  trick"). MONTH HEADINGS are chapter headings: h2 at step 3 in ink with a short gold rule
  (the spine's waypoint reborn), events drop to h3 at step 1, because on a chronological page
  the month is the chapter and the running-head treatment was "easy to miss" when scrolling.
  Smooth scrolling is site-wide per the earlier ruling.

- **Events admin probe round (Geoff, 2026-08-24, the four questions held from the
  events-admin coherence reads; probe page rendered from the live local page with the
  coherence-read seed)**: the EDITABLE DATE COLUMN reads typeset at rest in the prior
  columns' register (full ink, dashed-underline affordance, "+ add date" on undated rows)
  and swaps to the native inputs only while editing — the boxed mm/dd/yyyy chrome beside
  typeset columns was the rejected state. The HERO PICKER closes at rest: a large 3:2
  preview with name and alt beside "Change photo"/Clear, the library opening on demand as a
  photos-first 3:2 thumbnail grid (the always-open vertical listbox with oval-rounded thumbs
  was rejected; photo display names are a Library question, noted, not a picker one).
  CATEGORY COLOR moves off the 6px dot onto the chip's own ground ("the dot is so small
  it's hard to tell what color it is"): tinted chip grounds carrying the public Season
  palette — racing blue oklch(53% 0.15 245) at 16%, class gold oklch(62% 0.155 78.3) at
  22%, social sage oklch(46% 0.14 155) at 15%, operations/governance on the quiet gray —
  no dots, every chip at one font weight (the state chips' 600 against the labels' 400 was
  the flagged inconsistency, proven by measurement, invisible at 10px without zoom). The
  ruling is TOOLKIT-WIDE ("it would need to apply to everything"): the tinted-ground
  grammar is cairn StatusChip's, filed in the events-admin harvest; this site carries it
  until the engine ships it. HIDDEN AND RETIRED must not read identically (Geoff): Hidden
  is the quiet hairline-outline chip (transient absence), Retired keeps the filled darker
  state gray (settled), both at the normalized weight. The 390 PRIOR-SEASON DROP is
  RATIFIED as-is — no substitute history line; the candidates (a quiet line under the
  name, a panel line above Start date) were both declined.

- **Events admin probe settle (2026-08-24, the build of the four verdicts above)**: the
  settle round's own cold coherence read failed on five assembly tells, all fixed and
  re-measured to a CLEAN verdict: the current-season column reserves its edit-form width
  (284px, 140px narrow) so entering date-edit moves nothing (0.00px column deltas at 1440
  and 390); the star rides the first line of a wrapped title; the at-rest "+ add date"
  joins the muted column register (14px, muted ink, dashed rule) instead of the in-form
  purple link voice; an undated row's current cell says "not scheduled" in the muted step
  rather than rendering blank; and the hero picker's rest state is a fixed non-wrap row
  (caption, 264px 3:2 preview or placeholder, text column, left-aligned buttons at one x
  in both chosen states). Operations/governance chip grounds take a 10% base-content tint
  to sit in the tinted siblings' contrast band (1.16–1.47:1 across themes and stripes) —
  no single percentage lands an idealized 1.15–1.35 in all four theme/stripe combinations,
  so the band is the standard, not the number. Ruled settled-by-design: the +19px row
  growth at 390 when date-edit opens, caused by the narrow-only end-date affordance
  wrapping to a second line inside the reserved column; siblings translate but never
  re-wrap, and the affordance is part of the accepted in-form vocabulary.

- **Assets register settle (2026-08-25, the assets-register pass close, PR #10)**: the plan's
  five probe verdicts built and settled. NO CATEGORY COLOR for asset types: the by-asset view
  groups by type and the inbox leads with the type name, so per-type hue would be a fourth
  color vocabulary with no discrimination need; type labels take the quiet neutral chip. STATE
  CHIPS take the tinted-ground grammar site-wide via `src/theme/admin-chip-registers.css`
  (quiet tint for Paid/settled, warning tint for Outstanding, hairline outline for Not billed,
  one 400 weight, no tone dots), consumed per-page; the grammar is StatusChip's to absorb
  (harvest finding 1). The ACCORDION SUBSTITUTION is ratified: per-type groups are a real
  `<button>` with `aria-expanded`/`aria-controls` over a `hidden` panel plus `role="region"`,
  not `<details>/<summary>`, because the group header hosts the Promote form and Edit, which
  cannot live inside a summary; the a11y sweep graded the outcome equivalent or better. STRIPE
  GEOMETRY is one dialect family-wide: square and full-bleed to the card edge on both sides
  (the UA `<ul>` `padding-inline-start` survives `list-style: none` under the no-Preflight
  admin and must be zeroed; daisyUI `.list-row`'s 1rem radius is zeroed on striped rows; edge
  padding trims are parity-scoped so a striped edge row keeps its full fill). VIEW SWITCHERS
  are plain `aria-pressed` buttons, not `role="tablist"`. DUPLICATE REQUESTS are kind-agnostic:
  one pending request per household and asset type, enforced by migration 0037's partial
  unique index, and the app guards match the index's shape. The close's cold read failed on
  four tells (the 40px left stripe gutter, a subtitle with its count dropped, the rounded
  stripe lozenge, mechanical "(s)" plurals), fixed in one round and re-measured CLEAN with
  pixel evidence (fill flush both edges at 0.0px delta, exact subtitle strings, radius 0,
  zero horizontal overflow at 390 in all four theme/screen combinations). FLAGGED TO GEOFF,
  not settled: the 10px StatusChip ink is the smallest text on the screens and carries payment
  standing; the cold read graded it legible but at the floor.

- **Email + Announce settle (2026-08-26, the email-announce pass close, PR #11)**: the
  probe's five verdicts built and settled — the incident row on the NEUTRAL row ground
  with the warning chip alone carrying tone; the expanded state as inset member rows with
  their own Failed chips plus an in-incident pager; the announced-state chip pair with the
  detail as muted text beside the chip; the announce form as stacked parallel channel
  blocks each carrying its own enable control and preview (SMS joins as a third block
  later); the subject inside the Email block. The chip registers were REUSED UNMODIFIED
  on their third, fourth, and fifth consumers (email index, announce list, Compose badge;
  verify-chip-registers green throughout, extended to 28 measurements to cover the new
  inset-member-row ground at 1.306:1 light / 1.275:1 dark, inside the events settle's
  1.16-1.47:1 band). COUNT VOCABULARY on the send log: three counts name three things —
  the subtitle's "log entries", the filter band's "sends" (send attempts), the pager's
  "groups" (folded display units); one noun for all three read as contradiction. CHECKBOX
  EDGES take an explicit primary border (unlayered, dual-selector dark): DaisyUI's
  unchecked default measured ~1.5:1 against the 3:1 floor; the fix measures 9.72/7.55:1
  (site light/dark) and 5.82/5.43:1 (admin light/dark); the mechanic is filed engine-level
  (harvest 31). The COMPOSE VARIABLE PALETTE is judged settled WITHOUT a probe (the plan's
  contingency): the cold read graded it designed-in-conception, undone only by the UA
  `<ul>` indent — the SAME gotcha the assets settle logged ("padding-inline-start survives
  list-style: none under the no-Preflight admin"), now bitten twice across passes and
  filed as the engine list-reset ask (harvest 35). The close's cold read graded four
  screens DESIGNED and two ASSEMBLY (the send log's stacked filter selects at 1440, the
  portal Notifications row collapsing at both widths); both fixed in close round A with
  measured after-numbers. Contract ruling 4's `currentMemberEmails` overdue-widening
  walkthrough is CLOSED-CONFIRMED: the audience query grounds on
  `classifyHouseholdStanding`, and an overdue household's default recipient lands in
  `current` (covered by the Task 1 acceptance test). FLAGGED TO GEOFF, not settled: the
  announce list's emphasis inversion (fourteen outlined "Not announced" pills louder than
  the one quiet "Announced"; the probe-ratified pair stands unless reopened); the headroom
  fact's two homes (bordered banner on compose review, bare helper on the announce form);
  the announce send carrying no count-acknowledging confirm while Compose gates the same
  action; and the head-of-household toggle semantics (the default recipient sees a control
  that cannot change their own reach — security review finding, harvest 15).

## Benchmark provenance

Pinned by the owner 2026-07-08 ("that's our new design benchmark"): the home page at commit
9b0f415, re-captured at a681023 after the nav-divider removal. Captures in this directory.
