import { describe, expect, it } from 'vitest';
import { simulateRaise } from './raise-simulation.js';

function paid(currency: string, ...salariesMinor: number[]) {
  return salariesMinor.map((salaryMinor) => ({ currency, salaryMinor }));
}

describe('simulateRaise', () => {
  it('returns no rows and a zero total for an empty list', () => {
    expect(simulateRaise([], 8)).toEqual({ byCurrency: [], increaseUsdMinor: 0 });
  });

  it('costs nothing at 0%, and still counts the people and their current total', () => {
    expect(simulateRaise(paid('USD', 9_500_000, 10_500_000), 0)).toEqual({
      byCurrency: [
        {
          currency: 'USD',
          headcount: 2,
          currentTotalMinor: 20_000_000,
          increaseMinor: 0,
          newTotalMinor: 20_000_000,
        },
      ],
      increaseUsdMinor: 0,
    });
  });

  it('gives each person their percentage and adds the increases up', () => {
    // 8% of USD 95,000 = 7,600 and of USD 105,000 = 8,400: 16,000 in all.
    expect(simulateRaise(paid('USD', 9_500_000, 10_500_000), 8)).toEqual({
      byCurrency: [
        {
          currency: 'USD',
          headcount: 2,
          currentTotalMinor: 20_000_000,
          increaseMinor: 1_600_000,
          newTotalMinor: 21_600_000,
        },
      ],
      increaseUsdMinor: 1_600_000,
    });
  });

  it('accepts the largest raise, exactly 50%', () => {
    expect(simulateRaise(paid('USD', 100_000), 50).byCurrency).toEqual([
      {
        currency: 'USD',
        headcount: 1,
        currentTotalMinor: 100_000,
        increaseMinor: 50_000,
        newTotalMinor: 150_000,
      },
    ]);
  });

  it.each([
    { pct: 50.1, why: 'one tenth above the maximum' },
    { pct: 51, why: 'above the maximum' },
    { pct: 100, why: 'far above the maximum' },
    { pct: -0.1, why: 'one tenth below zero' },
    { pct: -8, why: 'negative' },
  ])('rejects a raise of $pct% ($why)', ({ pct }) => {
    expect(() => simulateRaise(paid('USD', 100_000), pct)).toThrow(
      'Raise percentage must be between 0 and 50',
    );
  });

  it.each([8.25, 0.05, 49.99])('rejects a raise of %s%, which has more than one decimal', (pct) => {
    expect(() => simulateRaise(paid('USD', 100_000), pct)).toThrow(
      'Raise percentage can have at most 1 decimal place',
    );
  });

  it('rejects a percentage that is not a number', () => {
    expect(() => simulateRaise(paid('USD', 100_000), Number.NaN)).toThrow(
      'Enter a valid raise percentage',
    );
  });

  it('rejects a bad percentage even when there is nobody to give it to', () => {
    expect(() => simulateRaise([], 50.1)).toThrow('Raise percentage must be between 0 and 50');
  });

  describe('rounding', () => {
    it('rounds each person’s increase half up before adding, so halves are not lost', () => {
      // 10% of 5 minor units is 0.5, which each of the three people gets rounded up to 1.
      // Adding first would give 10% of 15 = 1.5 -> 2, one less than they are actually paid.
      expect(simulateRaise(paid('USD', 5, 5, 5), 10).byCurrency).toEqual([
        {
          currency: 'USD',
          headcount: 3,
          currentTotalMinor: 15,
          increaseMinor: 3,
          newTotalMinor: 18,
        },
      ]);
    });

    it('rounds each person’s increase down below a half, so fractions do not add up to a unit', () => {
      // 10% of 4 minor units is 0.4, which each of the three people loses.
      // Adding first would give 10% of 12 = 1.2 -> 1, one more than they are actually paid.
      expect(simulateRaise(paid('USD', 4, 4, 4), 10).byCurrency).toEqual([
        {
          currency: 'USD',
          headcount: 3,
          currentTotalMinor: 12,
          increaseMinor: 0,
          newTotalMinor: 12,
        },
      ]);
    });

    it.each([
      { salaryMinor: 1_500, pct: 0.1, exact: '1.5', increaseMinor: 2 },
      { salaryMinor: 1_499, pct: 0.1, exact: '1.499', increaseMinor: 1 },
      { salaryMinor: 200_000, pct: 12.5, exact: '25,000', increaseMinor: 25_000 },
      { salaryMinor: 333, pct: 12.5, exact: '41.625', increaseMinor: 42 },
      { salaryMinor: 1, pct: 50, exact: '0.5', increaseMinor: 1 },
      { salaryMinor: 1, pct: 49.9, exact: '0.499', increaseMinor: 0 },
    ])(
      'gives $increaseMinor for $pct% of $salaryMinor minor units (exactly $exact)',
      ({ salaryMinor, pct, increaseMinor }) => {
        expect(simulateRaise(paid('USD', salaryMinor), pct).byCurrency[0]?.increaseMinor).toBe(
          increaseMinor,
        );
      },
    );

    // In floating point 8.3 * 10 is 83.00000000000001 and 16.1 * 10 is 161.00000000000003.
    it.each([
      { pct: 8.3, increaseMinor: 83 },
      { pct: 16.1, increaseMinor: 161 },
      { pct: 1.1, increaseMinor: 11 },
      { pct: 0.7, increaseMinor: 7 },
      { pct: 33.3, increaseMinor: 333 },
    ])(
      'works the percentage out in whole tenths, so $pct% of 1,000 is exactly $increaseMinor',
      ({ pct, increaseMinor }) => {
        expect(simulateRaise(paid('USD', 1_000), pct).byCurrency[0]?.increaseMinor).toBe(
          increaseMinor,
        );
      },
    );
  });

  describe('several currencies', () => {
    const mixed = [
      ...paid('USD', 9_500_000),
      ...paid('INR', 100_000_000, 120_000_000),
      ...paid('EUR', 8_000_000),
    ];

    it('keeps each currency on its own row, in order of currency code', () => {
      expect(simulateRaise(mixed, 10).byCurrency).toEqual([
        {
          currency: 'EUR',
          headcount: 1,
          currentTotalMinor: 8_000_000,
          increaseMinor: 800_000,
          newTotalMinor: 8_800_000,
        },
        {
          currency: 'INR',
          headcount: 2,
          currentTotalMinor: 220_000_000,
          increaseMinor: 22_000_000,
          newTotalMinor: 242_000_000,
        },
        {
          currency: 'USD',
          headcount: 1,
          currentTotalMinor: 9_500_000,
          increaseMinor: 950_000,
          newTotalMinor: 10_450_000,
        },
      ]);
    });

    it('never adds amounts in different currencies: the only cross-currency figure is in USD', () => {
      // Increase by currency, each converted on its own and then added:
      //   EUR   8,000 x 1.08  = USD  8,640.00
      //   INR 220,000 x 0.012 = USD  2,640.00
      //   USD   9,500 x 1     = USD  9,500.00
      //                         USD 20,780.00
      expect(simulateRaise(mixed, 10).increaseUsdMinor).toBe(2_078_000);
    });

    it('converts each currency’s total increase to USD, not each person’s, so it rounds once per currency', () => {
      // Two people get INR 0.42 each: 84 paise x 0.012 = 1.008 cents -> 1.
      // Converting each increase first would round 0.504 up twice: 2.
      expect(simulateRaise(paid('INR', 420, 420), 10).increaseUsdMinor).toBe(1);
    });

    it('throws for a currency that is not in the country config', () => {
      expect(() => simulateRaise(paid('JPY', 100_000), 10)).toThrow('Unknown currency: JPY');
    });
  });

  it('adds in BigInt, so a total increase past 2^53 minor units still converts exactly', () => {
    // 50% of these three Singapore salaries is 4,500,000,000,000,001 + 4,500,000,000,000,000
    // + 1,000,000,000,000,000 = 10,000,000,000,000,001 cents, which number addition turns
    // into 10,000,000,000,000,000.
    //   exact: 10,000,000,000,000,001 x 0.74 = 7,400,000,000,000,000.74 -> 7,400,000,000,000,001
    //   lossy: 10,000,000,000,000,000 x 0.74 = 7,400,000,000,000,000
    const hugeSalaries = paid(
      'SGD',
      9_000_000_000_000_002,
      9_000_000_000_000_000,
      2_000_000_000_000_000,
    );

    expect(simulateRaise(hugeSalaries, 50).increaseUsdMinor).toBe(7_400_000_000_000_001);
  });

  it('does not change the list it is given', () => {
    const employees = paid('USD', 9_500_000, 10_500_000);

    simulateRaise(employees, 8);

    expect(employees).toEqual(paid('USD', 9_500_000, 10_500_000));
  });
});
