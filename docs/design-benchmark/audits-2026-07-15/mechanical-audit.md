# Mechanical audit — invisible-craft pass (static/code analysis only)

Scope: `src/theme/**`, `src/routes/(site)/**` + `src/routes/(site)/my-account/**`, `src/chassis/**`
(chassis findings marked **[chassis]**, report-only — route upstream, not edited here). No server
was started; every finding is grep/read-verified against committed source. Severity is a
perceptual-leverage guess (high/medium/low), not a bug-priority ranking.

Token scale for reference (`src/theme/theme.css:166-173`): 3xs≈0.31-0.34rem, 2xs≈0.5-0.56rem,
xs≈0.75-0.84rem, s≈1-1.13rem, m≈1.5-1.69rem, l≈2-2.25rem, xl≈3-3.5rem, 2xl≈4-4.75rem.

---

## 1. Spacing values off the token scale

Every value below is a literal px/rem/em in a `margin`/`padding`/`gap`/`inset`/offset declaration
that does not reference `var(--spacing-*)`. None land on a token step.

| File:line | Property | Value |
|---|---|---|
| `src/theme/site.css:107` | margin-top | 0.6rem |
| `src/theme/components/SiteFooter.svelte:47` | padding-block | 0.3rem |
| `src/theme/components/SpineRow.svelte:60` | scroll-margin-top | 6rem |
| `src/theme/components/SpineRow.svelte:65` | top | 0.65em |
| `src/theme/components/SpineRow.svelte:104` | margin | 0.15rem 0 0 |
| `src/theme/components/SpineRow.svelte:127` | row-gap | 0.15rem |
| `src/theme/components/ClassSchedule.svelte:91` | gap | 0.35rem 1rem |
| `src/theme/components/ClassSchedule.svelte:93` | padding-block | 0.6rem |
| `src/theme/components/ClassSchedule.svelte:136` | margin | 0.9rem 0 0 |
| `src/theme/components/EventsListing.svelte:90` | custom prop (`--spine-content-gap`) | 1.75rem |
| `src/theme/components/EventsListing.svelte:113` | top | 0.5em |
| `src/theme/components/EventsListing.svelte:135` | custom prop (`--spine-content-gap`) | 1.15rem |
| `src/theme/components/SearchModal.svelte:180` | inset (hit-area `::before`) | -4px |
| `src/theme/components/NotificationStrip.svelte:60` | margin-top | 0.2em |
| `src/theme/asc-components.css:21` | margin-bottom | 0.3rem |
| `src/theme/asc-components.css:89` | margin-bottom | 0.3rem |
| `src/theme/asc-components.css:131` | margin-top | 0.5rem |
| `src/theme/asc-components.css:287` | top | 1.75rem |
| `src/theme/asc-components.css:331` | padding | 0.6rem 1.25rem |
| `src/theme/asc-components.css:440` | padding | 0.35rem 0.5rem |
| `src/theme/asc-components.css:477` | gap | 0.3rem |
| `src/theme/asc-components.css:520` | padding | 0.1rem 0.5rem |
| `src/theme/components/SiteHeader.svelte:388` | padding-block | 0.25rem |
| `src/theme/components/SiteHeader.svelte:444` | inset (hit-area `::before`) | -4px |
| `src/theme/components/SiteHeader.svelte:529` | padding-block | 0.6rem |
| `src/theme/components/SiteHeader.svelte:556` | padding-block | 0.8rem |
| `src/routes/(site)/events/[id]/+page.svelte:192` | margin | 0.15rem 0 0 |
| `src/routes/(site)/events/[id]/+page.svelte:228` | padding | 0.6rem 1.25rem |
| `src/routes/(site)/events/+page.svelte:111` | margin-bottom | 0.4rem |
| `src/routes/(site)/events/+page.svelte:122` | gap | 0.375rem |
| `src/routes/(site)/[...path]/+page.svelte:649` | padding | 0.2em 0.55em |
| `src/routes/(site)/[...path]/+page.svelte:659` | gap | 0.3rem |
| `src/routes/(site)/[...path]/+page.svelte:867` | padding | 0.2rem 0 |
| `src/routes/(site)/[...path]/+page.svelte:1082` | margin-top | 1.35em |
| `src/routes/(site)/[...path]/+page.svelte:1217` | padding-block | 0.2rem |
| `src/routes/(site)/[...path]/+page.svelte:1218` | padding-left | 1em |
| `src/routes/(site)/[...path]/+page.svelte:1424` | padding-block | 0.2rem |
| `src/routes/(site)/[...path]/+page.svelte:1586` | padding | 0.25rem 0 |
| `src/routes/(site)/+page.svelte:486,512` | padding | 0.6rem 1.25rem |
| `src/routes/(site)/+page.svelte:801,1170` | padding-block | 0.3rem |
| `src/routes/(site)/+page.svelte:879,1031` | padding-block | 0.2rem |
| `src/routes/(site)/+page.svelte:880` | padding-left | 1em |
| `src/routes/(site)/+page.svelte:984` | gap | 0.35rem |
| `src/routes/(site)/+page.svelte:1028` | gap | 0.75rem |
| `src/routes/(site)/+page.svelte:1109` | margin-top | -0.08em |

**Severity: low.** Most of these are the CTA button internal `padding: 0.6rem 1.25rem` pattern
(repeated 3x verbatim — `asc-components.css:331`, `events/[id]/+page.svelte:228`,
`+page.svelte:486,512`) or a `0.1-0.4rem` micro-adjustment inside a component's own scoped
`<style>`, most with a comment explaining the specific optical reason (baseline nudges, hit-area
insets, em-relative icon offsets). Two clusters worth a closer look if this becomes a cleanup
pass: (a) the `0.6rem 1.25rem` CTA padding pair, appearing identically in three separate files —
a candidate for a shared `.cta-btn` mixin/token rather than copy-paste; (b) the run of
`padding-block: 0.2rem`/`0.25rem`/`0.3rem` variants on TOC/list rows in `[...path]/+page.svelte`
and the home page, which read like they're approximating `--spacing-2xs` (0.5rem) at half value
rather than deliberately choosing a finer step.

**[chassis] `src/chassis/prose.css`** carries the same pattern at a similar rate (16 hardcoded
values, e.g. lines 185, 213, 230, 369, 380, 505, 539-540) — report upstream, not a site defect.

---

## 2. Interaction-state coverage

**`:active` — confirmed still ZERO across `src/theme/**` and `src/routes/(site)/**`.** The only
`active` hits are the `class:active={current}` nav-current-page state class
(`SiteHeader.svelte:212,244,316`), not the `:active` pseudo-class. Same in chassis (zero hits in
`src/chassis/*.css`). **`:disabled`/`[disabled]` — also zero** anywhere in scope, despite every
form's submit button setting the `disabled` attribute dynamically (`ContactForm.svelte:65`,
`DonateForm.svelte:82-88`, `join/apply/+page.svelte:290`, `classes/[id]/signup/+page.svelte:293`,
etc.) — a disabled submit button falls back to the browser/DaisyUI default dimmed state with no
site-authored styling.

Elements that most deserve an `:active` rule, ranked by how often a visitor's finger/mouse is on
them: primary CTAs (`.cta-btn`, `.asc-cta-btn`, `btn-primary` submit buttons across every form),
the mobile hamburger/theme-toggle/donate-link trio (`SiteHeader.svelte:268-345`), and nav links
(`.nav-link`). None of these press-state at all today — a click reads as `:hover` → next page,
with zero tactile feedback in between.

**Hover/focus-visible pairing** — selector-by-selector, from `src/theme/**` and
`src/routes/(site)/**`:

| Selector | :hover | :focus-visible | Note |
|---|---|---|---|
| `.cta-btn` (3 local copies: `+page.svelte`, `events/[id]/+page.svelte`, `asc-components.css` as `.asc-cta-btn`) | yes | yes | — |
| `.ghost-btn` | yes | yes | — |
| `.nav-link` | yes | yes | — |
| `.mobile-sublink`, `.mobile-link`, `.hamburger`, `.theme-toggle` | yes | yes | — |
| `.donate-link` | no local `:hover` (color set by shared `.theme-toggle,.donate-link,.nav-caret` group) | yes | fine, hover covered by group rule |
| `.site-logo` | yes | yes | — |
| `.footer-link` | yes | yes | — |
| `.season-link` | yes | yes | — |
| `.notification-link` | yes | yes | — |
| `.news-card`, `.wdwd-panel-link`, `.arrow-link` | yes | yes | — |
| `.jump-links a` / `.page-toc-rail a` / `.page-toc-sticky nav a` (`[...path]/+page.svelte`) | yes, locally | **no local rule, but covered generically** — all three sit inside `<article class="prose">` (`[...path]/+page.svelte:493`), so chassis's `.prose a:focus-visible` (`prose.css:161`) reaches them | verified not a gap |
| `.search-trigger` (SearchModal) | n/a (icon button) | yes | — |
| **`.search-result-link`** (`SearchModal.svelte:149,186`) | yes | **no** | genuine gap — arrow-key-navigable search results have no focus ring |
| **`.spine-row-title`** (`SpineRow.svelte:85,92`) | yes | **no** | genuine gap |
| **`.events-toc-link`** (`EventsListing.svelte:71,78`) | yes | **no** | genuine gap |
| **`.ics-link`, `.event-detail-nav-link`** (`events/[id]/+page.svelte:240-267`) | yes | **no** | genuine gap |
| **`.calendar-subscribe-link`** (`events/+page.svelte:119-134`) | yes | **no** | genuine gap |
| **`.back-link`** (`[...path]/+page.svelte:656-665`) | yes | **no** | genuine gap |
| `.nav-caret` | color-transition via group rule, no `:hover` proper | yes | — |

**Severity: medium.** None of these gap elements has any sitewide `:focus-visible` fallback
outside `.prose` (`src/theme/theme.css` and `site.css` carry no universal `a:focus-visible`/
`button:focus-visible` reset), so a keyboard user tabbing to a search result, an events-page prev/
next link, the calendar-subscribe link, or the governance back-link gets only the browser's UA
default ring — inconsistent with the rest of the site's deliberate navy-ring convention.

---

## 3. Transition audit

Every hand-written `transition:` in scope, with duration+easing:

| File:line | Value |
|---|---|
| `SiteFooter.svelte:48` | `color 0.15s ease` |
| `asc-components.css:75` | `transform 0.15s ease, box-shadow 0.15s ease` |
| `asc-components.css:334` | `filter 0.15s ease, transform 0.15s ease` |
| `SearchModal.svelte:168` | `color 0.15s ease` |
| `SearchModal.svelte:184` | `background-color 0.15s ease` |
| `+page.svelte:489,905` | `filter/transform/box-shadow 0.15s ease` combos |
| `+page.svelte:515` | `background 0.15s ease` |
| `SiteHeader.svelte:353,390,411` | `opacity`/`color 0.15s ease` |
| `[...path]/+page.svelte:788,1451` | `transform 0.15s ease` |

**All hand-written transitions use the standardized `0.15s ease` value — no deviation, no
`transition: all`.** One exception worth flagging: `posts/+page.svelte:77` uses the Tailwind
utility class `transition-colors` (no explicit duration/easing in source) — Tailwind v4's default
for that utility is `150ms` at `cubic-bezier(0.4, 0, 0.2, 1)`, matching the 150ms duration but
using Tailwind's own easing curve rather than the literal `ease` keyword every hand-written rule
uses. **Severity: low** — imperceptible in practice, flagged only because it's the one place the
standardized value isn't literally spelled out.

One `animation-duration: 180ms` exists for the page cross-fade (`site.css:226`,
`::view-transition-old/new(root)`), documented as a deliberate ~180ms choice "toward the fast end
of the ~150-200ms range" — inside the stated 100-300ms band, not a finding.

**`prefers-reduced-motion` coverage is thorough and verified complete.** Beyond the five
component-scoped `@media (prefers-reduced-motion: reduce)` blocks (SiteHeader, SiteFooter,
SearchModal, asc-components.css, `[...path]/+page.svelte` x2), `site.css:193-202` carries a
sitewide blanket `*, *::before, *::after { transition-duration: 0.01ms !important; ... }` rule
specifically to catch "a future transition nobody remembers to gate individually" and DaisyUI's
own built-in motion — this also silently covers the untagged `transition-colors` Tailwind utility
above. A second blanket rule (`site.css:234-239`) separately silences `::view-transition-*`
pseudo-elements, which the first blanket rule's universal selector cannot reach. **No gap found.**

**[chassis]** `src/chassis/prose.css:728` — `transition: transform 0.15s ease` — consistent, no
finding to route upstream on this axis.

---

## 4. Forms — inputs/textareas/selects, public + portal

| Field | type | inputmode | autocomplete | Label |
|---|---|---|---|---|
| **ContactForm** name/email/phone (`ContactForm.svelte:35,40,45`) | text/email/tel (via `.as()`) | via `.as()` | name/email/tel | `<fieldset><legend>` ✓ |
| ContactForm category select (`:50`) | select | n/a | none | `<legend>` ✓ |
| ContactForm message (`:60`) | textarea | n/a | none | `<legend>` ✓ |
| **DonateForm** custom amount (`DonateForm.svelte:64`) | number | none | none | **placeholder-only** — wrapped in `<label class="input">` but its only text content is an `aria-hidden="true"` `$` span; accessible name comes from `placeholder="Other amount"` alone |
| DonateForm note (`:70-75`) | textarea | n/a | none | `<legend>` ✓ (fieldset group name, no per-field text) |
| **join/apply** purchaserName (`join/apply/+page.svelte:161`) | text | none | name | **no `<label>`, placeholder-only** (`"Full name"`) |
| join/apply purchaserEmail (`:162-171`) | email | none (type=email covers keyboard) | email | **no `<label>`, placeholder-only** (`"Email address"`) |
| join/apply purchaserPhone (`:172`) | tel | none (type=tel covers keyboard) | tel | **no `<label>`, placeholder-only** (`"Phone number (optional)"`) |
| join/apply purchaserBirthdate (`:174-176`) | date | n/a | none | `<label>` text ✓ |
| join/apply household member name/birthdate/email (`:193-215`) | text/date/email | none | none | `aria-label` ✓ (real, non-visual label — inconsistent with the purchaser fields above, which get neither) |
| join/apply class picks (`:236-246`) | select | n/a | none | `<label>` text ✓ |
| join/apply waiver checkbox (`:283-288`) | checkbox | n/a | n/a | `<label>` wraps it ✓ |
| **class signup** name/email/phone (`classes/[id]/signup/+page.svelte:256-269`) | text/email/tel (via `.as()`) | via `.as()` | name/email/tel | `<legend>` ✓ |
| class signup interests (`:273`) | textarea | n/a | none | `<legend>` ✓ |
| class signup waiver checkbox (`:286`) | checkbox | n/a | n/a | `<label>` wraps it ✓ |
| **my-account/profile** email/phone/birthdate (`profile/+page.svelte:46,50,55`) | email/tel/date | n/a | email/tel | `<legend>` ✓; phone carries a placeholder example (`+19075551234`) IN ADDITION to its real label — fine, not placeholder-only |
| profile visibility select (`:67`) | select | n/a | none | no `<label>`/`<legend>` — bare `<select>` inside a `<form>` next to a `<button>`, relies on the section `<h2>Directory listing</h2>` for context only |
| **my-account/household** add-member name/email/birthdate (`household/+page.svelte:68,72,76`) | text/email/date | n/a | none | `<legend>` ✓ |
| household per-member visibility selects (`:51-55`) | select | n/a | none | no `<label>` — same bare-select pattern as profile |
| **my-account/confirm** resend email (`confirm/+page.svelte:75`) | email | n/a | email | `<legend>` ✓ |
| **my-account/+page.svelte** asset-request note (`:229`) | text | none | none | `<legend>` ✓ |

**Findings, ranked:**
- **Medium: `join/apply/+page.svelte:161,162,172`** — the purchaser name/email/phone fields are
  placeholder-only, while every sibling form (ContactForm, class-signup) uses `<fieldset><legend>`
  and the household-member fields two sections down in the *same file* use `aria-label`. This is
  an inconsistency within one form, not a sitewide pattern — the fix is cheap (match the
  surrounding convention) and the risk (a screen-reader user hitting an unlabeled required field
  on the club's primary join flow) is real.
- **Low-medium: `DonateForm.svelte:64`** — the custom-amount input's only accessible text is a
  placeholder; the `aria-hidden` `$` span means the wrapping `<label>` contributes nothing to the
  accessible name.
- **Low: bare `<select>` visibility controls** (`profile/+page.svelte:67`,
  `household/+page.svelte:51`) have no per-control label text; acceptable given the adjacent
  heading/button context but not to the fieldset+legend standard the rest of the site holds.
- No missing `type=`/`autocomplete` mobile-keyboard hints found on any email/tel/date field in
  scope — every one correctly types `email`/`tel`/`date` and sets `autocomplete` where the field
  maps to a real autofill category. No postal/zip field exists anywhere in the codebase.

---

## 5. Touch targets (candidates for measurement, not asserted failures)

CSS-computable box sizes for genuinely **interactive, non-decorative** elements under ~44px in a
dimension:

- **`.nav-caret` (`SiteHeader.svelte:217`, `h-6 w-6` = 24×24px)** — a standalone `<button
  popovertarget>` (the "Members" dropdown disclosure), separate from its sibling `<a>`. Unlike its
  neighbors it gets **no** hit-area expansion: `.theme-toggle`/`.donate-link` both get a
  documented `::before { inset: -4px }` trick (`SiteHeader.svelte:441-444`) that grows their
  visible 36px box to an effective ~44px hit area, and `.search-trigger` gets the identical
  treatment (`SearchModal.svelte:177-180`) — `.nav-caret` is conspicuously excluded from that
  shared rule (`SiteHeader.svelte:410-436` lists `.theme-toggle`/`.donate-link` but not
  `.nav-caret` in the `::before` block). **Highest-confidence candidate: 24×24px, no expansion.**
- **`.donate-link` (`SiteHeader.svelte:345`, `h-9 w-9` = 36×36px visible box)** — the same
  36px-visible/44px-effective pattern as `.theme-toggle`/`.search-trigger` (all three share the
  `::before` rule), so likely fine once the pseudo-element is accounted for — but it's rendered
  identically on the **mobile** toolbar (`SiteHeader.svelte:276`, `.mobile-controls`) sitting next
  to `.theme-toggle`'s *mobile* variant which is explicitly `h-11 w-11` (44px, no expansion
  needed) and `.hamburger` at `h-11 w-11`. Worth a real-device tap-target measurement to confirm
  the `::before` expansion actually lands at 44px on that toolbar, since it's the one icon in the
  mobile row not given a full 44px box outright.
- Everything else under 44px found by CSS grep (`EventsListing.svelte:115-116` 0.75rem dots,
  `SeasonList.svelte:154-155`/`asc-components.css:494-495` 8px dots, `SpineRow.svelte:67-68`
  0.5rem dot) is a **decorative legend/status dot inside a larger clickable row, not its own
  target** — confirmed by reading each component; not a finding.
- `.arrow-link` (`+page.svelte:1169-1170`) and `.footer-link` (`SiteFooter.svelte:41-47`) are
  **already deliberately addressed** by a prior audit pass: both carry a documented comment
  explaining they were measured at 19-22px and given `padding-block: 0.3rem` to reach a stated
  24px minimum for *inline text links* (not the 44px block-target bar, which the comments
  explicitly note doesn't apply to inline text). Not re-flagging as new.

**Severity: medium for `.nav-caret`** (real gap, no mitigation), **low for the mobile
`.donate-link` question** (likely fine, worth a five-minute confirm rather than a rebuild).

---

## 6. Numerals — font-variant-numeric coverage

**Has `tabular-nums`:** `ClassSchedule.svelte:107`, `SeasonList.svelte:142`, `SpineRow.svelte:119`
(date blocks), `[...path]/+page.svelte:1171` (a prose ordered-list counter, matching chassis's own
`prose.css:300` `.prose ol > li::before`), `asc-components.css:281` (`.asc-step` counter circles),
`asc-components.css:424` (`.prose .asc-table th, td` — covers all three `:::table` variants:
results/fees/gear, since they share the one `.asc-table` class).

**Missing — genuine gap:** `src/routes/(site)/my-account/+page.svelte` — none of the
portal's dollar-amount lines carry `font-variant-numeric`: the outstanding-payment amount
(`:174`, `formatDollars(assignment.feeCents / 100)`), the approved-request fee (`:203`), and
**especially** the Receipts list (`:246-254`), which renders a `<ul>` of `<li class="flex ...
justify-between">` rows with a right-aligned dollar figure in each — exactly the "digits column"
case the audit is watching for, and the one place in the portal where misaligned digit widths
would be visible reading down a column. `my-account/classes/+page.svelte:91` (`$${cls.fee}`
inline in prose text) is lower-stakes since it's not columnar.

Pagination and a stats-bar were named in the audit brief but don't exist in this codebase today:
the directory page explicitly forgoes pagination (`directory/+page.svelte:6`, "roughly 210 members
... a client-side filter is plenty"), and no stats-bar component exists in scope.

**Severity: low-medium** — cosmetic-only, but the receipts list is the one true numeral-column in
the member-facing portal and is the one place lacking the treatment applied everywhere else.

---

## 7. Color hygiene

**No pure `#000`/`#fff` and no gray-hue hex/rgb neutrals** found bypassing the token system in
`src/theme/**` or `src/routes/(site)/**`. The two apparent hex-color hits inside comments
(`SiteHeader.svelte:401` quoting the north star's own `#1C4670`/`#E3A008` as documentation; the
live rule two lines below uses `var(--color-primary)`/`var(--color-secondary)`) and
(`theme.css:186`, a comment glossing the oklch values as "Muted ink (#5C6B72)") are **not** live
declarations — excluded per the calibration note that token-definition context is fine.

**Real findings — literal white bypassing the token system:**
- `+page.svelte:495` — `.cta-btn { color: white; }`
- `+page.svelte:508` — `.ghost-btn { color: white; border: 1px solid rgba(255, 255, 255, 0.4); }`
- `+page.svelte:518` — `.ghost-btn:hover { background: rgba(255, 255, 255, 0.08); }`
- `+page.svelte:521` — `.ghost-btn:focus-visible { outline: 2px solid white; }`
- `+page.svelte:792` — `.wdwd-panel-desc { color: rgba(255, 255, 255, 1); }`

None of these are `var(--color-base-100)` or an equivalent token reference; all are literal
`white`/`rgba(255,255,255,…)` used as an on-photo/on-navy foreground color. **Severity: low** —
these are all deliberate, commented choices (the `.cta-btn` comment explicitly discusses
navy-vs-white contrast tradeoffs) and read correctly today; flagged only because a token
(`--color-base-100` or a new `--color-on-photo`) would make a future palette tweak reach every
instance instead of five hand-copied literals.

**`filter: brightness()` hover — confirmed, and wider than previously known.** STATUS.md's prior
finding named `.cta-btn`/`.asc-cta-btn`; this pass finds **three** separate local `.cta-btn`
definitions using the identical `filter: brightness(1.08)` hover, not two:
`asc-components.css:337`, `+page.svelte:492`, and **`events/[id]/+page.svelte:233`** (not
previously named). All three bypass a computed color step in favor of a brightness filter.

**[chassis]** No raw hex/rgb colors found in `src/chassis/*.css` — clean, nothing to route
upstream on this axis.

---

## 8. Micro-details

- **`::selection`** — **present**, `site.css:213-215` (`color-mix(in oklab, var(--color-primary)
  28%, transparent)`, unlayered so it outranks chassis). The "known absent" prior finding is
  **stale — this was fixed since 2026-07-08.**
- **`-webkit-tap-highlight-color`** — **confirmed absent**, zero hits in theme/route/chassis CSS.
  Mobile Chrome/Android will show its default gray tap flash on every link/button, including the
  icon buttons that otherwise carry a deliberate hover-color transition — a plausible, cheap
  sitewide add (`-webkit-tap-highlight-color: transparent` paired with the existing
  `:focus-visible`/`:active` rules, once those exist per §2).
- **Scrollbar styling** — none found. Only the `.table-scroll` overflow-x region
  (`prose.css:349-354`) could conceivably want custom scrollbar styling for a genuinely wide table,
  but per that rule's own comment this is "the honest fallback... not the default reading path,"
  i.e. deliberately rare. Low priority.
- **`text-wrap: balance`/`pretty`** — **present and broad**, contradicting the prior "known absent
  as of 07-08" note: `.prose > h1` (`prose.css:96`), `.prose h2` (`:120`), `.prose h3` (`:131`),
  body `.prose p` gets `pretty` (`:68`), plus local uses on `+page.svelte:536,540`,
  `events/+page.svelte:93`, `[...path]/+page.svelte:1249`, `asc-components.css:367`. **Gap:**
  `.prose h4` (`prose.css:141-150`) does **not** get `text-wrap: balance`, unlike h1-h3 — minor,
  since h4 text ("B1 real subheads") tends to be short. No h5/h6 rules exist at all, but the
  content model appears to cap at h4 by design (per that rule's own comment), so this isn't a gap.
- **Non-breaking spaces before units/numbers** — only one `&nbsp;` in scope sitewide
  (`NotificationStrip.svelte:34`, `Read more&nbsp;&rarr;`, protecting an arrow glyph, already
  redundant with the row's `whitespace-nowrap`). No unit-before-number patterns in component
  templates were found that would benefit from one (dollar amounts render as one token, `"$100"`,
  with no space to break on).
- **Truncation** — `.news-card-title` (`+page.svelte:930-941`) is the one genuine truncation
  device in scope: a documented, deliberate 2-line `-webkit-line-clamp`/`line-clamp` pairing with
  a `min-height` reserve to hold card-row baseline alignment. No other card/list component in
  scope renders unbounded variable-length text without either a natural short-content guarantee
  (event/class names) or this treatment — no overflow-chaos candidates found.

---

## 9. Standing-gate candidates for `scripts/design-probe.mjs`

`design-probe.mjs` today runs Playwright against rendered pages with hard-fail checks (image
ratio, stray-corner, overflow, unstyled band lists) plus one soft warning (band-repeat), scoped to
`BAND_COMPOSED_PAGES`. Candidates below follow that shape — cheap, deterministic, low
false-positive — ranked by how directly they'd have caught something this pass found:

1. **`:active`/`:focus-visible` selector-set parity, static (no browser needed).** A plain Node
   script (or a `grep`-backed step, doesn't need Playwright at all) that collects every
   `:hover`-suffixed selector across `src/theme/**`/`src/routes/(site)/**`, strips the pseudo, and
   checks a `:focus-visible` variant exists somewhere in the same file OR the element's known
   `.prose`-nesting exception list. Cheap, and this pass's biggest finding (§2) is exactly this
   shape. Risk: needs a short allowlist for the `.prose`-inherited cases (`jump-links`,
   `page-toc-rail`, `page-toc-sticky`) to avoid false positives — small, stable list.
2. **Sitewide `:active` existence gate.** Trivial: fail if `grep -c ':active' src/theme
   src/routes/(site) --include=*.css --include=*.svelte` is 0. Zero false-positive risk; the only
   design question is when the site is ready to stop treating this as a known gap (right now it'd
   fail immediately, so gate it once the fix lands, not before).
3. **Touch-target hit-area check, Playwright-based, pseudo-element-aware.** For every `<button>`
   and `<a href>` under some CSS selector allowlist (icon-only controls, not every link), read
   `getBoundingClientRect()` on the element AND `getComputedStyle(el, '::before')`/`'::after'` to
   detect a negative-inset expansion trick; fail only if neither the box nor the expanded
   pseudo-element reaches 44px in the smaller dimension. This exact logic would have caught
   `.nav-caret` (§5) and confirmed `.donate-link`/`.theme-toggle`/`.search-trigger` are fine, with
   no manual per-element allowlisting.
4. **`transition:` value grep.** Fail on any `transition:` (or `transition-property`) declaration
   using `all`, or with a duration outside 100-300ms, across theme/route CSS. Cheap, static, no
   browser needed; this pass found zero violations, so the check would start green and just guard
   against regression.

**Not recommended yet:** a tabular-nums/numeral-column check (too much judgment about what counts
as a "column" to do cheaply without false positives) and a placeholder-only-label check (fieldset+
legend vs `<label>` vs `aria-label` are all valid per WCAG, so a mechanical check would need a
nuanced allowlist that isn't worth building until the site's convention is fully settled to one
pattern).
