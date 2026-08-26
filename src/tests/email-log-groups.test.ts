import { describe, expect, it } from 'vitest';
import { groupEmailLog } from '../admin-club/lib/email-log-groups';
import type { EmailLogRow } from '../admin-club/lib/club-email';

const QUOTA_ERROR = 'account daily sending quota exceeded';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A D1-shaped timestamp (`YYYY-MM-DD HH:MM:SS`, UTC, no offset) `offsetSeconds` after
 *  `baseIso`, matching `club-email.ts`'s own `sent_at` column shape. */
function timestampAt(baseIso: string, offsetSeconds: number): string {
  const t = new Date(new Date(baseIso).getTime() + offsetSeconds * 1000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}

function failedRow(overrides: Partial<EmailLogRow> & { id: string; sentAt: string }): EmailLogRow {
  return {
    templateId: 'class_followup',
    segment: null,
    recipient: `${overrides.id}@example.com`,
    subject: 'Class follow-up',
    status: 'failed',
    errorDetail: QUOTA_ERROR,
    ...overrides,
  };
}

function sentRow(overrides: Partial<EmailLogRow> & { id: string; sentAt: string }): EmailLogRow {
  return {
    templateId: 'renewal_reminder',
    segment: null,
    recipient: `${overrides.id}@example.com`,
    subject: 'Renewal reminder',
    status: 'sent',
    errorDetail: null,
    ...overrides,
  };
}

/** The live 2026-07-14 quota-exhaustion cluster's shape: 471 failed rows, one `error_detail`,
 *  spanning 08:07:11 to 08:15:55, three template ids cycled across them. Built newest first,
 *  matching `listEmailLog`'s own `sent_at DESC, id DESC` order. */
function buildLiveCluster(): EmailLogRow[] {
  const base = '2026-07-14T08:07:11Z';
  const span = 524; // 08:07:11 to 08:15:55, in seconds
  const templateIds = ['class_followup', 'class_day_before', 'class_week_out'];
  const rows: EmailLogRow[] = [];
  for (let i = 0; i < 471; i++) {
    const offset = Math.round((i * span) / 470);
    rows.push(
      failedRow({
        id: `cluster-${i}`,
        sentAt: timestampAt(base, offset),
        templateId: templateIds[i % templateIds.length],
      }),
    );
  }
  return rows.reverse(); // newest first
}

describe('groupEmailLog', () => {
  it('folds the live cluster shape into one incident: 471 rows, one error, the full nine-minute window', () => {
    const units = groupEmailLog(buildLiveCluster());

    expect(units).toHaveLength(1);
    const [unit] = units;
    if (unit.kind !== 'incident') throw new Error('expected an incident');
    expect(unit.count).toBe(471);
    expect(unit.errorDetail).toBe(QUOTA_ERROR);
    expect(unit.firstSentAt).toBe('2026-07-14 08:07:11');
    expect(unit.lastSentAt).toBe('2026-07-14 08:15:55');
    expect(unit.templateIds).toEqual(['class_day_before', 'class_followup', 'class_week_out']);
    expect(unit.rows).toHaveLength(471);
  });

  it('leaves a singleton failure (no adjacent same-error failure within an hour) as its own row', () => {
    const rows: EmailLogRow[] = [
      sentRow({ id: 'a', sentAt: '2026-07-08 09:00:00' }),
      failedRow({ id: 'b', sentAt: '2026-07-08 08:00:00', errorDetail: 'a one-off send failure' }),
      sentRow({ id: 'c', sentAt: '2026-07-08 07:00:00' }),
    ];

    const units = groupEmailLog(rows);

    expect(units).toHaveLength(3);
    expect(units.every((unit) => unit.kind === 'row')).toBe(true);
    const failedUnit = units.find((unit) => unit.kind === 'row' && unit.row.id === 'b');
    expect(failedUnit).toBeDefined();
  });

  it('splits two clusters more than an hour apart into two separate incidents', () => {
    const rows: EmailLogRow[] = [
      // The later cluster: newest first, per listEmailLog's own order.
      failedRow({ id: 'late-3', sentAt: '2026-07-08 10:10:00' }),
      failedRow({ id: 'late-2', sentAt: '2026-07-08 10:05:00' }),
      failedRow({ id: 'late-1', sentAt: '2026-07-08 10:00:00' }),
      // Gap here exceeds an hour (10:00:00 back to 08:05:00 is 1h55m).
      failedRow({ id: 'early-3', sentAt: '2026-07-08 08:05:00' }),
      failedRow({ id: 'early-2', sentAt: '2026-07-08 08:02:00' }),
      failedRow({ id: 'early-1', sentAt: '2026-07-08 08:00:00' }),
    ];

    const units = groupEmailLog(rows);

    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.kind === 'incident')).toBe(true);
    const [later, earlier] = units as Array<{ kind: 'incident'; count: number; firstSentAt: string; lastSentAt: string }>;
    expect(later.count).toBe(3);
    expect(later.firstSentAt).toBe('2026-07-08 10:00:00');
    expect(later.lastSentAt).toBe('2026-07-08 10:10:00');
    expect(earlier.count).toBe(3);
    expect(earlier.firstSentAt).toBe('2026-07-08 08:00:00');
    expect(earlier.lastSentAt).toBe('2026-07-08 08:05:00');
  });

  it('does not let a sent row inside a failure window split the incident, and keeps the sent row as its own unit', () => {
    const rows: EmailLogRow[] = [
      // Newest first: a failed row, then an interleaved sent row, then an earlier failed row
      // sharing the same error and within an hour of the first.
      failedRow({ id: 'later-failure', sentAt: '2026-07-08 10:10:00' }),
      sentRow({ id: 'interleaved-sent', sentAt: '2026-07-08 10:05:00' }),
      failedRow({ id: 'earlier-failure', sentAt: '2026-07-08 10:00:00' }),
    ];

    const units = groupEmailLog(rows);

    expect(units).toHaveLength(2);
    const incident = units.find((unit) => unit.kind === 'incident');
    if (!incident || incident.kind !== 'incident') throw new Error('expected an incident');
    expect(incident.count).toBe(2);
    expect(incident.rows.map((row) => row.id)).toEqual(['later-failure', 'earlier-failure']);

    const sentUnit = units.find((unit) => unit.kind === 'row' && unit.row.id === 'interleaved-sent');
    expect(sentUnit).toBeDefined();
  });

  it('groups identically regardless of whether an outcome filter is later applied', () => {
    const rows = [...buildLiveCluster(), sentRow({ id: 'unrelated-sent', sentAt: '2026-07-08 09:00:00' })];

    const allUnits = groupEmailLog(rows);
    const incidentFromAll = allUnits.find((unit) => unit.kind === 'incident');
    if (!incidentFromAll || incidentFromAll.kind !== 'incident') throw new Error('expected an incident');

    // A later "failed only" filter operates on groupEmailLog's own output, never re-derives it.
    const failedOnly = allUnits.filter((unit) => unit.kind === 'incident' || unit.row.status === 'failed');
    const incidentFromFiltered = failedOnly.find((unit) => unit.kind === 'incident');

    expect(incidentFromFiltered).toEqual(incidentFromAll);
    expect(incidentFromFiltered?.kind === 'incident' && incidentFromFiltered.count).toBe(471);
  });
});
