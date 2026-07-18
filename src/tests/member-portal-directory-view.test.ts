// The directory screen's pure view logic (plan T4): the boat-summary collapse/abbreviation, the
// resting title chip, the chip predicates, the client-side search match, the caret-honesty rule,
// and the auto-expand threshold. Each is a pure function of a `DirectoryEntry`, so it is tested
// here directly rather than through the rendered component.
import { describe, expect, it } from 'vitest';
import type { DirectoryBoat, DirectoryEntry } from '$member-portal/lib/directory';
import {
  abbreviateModel,
  boatLines,
  boatSummary,
  hasExpansion,
  isRowOpen,
  matchesChip,
  matchesQuery,
  resolveTitles,
  shouldAutoExpand,
  AUTO_EXPAND_THRESHOLD,
} from '../routes/(site)/my-account/directory/directory-view';

function boat(overrides: Partial<DirectoryBoat> = {}): DirectoryBoat {
  return { name: null, model: 'Laser', keptOn: 'trailer', ...overrides };
}

function entry(overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return {
    id: 'mem-1',
    name: 'Vera Visible',
    household: { name: 'Vera Visible', city: 'Anchorage' },
    secondary: 'Anchorage',
    positions: [],
    memberships: [],
    boats: [],
    contact: { email: null, phone: null, address: null },
    ...overrides,
  };
}

describe('abbreviateModel', () => {
  it('shortens Buccaneer to Bucc and leaves the number', () => {
    expect(abbreviateModel('Buccaneer 18')).toBe('Bucc 18');
  });

  it('passes a short model through unchanged', () => {
    expect(abbreviateModel('Laser')).toBe('Laser');
  });
});

describe('boatSummary', () => {
  it('is null when the member owns no boats', () => {
    expect(boatSummary([])).toBeNull();
  });

  it('names a named boat by its own name', () => {
    expect(boatSummary([boat({ name: 'Dionysus', model: 'Laser' })])).toBe('Dionysus');
  });

  it('collapses unnamed duplicate models into a count', () => {
    const boats = [boat({ model: 'Buccaneer 18' }), boat({ model: 'Buccaneer 18' }), boat({ model: 'Buccaneer 18' })];
    expect(boatSummary(boats)).toBe('3 × Buccaneer 18');
  });

  it('drops the count for a single unnamed boat', () => {
    expect(boatSummary([boat({ model: 'Buccaneer 18' })])).toBe('Buccaneer 18');
  });

  it('lists named boats first, then collapsed unnamed groups', () => {
    const boats = [
      boat({ name: 'Dionysus', model: 'Laser' }),
      boat({ model: 'Buccaneer 18' }),
      boat({ model: 'Buccaneer 18' }),
    ];
    expect(boatSummary(boats)).toBe('Dionysus, 2 × Buccaneer 18');
  });

  it('caps at the first two tokens plus a +N overflow', () => {
    const boats = [
      boat({ name: 'A', model: 'Laser' }),
      boat({ name: 'B', model: 'Laser' }),
      boat({ name: 'C', model: 'Laser' }),
      boat({ name: 'D', model: 'Laser' }),
    ];
    expect(boatSummary(boats)).toBe('A, B +2');
  });

  it('abbreviates the model on narrow screens', () => {
    const boats = [boat({ model: 'Buccaneer 18' }), boat({ model: 'Buccaneer 18' })];
    expect(boatSummary(boats, { abbreviate: true })).toBe('2 × Bucc 18');
  });
});

describe('boatLines', () => {
  it('keeps named boats individual with their model line and berth', () => {
    expect(boatLines([boat({ name: 'Dionysus', model: 'Laser', keptOn: 'mooring' })])).toEqual([
      { label: 'Dionysus', model: 'Laser', keptOn: 'mooring', count: 1 },
    ]);
  });

  it('collapses unnamed boats of the same model and berth into a count', () => {
    const boats = [boat({ model: 'Buccaneer 18' }), boat({ model: 'Buccaneer 18' })];
    expect(boatLines(boats)).toEqual([{ label: 'Buccaneer 18', model: null, keptOn: 'trailer', count: 2 }]);
  });

  it('does not collapse unnamed boats that differ in berth', () => {
    const boats = [boat({ model: 'Laser', keptOn: 'trailer' }), boat({ model: 'Laser', keptOn: 'mooring' })];
    expect(boatLines(boats)).toEqual([
      { label: 'Laser', model: null, keptOn: 'trailer', count: 1 },
      { label: 'Laser', model: null, keptOn: 'mooring', count: 1 },
    ]);
  });
});

describe('resolveTitles', () => {
  it('has no top title for a member with no positions or chair roles', () => {
    expect(resolveTitles(entry())).toEqual({ top: null, extra: 0 });
  });

  it('takes a position title as the top and counts the rest', () => {
    const e = entry({
      positions: [
        { kind: 'officer', title: 'Commodore', sortOrder: 0 },
        { kind: 'appointed', title: 'Instructor', sortOrder: 1 },
      ],
    });
    expect(resolveTitles(e)).toEqual({ top: 'Commodore', extra: 1 });
  });

  it('counts derived chair titles but never a plain membership', () => {
    const e = entry({
      memberships: [
        { committeeName: 'Fleet', role: 'chair', title: 'Fleet Chair' },
        { committeeName: 'Program', role: 'member', title: null },
      ],
    });
    expect(resolveTitles(e)).toEqual({ top: 'Fleet Chair', extra: 0 });
  });
});

describe('matchesChip', () => {
  it('matches "board" on an officer or director position', () => {
    expect(matchesChip(entry({ positions: [{ kind: 'officer', title: 'Commodore', sortOrder: 0 }] }), 'board')).toBe(true);
    expect(matchesChip(entry({ positions: [{ kind: 'director', title: 'Director', sortOrder: 0 }] }), 'board')).toBe(true);
  });

  it('matches "board" on a chair or co-chair membership', () => {
    expect(matchesChip(entry({ memberships: [{ committeeName: 'Fleet', role: 'chair', title: 'Fleet Chair' }] }), 'board')).toBe(true);
    expect(matchesChip(entry({ memberships: [{ committeeName: 'Fleet', role: 'co-chair', title: 'Fleet Co-Chair' }] }), 'board')).toBe(true);
  });

  it('does not match "board" on a plain membership or an appointed position', () => {
    expect(matchesChip(entry({ memberships: [{ committeeName: 'Fleet', role: 'member', title: null }] }), 'board')).toBe(false);
    expect(matchesChip(entry({ positions: [{ kind: 'appointed', title: 'Instructor', sortOrder: 0 }] }), 'board')).toBe(false);
  });

  it('matches "instructors" only on an appointed position titled Instructor', () => {
    expect(matchesChip(entry({ positions: [{ kind: 'appointed', title: 'Instructor', sortOrder: 0 }] }), 'instructors')).toBe(true);
    expect(matchesChip(entry({ positions: [{ kind: 'appointed', title: 'Race Officer', sortOrder: 0 }] }), 'instructors')).toBe(false);
    expect(matchesChip(entry({ positions: [{ kind: 'officer', title: 'Instructor', sortOrder: 0 }] }), 'instructors')).toBe(false);
  });

  it('matches "mooring" on any boat kept on a mooring', () => {
    expect(matchesChip(entry({ boats: [boat({ keptOn: 'mooring' })] }), 'mooring')).toBe(true);
    expect(matchesChip(entry({ boats: [boat({ keptOn: 'trailer' })] }), 'mooring')).toBe(false);
  });
});

describe('matchesQuery', () => {
  const e = entry({
    name: 'Nancy Black',
    boats: [boat({ name: 'Daydream Believer', model: 'Buccaneer 18' })],
    positions: [{ kind: 'appointed', title: 'Instructor', sortOrder: 0 }],
    memberships: [{ committeeName: 'Fleet', role: 'chair', title: 'Fleet Chair' }],
  });

  it('matches everyone on an empty needle', () => {
    expect(matchesQuery(e, '')).toBe(true);
    expect(matchesQuery(e, '   ')).toBe(true);
  });

  it('matches on member name, boat name, position title, and committee name', () => {
    expect(matchesQuery(e, 'nancy')).toBe(true);
    expect(matchesQuery(e, 'daydream')).toBe(true);
    expect(matchesQuery(e, 'instructor')).toBe(true);
    expect(matchesQuery(e, 'fleet')).toBe(true);
  });

  it('does not match an unrelated needle', () => {
    expect(matchesQuery(e, 'zzz')).toBe(false);
  });
});

describe('hasExpansion', () => {
  it('is false for a name-only partial member with nothing behind the row', () => {
    expect(hasExpansion(entry())).toBe(false);
  });

  it('is true when a position, membership, boat, or any contact fact exists', () => {
    expect(hasExpansion(entry({ positions: [{ kind: 'officer', title: 'Commodore', sortOrder: 0 }] }))).toBe(true);
    expect(hasExpansion(entry({ memberships: [{ committeeName: 'Fleet', role: 'member', title: null }] }))).toBe(true);
    expect(hasExpansion(entry({ boats: [boat()] }))).toBe(true);
    expect(hasExpansion(entry({ contact: { email: 'a@b.co', phone: null, address: null } }))).toBe(true);
    expect(
      hasExpansion(entry({ contact: { email: null, phone: null, address: { line1: '1 Way', line2: null, city: 'Anchorage', state: 'AK', postalCode: '99501' } } })),
    ).toBe(true);
  });
});

describe('shouldAutoExpand', () => {
  it('auto-expands a filtered result set at or below the threshold', () => {
    expect(shouldAutoExpand(AUTO_EXPAND_THRESHOLD, true)).toBe(true);
    expect(shouldAutoExpand(1, true)).toBe(true);
  });

  it('does not auto-expand above the threshold or with no filter active', () => {
    expect(shouldAutoExpand(AUTO_EXPAND_THRESHOLD + 1, true)).toBe(false);
    expect(shouldAutoExpand(2, false)).toBe(false);
    expect(shouldAutoExpand(0, true)).toBe(false);
  });
});

describe('isRowOpen', () => {
  const expandable = entry({ positions: [{ kind: 'officer', title: 'Commodore', sortOrder: 0 }] });

  it('never opens a row with nothing to expand, even during auto-expand', () => {
    expect(isRowOpen(entry(), { autoExpand: true, expandedIds: new Set(), autoExpandOverrides: new Set() })).toBe(false);
  });

  it('auto-expand forces an expandable row open with no override', () => {
    expect(isRowOpen(expandable, { autoExpand: true, expandedIds: new Set(), autoExpandOverrides: new Set() })).toBe(true);
  });

  it('a per-row override closes a row auto-expand would otherwise force open (the toggle is never inert)', () => {
    expect(
      isRowOpen(expandable, { autoExpand: true, expandedIds: new Set(), autoExpandOverrides: new Set([expandable.id]) }),
    ).toBe(false);
  });

  it('outside auto-expand, only the hand-set expandedIds decide, ignoring any override', () => {
    expect(isRowOpen(expandable, { autoExpand: false, expandedIds: new Set(), autoExpandOverrides: new Set([expandable.id]) })).toBe(
      false,
    );
    expect(
      isRowOpen(expandable, { autoExpand: false, expandedIds: new Set([expandable.id]), autoExpandOverrides: new Set() }),
    ).toBe(true);
  });
});
