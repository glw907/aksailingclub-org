# Pass 2.1 harvest (the seam's first production test: what it taught)

Compiled at the pass close, 2026-07-07. The pass was the extending-developer seam's first
production workout: ten plan tasks plus riders, built by Sonnet implementers under Fable
review, closed by a three-reviewer Opus fan-out whose confirmed findings were fixed before
merge. This file is the durable residue; the per-task evidence lives in the branch log.

## Engine follow-ups (cairn-cms)

1. **adminAction's audit-on-every-path contract vs validation rejects.** A handler that
   returns fail(400/404) before mutating anything must still emit an audit record or the
   dev-mode 500 fires. Every consumer in this pass hit it and adopted audit-the-reject.
   The posture is defensible (attempted-tamper visibility) but deserves a deliberate
   engine ruling; if kept, the reference page should state the idiom.
2. **Layout guards never run before POST actions** (traced in SvelteKit's own dispatch).
   A site's +layout.server.ts section guard protects loads only. The engine's
   add-a-custom-admin-screen guide must carry this in bold, with the site-local wrapper
   (compose adminAction with the site's role precondition; this repo's
   `clubAdminAction`) as the worked recipe. The pass's security review caught exactly one
   action that predated the wrapper and slipped (signups) — evidence the pattern must be
   unforgettable, not remembered.
3. **The auditSink wiring recipe** belongs in the same guide: ctx.audit logs structurally;
   persistence needs the site's hooks to set event.locals.auditSink (and the write must be
   awaited on Workers, or the response cancels it — the fire-and-forget shape drops rows).
4. **OfficeList ships no default eyebrow**; consumers pass it per section. Fine; the
   reference should show the idiom.
5. **deriveExcerpt/post subtitles cut mid-word** ("…and the Santa wi") — word-boundary +
   ellipsis nit, filed for a cairn pass.

## Site facts the next passes need

6. **Instructor identity is interim** (migration 0002): class_instructors.member_id holds
   the instructor's EMAIL plus a member_name display column until 2.2's members table
   exists; 2.2's member-model migration re-keys the FK and retires the interim shape.
7. **Class capacity=10 is an admin-editable placeholder** (fee corrected to the published
   $100); the committee sets real caps per class in the admin.
8. **The events read's rollback is a repoint** (EVENTS_DB binding kept, documented); the
   ops 410 patch is prepared at docs/plans/assets/ops-events-410.md, HELD for Geoff.
9. **Public-cutover blockers, named:** TURNSTILE_SECRET_KEY must be set (the degraded
   path fails open and permits unbounded unauthenticated D1 writes; acceptable only
   behind Access) plus a rate limit on the public class forms; the offer token rides the
   URL (accepted magic-link tradeoff; Referrer-Policy: no-referrer shipped; note the
   email-scanner residual in the offer email copy when 2.3 builds sends).
10. **Wrangler trap:** `d1 execute --remote --file` silently bulk-imports write-only SQL
    and discards SELECT output; verify files run via --command joined strings (each
    migration README carries the recipe).
11. **Remote D1 enforces REFERENCES table existence** (corrects the prior local-only
    memory): landing 0001 with FKs into a not-yet-existing members table made every
    class write path fail on the real database while all 253 unit tests stayed green,
    because the fake D1 double enforces nothing. Two rules follow: never land a REFERENCES
    edge before its target table, and every pass touching write paths ends with a
    scripted real-D1 (scratch) proof, not only the doubles. The 0005 member-domain
    migration (the authorized 2.2 substrate, pulled forward) closed the gap.
12. **The proof immediately earned its keep:** the same run caught a second live FK
    defect (class_offers.waitlist_id had no ON DELETE clause, so every claim's waitlist
    delete failed on real D1; fixed by 0006's CASCADE after confirming the UI never
    renders a claimed offer's chip once its waitlist row is gone). Two production-dead
    write paths, zero red unit tests: the scripted real-database proof is not optional.

## Method notes (what the close proved)

- The three-lens Opus fan-out over the branch found one HIGH (the unwrapped signups
  actions), two independent confirmations of the same atomicity defect (offer consume),
  and a timezone lie (UTC expiry rendered to an Alaska admin) that no single generalist
  review would likely have collected. The review-then-fix-batch shape (confirmed findings
  only, one dispatch) held.
- Every schema/import change ran the four-file discipline with a scratch-database proof
  before touching the real asc-club; zero rollbacks were needed on the real database all
  pass.
