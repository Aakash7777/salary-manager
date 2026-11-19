import { describe, expect, it } from 'vitest';
import { compareWithRole, percentDifference } from './role-comparison.js';

describe('percentDifference', () => {
  it.each([
    { amount: 150_000, reference: 100_000, expected: 50 },
    { amount: 60_000, reference: 100_000, expected: -40 },
    { amount: 100_000, reference: 100_000, expected: 0 },
    { amount: 200_000_000, reference: 130_000_000, expected: 53.8 },
    { amount: 100_000_000, reference: 130_000_000, expected: -23.1 },
    { amount: 133_333, reference: 100_000, expected: 33.3 },
    { amount: 166_667, reference: 100_000, expected: 66.7 },
  ])(
    'gives $expected for $amount against $reference, to one decimal place',
    ({ amount, reference, expected }) => {
      expect(percentDifference(amount, reference)).toBe(expected);
    },
  );

  it('gives a plain 0, not negative zero, for a difference too small to show', () => {
    expect(Object.is(percentDifference(99_999_999, 100_000_000), 0)).toBe(true);
  });
});

describe('compareWithRole', () => {
  it('gives the median of the role and the difference from it', () => {
    const roleSalaries = [100_000_000, 120_000_000, 140_000_000, 200_000_000];

    expect(compareWithRole(200_000_000, roleSalaries)).toEqual({
      roleMedianMinor: 130_000_000,
      pctVsRoleMedian: 53.8,
    });
  });

  it('gives a negative difference to someone below the median', () => {
    expect(compareWithRole(6_000_000, [6_000_000, 8_000_000])).toEqual({
      roleMedianMinor: 7_000_000,
      pctVsRoleMedian: -14.3,
    });
  });

  it('gives 0 to someone exactly on the median', () => {
    expect(compareWithRole(7_000_000, [7_000_000, 7_000_000, 9_000_000])).toEqual({
      roleMedianMinor: 7_000_000,
      pctVsRoleMedian: 0,
    });
  });

  it('gives nulls when the employee is the only one in the role', () => {
    expect(compareWithRole(9_000_000, [9_000_000])).toEqual({
      roleMedianMinor: null,
      pctVsRoleMedian: null,
    });
  });

  it('gives nulls when there is nobody in the role at all', () => {
    expect(compareWithRole(9_000_000, [])).toEqual({
      roleMedianMinor: null,
      pctVsRoleMedian: null,
    });
  });
});
