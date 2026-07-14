import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildListPriceIndex,
  buildSubtotalLines,
  buildTransactionInsertStatements,
  classifyKind,
  deriveMwRef,
  formatReport,
  linkDomainRows,
  linkRefunds,
  planMwLedgerImport,
  planTransactionRow,
} from '../../scripts/import/mw-ledger.mjs';
import { RowRefusedError, parseMwCsv } from '../../scripts/import/mw-members.mjs';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadRows() {
  return parseMwCsv(readFileSync(path.join(FIXTURES_DIR, 'mw-accounting-ledger-synthetic.csv'), 'utf8'));
}

const CTX = { accountId: 'acct-1', accountName: 'Test', email: 'test@example.com' };

/** The database state `mw-members.mjs` would already have written before this backfill runs:
 *  households acct-1 through acct-6 resolved (acct-unknown deliberately absent), one existing
 *  membership matching the bundle transaction's dues line, one existing stripe-linked enrollment
 *  matching the event transaction. */
function existingState() {
  return {
    householdIdByMwAccountId: new Map([
      ['acct-1', 'household-1'],
      ['acct-2', 'household-2'],
      ['acct-3', 'household-3'],
      ['acct-4', 'household-4'],
      ['acct-5', 'household-5'],
      ['acct-6', 'household-6'],
    ]),
    memberships: [{ id: 'membership-1', householdId: 'household-1', paidAt: '2026-01-10', pricePaid: 150 }],
    enrollments: [{ id: 'enrollment-1', householdId: 'household-4', stripeRef: 'ch_evt1' }],
    existingMwRefs: new Set<string>(),
  };
}

describe('classifyKind', () => {
  it('classifies a voided row as void regardless of its Transaction Total sign', () => {
    expect(classifyKind({ Items: 'Voided', 'Transaction Total': '90' }, CTX)).toBe('void');
  });

  it('classifies a negative-total row as a refund', () => {
    expect(classifyKind({ Items: '', 'Transaction Total': '-120' }, CTX)).toBe('refund');
  });

  it('classifies everything else as a charge', () => {
    expect(classifyKind({ Items: '', 'Transaction Total': '100' }, CTX)).toBe('charge');
    expect(classifyKind({ Items: '', 'Transaction Total': '0' }, CTX)).toBe('charge');
  });
});

describe('deriveMwRef', () => {
  it('is stable across repeated derivation of the same row', () => {
    const row = { Date: 'Jan 10, 2026', 'Account ID': 'acct-1', 'Transaction Type': 'Membership', Reference: '', Items: 'Family membership - Renewal', 'Transaction Total': '200', 'Payment ID': 'ch_fam1', 'Discount Code': '', Note: '' };
    expect(deriveMwRef(row)).toBe(deriveMwRef({ ...row }));
  });

  it('differs when an identifying column differs', () => {
    const a = { Date: 'Jan 10, 2026', 'Account ID': 'acct-1', 'Transaction Type': 'Membership', Reference: '', Items: 'x', 'Transaction Total': '200', 'Payment ID': '', 'Discount Code': '', Note: '' };
    const b = { ...a, 'Account ID': 'acct-2' };
    expect(deriveMwRef(a)).not.toBe(deriveMwRef(b));
  });
});

describe('buildSubtotalLines', () => {
  it('builds one line per non-zero sub-total column, dropping zero columns', () => {
    const row = { 'Membership Sub-Total': '150', 'Event Sub-Total': '0', 'Donation Sub-Total': '0', 'Cart Sub-Total': '50', 'Other Sub-Total': '0', Handling: '0', 'Total Tax': '0' };
    expect(buildSubtotalLines(row, CTX)).toEqual([
      { item: 'dues', description: 'Membership dues', amountCents: 15000 },
      { item: 'asset-fee', description: 'Asset add-on', amountCents: 5000 },
    ]);
  });

  it('combines Handling and Total Tax into one other line', () => {
    const row = { 'Membership Sub-Total': '0', 'Event Sub-Total': '75', 'Donation Sub-Total': '0', 'Cart Sub-Total': '0', 'Other Sub-Total': '0', Handling: '2', 'Total Tax': '3' };
    expect(buildSubtotalLines(row, CTX)).toEqual([
      { item: 'class-fee', description: 'Class fee', amountCents: 7500 },
      { item: 'other', description: 'Handling & tax', amountCents: 500 },
    ]);
  });
});

describe('buildListPriceIndex', () => {
  it('derives the highest non-comped price per membership tier and per event Reference', () => {
    const rows = loadRows();
    const index = buildListPriceIndex(rows);
    // The highest "individual" price in the fixture is Jordan Fiveington's $120 (later refunded);
    // a later refund does not disqualify a row from establishing a real list price.
    expect(index.membershipCentsByTier.get('individual')).toBe(12000);
    expect(index.membershipCentsByTier.get('family')).toBe(15000);
    expect(index.eventCentsByReference.get('2024-1st-adult')).toBe(7500);
  });
});

describe('planTransactionRow: membership bundle with an asset add-on line', () => {
  it('splits the Membership and Cart sub-totals into a dues line and an asset-fee line', () => {
    const rows = loadRows();
    const row = rows.find((r) => r['Account ID'] === 'acct-1')!;
    const planned = planTransactionRow(row, existingState(), buildListPriceIndex(rows));
    expect(planned.kind).toBe('charge');
    expect(planned.source).toBe('stripe');
    expect(planned.amountTotalCents).toBe(20000);
    expect(planned.feeCents).toBe(600);
    expect(planned.householdId).toBe('household-1');
    expect(planned.lines).toEqual([
      { item: 'dues', description: 'Membership dues', amountCents: 15000, membershipId: null, enrollmentId: null, assignmentId: null },
      { item: 'asset-fee', description: 'Asset add-on', amountCents: 5000, membershipId: null, enrollmentId: null, assignmentId: null },
    ]);
  });
});

describe('planTransactionRow: comped seat', () => {
  it('derives a list price and emits a positive item line plus a matching negative discount line', () => {
    const rows = loadRows();
    const row = rows.find((r) => r['Account ID'] === 'acct-3')!;
    const planned = planTransactionRow(row, existingState(), buildListPriceIndex(rows));
    expect(planned.source).toBe('comp');
    expect(planned.amountTotalCents).toBe(0);
    expect(planned.lines).toEqual([
      { item: 'dues', description: 'Membership dues (comp)', amountCents: 12000, membershipId: null, enrollmentId: null, assignmentId: null },
      { item: 'discount', description: 'Comp discount', amountCents: -12000, membershipId: null, enrollmentId: null, assignmentId: null },
    ]);
  });

  it('refuses a comp row whose tier has no real (non-comped) price anywhere in the file', () => {
    const rows = loadRows();
    const compOnlyRow = { ...rows.find((r) => r['Account ID'] === 'acct-3')!, Items: 'Young adult membership - Comp' };
    expect(() => planTransactionRow(compOnlyRow, existingState(), buildListPriceIndex(rows))).toThrow(RowRefusedError);
  });
});

describe('planTransactionRow: void', () => {
  it('records what would have moved, with no sign flip on the header amount', () => {
    const rows = loadRows();
    const row = rows.find((r) => r['Account ID'] === 'acct-6')!;
    const planned = planTransactionRow(row, existingState(), buildListPriceIndex(rows));
    expect(planned.kind).toBe('void');
    expect(planned.amountTotalCents).toBe(9000);
    expect(planned.lines).toEqual([{ item: 'dues', description: 'Membership dues', amountCents: 9000, membershipId: null, enrollmentId: null, assignmentId: null }]);
  });
});

describe('planTransactionRow: donation', () => {
  it('leaves household_id null and snapshots the payer name/email instead', () => {
    const rows = loadRows();
    const row = rows.find((r) => r['Transaction Type'] === 'Donation')!;
    const planned = planTransactionRow(row, existingState(), buildListPriceIndex(rows));
    expect(planned.householdId).toBeNull();
    expect(planned.payerName).toBe('Anonymous Donor');
    expect(planned.payerEmail).toBe('donor@example.com');
    expect(planned.lines).toEqual([{ item: 'donation', description: 'Donation', amountCents: 2500, membershipId: null, enrollmentId: null, assignmentId: null }]);
  });
});

describe('planTransactionRow: unmatchable row', () => {
  it('refuses a Membership row whose account resolves to no household', () => {
    const rows = loadRows();
    const row = rows.find((r) => r['Account ID'] === 'acct-unknown')!;
    expect(() => planTransactionRow(row, existingState(), buildListPriceIndex(rows))).toThrow(RowRefusedError);
  });
});

describe('linkRefunds', () => {
  it('links a refund to its most recent matching prior charge', () => {
    const rows = loadRows();
    const index = buildListPriceIndex(rows);
    const existing = existingState();
    const planned = rows
      .filter((r) => r['Account ID'] === 'acct-5')
      .map((row) => ({ ...planTransactionRow(row, existing, index), id: crypto.randomUUID(), refundsTransactionId: null as string | null }));
    linkRefunds(planned);
    const charge = planned.find((t) => t.kind === 'charge')!;
    const refund = planned.find((t) => t.kind === 'refund')!;
    expect(refund.refundsTransactionId).toBe(charge.id);
  });

  it('leaves refundsTransactionId null when no matching prior charge exists', () => {
    const orphanRefund = { kind: 'refund' as const, refundLinkKey: 'Membership:acct-9:', amountTotalCents: 5000, id: 'r1', refundsTransactionId: null as string | null };
    linkRefunds([orphanRefund] as never);
    expect(orphanRefund.refundsTransactionId).toBeNull();
  });
});

describe('linkDomainRows', () => {
  it('links a dues line to the matching existing membership row', () => {
    const rows = loadRows();
    const index = buildListPriceIndex(rows);
    const existing = existingState();
    const row = rows.find((r) => r['Account ID'] === 'acct-1')!;
    const planned = [{ ...planTransactionRow(row, existing, index), id: 't1', refundsTransactionId: null }];
    linkDomainRows(planned, existing);
    expect(planned[0].lines.find((l) => l.item === 'dues')?.membershipId).toBe('membership-1');
  });

  it('links a class-fee line to the single matching enrollment sharing the processor ref', () => {
    const rows = loadRows();
    const index = buildListPriceIndex(rows);
    const existing = existingState();
    const row = rows.find((r) => r['Account ID'] === 'acct-4')!;
    const planned = [{ ...planTransactionRow(row, existing, index), id: 't2', refundsTransactionId: null }];
    linkDomainRows(planned, existing);
    expect(planned[0].lines.find((l) => l.item === 'class-fee')?.enrollmentId).toBe('enrollment-1');
  });
});

describe('planMwLedgerImport (integration)', () => {
  it('plans every category, refuses the unmatchable row, and links refunds/domain rows', () => {
    const rows = loadRows();
    const plan = planMwLedgerImport(rows, existingState());

    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0].reason).toContain('no household resolves');
    expect(plan.toInsert).toHaveLength(rows.length - 1);

    const bundle = plan.toInsert.find((t) => t.householdId === 'household-1')!;
    expect(bundle.lines.find((l) => l.item === 'dues')?.membershipId).toBe('membership-1');

    const refund = plan.toInsert.find((t) => t.kind === 'refund')!;
    const charge = plan.toInsert.find((t) => t.kind === 'charge' && t.householdId === 'household-5')!;
    expect(refund.refundsTransactionId).toBe(charge.id);

    const voidRow = plan.toInsert.find((t) => t.kind === 'void')!;
    expect(voidRow.amountTotalCents).toBe(9000);

    for (const t of plan.toInsert) {
      const sum = t.lines.reduce((s, l) => s + l.amountCents, 0);
      expect(sum).toBe(t.amountTotalCents);
    }
  });

  it('is idempotent: a second run against unchanged input plans zero inserts', () => {
    const rows = loadRows();
    const existing = existingState();
    const first = planMwLedgerImport(rows, existing);
    const secondExisting = { ...existing, existingMwRefs: new Set(first.toInsert.map((t) => t.mwRef)) };
    const second = planMwLedgerImport(rows, secondExisting);
    expect(second.toInsert).toHaveLength(0);
    expect(second.alreadyImported).toHaveLength(first.toInsert.length);
  });
});

describe('buildTransactionInsertStatements', () => {
  it('emits one transactions INSERT and one transaction_lines INSERT per line', () => {
    const t = {
      id: 'txn-1',
      mwRef: 'mw-ledger:test',
      kind: 'charge' as const,
      source: 'stripe' as const,
      occurredAt: '2026-01-10',
      amountTotalCents: 15000,
      feeCents: 600,
      processorRef: 'ch_fam1',
      refundsTransactionId: null,
      householdId: 'household-1',
      payerName: null,
      payerEmail: null,
      lines: [{ item: 'dues', description: 'Membership dues', amountCents: 15000, membershipId: 'membership-1', enrollmentId: null, assignmentId: null }],
      refundLinkKey: null,
      accountId: 'acct-1',
    };
    const statements = buildTransactionInsertStatements(t);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO transactions');
    expect(statements[0]).toContain("'txn-1'");
    expect(statements[1]).toContain('INSERT INTO transaction_lines');
    expect(statements[1]).toContain("'membership-1'");
  });
});

describe('formatReport', () => {
  it('never includes a payer name or email, only account ids and counts', () => {
    const rows = loadRows();
    const plan = planMwLedgerImport(rows, existingState());
    const report = formatReport(plan);
    expect(report).not.toContain('Unknown Household');
    expect(report).toContain('acct-unknown');
  });
});
