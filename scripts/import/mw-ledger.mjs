#!/usr/bin/env node
/**
 * Import script: the 401-row MembershipWorks (MW) canon accounting export -> asc-club's money
 * ledger (`transactions` / `transaction_lines`, migration `0021_money_ledger`,
 * `docs/2026-07-13-money-ledger-design.md`). Every accounting row becomes exactly one
 * `transactions` row (a `charge`, `refund`, or `void`), broken into `transaction_lines` from the
 * export's own sub-total columns (`Membership Sub-Total` -> `dues`, `Event Sub-Total` ->
 * `class-fee`, `Donation Sub-Total` -> `donation`, `Cart Sub-Total` -> `asset-fee`, `Other
 * Sub-Total` plus `Handling`/`Total Tax` -> `other`) -- the export's own header-plus-lines shape,
 * not a guess.
 *
 * Categorization is structural, read straight off the row, never inferred:
 *   - `Items = 'Voided'`                     -> kind = 'void'
 *   - a negative `Transaction Total`          -> kind = 'refund'
 *   - everything else                        -> kind = 'charge'
 * A comped seat (`Discount Code` set, `Transaction Total = 0`) carries no real sub-total to build
 * a line from -- {@link buildListPriceIndex} derives a "list price" per tier (Membership rows) or
 * per `Reference` (Event rows) from the SAME export's own highest non-comped charge for that key,
 * and the comp gets a positive item line at that price plus a matching negative `discount` line,
 * netting to the row's real zero total.
 *
 * Domain linking is best-effort, never a hard requirement of writing the row: a `dues` line links
 * to the already-imported `memberships` row matching the transaction's household, date, and price
 * (the same three columns `mw-members.mjs` wrote them from); a `class-fee` line links to the
 * `class_enrollments` row sharing the transaction's `Payment ID` as `stripe_ref`, when exactly one
 * such row exists for the household (a multi-seat group purchase is left unlinked, never guessed
 * at). A transaction whose `Account ID` resolves to NO household is refused loudly (Membership/
 * Event rows only -- `mw-members.mjs` resolved every real account, so a miss here is a defect to
 * surface); a
 * Donation row's `household_id` is simply left null, using the row's own `Name`/`Email` as a
 * payer snapshot, since donors need not be members. A refund is linked to its original charge by
 * matching the most recent prior unconsumed same-account/same-type(/same-`Reference`-for-Event)
 * charge of the same absolute amount, `preprocessAccounting`'s own netting key
 * (`mw-members.mjs`) -- unlinkable when no such charge exists in this run.
 *
 * Idempotency key: `mw_ref`, a stable hash of each row's own identifying columns (the export
 * carries no transaction-id column of its own) -- see {@link deriveMwRef}. A re-run against
 * unchanged input plans zero changes: every row's `mw_ref` is checked against the database before
 * planning a write.
 *
 * Usage:
 *   node scripts/import/mw-ledger.mjs                    # dry run (default), prints the plan
 *   node scripts/import/mw-ledger.mjs --apply             # applies it to the real asc-club
 *   node scripts/import/mw-ledger.mjs --accounting /path --db asc-club
 *
 * Needs `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and
 * network access to the real `asc-club` database; always `--remote`, there is no local-D1 mode.
 *
 * SAFETY -- take a backup before `--apply`: this import applies as ONE `wrangler d1 execute
 * --remote --file` call with no cross-statement transaction. See `mw-ledger.README.md`.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEmail, normalizeNameCaps } from '../../src/admin-club/lib/member-normalize.js';
import { RowRefusedError, deriveMembershipTier, parseMoneyToInt, parseMwCsv, parseMwDateToIso, sqlInt } from './mw-members.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// SQL literal helper (mw-members.mjs's own `sqlLiteral` is a module-private four-liner; kept
// duplicated here rather than exported across scripts for one function, the same call
// `redactEmail` makes there).
// ---------------------------------------------------------------------------

/** @param {unknown} value @returns {string} */
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @param {Record<string, string>} row @returns {{ accountId: string, accountName: string, email: string }} */
function rowContext(row) {
  return { accountId: row['Account ID']?.trim() ?? '', accountName: row.Name?.trim() ?? '', email: row.Email?.trim() ?? '' };
}

// ---------------------------------------------------------------------------
// Idempotency key.
// ---------------------------------------------------------------------------

/** The columns that identify a row: everything else (address, contact info) is either
 *  reconstructible from these or irrelevant to what transaction the row describes. */
const MW_REF_COLUMNS = ['Date', 'Account ID', 'Transaction Type', 'Reference', 'Items', 'Transaction Total', 'Payment ID', 'Discount Code', 'Note'];

/**
 * Derives a stable `mw_ref` from a row's own identifying columns: the export carries no explicit
 * transaction-id column, so the row's own content stands in for one. Two rows with identical
 * values in every {@link MW_REF_COLUMNS} column collide (a real possibility -- two same-day,
 * same-amount comped seats for one account, say); {@link planMwLedgerImport} disambiguates a
 * collision within one run by appending a `#n` suffix, deterministic as long as the export's row
 * order stays stable across runs.
 * @param {Record<string, string>} row
 * @returns {string}
 */
export function deriveMwRef(row) {
  const canonical = MW_REF_COLUMNS.map((c) => `${c}=${(row[c] ?? '').trim()}`).join('|');
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  return `mw-ledger:${hash}`;
}

/**
 * The row's `kind`, read straight off its own columns: `Items = 'Voided'` always wins (a voided
 * row's `Transaction Total` can still be negative or positive), then a negative total is a
 * refund, and everything else is a charge.
 * @param {Record<string, string>} row
 * @param {{ accountId: string, accountName: string, email: string }} ctx
 * @returns {'charge' | 'refund' | 'void'}
 */
export function classifyKind(row, ctx) {
  if (row.Items?.trim() === 'Voided') return 'void';
  const total = parseMoneyToInt(row['Transaction Total'], ctx, 'Transaction Total');
  return total < 0 ? 'refund' : 'charge';
}

// ---------------------------------------------------------------------------
// Line-item breakdown from the export's own sub-total columns.
// ---------------------------------------------------------------------------

const SUBTOTAL_COLUMNS = /** @type {const} */ ([
  { column: 'Membership Sub-Total', item: 'dues', description: 'Membership dues' },
  { column: 'Event Sub-Total', item: 'class-fee', description: 'Class fee' },
  { column: 'Donation Sub-Total', item: 'donation', description: 'Donation' },
  { column: 'Cart Sub-Total', item: 'asset-fee', description: 'Asset add-on' },
  { column: 'Other Sub-Total', item: 'other', description: 'Other charge' },
]);

/**
 * Builds one line per non-zero export sub-total column, in `SUBTOTAL_COLUMNS` order, plus one
 * combined `other` line for `Handling` + `Total Tax` when their sum is non-zero. Every amount is
 * taken as its absolute value in cents: the sign of the transaction (charge/refund/void) lives on
 * the header's `kind`, never on an individual line (the spec's "everything else positive" rule).
 * @param {Record<string, string>} row
 * @param {{ accountId: string, accountName: string, email: string }} ctx
 * @returns {{ item: string, description: string, amountCents: number }[]}
 */
export function buildSubtotalLines(row, ctx) {
  const lines = [];
  for (const { column, item, description } of SUBTOTAL_COLUMNS) {
    const dollars = parseMoneyToInt(row[column] ?? '', ctx, column);
    if (dollars !== 0) lines.push({ item, description, amountCents: Math.abs(dollars) * 100 });
  }
  const handling = parseMoneyToInt(row.Handling ?? '', ctx, 'Handling');
  const tax = parseMoneyToInt(row['Total Tax'] ?? '', ctx, 'Total Tax');
  const extra = handling + tax;
  if (extra !== 0) lines.push({ item: 'other', description: 'Handling & tax', amountCents: Math.abs(extra) * 100 });
  return lines;
}

/**
 * @typedef {object} ListPriceIndex
 * @property {Map<string, number>} membershipCentsByTier the highest non-comped `Membership
 *   Sub-Total` seen for a tier, in cents
 * @property {Map<string, number>} eventCentsByReference the highest non-comped `Event Sub-Total`
 *   seen for an event `Reference`, in cents
 */

/**
 * Derives the "list price" a comped Membership or Event row's own sub-total (always zero) cannot
 * carry: the highest real, non-zero sub-total this SAME export shows for that tier (Membership)
 * or `Reference` (Event) -- the file's own going rate, not an external assumption. A tier this
 * export never charges anyone a real price for (every row for it happens to be comped) has no
 * entry; {@link planMwLedgerImport} refuses that comp rather than guessing.
 * @param {Record<string, string>[]} rows every accounting row (voided rows excluded up front --
 *   they never establish a real price)
 * @returns {ListPriceIndex}
 */
export function buildListPriceIndex(rows) {
  /** @type {Map<string, number>} */
  const membershipCentsByTier = new Map();
  /** @type {Map<string, number>} */
  const eventCentsByReference = new Map();

  for (const row of rows) {
    if (row.Items?.trim() === 'Voided') continue;
    const ctx = rowContext(row);
    const type = row['Transaction Type'];
    if (type === 'Membership') {
      let tier;
      try {
        tier = deriveMembershipTier(row.Items, ctx).tier;
      } catch {
        continue; // unrecognized tier text; not a usable price source
      }
      const dollars = parseMoneyToInt(row['Membership Sub-Total'] ?? '', ctx, 'Membership Sub-Total');
      if (dollars > 0) {
        const cents = dollars * 100;
        if ((membershipCentsByTier.get(tier) ?? 0) < cents) membershipCentsByTier.set(tier, cents);
      }
    } else if (type === 'Event') {
      const reference = row.Reference?.trim();
      const dollars = parseMoneyToInt(row['Event Sub-Total'] ?? '', ctx, 'Event Sub-Total');
      if (reference && dollars > 0) {
        const cents = dollars * 100;
        if ((eventCentsByReference.get(reference) ?? 0) < cents) eventCentsByReference.set(reference, cents);
      }
    }
  }
  return { membershipCentsByTier, eventCentsByReference };
}

// ---------------------------------------------------------------------------
// Per-row planning.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ExistingHouseholdMembership
 * @property {string} id
 * @property {string} householdId
 * @property {string | null} paidAt
 * @property {number} pricePaid dollars, `memberships.price_paid`'s own unit
 */
/**
 * @typedef {object} ExistingEnrollment
 * @property {string} id
 * @property {string} householdId
 * @property {string | null} stripeRef
 */
/**
 * @typedef {object} ExistingLedgerState
 * @property {Map<string, string>} householdIdByMwAccountId
 * @property {ExistingHouseholdMembership[]} memberships
 * @property {ExistingEnrollment[]} enrollments
 * @property {Set<string>} existingMwRefs every `transactions.mw_ref` already in the database
 */

/**
 * @typedef {object} PlannedLine
 * @property {string} item
 * @property {string} description
 * @property {number} amountCents
 * @property {string | null} membershipId
 * @property {string | null} enrollmentId
 * @property {string | null} assignmentId
 */
/**
 * @typedef {object} PlannedTransaction
 * @property {string} mwRef
 * @property {'charge' | 'refund' | 'void'} kind
 * @property {'stripe' | 'comp' | 'other'} source
 * @property {string} occurredAt
 * @property {number} amountTotalCents
 * @property {number | null} feeCents
 * @property {string | null} processorRef
 * @property {string | null} householdId
 * @property {string | null} payerName
 * @property {string | null} payerEmail
 * @property {PlannedLine[]} lines
 * @property {string | null} refundLinkKey netting key for refund->charge linking, null for
 *   non-refund/non-charge rows that never participate
 * @property {string | null} accountId `Account ID`, kept for the report
 */

/**
 * Plans one accounting row into a {@link PlannedTransaction}, or throws {@link RowRefusedError}
 * for a row this import declines to write (no household resolves for a Membership/Event
 * transaction's account; a comp row with no list-price source; the lines-sum-to-total invariant
 * fails). Does NOT resolve domain FKs (`membership_id`/`enrollment_id`) or
 * `refunds_transaction_id` -- {@link linkDomainRows} and {@link linkRefunds} do that in a second
 * pass, once every row in the file has been planned.
 * @param {Record<string, string>} row
 * @param {ExistingLedgerState} existing
 * @param {ListPriceIndex} listPrices
 * @returns {PlannedTransaction}
 */
export function planTransactionRow(row, existing, listPrices) {
  const ctx = rowContext(row);
  const type = row['Transaction Type'];
  const kind = classifyKind(row, ctx);
  const totalDollars = parseMoneyToInt(row['Transaction Total'], ctx, 'Transaction Total');
  const amountTotalCents = Math.abs(totalDollars) * 100;
  const occurredAt = parseMwDateToIso(row.Date, ctx);
  const processorRef = row['Payment ID']?.trim() || null;
  const feeDollars = parseMoneyToInt(row['Transaction Fee'] ?? '', ctx, 'Transaction Fee');
  const feeCents = feeDollars !== 0 ? Math.abs(feeDollars) * 100 : null;
  const discountCode = row['Discount Code']?.trim();
  const isComp = kind === 'charge' && amountTotalCents === 0 && Boolean(discountCode);
  const source = isComp ? 'comp' : processorRef ? 'stripe' : 'other';

  const accountId = ctx.accountId || null;
  const householdId = accountId ? (existing.householdIdByMwAccountId.get(accountId) ?? null) : null;
  if (type !== 'Donation' && !householdId) {
    throw new RowRefusedError(`no household resolves for account ${accountId ?? '(blank)'}`, ctx);
  }

  const payerName = !householdId && row.Name?.trim() ? normalizeNameCaps(row.Name.trim()) : null;
  const payerEmail = !householdId && row.Email?.trim() ? normalizeEmail(row.Email.trim()) : null;

  /** @type {PlannedLine[]} */
  let lines;
  if (isComp) {
    const compItem = type === 'Membership' ? 'dues' : type === 'Event' ? 'class-fee' : null;
    if (!compItem) throw new RowRefusedError(`comp row of unsupported transaction type: ${type}`, ctx);
    const key = type === 'Membership' ? deriveMembershipTier(row.Items, ctx).tier : row.Reference?.trim();
    const listPriceCents = type === 'Membership' ? listPrices.membershipCentsByTier.get(key) : listPrices.eventCentsByReference.get(key);
    if (!listPriceCents) throw new RowRefusedError(`no list price found for comped ${type.toLowerCase()} (key: ${key})`, ctx);
    lines = [
      { item: compItem, description: compItem === 'dues' ? 'Membership dues (comp)' : 'Class fee (comp)', amountCents: listPriceCents, membershipId: null, enrollmentId: null, assignmentId: null },
      { item: 'discount', description: 'Comp discount', amountCents: -listPriceCents, membershipId: null, enrollmentId: null, assignmentId: null },
    ];
  } else {
    lines = buildSubtotalLines(row, ctx).map((l) => ({ ...l, membershipId: null, enrollmentId: null, assignmentId: null }));
  }

  const lineSum = lines.reduce((s, l) => s + l.amountCents, 0);
  if (lineSum !== amountTotalCents) {
    throw new RowRefusedError(`lines sum to ${lineSum} cents but Transaction Total is ${amountTotalCents} cents`, ctx);
  }

  const refundLinkKey = accountId ? `${type}:${accountId}:${type === 'Event' ? (row.Reference?.trim() ?? '') : ''}` : null;

  return {
    mwRef: deriveMwRef(row),
    kind,
    source,
    occurredAt,
    amountTotalCents,
    feeCents,
    processorRef,
    householdId,
    payerName,
    payerEmail,
    lines,
    refundLinkKey,
    accountId,
  };
}

// ---------------------------------------------------------------------------
// Second pass: refund linking and domain-row linking.
// ---------------------------------------------------------------------------

/**
 * Links every `refund`-kind planned transaction to its originating `charge`, in place, by the
 * same netting key `mw-members.mjs`'s `preprocessAccounting` uses (account + type, plus
 * `Reference` for an Event): the most recent prior UNCONSUMED charge sharing the key and the
 * refund's own absolute amount. Unlike that script, both rows stay in the ledger -- this only
 * records the link, never drops either row. A refund with no matching charge in this run (its
 * charge predates this export, say) is left with `refundsTransactionId: null`, never refused --
 * the spec marks the FK "when identifiable", not mandatory.
 * @param {(PlannedTransaction & { id: string, refundsTransactionId: string | null })[]} planned
 *   every planned row, IN ORIGINAL FILE ORDER, already assigned an `id`
 */
export function linkRefunds(planned) {
  /** @type {Map<string, { id: string; amountCents: number; consumed: boolean }[]>} */
  const chargesByKey = new Map();
  for (const t of planned) {
    if (t.kind === 'charge' && t.refundLinkKey) {
      const list = chargesByKey.get(t.refundLinkKey) ?? [];
      list.push({ id: t.id, amountCents: t.amountTotalCents, consumed: false });
      chargesByKey.set(t.refundLinkKey, list);
    }
  }
  for (const t of planned) {
    if (t.kind !== 'refund' || !t.refundLinkKey) continue;
    const candidates = chargesByKey.get(t.refundLinkKey) ?? [];
    const match = [...candidates].reverse().find((c) => !c.consumed && c.amountCents === t.amountTotalCents);
    if (match) {
      match.consumed = true;
      t.refundsTransactionId = match.id;
    } else {
      t.refundsTransactionId = null;
    }
  }
}

/**
 * Fills in `membership_id`/`enrollment_id` on the `dues`/`class-fee` lines of every planned
 * charge, in place, matching against rows `mw-members.mjs` already wrote:
 *   - a `dues` line matches the `memberships` row sharing this transaction's household, date
 *     (`paid_at`), and price (`price_paid`) -- the exact three columns that row was built from.
 *   - a `class-fee` line matches a `class_enrollments` row sharing this transaction's
 *     `processor_ref` as `stripe_ref`, but ONLY when exactly one such enrollment exists for this
 *     household: a group purchase can seat more than one member under the same shared `stripe_ref`,
 *     and a single line can reference at most one domain row (the ledger's own invariant), so a
 *     multi-seat match is left unlinked rather than guessed at.
 * Neither link is required: a membership that was later deleted (a full-refund household, per
 * the accounting-is-canon ruling) or an enrollment with no unambiguous match leaves the line's FK
 * null, never a refusal -- the line still records the money fact.
 * @param {(PlannedTransaction & { id: string })[]} planned
 * @param {ExistingLedgerState} existing
 */
export function linkDomainRows(planned, existing) {
  for (const t of planned) {
    if (t.kind !== 'charge' || !t.householdId) continue;
    for (const line of t.lines) {
      if (line.item === 'dues') {
        const priceDollars = line.amountCents / 100;
        const match = existing.memberships.find((m) => m.householdId === t.householdId && m.paidAt === t.occurredAt && m.pricePaid === priceDollars);
        if (match) line.membershipId = match.id;
      } else if (line.item === 'class-fee' && t.processorRef) {
        const matches = existing.enrollments.filter((e) => e.householdId === t.householdId && e.stripeRef === t.processorRef);
        if (matches.length === 1) line.enrollmentId = matches[0].id;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level plan.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MwLedgerPlan
 * @property {(PlannedTransaction & { id: string, refundsTransactionId: string | null })[]} toInsert
 * @property {{ mwRef: string }[]} alreadyImported rows whose `mw_ref` is already in the database
 *   (the idempotent no-op path)
 * @property {{ reason: string, accountId: string }[]} refusals
 * @property {{ kind: string, source: string, count: number }[]} categoryCounts
 */

/**
 * Plans the whole import: classifies every row, links refunds and domain rows, and separates
 * already-imported rows (matched by `mw_ref`) from real work. Never writes anything -- `main()`'s
 * own statement-building step does that, gated on `--apply`.
 * @param {Record<string, string>[]} accountingRows every row of the accounting export, in file
 *   order
 * @param {ExistingLedgerState} existing
 * @returns {MwLedgerPlan}
 */
export function planMwLedgerImport(accountingRows, existing) {
  const listPrices = buildListPriceIndex(accountingRows);
  /** @type {{ reason: string, accountId: string }[]} */
  const refusals = [];
  /** @type {(PlannedTransaction & { id: string, refundsTransactionId: string | null })[]} */
  const planned = [];
  /** @type {Map<string, number>} */
  const seenRefs = new Map();

  for (const row of accountingRows) {
    let t;
    try {
      t = planTransactionRow(row, existing, listPrices);
    } catch (err) {
      if (err instanceof RowRefusedError) {
        refusals.push({ reason: err.reason, accountId: err.context.accountId || '(blank)' });
        continue;
      }
      throw err;
    }
    const seenCount = seenRefs.get(t.mwRef) ?? 0;
    seenRefs.set(t.mwRef, seenCount + 1);
    const mwRef = seenCount === 0 ? t.mwRef : `${t.mwRef}#${seenCount}`;
    planned.push({ ...t, mwRef, id: randomUUID(), refundsTransactionId: null });
  }

  linkRefunds(planned);
  linkDomainRows(planned, existing);

  const toInsert = planned.filter((t) => !existing.existingMwRefs.has(t.mwRef));
  const alreadyImported = planned.filter((t) => existing.existingMwRefs.has(t.mwRef)).map((t) => ({ mwRef: t.mwRef }));

  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const t of toInsert) {
    const key = `${t.kind}:${t.source}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const categoryCounts = [...counts.entries()].map(([key, count]) => {
    const [kind, source] = key.split(':');
    return { kind, source, count };
  });

  return { toInsert, alreadyImported, refusals, categoryCounts };
}

// ---------------------------------------------------------------------------
// Statement building.
// ---------------------------------------------------------------------------

/**
 * Builds the `transactions` INSERT plus one `transaction_lines` INSERT per line for one planned
 * row -- the same shape `src/admin-club/lib/ledger.ts`'s `buildTransactionStatements` enforces at
 * the live write seam, expressed as raw SQL text (this script has no `D1Database` object; it
 * shells out through `wrangler d1 execute`, exactly like `mw-members.mjs`).
 * @param {PlannedTransaction & { id: string, refundsTransactionId: string | null }} t
 * @returns {string[]}
 */
export function buildTransactionInsertStatements(t) {
  const statements = [
    `INSERT INTO transactions (id, kind, source, occurred_at, amount_total_cents, fee_cents, processor_ref, refunds_transaction_id, household_id, payer_name, payer_email, mw_ref) VALUES (${sqlLiteral(t.id)}, ${sqlLiteral(t.kind)}, ${sqlLiteral(t.source)}, ${sqlLiteral(t.occurredAt)}, ${sqlInt(t.amountTotalCents)}, ${t.feeCents === null ? 'NULL' : sqlInt(t.feeCents)}, ${sqlLiteral(t.processorRef)}, ${sqlLiteral(t.refundsTransactionId)}, ${sqlLiteral(t.householdId)}, ${sqlLiteral(t.payerName)}, ${sqlLiteral(t.payerEmail)}, ${sqlLiteral(t.mwRef)})`,
  ];
  for (const line of t.lines) {
    statements.push(
      `INSERT INTO transaction_lines (id, transaction_id, item, description, amount_cents, membership_id, enrollment_id, assignment_id) VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(t.id)}, ${sqlLiteral(line.item)}, ${sqlLiteral(line.description)}, ${sqlInt(line.amountCents)}, ${sqlLiteral(line.membershipId)}, ${sqlLiteral(line.enrollmentId)}, ${sqlLiteral(line.assignmentId)})`,
    );
  }
  return statements;
}

/**
 * Formats the plan for a human read: category counts, refusals (account id + reason, no name or
 * email -- names/emails never print from this script), and the already-imported count. Printed
 * under `--dry-run` and on a real applied run alike.
 * @param {MwLedgerPlan} plan
 * @returns {string}
 */
export function formatReport(plan) {
  const lines = ['mw-ledger plan:'];
  lines.push(`  to insert: ${plan.toInsert.length}`);
  for (const c of plan.categoryCounts) lines.push(`    ${c.kind}/${c.source}: ${c.count}`);
  lines.push(`  already imported (no-op): ${plan.alreadyImported.length}`);
  lines.push(`  refused: ${plan.refusals.length}`);
  for (const r of plan.refusals) lines.push(`    account=${r.accountId}: ${r.reason}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Real-database plumbing (mirrors `mw-members.mjs`'s own `wrangler`/`query` helpers).
// ---------------------------------------------------------------------------

const dbNameFlagIndex = process.argv.indexOf('--db');
const DB_NAME = dbNameFlagIndex !== -1 ? process.argv[dbNameFlagIndex + 1] : 'asc-club';

/** @param {string[]} args */
function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/** @param {string} sql @returns {Record<string, unknown>[]} */
function query(sql) {
  const out = wrangler(['d1', 'execute', DB_NAME, '--remote', '--command', sql, '--json']);
  return JSON.parse(out)[0].results;
}

/** @returns {ExistingLedgerState} */
function readExistingState() {
  const members = query(`SELECT household_id, mw_account_id FROM members WHERE mw_account_id IS NOT NULL`);
  const householdIdByMwAccountId = new Map(members.map((r) => [String(r.mw_account_id), String(r.household_id)]));

  const memberships = query(`SELECT id, household_id, price_paid, paid_at FROM memberships`).map((r) => ({
    id: String(r.id),
    householdId: String(r.household_id),
    paidAt: r.paid_at === null ? null : String(r.paid_at),
    pricePaid: Number(r.price_paid),
  }));

  const enrollmentRows = query(
    `SELECT ce.id, ce.stripe_ref, m.household_id FROM class_enrollments ce JOIN members m ON m.id = ce.member_id WHERE ce.stripe_ref IS NOT NULL`,
  );
  const enrollments = enrollmentRows.map((r) => ({ id: String(r.id), householdId: String(r.household_id), stripeRef: String(r.stripe_ref) }));

  const existingMwRefs = new Set(query(`SELECT mw_ref FROM transactions WHERE mw_ref IS NOT NULL`).map((r) => String(r.mw_ref)));

  return { householdIdByMwAccountId, memberships, enrollments, existingMwRefs };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const argValue = (/** @type {string} */ flag, /** @type {string} */ fallback) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : fallback;
  };
  const accountingPath = argValue('--accounting', path.join(os.homedir(), '.local', 'asc-data', 'mw-accounting-2026-07-13.csv'));

  const existing = readExistingState();
  console.log(`mw-ledger: ${existing.memberships.length} membership(s), ${existing.enrollments.length} stripe-linked enrollment(s), ${existing.existingMwRefs.size} transaction(s) already in ${DB_NAME}`);

  const accountingRows = parseMwCsv(readFileSync(accountingPath, 'utf8'));
  console.log(`mw-ledger: ${accountingRows.length} accounting row(s) read`);

  const plan = planMwLedgerImport(accountingRows, existing);
  console.log(`\n${formatReport(plan)}`);

  if (!apply) {
    console.log('\ndry run (default): no statements executed. Pass --apply to write to the real database.');
    return;
  }
  if (plan.toInsert.length === 0) {
    console.log('\nmw-ledger: nothing to write (idempotent no-op run).');
    return;
  }

  const statements = plan.toInsert.flatMap((t) => buildTransactionInsertStatements(t));
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mw-ledger-'));
  const tmpFile = path.join(tmpDir, 'import.sql');
  writeFileSync(tmpFile, statements.join(';\n'));
  try {
    wrangler(['d1', 'execute', DB_NAME, '--remote', '--file', tmpFile]);
    console.log(`\nmw-ledger: applied ${statements.length} statement(s) to ${DB_NAME}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
