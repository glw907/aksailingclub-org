// The renewal-reminders job's own Former-transition sweep (Members pass T2, migration
// 0033_member_standing): a household whose renewal boundary plus FORMER_SEQUENCE_DAYS (30) has
// passed is marked Former (source 'sequence'); one whose boundary has since moved back into the
// future (a renewal) has its own sequence-sourced marker cleared. Deliberately independent of the
// touch-sending machinery `renewal-reminders.test.ts` already covers -- this file proves that
// independence directly, including the "staleness-window-expired" case (an imported/dormant
// household whose 30_after touch can never fire, per the touch machinery's own 10-day staleness
// cutoff, still transitions to Former).
import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { renewalRemindersJob } from '../jobs/renewal-reminders';

/** A household row shaped for `listHouseholdsWithPaidMembership`'s own grounding query. */
function household(paidAt: string) {
  return { household_id: 'hh-1', household_name: 'The Larsens', paid_at: paidAt };
}

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('renewalRemindersJob.run: the Former-transition sweep', () => {
  const NOW = new Date('2027-06-15T00:00:00Z');

  it('marks a household Former once its renewal boundary plus 30 days has passed, with no touch due at all (the staleness-window-expired case: an imported/dormant household)', async () => {
    // paid_at 500 days ago: the boundary (365 days) plus the Former sequence window (30 days) is
    // long past, AND the 30_after touch's own due date (day 395) is far outside the touch
    // machinery's 10-day staleness cutoff -- no touch fires at all, but the Former sweep still
    // marks it, proving the two are independent (this file's own header).
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 500))],
        'FROM renewal_reminders_sent WHERE household_id': [],
      },
      runResults: {
        "UPDATE households SET former_at = datetime('now')": { changes: 1 },
      },
    });

    const summary = await renewalRemindersJob.run({}, { db, now: NOW });

    expect(summary.detail).toContain('former_marked=1');
    expect(summary.detail).toContain('households_with_a_due_touch=0');
    const markCall = calls.find((c) => c.sql.startsWith("UPDATE households SET former_at = datetime('now')"));
    expect(markCall?.args).toEqual(['hh-1', 'sequence']);
    expect(markCall?.sql).toContain('former_at IS NULL');
  });

  it('does NOT mark Former while still inside the 30-day window past the boundary (Overdue, full benefits)', async () => {
    // paid_at 375 days ago: 10 days past the one-year boundary, still inside the 30-day window.
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 375))],
        'FROM renewal_reminders_sent WHERE household_id': [],
      },
      runResults: {
        'UPDATE households SET former_at = NULL': { changes: 0 },
      },
    });

    const summary = await renewalRemindersJob.run({}, { db, now: NOW });

    expect(summary.detail).toContain('former_marked=0');
    expect(calls.some((c) => c.sql.startsWith("UPDATE households SET former_at = datetime('now')"))).toBe(false);
    const clearCall = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(clearCall?.sql).toContain("former_source = 'sequence'");
  });

  it('is idempotent: marking an already-marked household reports no new write (the guard, not a re-run count)', async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 500))],
        'FROM renewal_reminders_sent WHERE household_id': [],
      },
      runResults: {
        // Already marked: former_at IS NULL no longer matches, so the guarded UPDATE changes 0 rows.
        "UPDATE households SET former_at = datetime('now')": { changes: 0 },
      },
    });

    const summary = await renewalRemindersJob.run({}, { db, now: NOW });

    expect(summary.detail).toContain('former_marked=0');
  });

  it('auto-clears a stale sequence-sourced marker once a renewal moves the boundary back into the future ("payment clears Former")', async () => {
    // Renewed 10 days ago: this cycle's own paid_at is recent, so the boundary is far in the
    // future and the household is nowhere near Former. Any leftover 'sequence' marker from a
    // PRIOR cycle is cleared so the stored column stays eventually accurate (this file's own
    // header; classifyHouseholdStanding already reads a superseded marker correctly on every live
    // lookup regardless of whether this clear has run).
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 10))],
        'FROM renewal_reminders_sent WHERE household_id': [],
      },
      runResults: {
        'UPDATE households SET former_at = NULL': { changes: 1 },
      },
    });

    const summary = await renewalRemindersJob.run({}, { db, now: NOW });

    expect(summary.detail).toContain('former_cleared=1');
    const clearCall = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(clearCall?.args).toEqual(['hh-1']);
  });

  it('never fires the clear guard\'s WHERE against a manual marker: the clear call always scopes to former_source = \'sequence\', regardless of the fake\'s own changes count', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 10))],
        'FROM renewal_reminders_sent WHERE household_id': [],
      },
      // A manually-marked household never matches this guard in real SQL (former_source =
      // 'manual' != 'sequence'); the fake reports 0 changes for it here as that real-world outcome.
      runResults: {
        'UPDATE households SET former_at = NULL': { changes: 0 },
      },
    });

    const summary = await renewalRemindersJob.run({}, { db, now: NOW });

    expect(summary.detail).toContain('former_cleared=0');
    const clearCall = calls.find((c) => c.sql.startsWith('UPDATE households SET former_at = NULL'));
    expect(clearCall?.sql).toBe("UPDATE households SET former_at = NULL, former_source = NULL WHERE id = ?1 AND former_source = 'sequence'");
  });

  it('a re-run of the same tick against unchanged data changes nothing further (idempotent sweep, matching the touch machinery\'s own no-double-fire guarantee)', async () => {
    const runOnce = () =>
      renewalRemindersJob.run(
        {},
        {
          db: fakeD1({
            allResults: {
              'FROM households h JOIN memberships m': [household(isoDaysAgo(NOW, 500))],
              'FROM renewal_reminders_sent WHERE household_id': [],
            },
            runResults: {
              // Simulates the SECOND run against a household already marked on the first: the
              // guard means both ticks report the same "no new write" outcome.
              "UPDATE households SET former_at = datetime('now')": { changes: 0 },
            },
          }).db,
          now: NOW,
        },
      );

    const first = await runOnce();
    const second = await runOnce();

    expect(first.detail).toContain('former_marked=0');
    expect(second.detail).toContain('former_marked=0');
  });
});
