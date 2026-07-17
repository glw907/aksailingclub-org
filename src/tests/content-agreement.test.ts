import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// The site-contract arm of the fragments-migration harvest
// (docs/2026-07-17-fragments-migration-design.md, "The agreement test"). Six survey
// candidates dropped from fragment conversion because the blocks-only bar found no
// shared block: a table row, or independent contextual prose. Nothing else catches
// drift between these duplicated facts, so this test pins each canonical string in
// every file the verdict table names as still needing to agree.

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readContentFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

interface Agreement {
  fact: string;
  files: string[];
  why: string;
}

const AGREEMENTS: Agreement[] = [
  {
    fact: '$300/season',
    files: ['src/content/pages/moorings.md', 'src/content/pages/join.md'],
    why: 'Candidate 1, dropped: moorings.md carries the only block-shaped consumer; join.md holds it as a fee-table row, and a table row cannot take a block splice.'
  },
  {
    fact: 'Mile 8.2 South Big Lake Road',
    files: ['src/content/pages/contact.md', 'src/content/pages/visiting-the-club.md'],
    why: 'Candidate 2, dropped (flipped from convert): the two facts blocks differ in label, body, and shape, so no include serves both without breaking one page.'
  },
  {
    fact: 'Big Lake, AK 99654',
    files: ['src/content/pages/contact.md', 'src/content/pages/visiting-the-club.md'],
    why: 'Candidate 2, same reasoning.'
  },
  {
    fact: '$100/season',
    files: ['src/content/pages/join.md', 'src/content/pages/trailered-boat-parking.md'],
    why: 'Candidate 3, dropped: the fee table lives only on join.md; per-resource pages state their own fee in their own shape.'
  },
  {
    fact: '$50/season',
    files: ['src/content/pages/join.md', 'src/content/pages/rack-storage.md'],
    why: 'Candidate 3, same reasoning.'
  },
  {
    fact: '12 and under',
    files: [
      'src/content/pages/education.md',
      'src/content/pages/visiting-the-club.md',
      'src/content/pages/member-expectations.md'
    ],
    why: 'Candidate 5, dropped: three contextual mentions, no shared block. This is a child-safety rule, so drift matters.'
  },
  {
    fact: '3-4 RVs',
    files: [
      'src/content/pages/transient-rv-parking.md',
      'src/content/pages/visiting-the-club.md',
      'src/content/pages/new-member-guide.md',
      'src/content/pages/education.md'
    ],
    why: 'Candidate 6, dropped (overriding partial): visiting\'s 5-fact block and transient-rv-parking\'s 6-fact superset differ in order and wording; converging would rewrite both.'
  }
];

describe('content agreement', () => {
  for (const { fact, files, why } of AGREEMENTS) {
    it(`"${fact}" agrees across every named file (${why})`, () => {
      for (const file of files) {
        expect(readContentFile(file), `expected ${file} to still contain "${fact}"`).toContain(fact);
      }
    });
  }
});
