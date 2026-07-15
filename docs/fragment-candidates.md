# Fragment candidates

> Running list of content that logically exists in multiple locations and should become a
> cairn **fragment** once the next cairn release ships the concept (noted by Geoff,
> 2026-07-15). Until then the policy is: duplicate freely, format consistently (usually via
> the shared components from the 2026-07-15 pass), and log the duplicate here. A future
> content-consolidation pass converts this list and deletes it.

Each entry: what the content is, where it currently lives, and the likely fragment shape.
Where the 2026-07-15 pass converged duplicated copies on one canonical wording (allowed, per
Geoff: gentle realignment that makes the future extraction mechanical), the entry records
that canonical form.

- **Mooring cost and eligibility** — Moorings (facts block) and Join (additional-fees table).
  Fragment: a `:::facts` block (cost, eligibility, waitlist reality). Converged (2026-07-15
  retrofit): both pages now state the mooring fee identically as `$300/season`; Moorings
  carries the full facts row set (Cost, Eligibility, Boat size, Waitlist reality), Join's fee
  table carries only the `Moorings | $300/season` row. Canonical wording: `$300/season`.
- **Club physical + mailing address, "get directions" link** — Contact ("Our Location"),
  Visiting ("Getting there"), restated in prose on Home. Fragment: a `:::facts` address block.
  Visiting now carries the canonical shape (2026-07-15 retrofit): a one-row `:::facts` block
  labeled `Getting there`, value `Mile 8.2 South Big Lake Road, Big Lake, AK 99654, about an
  hour north of Anchorage on the Parks Highway. See Contact for a map link.` Contact's own page
  is not yet converged onto this shape (out of the bounded Task 7 retrofit).
- **Storage fees** ($100 trailer row, $100 RV, $300 mooring, $50 rack) — Join's fee table and
  each storage page's own statement. Fragment: one fees table or per-resource facts rows.
  Join's additional-fees list is now a `:::table{variant="fees"}` (2026-07-15 retrofit) with
  columns `Item | Fee` and literal dollar amounts (`$100/season`, `$100/season`, `$300/season`,
  `$50/season`, `$100 per class`); the per-resource pages (Moorings, and any future Trailer Row
  / RV / Rack pages) still state their own fee independently, not yet fragment-sourced.
- **Club-boat ground rules** (log the boat, life jackets, guest accompaniment, two-hour
  blocks) — Visiting ("Club Boat Reminders") and Club Boat Use & Qualification; echoed in the
  New Member Guide. Fragment: a steps/facts hybrid, source of truth on the qualification page.
  Visiting's "Before you sail / At the dock / When you're done" prose is now a `:::steps`
  block (2026-07-15 retrofit), text moved verbatim (bold lead to step title, remainder to step
  body); New Member Guide's own restatement is untouched (out of the bounded Task 7 scope).
- **Life-jacket rule for kids 12 and under** — Visiting intro, New Member Guide safety
  section, Education (youth classes). Fragment: one requirement callout.
- **Camping / RV quick facts** (tenting included, transient RV limits, no potable water) —
  Visiting, New Member Guide, Education ("Camping at the ASC"). Fragment: facts block.
  Visiting's Transient RV Parking bullets are now a `:::facts` block (2026-07-15 retrofit):
  `Maximum stay`, `Maximum box length`, `Power`, `Water`, `Fire extinguisher`. New Member Guide
  and Education's own restatements are untouched (out of the bounded Task 7 scope).
- **"Who to ask" contact routes** (sailing questions → #education, broken/missing → Issues &
  Support, membership → contact) — New Member Guide "Need Help?", Visiting "Questions?",
  Contact "Other Ways to Reach Us". Fragment: a related/page-cta cluster. Converged
  (2026-07-15 retrofit): Visiting, Join, and New Member Guide all now close with a
  `:::page-cta` whose body lists the non-contact routes (Discord/Issues & Support) as prose and
  whose one action is a `:::cta-action` labeled `Contact us` linking to `/contact/`, kind
  `secondary`. Canonical action label: `Contact us`. Contact's own "Other Ways to Reach Us" is
  not yet converged onto this shape (out of the bounded Task 7 retrofit).
- **Registration path for classes** (new vs current vs returning member) — Education "Your
  Registration Path" and Join "How to Apply"/"Taking a Sailing Class?". Fragment: steps block.
  Join's "How to Apply" New Members list is now a `:::steps` block (2026-07-15 retrofit,
  bold lead moved to step title, remainder to step body); Education's "Your Registration Path"
  card cluster and Join's "Returning Members" card are untouched (out of the bounded Task 7
  scope).
- **Discord channel vocabulary** (#education, #fleet, #harbor, #racing, #general,
  #introductions and where each is pointed to) — Events, Join, Education, Contact, New Member
  Guide, Moorings. Fragment: possibly per-channel inline reference rather than one block.
