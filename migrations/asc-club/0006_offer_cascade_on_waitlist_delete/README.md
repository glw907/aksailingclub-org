# asc-club migration 0006: a claimed offer's row survives its waitlist entry's deletion

## What this does

Recreates `class_offers` (SQLite cannot alter a `REFERENCES` clause in place) so that
`waitlist_id`'s foreign key to `class_waitlist(id)` carries `ON DELETE CASCADE` instead of the
default `NO ACTION`. No other column changes.

## The finding, and why it is not migration 0005's own scope

Landing 0005's member domain and rewriting the write paths onto `ensureMember`, then proving the
whole chain end to end with `scripts/verify/real-d1-write-path.mjs`, surfaced a SECOND real-D1 FK
finding, unrelated to the member-domain gap: `claimOffer` (offers.ts) marks the consumed offer
`resolved = 'claimed'` (its own row is never deleted, by design, see below) and then deletes the
`class_waitlist` row it was offered to. `class_offers.waitlist_id REFERENCES class_waitlist(id)`
(`0001_substrate`) has no `ON DELETE` clause, SQLite's default `NO ACTION`, which refuses to delete
a parent row for as long as any child row still references it. Confirmed directly this session,
reproduced deterministically with a minimal isolated parent/child pair (independent of any timing
or replica routing): deleting a `class_waitlist` row while its own `class_offers` row still points
at it always fails with `FOREIGN KEY constraint failed`. This FK has been live since
`0001_substrate` first created `class_waitlist`, so `claimOffer` could never actually complete
against real D1, only against the `fakeD1` test double every existing unit test uses (`fakeD1`
enforces no FK at all, the same blind spot `0004_waitlist_integrity`'s README first named for the
member-domain gap 0005 fixed).

## Why `ON DELETE CASCADE`, not a nullable `waitlist_id`

The first fix considered was making `waitlist_id` nullable with `ON DELETE SET NULL`, preserving
every `class_offers` row forever as an audit trail even after its waitlist entry is gone. That
would have meant widening `OfferRow.waitlistId`'s type to `string | null` and auditing every
consumer of it. Reading the classes detail screen's own `waitlistView` derivation
(`+page.svelte`) first: its own comment already states plainly that "a claimed offer's own
waitlist row no longer exists (`claimOffer` deletes it), so a history chip is only ever
`'declined'` or `'expired'` here". The UI already joins `data.offers` back to `data.waitlist` by
id, so a claimed offer has ALWAYS been invisible in the admin screen the moment its waitlist row
is gone (`class-waitlist-actions.test.ts`-adjacent behavior, unaffected by this migration).
`ON DELETE CASCADE` makes the stored data match that already-existing, already-documented
behavior exactly: a claimed offer's row disappears at the same moment it already disappeared from
every UI that reads it, with zero type or call-site changes needed anywhere. A declined or expired
offer's waitlist row is never deleted by any code path (only `claimOffer`'s consume-and-enroll
sequence deletes one), so this `CASCADE` never fires for those, and their own history chips render
exactly as before.

`listOffersForClass`'s own doc comment ("a resolved offer keeps rendering as a history chip rather
than disappearing once claimed, declined, or expired") is imprecise for the claimed case
specifically, pre-dating this finding; not corrected here beyond this note, since the actual
runtime behavior (confirmed against the `.svelte` component's own comment) was already what this
migration now makes structurally consistent.

## How to run

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0006_offer_cascade_on_waitlist_delete/forward.sql
```

## Verify

```sh
npx wrangler d1 execute asc-club --remote --command "$(grep -v '^--' migrations/asc-club/0006_offer_cascade_on_waitlist_delete/verify.sql)"
```

Expect one row: `on_delete: "CASCADE"`.

## Proved safe before landing (2026-07-07)

The real `asc-club` `class_offers` table was confirmed empty (`SELECT COUNT(*)` returned 0) before
this migration ran: the offer/claim flow has never yet completed a real write against remote D1
(the very failure this migration fixes), so the recreate-and-copy carries no data to reconcile.
The `ON DELETE CASCADE` mechanism itself, and the underlying `NO ACTION` failure it fixes, were
both reproduced against a disposable isolated scratch database with a minimal two-table
parent/child pair before this migration was written; `scripts/verify/real-d1-write-path.mjs`'s own
run (this pass, its own report has the full transcript) is the end-to-end proof through the real
`claimOffer` write path afterward.

## Rollback

```sh
npx wrangler d1 execute asc-club --remote --file migrations/asc-club/0006_offer_cascade_on_waitlist_delete/rollback.sql
```

Safe only before any real claim has happened (see `rollback.sql`'s own header): a rollback after
that point reopens the `FOREIGN KEY constraint failed` failure on every future claim.
