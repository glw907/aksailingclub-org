import { describe, expect, it } from 'vitest';
import { computeAge, eligibilityForTrack, isAgeEligibleForTrack } from '$member-portal/lib/age-gate';

describe('computeAge', () => {
  it('counts a birthday that has already landed this year', () => {
    expect(computeAge('2015-01-01', new Date('2026-07-07T00:00:00Z'))).toBe(11);
  });

  it('does not count a birthday that has not landed yet this year', () => {
    expect(computeAge('2015-12-31', new Date('2026-07-07T00:00:00Z'))).toBe(10);
  });

  it('counts the birthday itself as landed', () => {
    expect(computeAge('2015-07-07', new Date('2026-07-07T00:00:00Z'))).toBe(11);
  });
});

describe('isAgeEligibleForTrack', () => {
  it('youth is a closed 8-12 window', () => {
    expect(isAgeEligibleForTrack(7, 'youth')).toBe(false);
    expect(isAgeEligibleForTrack(8, 'youth')).toBe(true);
    expect(isAgeEligibleForTrack(12, 'youth')).toBe(true);
    expect(isAgeEligibleForTrack(13, 'youth')).toBe(false);
  });

  it('adult-teen is an open 13+ floor, no ceiling', () => {
    expect(isAgeEligibleForTrack(12, 'adult-teen')).toBe(false);
    expect(isAgeEligibleForTrack(13, 'adult-teen')).toBe(true);
    expect(isAgeEligibleForTrack(90, 'adult-teen')).toBe(true);
  });
});

describe('eligibilityForTrack', () => {
  const NOW = new Date('2026-07-07T00:00:00Z');

  it('asks for a birthdate when none is on file', () => {
    expect(eligibilityForTrack(null, 'youth', NOW)).toEqual({ eligible: false, needsBirthdate: true });
  });

  it('is eligible when the age fits the track', () => {
    expect(eligibilityForTrack('2016-01-01', 'youth', NOW)).toEqual({ eligible: true });
  });

  it('is ineligible, carrying the computed age, when it does not', () => {
    expect(eligibilityForTrack('2020-01-01', 'youth', NOW)).toEqual({ eligible: false, needsBirthdate: false, age: 6 });
    expect(eligibilityForTrack('2020-01-01', 'adult-teen', NOW)).toEqual({ eligible: false, needsBirthdate: false, age: 6 });
  });
});
