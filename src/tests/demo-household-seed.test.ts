import { describe, expect, it } from 'vitest';
import {
  DEMO_ACTOR,
  DEMO_ALEX_EMAIL,
  DEMO_ASSET_ASSIGNMENT_ID,
  DEMO_HOUSEHOLD_ID,
  DEMO_JORDAN_EMAIL,
  DEMO_MEMBERSHIP_ID,
  DEMO_MEMBER_ALEX_ID,
  DEMO_MEMBER_JORDAN_ID,
  DEMO_MEMBER_SAM_ID,
  buildApplyStatements,
  buildCleanupStatements,
  buildDemoPlan,
  checkSeededState,
  renderPlanText,
} from '../../scripts/import/demo-household.mjs';

describe('buildDemoPlan', () => {
  const plan = buildDemoPlan(2026, 500);

  it('names the household clearly as a demo, with Alex as primary', () => {
    expect(plan.household).toEqual({ id: DEMO_HOUSEHOLD_ID, name: '[DEMO] Harbor family', primaryMemberId: DEMO_MEMBER_ALEX_ID });
  });

  it('seeds two adults on Geoff\'s own plus-addressed emails and one minor with no email', () => {
    expect(plan.members).toEqual([
      { id: DEMO_MEMBER_ALEX_ID, householdId: DEMO_HOUSEHOLD_ID, name: '[DEMO] Alex Harbor', email: DEMO_ALEX_EMAIL, phone: '+19075550101', birthdate: null },
      { id: DEMO_MEMBER_JORDAN_ID, householdId: DEMO_HOUSEHOLD_ID, name: '[DEMO] Jordan Harbor', email: DEMO_JORDAN_EMAIL, phone: '+19075550102', birthdate: null },
      { id: DEMO_MEMBER_SAM_ID, householdId: DEMO_HOUSEHOLD_ID, name: '[DEMO] Sam Harbor', email: null, phone: null, birthdate: '2016-05-01' },
    ]);
  });

  it('prices the family-tier membership from the live setting and leaves it unpaid', () => {
    expect(plan.membership).toEqual({ id: DEMO_MEMBERSHIP_ID, householdId: DEMO_HOUSEHOLD_ID, season: 2026, tier: 'family', pricePaid: 500, paidAt: null });
  });

  it('attaches one active mooring assignment to that membership', () => {
    expect(plan.assetAssignment).toEqual({
      id: DEMO_ASSET_ASSIGNMENT_ID,
      assetType: 'mooring',
      membershipId: DEMO_MEMBERSHIP_ID,
      description: '[DEMO] Slip mooring',
      status: 'active',
    });
  });

  it('carries the season/price a caller reads live, not a hardcoded value', () => {
    expect(buildDemoPlan(2027, 550).membership).toMatchObject({ season: 2027, pricePaid: 550 });
  });
});

describe('renderPlanText', () => {
  it('prints every row the plan would write, and states no waiver rows are seeded', () => {
    const text = renderPlanText(buildDemoPlan(2026, 500));
    expect(text).toContain('[DEMO] Harbor family');
    expect(text).toContain('[DEMO] Alex Harbor');
    expect(text).toContain('[DEMO] Jordan Harbor');
    expect(text).toContain('[DEMO] Sam Harbor');
    expect(text).toContain('season=2026');
    expect(text).toContain('waiver_acceptances: none');
  });
});

describe('buildApplyStatements', () => {
  const plan = buildDemoPlan(2026, 500);
  const statements = buildApplyStatements(plan, 'batch-test-1');

  it('inserts the household, all three members, and the primary-member update', () => {
    expect(statements).toContainEqual(expect.stringContaining("INSERT INTO households (id, name) VALUES ('demo-hh-harbor'"));
    expect(statements.filter((s) => s.startsWith('INSERT INTO members '))).toHaveLength(3);
    expect(statements).toContainEqual(expect.stringContaining("UPDATE households SET primary_member_id = 'demo-mem-alex-harbor'"));
  });

  it('inserts the unpaid membership (paid_at column present, value NULL) and the active mooring assignment', () => {
    const membershipStatement = statements.find((s) => s.startsWith('INSERT INTO memberships'));
    expect(membershipStatement).toContain('paid_at');
    expect(membershipStatement).toMatch(/, NULL\);$/);
    expect(statements).toContainEqual(expect.stringContaining("INSERT INTO asset_assignments"));
  });

  it('writes zero waiver_acceptances rows', () => {
    expect(statements.some((s) => s.includes('waiver_acceptances'))).toBe(false);
  });

  it('audits every entity plus one batch summary, all under the demo actor', () => {
    const auditRows = statements.filter((s) => s.startsWith('INSERT INTO audit_log'));
    // household + 3 members + membership + asset_assignment (6 import.insert rows) + 1 import.batch summary
    expect(auditRows).toHaveLength(7);
    expect(auditRows.every((s) => s.includes(`'${DEMO_ACTOR}'`))).toBe(true);
    expect(statements.some((s) => s.includes("'import.batch'"))).toBe(true);
  });
});

describe('buildCleanupStatements', () => {
  const statements = buildCleanupStatements();

  it('sweeps the seed rows and every named side-effect table', () => {
    const joined = statements.join('\n');
    expect(joined).toContain('DELETE FROM waiver_acceptances');
    expect(joined).toContain('DELETE FROM contact_confirmations');
    expect(joined).toContain('DELETE FROM member_tokens');
    expect(joined).toContain('DELETE FROM email_log');
    expect(joined).toContain('DELETE FROM asset_assignments');
    expect(joined).toContain('DELETE FROM memberships');
    expect(joined).toContain('DELETE FROM members');
    expect(joined).toContain('DELETE FROM households');
    expect(joined).toContain(`DELETE FROM audit_log WHERE actor = '${DEMO_ACTOR}'`);
  });

  it('nulls the household primary before deleting members, avoiding a self-reference orphan', () => {
    const nullIndex = statements.findIndex((s) => s.includes('SET primary_member_id = NULL'));
    const deleteMembersIndex = statements.findIndex((s) => s.startsWith('DELETE FROM members '));
    expect(nullIndex).toBeGreaterThanOrEqual(0);
    expect(deleteMembersIndex).toBeGreaterThanOrEqual(0);
    expect(nullIndex).toBeLessThan(deleteMembersIndex);
  });

  it('matches email_log by the +demo- prefix, not the household id', () => {
    expect(statements.some((s) => s.includes("email_log WHERE recipient LIKE 'geoff.wright+demo-%'"))).toBe(true);
  });
});

describe('checkSeededState', () => {
  const plan = buildDemoPlan(2026, 500);
  const goodRows = {
    household: { id: DEMO_HOUSEHOLD_ID, name: '[DEMO] Harbor family', primary_member_id: DEMO_MEMBER_ALEX_ID },
    members: [
      { id: DEMO_MEMBER_ALEX_ID, name: '[DEMO] Alex Harbor', email: DEMO_ALEX_EMAIL, phone: '+19075550101', birthdate: null },
      { id: DEMO_MEMBER_JORDAN_ID, name: '[DEMO] Jordan Harbor', email: DEMO_JORDAN_EMAIL, phone: '+19075550102', birthdate: null },
      { id: DEMO_MEMBER_SAM_ID, name: '[DEMO] Sam Harbor', email: null, phone: null, birthdate: '2016-05-01' },
    ],
    membership: { id: DEMO_MEMBERSHIP_ID, season: 2026, tier: 'family', price_paid: 500, paid_at: null },
    assetAssignment: { id: DEMO_ASSET_ASSIGNMENT_ID, asset_type: 'mooring', membership_id: DEMO_MEMBERSHIP_ID, status: 'active' },
    waiverCount: 0,
  };

  it('passes every check on a correctly-seeded household', () => {
    const checks = checkSeededState(plan, goodRows);
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it('fails the membership check when the row is paid', () => {
    const checks = checkSeededState(plan, { ...goodRows, membership: { ...goodRows.membership, paid_at: '2026-01-01' } });
    const membershipCheck = checks.find((c) => c.name.includes('unpaid'));
    expect(membershipCheck?.pass).toBe(false);
  });

  it('fails the waiver check when a signature exists', () => {
    const checks = checkSeededState(plan, { ...goodRows, waiverCount: 1 });
    const waiverCheck = checks.find((c) => c.name.includes('waiver_acceptances'));
    expect(waiverCheck?.pass).toBe(false);
  });

  it('fails the household check when the household is missing', () => {
    const checks = checkSeededState(plan, { ...goodRows, household: null });
    expect(checks.find((c) => c.name.includes('household'))?.pass).toBe(false);
  });
});
