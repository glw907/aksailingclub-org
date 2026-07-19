import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { documents } from '$chassis/content';

// The member-waivers document model's freeze guard (T1, docs/2026-07-17-member-waivers-design.md
// "Ratified decisions" 4: "Published versions are frozen: a guard fails if a published document's
// content hash changes rather than a new version being added"). Nothing else in the pipeline
// enforces that promise: an editor could hand-edit a published document's body in the admin and
// every other gate (check/build/the concept's own field validation) would stay green, silently
// invalidating every signature already recorded against that version's hash (T2's own record
// integrity depends on the served text matching what was hashed at signing time). This closes
// that gap the same way fragment-integrity.test.ts closes its own render-time gaps: read the real
// content corpus through the site's own parse path (`$chassis/content`'s `documents` index, not a
// hand-rolled frontmatter parser), and fail loudly rather than let a silent mutation ship.
//
// All eight of T1's shipped drafts carry `status: 'draft'` (none is published yet; publishing is
// the attorney's later act), so the ledger below starts empty and the "every published document
// matches" check below is vacuously green on its own. The second describe block proves the guard
// is actually load-bearing, per the task's own instruction not to trust a green check that was
// never exercised: it runs the identical violation logic against a synthetic published fixture,
// mutates it, and asserts the guard catches both a changed hash and a version missing from the
// ledger.

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER_PATH = 'src/tests/fixtures/document-freeze-ledger.json';

/** One document version's identity, as the ledger keys it. */
interface DocumentIdentity {
  document: string;
  season: number;
  version: number;
}

/** One document version's freeze-relevant facts: identity, publication status, and the exact
 *  signable text (the parsed body, the same text T4 renders and T2 snapshots). */
interface FreezeCheckable extends DocumentIdentity {
  status: 'draft' | 'published';
  signableText: string;
}

function ledgerKey({ document, season, version }: DocumentIdentity): string {
  return `${document}@${season}v${version}`;
}

function hashSignableText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Every violation among `docs` against `ledger`: a published document whose current signable-text
 * hash no longer matches the ledger's recorded hash (content mutated in place instead of a new
 * version), or a published document the ledger does not carry at all. A draft is exempt; nothing
 * freezes until it publishes. Returns every violation found, not just the first.
 */
function findFreezeViolations(docs: FreezeCheckable[], ledger: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const doc of docs) {
    if (doc.status !== 'published') continue;
    const key = ledgerKey(doc);
    const expected = ledger[key];
    const actual = hashSignableText(doc.signableText);
    if (expected === undefined) {
      violations.push(`${key} is published but missing from the ledger`);
    } else if (expected !== actual) {
      violations.push(`${key} hash mismatch: published content changed without a new version`);
    }
  }
  return violations;
}

describe('document freeze guard', () => {
  describe('every published document on disk matches the committed hash ledger', () => {
    const summaries = documents.all({ includeDrafts: true });
    const docs: FreezeCheckable[] = summaries.map((summary) => {
      const entry = documents.byId(summary.id);
      if (!entry) throw new Error(`documents.byId found no entry for summary "${summary.id}"`);
      return {
        document: entry.frontmatter.document,
        season: entry.frontmatter.season,
        version: entry.frontmatter.version,
        status: entry.frontmatter.status,
        signableText: entry.body,
      };
    });
    const ledger = JSON.parse(readFileSync(path.join(REPO_ROOT, LEDGER_PATH), 'utf8')) as Record<string, string>;

    it('found at least one document on disk to exercise the check against', () => {
      expect(summaries.length).toBeGreaterThan(0);
    });

    it('no published document is missing from the ledger or hashes differently than recorded', () => {
      expect(findFreezeViolations(docs, ledger)).toEqual([]);
    });
  });

  // Proves the guard logic actually fails, since the check above is currently vacuous (T1 ships
  // no published documents). A synthetic fixture stands in for a document the attorney has
  // cleared and season-rollover has published.
  describe('the guard fails on a mutated published fixture (proves the check is live)', () => {
    const published: FreezeCheckable = {
      document: 'general-release',
      season: 2027,
      version: 3,
      status: 'published',
      signableText: 'The frozen, attorney-cleared text.',
    };
    const ledger = { [ledgerKey(published)]: hashSignableText(published.signableText) };

    it('passes against the unmutated fixture', () => {
      expect(findFreezeViolations([published], ledger)).toEqual([]);
    });

    it('fails when a published document is edited in place after freezing', () => {
      const mutated: FreezeCheckable = { ...published, signableText: 'The frozen text, quietly edited.' };
      expect(findFreezeViolations([mutated], ledger)).toEqual([
        `${ledgerKey(published)} hash mismatch: published content changed without a new version`,
      ]);
    });

    it('fails when a published document has no ledger entry at all', () => {
      const unledgered: FreezeCheckable = { ...published, version: 4 };
      expect(findFreezeViolations([unledgered], ledger)).toEqual([
        `${ledgerKey(unledgered)} is published but missing from the ledger`,
      ]);
    });

    it('never flags a draft, mutated or not: a draft mutates freely until it publishes', () => {
      const draft: FreezeCheckable = { ...published, status: 'draft', signableText: 'anything at all' };
      expect(findFreezeViolations([draft], {})).toEqual([]);
    });
  });
});
