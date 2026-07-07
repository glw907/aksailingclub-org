# What the club needs vs what we've specced: the gap analysis

Synthesized on Fable, 2026-07-07, from three evidence streams: the MembershipWorks teardown
(what members live with today), a seven-product category survey (Wild Apricot, ClubExpress,
Join It, TidyHQ, Memberful, GrowthZone, DIY; vendor primary sources), and ASC's actuals (the
phase-2 design suite, the ops schema, the MW export's real shape). The question Geoff asked:
what functionality do we need, and what might we be missing?

## The headline: the build is aimed at the right target

Two category-level findings vindicate the whole absorption:

1. **Season-long asset assignment (moorings, parking, racks) is unserved by the entire
   category.** Even ClubExpress, the boating-club specialist, offers only time-slot rental
   plus a display-only fleet roster; no product models annual assignment + waitlist +
   per-asset billing. This is why ops had to exist. The custom build isn't reinventing a
   commodity; it's building the one thing nobody sells.
2. **Class credits as durable dollar-valued ledger entries exist nowhere** (the closest is
   GrowthZone's professional-CE transcripts). The club's published never-expire promise is
   custom-build territory by nature.

Where the category IS strong (payments plumbing, lifecycle states, email hygiene), the specced
system already covers most of it, and the audit convention beats the category outright (only
TidyHQ keeps a real admin audit trail).

## Confirmed gaps: specced system vs what the evidence says a club needs

Ranked by how much they'd bite, with a recommendation each.

### 1. Liability waivers with text versioning (the insurance one) — NOT IN THE SPEC
The club requires signed liability releases (the education and visiting pages say so; MW
carries a release-of-liability field; the export confirms it). The phase-2 suite never
mentions waivers. The category's reference shape (ClubExpress + TidyHQ's versioning detail):
store WHICH VERSION of the release text each person accepted, timestamped, with signer name,
at BOTH join and class registration, guest signing included, retrievable years later —
because that's what the insurer's lawyer asks for.
**Recommend:** a small `waiver_acceptances` table (person, context, text-version, timestamp)
+ a versioned waiver text in settings, wired into the join flow (2.2) and class signup (2.1's
public forms can land the table early). Cheap now, painful to retrofit.

### 2. Offline check/cash payment recording — NOT IN THE SPEC
Universal in the category, including the lean tools, because volunteer-club treasurers really
do take checks (the club's own join page offers it). A Stripe-only build breaks at the first
mailed check.
**Recommend:** 2.2's payment model includes an admin "record offline payment" action (amount,
method check/cash, reference note), audited, feeding the same membership/payment rows.

### 3. The grace state in the lifecycle ladder — PARTIALLY SPECCED
The suite has active/lapsed/archived. The category's mature pattern distinguishes
renewal-overdue (in grace: still treated warmly, maybe still in the directory) from lapsed
(grace expired). MW itself runs two independent grace day-counts (directory removal vs
access loss).
**Recommend:** standing derives as current → grace → lapsed → archived, with the two windows
as Club settings. This also answers the portal doc's open item 3 (directory drop-off) with a
setting instead of a hard rule.

### 4. Bounce handling + per-recipient delivery visibility — 2.3 RISK
The suite carries per-recipient send logs (ops's convention). What it lacks: hard-bounce
suppression (auto-flag the member record, stop sending, prompt a volunteer to fix the
address) and the "did Bob get his renewal notice?" answer surfaced on the member detail.
Without it, someone emails a dead address for two years. Note: Cloudflare Email Sending's
bounce-feedback surface needs verifying in 2.3's design step; if it's thin, the fallback is
manual bounce marking on the member record.
**Recommend:** add both to 2.3's email consolidation acceptance.

### 5. Donation + payment receipts with 501(c)(3) substantiation language — EASY WIN
The survey's striking negative: NO vendor ships proper IRS substantiation language on
receipts. The club already takes donations through the new form. A receipt template with the
right language ("no goods or services were provided...") makes the club's paperwork better
than every commercial product.
**Recommend:** 2.2's receipt emails carry the substantiation boilerplate; the treasurer
blesses the wording once.

### 6. Treasurer-shaped exports — THIN IN THE SPEC
The dashboard's Money tile is specced; what the treasurer needs at year end is
payments-by-type CSV and a deposit-level view that reconciles against the bank statement.
No 990 report exists anywhere in the category; "exports the 990 preparer can derive lines
from" is the real target.
**Recommend:** one CSV export (payments with type/date/method/season) lands with 2.2; the
deposit-style rollup can wait for real treasurer feedback.

### 7. Duplicate detection — DEFERRED WITH EYES OPEN
Endemic in club data (typo'd emails, remarried names); almost every vendor built a merge
tool. At 210 members the import dedups once, and after that volume is low.
**Recommend:** the 2.2 import refuses exact-duplicate emails; an admin merge tool is
explicitly deferred until the club actually hits the case. Named here so it's a decision,
not an omission.

## Policy questions the evidence surfaces (for Geoff, not urgent tonight)

1. **Mid-season joins:** flat dues regardless of join month, or any proration? (The category
   builds proration because calendar-year dues + mid-year joins produce fairness disputes;
   the club's current practice appears to be flat.)
2. **The 8 auto-billed members** (from the export): their MW recurrence dies at cutover.
   Plan: import flag + one courteous email + the normal renewal flow. Bless the email.
3. **Grace windows:** how long after lapse does a member stay in the directory / keep
   member access? (Becomes two settings; MW's defaults were per-club anyway.)
4. **Elections:** the committees page says electronic voting runs before the annual meeting.
   Out of phase-2 scope on purpose (a yearly one-ballot form); confirm that's fine.

## What we're deliberately NOT building (category features that don't fit)

Auto-renew/card vaulting in v1 (annual manual rhythm; revisit only if members ask),
workflow-engine win-back sequences (one filtered email a year does it), volunteer-hour
logging (no bylaw mandate), newsletter authoring (Discord + posts carry club news), a
prospect pipeline, engagement scoring, and LMS-style anything. Lean is the point.
