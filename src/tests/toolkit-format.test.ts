import { describe, expect, it } from 'vitest';
import {
  ageFromBirthdate,
  formatCivilDate,
  formatMoney,
  formatTimestamp,
} from '$admin-club/toolkit/format';

describe('formatMoney', () => {
  it('formats zero cents as a zeroed currency string', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('adds thousands separators, ending the raw-cents artifact', () => {
    expect(formatMoney(30044)).toBe('$300.44');
  });

  it('signs a negative amount (a refund or credit) with a leading minus', () => {
    expect(formatMoney(-4500)).toBe('-$45.00');
  });

  it('honors a non-USD currency option', () => {
    expect(formatMoney(1000, { currency: 'CAD', locale: 'en-CA' })).toContain('10.00');
  });
});

describe('formatCivilDate', () => {
  it('reads the fallback word for a null date', () => {
    expect(formatCivilDate(null)).toBe('Not yet');
  });

  it('honors a caller-supplied fallback word', () => {
    expect(formatCivilDate(null, { fallback: 'TBD' })).toBe('TBD');
  });

  it('parses a bare YYYY-MM-DD date without shifting a day west of Greenwich', () => {
    expect(formatCivilDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('reads the leading date portion of a full SQLite datetime', () => {
    expect(formatCivilDate('2026-06-14 19:22:57')).toBe('Jun 14, 2026');
  });

  it('holds the calendar day across the spring-forward DST boundary', () => {
    expect(formatCivilDate('2026-03-08')).toBe('Mar 8, 2026');
  });

  it('holds the calendar day across the fall-back DST boundary', () => {
    expect(formatCivilDate('2026-11-01')).toBe('Nov 1, 2026');
  });
});

describe('formatTimestamp', () => {
  it('renders an Anchorage-local time before the spring-forward transition (AKST, UTC-9)', () => {
    expect(formatTimestamp('2026-03-08 09:00:00')).toBe('Mar 8, 2026, 12:00 AM');
  });

  it('renders an Anchorage-local time after the spring-forward transition (AKDT, UTC-8)', () => {
    expect(formatTimestamp('2026-03-08 12:00:00')).toBe('Mar 8, 2026, 4:00 AM');
  });

  it('renders an Anchorage-local time across the fall-back transition (AKDT, UTC-8)', () => {
    expect(formatTimestamp('2026-11-01 09:00:00')).toBe('Nov 1, 2026, 1:00 AM');
  });

  it('renders an Anchorage-local time after fall-back completes (AKST, UTC-9)', () => {
    expect(formatTimestamp('2026-11-01 12:00:00')).toBe('Nov 1, 2026, 3:00 AM');
  });

  it('honors a caller-supplied time zone', () => {
    expect(formatTimestamp('2026-06-01 12:00:00', { timeZone: 'UTC' })).toBe('Jun 1, 2026, 12:00 PM');
  });
});

describe('ageFromBirthdate', () => {
  it('reads null for a missing birthdate', () => {
    expect(ageFromBirthdate(null)).toBeNull();
  });

  // `asOf` is built with the local-time Date constructor (year, monthIndex, day), the same way
  // `ageFromBirthdate` builds `birth` internally, so these stay exact regardless of the runner's
  // own time zone -- an ISO `Z` string would drift a calendar day in either direction depending on
  // where the test happens to run.
  it('computes a whole-years age before the birthday this year', () => {
    expect(ageFromBirthdate('2015-08-20', new Date(2026, 7, 19, 12))).toBe(10);
  });

  it('turns over on the birthday itself, not the day after', () => {
    expect(ageFromBirthdate('2015-08-20', new Date(2026, 7, 20, 12))).toBe(11);
  });

  it('computes a whole-years age after the birthday this year', () => {
    expect(ageFromBirthdate('2015-08-20', new Date(2026, 7, 21, 12))).toBe(11);
  });
});
