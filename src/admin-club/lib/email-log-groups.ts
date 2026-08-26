// The send log's incident fold (`docs/2026-08-25-email-announce-design.md`, ruling 5): a pure
// function collapsing a run of failed `email_log` rows that share one `error_detail` and chain
// at gaps under an hour into a single incident display unit. Runs are computed over failed rows
// alone, so a sent row inside an incident's own time window neither joins the run nor splits it
// and keeps its own position in the returned list. This exists for the 2026-07-14
// quota-exhaustion cluster (471 of the 750 live rows, one error, a nine-minute window): without
// folding, the send log's own history reads as 471 separate "Failed" rows.
//
// Grouping runs once, over the whole ordered chronology (`sent_at DESC, id DESC`, `club-email.ts`'s
// own `listEmailLog`), BEFORE any outcome or template filter and before any pagination: which rows
// belong to a run and where that run's window starts and ends is decided here alone and never
// becomes filter-dependent, since a later filter operates on this function's own output rather
// than re-deriving it. A consumer is free to narrow what it DISPLAYS for a folded incident (the
// send-log screen's own template filter states a filtered count for the rows it actually shows,
// `email/+page.svelte`'s own header) -- that narrowing never reaches back into this fold.

import type { EmailLogRow } from './club-email';

/** A gap this wide or wider between two failed rows sharing one `error_detail` starts a new
 *  incident rather than extending the current one. */
const INCIDENT_GAP_MS = 60 * 60 * 1000;

/** A run of two or more failed rows sharing one `error_detail`, chained at gaps under an hour.
 *  `rows` carries the run's own member rows, in the order they appeared in the input, for the
 *  expanded view. */
export interface EmailLogIncident {
  kind: 'incident';
  count: number;
  firstSentAt: string;
  lastSentAt: string;
  errorDetail: string;
  templateIds: string[];
  rows: EmailLogRow[];
}

/** Any row that is not part of a multi-row incident: a sent row, or a failed row with no
 *  adjacent same-error failure inside the gap window. */
export interface EmailLogSingleRow {
  kind: 'row';
  row: EmailLogRow;
}

export type EmailLogDisplayUnit = EmailLogIncident | EmailLogSingleRow;

/** Parse a D1 timestamp (`YYYY-MM-DD HH:MM:SS`, no offset, always UTC) into epoch milliseconds.
 *  `Date.parse` does not reliably treat the space-separated form as UTC, so the separator is
 *  swapped for `T` and a `Z` appended first. */
function parseSentAtMs(sentAt: string): number {
  return Date.parse(`${sentAt.replace(' ', 'T')}Z`);
}

function buildIncident(memberRows: EmailLogRow[]): EmailLogIncident {
  const sentAts = memberRows.map((row) => row.sentAt).sort();
  const templateIds = Array.from(
    new Set(memberRows.map((row) => row.templateId).filter((id): id is string => id !== null)),
  ).sort();
  return {
    kind: 'incident',
    count: memberRows.length,
    firstSentAt: sentAts[0],
    lastSentAt: sentAts[sentAts.length - 1],
    errorDetail: memberRows[0].errorDetail ?? '',
    templateIds,
    rows: memberRows,
  };
}

/**
 * Fold `rows` (the full, ordered send-log chronology) into display units. A run of two or more
 * consecutive failed rows -- consecutive within the failed rows alone, so an interleaved sent row
 * neither joins nor breaks the run -- sharing one non-null `error_detail` and chained at gaps
 * under an hour becomes one `EmailLogIncident`. Every other row, including a lone failed row with
 * no adjacent match, is returned as its own `EmailLogSingleRow`. The returned array preserves
 * `rows`' own order: an incident occupies the position of its first member, and every other
 * member's index is folded into it rather than emitted again.
 */
export function groupEmailLog(rows: EmailLogRow[]): EmailLogDisplayUnit[] {
  const runs: number[][] = [];
  let previousFailedIndex = -1;

  rows.forEach((row, index) => {
    if (row.status !== 'failed') return;

    const previous = previousFailedIndex >= 0 ? rows[previousFailedIndex] : undefined;
    const chainsFromPrevious =
      previous !== undefined &&
      row.errorDetail !== null &&
      previous.errorDetail === row.errorDetail &&
      Math.abs(parseSentAtMs(row.sentAt) - parseSentAtMs(previous.sentAt)) < INCIDENT_GAP_MS;

    if (chainsFromPrevious) {
      runs[runs.length - 1].push(index);
    } else {
      runs.push([index]);
    }
    previousFailedIndex = index;
  });

  const multiRuns = runs.filter((run) => run.length > 1);
  const runByFirstIndex = new Map(multiRuns.map((run) => [run[0], run]));
  const foldedIndices = new Set(multiRuns.flat());

  return rows.reduce<EmailLogDisplayUnit[]>((units, row, index) => {
    const run = runByFirstIndex.get(index);
    if (run) {
      units.push(buildIncident(run.map((memberIndex) => rows[memberIndex])));
    } else if (!foldedIndices.has(index)) {
      units.push({ kind: 'row', row });
    }
    return units;
  }, []);
}
