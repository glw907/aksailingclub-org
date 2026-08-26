import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import {
  buildSampleVariables,
  findUnknownVariables,
  getEmailTemplateWithDefaults,
  getKnownVariables,
  KNOWN_TEMPLATE_VARIABLES,
  resetEmailTemplate,
  updateEmailTemplate,
} from '$admin-club/lib/email-templates-store';

const STORED_ROW = {
  id: 'class_offer',
  subject: 'A spot is open -- {{item_display_name}} (edited)',
  reply_to: 'program-committee@aksailingclub.org',
  body: 'Hi {{person_name}}, an edited body.',
  updated_at: '2026-07-07 00:00:00',
  updated_by: 'admin@example.com',
};

const DEFAULTS_ROW = {
  default_subject: 'A spot is open -- {{item_display_name}}',
  default_body: 'Hi {{person_name}}, claim it: {{claim_url}} (expires {{expires_at}}). Contact {{committee_email}}.',
};

describe('getKnownVariables', () => {
  it('names the known vocabulary for a documented template', () => {
    expect(getKnownVariables('class_offer')).toEqual([
      'person_name',
      'item_display_name',
      'claim_url',
      'expires_at',
      'committee_email',
    ]);
  });

  it('answers undefined for a template id the map does not name', () => {
    expect(getKnownVariables('no-such-template')).toBeUndefined();
  });
});

describe('findUnknownVariables', () => {
  it('flags a {{token}} not in the known set', () => {
    expect(findUnknownVariables('class_offer', 'Subject with {{typo_var}}', 'Body text.')).toEqual(['typo_var']);
  });

  it('flags nothing when every token is known', () => {
    expect(findUnknownVariables('class_offer', 'Hi {{person_name}}', 'Claim: {{claim_url}}')).toEqual([]);
  });

  it('skips the check entirely for a template id with no recorded vocabulary', () => {
    expect(findUnknownVariables('no-such-template', 'Anything {{goes}}', 'here')).toEqual([]);
  });
});

describe('buildSampleVariables', () => {
  it('produces a sample value for every known variable', () => {
    const sample = buildSampleVariables('class_offer');
    expect(Object.keys(sample).sort()).toEqual(
      ['claim_url', 'committee_email', 'expires_at', 'item_display_name', 'person_name'].sort(),
    );
    expect(sample.claim_url).toContain('https://');
  });

  it('answers {} for an unrecorded template id', () => {
    expect(buildSampleVariables('no-such-template')).toEqual({});
  });
});

describe('getEmailTemplateWithDefaults', () => {
  it('reads the template alongside its defaults', async () => {
    const { db } = fakeD1({
      firstResults: {
        'id, subject, reply_to, body, updated_at, updated_by FROM email_templates': STORED_ROW,
        'default_subject, default_body FROM email_templates': DEFAULTS_ROW,
      },
    });
    await expect(getEmailTemplateWithDefaults(db, 'class_offer')).resolves.toEqual({
      id: 'class_offer',
      subject: STORED_ROW.subject,
      replyTo: STORED_ROW.reply_to,
      body: STORED_ROW.body,
      updatedAt: STORED_ROW.updated_at,
      updatedBy: STORED_ROW.updated_by,
      defaultSubject: DEFAULTS_ROW.default_subject,
      defaultBody: DEFAULTS_ROW.default_body,
    });
  });

  it('answers null for an unknown id', async () => {
    const { db } = fakeD1();
    await expect(getEmailTemplateWithDefaults(db, 'no-such-template')).resolves.toBeNull();
  });
});

describe('updateEmailTemplate', () => {
  it('writes subject, body, and the acting editor, never touching the default columns', async () => {
    const { db, calls } = fakeD1();
    await updateEmailTemplate(db, 'class_offer', { subject: 'New subject', body: 'New body' }, 'admin@example.com');
    expect(calls).toEqual([
      {
        sql: `UPDATE email_templates SET subject = ?1, body = ?2, updated_at = datetime('now'), updated_by = ?3 WHERE id = ?4`,
        args: ['New subject', 'New body', 'admin@example.com', 'class_offer'],
      },
    ]);
  });
});

describe('resetEmailTemplate', () => {
  it('restores subject/body from the default columns and returns the restored row', async () => {
    const restoredRow = { ...STORED_ROW, subject: DEFAULTS_ROW.default_subject, body: DEFAULTS_ROW.default_body, updated_by: 'admin@example.com' };
    // `resetEmailTemplate` reads the row twice (once before the write, alongside its defaults;
    // once after, to return the fresh row): a call-order responder answers each read correctly,
    // since `fakeD1` only keys by SQL substring, not by call sequence.
    let readCount = 0;
    const { db, calls } = fakeD1({
      firstResults: {
        'id, subject, reply_to, body, updated_at, updated_by FROM email_templates': () => (readCount++ === 0 ? STORED_ROW : restoredRow),
        'default_subject, default_body FROM email_templates': DEFAULTS_ROW,
      },
    });

    const result = await resetEmailTemplate(db, 'class_offer', 'admin@example.com');
    expect(result).toEqual({
      ok: true,
      template: expect.objectContaining({ subject: DEFAULTS_ROW.default_subject, body: DEFAULTS_ROW.default_body }),
    });
    const write = calls.find((c) => c.sql.startsWith('UPDATE email_templates SET subject = default_subject'));
    expect(write?.args).toEqual(['admin@example.com', 'class_offer']);
  });

  it('fails closed when no default is recorded for the template (empty default columns)', async () => {
    const { db } = fakeD1({
      firstResults: {
        'id, subject, reply_to, body, updated_at, updated_by FROM email_templates': STORED_ROW,
        'default_subject, default_body FROM email_templates': { default_subject: '', default_body: '' },
      },
    });
    const result = await resetEmailTemplate(db, 'class_offer', 'admin@example.com');
    expect(result).toEqual({ ok: false, error: 'No default is recorded for this template; nothing to reset to.' });
  });

  it('fails closed for an unknown template id', async () => {
    const { db } = fakeD1();
    const result = await resetEmailTemplate(db, 'no-such-template', 'admin@example.com');
    expect(result).toEqual({ ok: false, error: 'No such template.' });
  });
});

// The eight-template gap closed by Task 8 (email-announce): each new map entry equals the exact
// `vars` key set its own sender passes, read from the sender's own call site rather than
// re-derived, so a drift between the map and a real send is caught here rather than only at a
// send that silently drops or leaves unresolved a variable.
describe('KNOWN_TEMPLATE_VARIABLES: the eight-template gap', () => {
  it('gives the three class-reminders.ts touches the same five-variable set', () => {
    const touchVars = ['person_name', 'item_display_name', 'start_date', 'location', 'committee_email'];
    expect(getKnownVariables('class_week_out')).toEqual(touchVars);
    expect(getKnownVariables('class_day_before')).toEqual(touchVars);
    expect(getKnownVariables('class_followup')).toEqual(touchVars);
  });

  it('gives class_refund_window the vocabulary class-refund-window-notice.ts passes', () => {
    expect(getKnownVariables('class_refund_window')).toEqual([
      'person_name',
      'item_display_name',
      'cutoff_date',
      'withdraw_url',
      'committee_email',
    ]);
  });

  it('gives class_welcome the vocabulary class-welcome.ts passes', () => {
    expect(getKnownVariables('class_welcome')).toEqual(['person_name', 'item_display_name', 'youth_note', 'committee_email']);
  });

  it("gives stripe_payment_receipt its two call sites' shared vars, receiptVars(...) expanded", () => {
    expect(getKnownVariables('stripe_payment_receipt')).toEqual([
      'person_name',
      'item_display_name',
      'amount',
      'payment_date',
      'reference',
      'committee_email',
    ]);
  });

  it('gives join_welcome the vocabulary stripe-reconcile.ts passes', () => {
    expect(getKnownVariables('join_welcome')).toEqual([
      'person_name',
      'tier_label',
      'season',
      'credit_status',
      'portal_url',
      'discord_url',
      'committee_email',
    ]);
  });

  it('gives board_join_notice the vocabulary stripe-reconcile.ts passes', () => {
    expect(getKnownVariables('board_join_notice')).toEqual(['household_name', 'tier_label', 'season', 'classes_summary']);
  });

  it('no longer names withdrawal_notice, a map key with no email_templates row behind it', () => {
    expect(getKnownVariables('withdrawal_notice')).toBeUndefined();
    expect(Object.keys(KNOWN_TEMPLATE_VARIABLES)).not.toContain('withdrawal_notice');
  });
});

describe('findUnknownVariables: the closed-gap templates', () => {
  it('flags a token outside class_followup its known vocabulary', () => {
    expect(findUnknownVariables('class_followup', 'Subject', 'Body with {{signature_block}}')).toEqual(['signature_block']);
  });

  it('does not flag {{committee_email}}, a known class_followup variable the shipped body does not yet use', () => {
    // The real shipped class_followup body (migration 0012_class_reminders) never uses
    // {{committee_email}}, even though the sender's own vars object always passes it: a known-but-
    // unused variable is not an "unknown token in the body" and must not be reported.
    const shippedSubject = 'Thanks for sailing with us -- {{item_display_name}}';
    const shippedBody =
      'Hi {{person_name}},\n\nThanks for taking **{{item_display_name}}** with us! Any boat checkouts earned in class are now on file.\n\nReady for more? Check the classes page for what\'s next, or reply to this email with questions.';
    expect(findUnknownVariables('class_followup', shippedSubject, shippedBody)).toEqual([]);
  });
});

// `fakeD1` never executes real SQL (`_fake-d1.ts`'s own header), so this suite cannot prove the
// map matches the LIVE `email_templates` table; it instead reads the repo's own migration SQL, so
// a future migration that seeds a new template with no matching KNOWN_TEMPLATE_VARIABLES entry
// fails this test immediately rather than silently reopening the gap Task 8 closed.
describe('KNOWN_TEMPLATE_VARIABLES: migration coverage', () => {
  it('names every template id an asc-club migration seeds', () => {
    const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
    const migrationsDir = path.join(repoRoot, 'migrations/asc-club');
    const seededIds = new Set<string>();

    for (const dir of readdirSync(migrationsDir)) {
      const forwardPath = path.join(migrationsDir, dir, 'forward.sql');
      let text: string;
      try {
        text = readFileSync(forwardPath, 'utf8');
      } catch {
        continue;
      }
      // Scope the search to each email_templates INSERT statement (stopping at the audit_log
      // INSERT that always follows it in this repo's migrations), so a quoted id-shaped string
      // elsewhere in the file (an audit_log row's own actor/action literals) is never mistaken
      // for a seeded template id.
      const statementRe = /INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+email_templates[\s\S]*?(?=INSERT INTO audit_log|$)/g;
      for (const statementMatch of text.matchAll(statementRe)) {
        const rowIdRe = /\(\s*'([a-z][a-z_]*)'\s*,/g;
        for (const idMatch of statementMatch[0].matchAll(rowIdRe)) {
          seededIds.add(idMatch[1]);
        }
      }
    }

    // A sanity floor: fail loudly if the parser above stops finding the migrations it should
    // (a renamed directory, a changed INSERT idiom) rather than silently asserting nothing.
    expect(seededIds.size).toBeGreaterThanOrEqual(9);
    for (const id of seededIds) {
      expect(Object.keys(KNOWN_TEMPLATE_VARIABLES)).toContain(id);
    }
  });
});
