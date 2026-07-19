#!/usr/bin/env node
/**
 * Seed script: the `[DEMO] Harbor family` household for the waivers board demo (member-waivers
 * board-demo pass, T3). Not a source-CSV import like `mw-members.mjs`; the household is a small,
 * fixed fixture this script mints directly against the live `asc-club` database so board members
 * can walk the family signing device (per-child Part Two, attestation radios, the household-
 * complete waiting state, the contact-confirm card) with a real session rather than a screenshot.
 *
 * The household mirrors the exact state `src/theme/join-apply-form.ts`'s `handleJoinApply` /
 * `src/member-signup/lib/statements.ts`'s `buildJoinStatements` persist for a fresh, unpaid join
 * application (household + members + one `season = current_season` `memberships` row with
 * `paid_at IS NULL`), plus one active `mooring` `asset_assignments` row on that membership, and
 * deliberately ZERO `waiver_acceptances` rows -- the whole point is that every document is
 * outstanding, so the household-complete gate and the payment-locked waiting state are real, not
 * simulated. `getCurrentSeason`/`getTierPrices` (`src/admin-club/lib/club-settings.ts`) are read
 * live rather than hardcoded, so the seed always lands at whatever season/price the site is
 * currently running under.
 *
 * Modes (exactly one required):
 *   --plan     dry run: prints every row this script would write, no database access to write
 *   --apply    writes the household live (idempotent: a second --apply is a no-op if the
 *              household already exists)
 *   --verify   asserts the seeded state against the live database, exits 1 on any mismatch
 *   --cleanup  removes every demo row (the seed rows plus generated side effects: any
 *              `waiver_acceptances`/`contact_confirmations`/`member_tokens` rows the demo's own
 *              sign-in or signing produced, and `email_log` rows sent to a `+demo-` recipient),
 *              then re-runs the verify assertions inverted (asserts zero rows) and prints proof
 *
 * Usage:
 *   node scripts/import/demo-household.mjs --plan
 *   node scripts/import/demo-household.mjs --apply
 *   node scripts/import/demo-household.mjs --verify
 *   node scripts/import/demo-household.mjs --cleanup
 *
 * `--club-db-name NAME` overrides the real `asc-club` write target; only ever used to scratch-
 * prove this script against a disposable database, never for a real run. Needs
 * `CLOUDFLARE_API_TOKEN` in the environment (wrangler picks it up automatically) and network
 * access to the real `asc-club` database; always `--remote`, there is no local-D1 mode here.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const clubDbFlagIndex = process.argv.indexOf('--club-db-name');
const CLUB_DB_NAME = clubDbFlagIndex !== -1 ? process.argv[clubDbFlagIndex + 1] : 'asc-club';

// ---------------------------------------------------------------------------
// Fixed demo identity (exported for the test suite). Ids follow the repo's own readable-fixture-
// id convention (`e2e/fixtures/waivers-seed.sql`'s `waiver-*` ids), prefixed `demo-` so every row
// this script owns is sweepable by prefix alone, independent of the emails/member ids below.
// ---------------------------------------------------------------------------

export const DEMO_ACTOR = 'admin:board-demo-seed';

export const DEMO_HOUSEHOLD_ID = 'demo-hh-harbor';
export const DEMO_MEMBER_ALEX_ID = 'demo-mem-alex-harbor';
export const DEMO_MEMBER_JORDAN_ID = 'demo-mem-jordan-harbor';
export const DEMO_MEMBER_SAM_ID = 'demo-mem-sam-harbor';
export const DEMO_MEMBERSHIP_ID = 'demo-ms-harbor';
export const DEMO_ASSET_ASSIGNMENT_ID = 'demo-aa-harbor-mooring';

/** Geoff's own club address via plus-addressing, so a live-demo magic link or nudge email lands
 *  in his inbox rather than a real member's. */
export const DEMO_ALEX_EMAIL = 'geoff.wright+demo-alex@aksailingclub.org';
export const DEMO_JORDAN_EMAIL = 'geoff.wright+demo-jordan@aksailingclub.org';
/** The `LIKE` prefix every generated-side-effect sweep (`email_log`) matches against. */
export const DEMO_EMAIL_PREFIX = 'geoff.wright+demo-%';

export const DEMO_ALEX_PHONE = '+19075550101';
export const DEMO_JORDAN_PHONE = '+19075550102';

/** Makes Sam ~10 years old for the life of this demo; the household device only needs "a child
 *  under AS 09.65.292", not an exact age. */
export const DEMO_SAM_BIRTHDATE = '2016-05-01';

export const DEMO_MEMBER_IDS = [DEMO_MEMBER_ALEX_ID, DEMO_MEMBER_JORDAN_ID, DEMO_MEMBER_SAM_ID];

// ---------------------------------------------------------------------------
// Pure planning (no DB/filesystem access -- unit-testable).
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DemoPlan
 * @property {{ id: string, name: string, primaryMemberId: string }} household
 * @property {{ id: string, householdId: string, name: string, email: string | null, phone: string | null, birthdate: string | null }[]} members
 * @property {{ id: string, householdId: string, season: number, tier: 'family', pricePaid: number, paidAt: null }} membership
 * @property {{ id: string, assetType: 'mooring', membershipId: string, description: string, status: 'active' }} assetAssignment
 */

/**
 * Builds the whole seed plan from the two live facts a fresh join would itself read at submit
 * time (`getCurrentSeason`, `getTierPrices(...).family`) -- kept as plain arguments so this
 * function stays pure and unit-testable with no database.
 * @param {number} currentSeason
 * @param {number} familyPriceDollars
 * @returns {DemoPlan}
 */
export function buildDemoPlan(currentSeason, familyPriceDollars) {
  return {
    household: { id: DEMO_HOUSEHOLD_ID, name: '[DEMO] Harbor family', primaryMemberId: DEMO_MEMBER_ALEX_ID },
    members: [
      {
        id: DEMO_MEMBER_ALEX_ID,
        householdId: DEMO_HOUSEHOLD_ID,
        name: '[DEMO] Alex Harbor',
        email: DEMO_ALEX_EMAIL,
        phone: DEMO_ALEX_PHONE,
        birthdate: null,
      },
      {
        id: DEMO_MEMBER_JORDAN_ID,
        householdId: DEMO_HOUSEHOLD_ID,
        name: '[DEMO] Jordan Harbor',
        email: DEMO_JORDAN_EMAIL,
        phone: DEMO_JORDAN_PHONE,
        birthdate: null,
      },
      {
        id: DEMO_MEMBER_SAM_ID,
        householdId: DEMO_HOUSEHOLD_ID,
        name: '[DEMO] Sam Harbor',
        email: null,
        phone: null,
        birthdate: DEMO_SAM_BIRTHDATE,
      },
    ],
    membership: {
      id: DEMO_MEMBERSHIP_ID,
      householdId: DEMO_HOUSEHOLD_ID,
      season: currentSeason,
      tier: 'family',
      pricePaid: familyPriceDollars,
      paidAt: null,
    },
    assetAssignment: {
      id: DEMO_ASSET_ASSIGNMENT_ID,
      assetType: 'mooring',
      membershipId: DEMO_MEMBERSHIP_ID,
      description: '[DEMO] Slip mooring',
      status: 'active',
    },
  };
}

/** @param {DemoPlan} plan @returns {string} */
export function renderPlanText(plan) {
  const lines = [
    'demo-household: PLAN (dry run, nothing written)',
    '',
    `household: ${plan.household.id} "${plan.household.name}" primary_member_id=${plan.household.primaryMemberId}`,
    'members:',
    ...plan.members.map((m) => `  - ${m.id} "${m.name}" email=${m.email ?? 'NULL'} phone=${m.phone ?? 'NULL'} birthdate=${m.birthdate ?? 'NULL'}`),
    `membership: ${plan.membership.id} season=${plan.membership.season} tier=${plan.membership.tier} price_paid=${plan.membership.pricePaid} paid_at=NULL`,
    `asset_assignment: ${plan.assetAssignment.id} asset_type=${plan.assetAssignment.assetType} membership_id=${plan.assetAssignment.membershipId} status=${plan.assetAssignment.status}`,
    '',
    'waiver_acceptances: none (every document stays outstanding by design)',
  ];
  return lines.join('\n') + '\n';
}

/** @param {unknown} value */
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** A fixed-width UTC timestamp id, matching `household-address-seed.mjs`'s own `batchId` shape.
 *  @param {string} prefix @returns {string} */
function timestampId(prefix) {
  return `${prefix}-${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Builds the ordered INSERT/UPDATE statements `--apply` runs, plus this batch's own audit trail
 * (one `import.insert` row per entity, one `import.batch` summary), all under actor
 * {@link DEMO_ACTOR}. Pure given `plan` and `batchId` -- no DB access -- so it stays
 * unit-testable.
 * @param {DemoPlan} plan
 * @param {string} batchId
 * @returns {string[]}
 */
export function buildApplyStatements(plan, batchId) {
  /** @type {string[]} */
  const statements = [];

  statements.push(`INSERT INTO households (id, name) VALUES (${sqlLiteral(plan.household.id)}, ${sqlLiteral(plan.household.name)});`);
  for (const m of plan.members) {
    statements.push(
      `INSERT INTO members (id, household_id, name, email, phone, birthdate) VALUES (${sqlLiteral(m.id)}, ${sqlLiteral(m.householdId)}, ${sqlLiteral(m.name)}, ${sqlLiteral(m.email)}, ${sqlLiteral(m.phone)}, ${sqlLiteral(m.birthdate)});`,
    );
  }
  statements.push(`UPDATE households SET primary_member_id = ${sqlLiteral(plan.household.primaryMemberId)} WHERE id = ${sqlLiteral(plan.household.id)};`);
  statements.push(
    `INSERT INTO memberships (id, household_id, season, tier, price_paid, paid_at) VALUES (${sqlLiteral(plan.membership.id)}, ${sqlLiteral(plan.membership.householdId)}, ${sqlLiteral(plan.membership.season)}, ${sqlLiteral(plan.membership.tier)}, ${sqlLiteral(plan.membership.pricePaid)}, NULL);`,
  );
  statements.push(
    `INSERT INTO asset_assignments (id, asset_type, membership_id, description, status) VALUES (${sqlLiteral(plan.assetAssignment.id)}, ${sqlLiteral(plan.assetAssignment.assetType)}, ${sqlLiteral(plan.assetAssignment.membershipId)}, ${sqlLiteral(plan.assetAssignment.description)}, ${sqlLiteral(plan.assetAssignment.status)});`,
  );

  const entities = [
    ['household', plan.household.id],
    ...plan.members.map((m) => /** @type {[string, string]} */ (['member', m.id])),
    ['membership', plan.membership.id],
    ['asset_assignment', plan.assetAssignment.id],
  ];
  for (const [entity, entityId] of entities) {
    statements.push(
      `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES (${sqlLiteral(DEMO_ACTOR)}, 'import.insert', ${sqlLiteral(entity)}, ${sqlLiteral(entityId)}, ${sqlLiteral(JSON.stringify({ batchId }))});`,
    );
  }
  statements.push(
    `INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES (${sqlLiteral(DEMO_ACTOR)}, 'import.batch', 'demo-household', NULL, ${sqlLiteral(JSON.stringify({ batchId, season: plan.membership.season, householdId: plan.household.id }))});`,
  );

  return statements;
}

/**
 * Builds the ordered `--cleanup` statements: every seed-generated side effect first (child rows
 * that reference a demo member, so nothing dangles even without FK enforcement), then the seed
 * rows themselves in dependency order, then this script's own audit trail. Pure -- no DB access.
 * @returns {string[]}
 */
export function buildCleanupStatements() {
  const memberIdList = DEMO_MEMBER_IDS.map(sqlLiteral).join(', ');
  return [
    `DELETE FROM waiver_acceptances WHERE member_id IN (${memberIdList}) OR minor_member_id IN (${memberIdList}) OR person_email LIKE ${sqlLiteral(DEMO_EMAIL_PREFIX)};`,
    `DELETE FROM contact_confirmations WHERE member_id IN (${memberIdList});`,
    `DELETE FROM member_tokens WHERE member_id IN (${memberIdList});`,
    `DELETE FROM email_log WHERE recipient LIKE ${sqlLiteral(DEMO_EMAIL_PREFIX)};`,
    `DELETE FROM asset_assignments WHERE id = ${sqlLiteral(DEMO_ASSET_ASSIGNMENT_ID)};`,
    `DELETE FROM memberships WHERE id = ${sqlLiteral(DEMO_MEMBERSHIP_ID)};`,
    `UPDATE households SET primary_member_id = NULL WHERE id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)};`,
    `DELETE FROM members WHERE household_id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)};`,
    `DELETE FROM households WHERE id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)};`,
    `DELETE FROM audit_log WHERE actor = ${sqlLiteral(DEMO_ACTOR)};`,
  ];
}

/**
 * @typedef {object} SeededRows
 * @property {{ id: string, name: string, primary_member_id: string | null } | null} household
 * @property {{ id: string, name: string, email: string | null, phone: string | null, birthdate: string | null }[]} members
 * @property {{ id: string, season: number, tier: string, price_paid: number, paid_at: string | null } | null} membership
 * @property {{ id: string, asset_type: string, membership_id: string, status: string } | null} assetAssignment
 * @property {number} waiverCount
 */

/**
 * Compares the plan against the live rows `--verify` (or `--apply`'s own post-check) queried,
 * returning one named pass/fail per assertion. Pure -- takes already-fetched rows, no DB access --
 * so the comparison logic itself stays unit-testable.
 * @param {DemoPlan} plan
 * @param {SeededRows} rows
 * @returns {{ name: string, pass: boolean, detail: string }[]}
 */
export function checkSeededState(plan, rows) {
  /** @type {{ name: string, pass: boolean, detail: string }[]} */
  const checks = [];

  checks.push({
    name: 'household exists with expected name and primary',
    pass: rows.household !== null && rows.household.name === plan.household.name && rows.household.primary_member_id === plan.household.primaryMemberId,
    detail: rows.household ? `${rows.household.id} "${rows.household.name}" primary=${rows.household.primary_member_id}` : 'missing',
  });

  for (const expected of plan.members) {
    const actual = rows.members.find((m) => m.id === expected.id);
    checks.push({
      name: `member ${expected.id} matches`,
      pass: !!actual && actual.name === expected.name && actual.email === expected.email && actual.phone === expected.phone && actual.birthdate === expected.birthdate,
      detail: actual ? `name=${actual.name} email=${actual.email} phone=${actual.phone} birthdate=${actual.birthdate}` : 'missing',
    });
  }

  checks.push({
    name: 'membership is the current-season family tier, unpaid',
    pass:
      rows.membership !== null &&
      rows.membership.season === plan.membership.season &&
      rows.membership.tier === plan.membership.tier &&
      rows.membership.price_paid === plan.membership.pricePaid &&
      rows.membership.paid_at === null,
    detail: rows.membership ? `season=${rows.membership.season} tier=${rows.membership.tier} price_paid=${rows.membership.price_paid} paid_at=${rows.membership.paid_at}` : 'missing',
  });

  checks.push({
    name: 'active mooring asset_assignment on the membership',
    pass: rows.assetAssignment !== null && rows.assetAssignment.asset_type === 'mooring' && rows.assetAssignment.membership_id === plan.membership.id && rows.assetAssignment.status === 'active',
    detail: rows.assetAssignment ? `asset_type=${rows.assetAssignment.asset_type} membership_id=${rows.assetAssignment.membership_id} status=${rows.assetAssignment.status}` : 'missing',
  });

  checks.push({
    name: 'zero waiver_acceptances for the household (everything outstanding)',
    pass: rows.waiverCount === 0,
    detail: `count=${rows.waiverCount}`,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// The wrangler-shelling CLI (guarded so importing this module for tests never runs it, the same
// dual-mode idiom `household-address-seed.mjs`/`mw-members.mjs` document).
// ---------------------------------------------------------------------------

/** @param {string[]} args */
function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/** @param {string} sql @returns {Record<string, unknown>[]} */
function query(sql) {
  const out = wrangler(['d1', 'execute', CLUB_DB_NAME, '--remote', '--command', sql, '--json']);
  return JSON.parse(out)[0].results;
}

/** @param {string[]} statements */
function applyBatch(statements) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'demo-household-'));
  const tmpFile = path.join(tmpDir, 'batch.sql');
  writeFileSync(tmpFile, statements.join('\n'));
  try {
    wrangler(['d1', 'execute', CLUB_DB_NAME, '--remote', '--file', tmpFile]);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function readLiveFacts() {
  const seasonRow = query("SELECT value FROM settings WHERE key = 'current_season'");
  const priceRow = query("SELECT value FROM settings WHERE key = 'tier_price_family'");
  const currentSeason = Number(/** @type {{ value: string }} */ (seasonRow[0]).value);
  const familyPriceDollars = Number(/** @type {{ value: string }} */ (priceRow[0]).value);
  return { currentSeason, familyPriceDollars };
}

/** @returns {Promise<SeededRows>} */
async function fetchSeededRows() {
  const householdRows = query(`SELECT id, name, primary_member_id FROM households WHERE id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)}`);
  const memberRows = query(`SELECT id, name, email, phone, birthdate FROM members WHERE household_id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)}`);
  const membershipRows = query(`SELECT id, season, tier, price_paid, paid_at FROM memberships WHERE id = ${sqlLiteral(DEMO_MEMBERSHIP_ID)}`);
  const assetRows = query(`SELECT id, asset_type, membership_id, status FROM asset_assignments WHERE id = ${sqlLiteral(DEMO_ASSET_ASSIGNMENT_ID)}`);
  const memberIdList = DEMO_MEMBER_IDS.map(sqlLiteral).join(', ');
  const waiverCountRows = query(
    `SELECT COUNT(*) AS n FROM waiver_acceptances WHERE member_id IN (${memberIdList}) OR minor_member_id IN (${memberIdList})`,
  );
  return {
    household: /** @type {SeededRows['household']} */ (householdRows[0] ?? null),
    members: /** @type {SeededRows['members']} */ (memberRows),
    membership: /** @type {SeededRows['membership']} */ (membershipRows[0] ?? null),
    assetAssignment: /** @type {SeededRows['assetAssignment']} */ (assetRows[0] ?? null),
    waiverCount: Number(/** @type {{ n: number }} */ (waiverCountRows[0])?.n ?? 0),
  };
}

/** Counts every row a full cleanup should have swept to zero; `--cleanup` prints this as proof. */
async function countRemainingDemoRows() {
  const memberIdList = DEMO_MEMBER_IDS.map(sqlLiteral).join(', ');
  const counts = {
    households: query(`SELECT COUNT(*) AS n FROM households WHERE id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)}`),
    members: query(`SELECT COUNT(*) AS n FROM members WHERE household_id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)}`),
    memberships: query(`SELECT COUNT(*) AS n FROM memberships WHERE id = ${sqlLiteral(DEMO_MEMBERSHIP_ID)}`),
    asset_assignments: query(`SELECT COUNT(*) AS n FROM asset_assignments WHERE id = ${sqlLiteral(DEMO_ASSET_ASSIGNMENT_ID)}`),
    waiver_acceptances: query(
      `SELECT COUNT(*) AS n FROM waiver_acceptances WHERE member_id IN (${memberIdList}) OR minor_member_id IN (${memberIdList}) OR person_email LIKE ${sqlLiteral(DEMO_EMAIL_PREFIX)}`,
    ),
    contact_confirmations: query(`SELECT COUNT(*) AS n FROM contact_confirmations WHERE member_id IN (${memberIdList})`),
    member_tokens: query(`SELECT COUNT(*) AS n FROM member_tokens WHERE member_id IN (${memberIdList})`),
    email_log: query(`SELECT COUNT(*) AS n FROM email_log WHERE recipient LIKE ${sqlLiteral(DEMO_EMAIL_PREFIX)}`),
    audit_log: query(`SELECT COUNT(*) AS n FROM audit_log WHERE actor = ${sqlLiteral(DEMO_ACTOR)}`),
  };
  return Object.fromEntries(Object.entries(counts).map(([table, rows]) => [table, Number(/** @type {{ n: number }} */ (rows[0])?.n ?? 0)]));
}

async function runPlan() {
  const { currentSeason, familyPriceDollars } = await readLiveFacts();
  const plan = buildDemoPlan(currentSeason, familyPriceDollars);
  console.log(renderPlanText(plan));
  console.log('--plan: no statements executed.');
}

async function runApply() {
  const { currentSeason, familyPriceDollars } = await readLiveFacts();
  const plan = buildDemoPlan(currentSeason, familyPriceDollars);

  const existing = query(`SELECT id FROM households WHERE id = ${sqlLiteral(DEMO_HOUSEHOLD_ID)}`);
  if (existing.length > 0) {
    console.log(`demo-household: ${DEMO_HOUSEHOLD_ID} already exists; --apply is a no-op. Run --verify to check its state.`);
    return;
  }

  const batchId = timestampId('board-demo-seed');
  const statements = buildApplyStatements(plan, batchId);
  applyBatch(statements);
  console.log(`demo-household: applied to ${CLUB_DB_NAME} (batch ${batchId})`);
}

async function runVerify() {
  const { currentSeason, familyPriceDollars } = await readLiveFacts();
  const plan = buildDemoPlan(currentSeason, familyPriceDollars);
  const rows = await fetchSeededRows();
  const checks = checkSeededState(plan, rows);

  console.log('demo-household: VERIFY');
  let allPass = true;
  for (const check of checks) {
    console.log(`  [${check.pass ? 'PASS' : 'FAIL'}] ${check.name} -- ${check.detail}`);
    if (!check.pass) allPass = false;
  }

  if (!allPass) {
    console.error('\ndemo-household: VERIFY FAILED');
    process.exitCode = 1;
    return;
  }
  console.log('\ndemo-household: VERIFY OK -- the household is seeded and every document is outstanding.');
}

async function runCleanup() {
  const statements = buildCleanupStatements();
  applyBatch(statements);
  console.log(`demo-household: cleanup applied to ${CLUB_DB_NAME}`);

  const remaining = await countRemainingDemoRows();
  console.log('\ndemo-household: CLEANUP PROOF (remaining row counts, all must be 0)');
  let allZero = true;
  for (const [table, count] of Object.entries(remaining)) {
    console.log(`  [${count === 0 ? 'PASS' : 'FAIL'}] ${table}: ${count}`);
    if (count !== 0) allZero = false;
  }

  if (!allZero) {
    console.error('\ndemo-household: CLEANUP INCOMPLETE -- rows remain, see above.');
    process.exitCode = 1;
    return;
  }
  console.log('\ndemo-household: CLEANUP OK -- every demo row removed.');
}

async function main() {
  const modes = ['--plan', '--apply', '--verify', '--cleanup'].filter((flag) => process.argv.includes(flag));
  if (modes.length !== 1) {
    console.error('Usage: node scripts/import/demo-household.mjs --plan|--apply|--verify|--cleanup');
    process.exitCode = 1;
    return;
  }

  if (modes[0] === '--plan') return runPlan();
  if (modes[0] === '--apply') return runApply();
  if (modes[0] === '--verify') return runVerify();
  return runCleanup();
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
