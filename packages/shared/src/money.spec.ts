import { describe, expect, it } from 'vitest';
import { formatMoney, toMinor } from './money.js';

describe('toMinor', () => {
  it.each([
    { major: 0, expected: 0 },
    { major: 5, expected: 500 },
    { major: 32_400, expected: 3_240_000 },
    { major: 12.5, expected: 1_250 },
    { major: 12.34, expected: 1_234 },
  ])('converts the number $major to $expected minor units', ({ major, expected }) => {
    expect(toMinor(major, 'USD')).toBe(expected);
  });

  it.each([
    { major: '0', expected: 0 },
    { major: '5', expected: 500 },
    { major: '3240000', expected: 324_000_000 },
    { major: '12.5', expected: 1_250 },
    { major: '12.34', expected: 1_234 },
    { major: '0.05', expected: 5 },
  ])('converts the string "$major" to $expected minor units', ({ major, expected }) => {
    expect(toMinor(major, 'INR')).toBe(expected);
  });

  // Each of these gives the wrong answer with a naive `major * 100`:
  // 1.15 * 100 = 114.99999999999999, 0.57 * 100 = 56.99999999999999, and so on.
  it.each([
    { major: 1.15, expected: 115 },
    { major: 0.57, expected: 57 },
    { major: 8.2, expected: 820 },
    { major: 19.99, expected: 1_999 },
    { major: 0.29, expected: 29 },
    { major: 1.1, expected: 110 },
    { major: 0.07, expected: 7 },
  ])('converts $major to exactly $expected despite binary float error', ({ major, expected }) => {
    expect(toMinor(major, 'GBP')).toBe(expected);
  });

  it('rejects the float result of 0.1 + 0.2 instead of guessing 0.30', () => {
    expect(() => toMinor(0.1 + 0.2, 'USD')).toThrow(
      'Amount has more than 2 decimal places: 0.30000000000000004',
    );
  });

  it.each([1.234, '1.234', '0.001'])('rejects %s for having more than 2 decimals', (major) => {
    expect(() => toMinor(major, 'USD')).toThrow(`Amount has more than 2 decimal places: ${major}`);
  });

  it.each([-1, -0.01, '-5', '-12.34'])('rejects the negative amount %s', (major) => {
    expect(() => toMinor(major, 'USD')).toThrow(`Amount must not be negative: ${major}`);
  });

  it.each([NaN, Infinity, -Infinity])('rejects %s', (major) => {
    expect(() => toMinor(major, 'USD')).toThrow(`Invalid amount: ${major}`);
  });

  it.each(['', '   ', 'abc', '12abc', '1e3', '1,000', '12.', '.5', '1.2.3'])(
    'rejects the malformed string "%s"',
    (major) => {
      expect(() => toMinor(major, 'USD')).toThrow(`Invalid amount: ${major}`);
    },
  );

  it('rejects an amount too large to hold exactly in minor units', () => {
    // 9,007,199,254,740,993 minor units is above Number.MAX_SAFE_INTEGER
    expect(() => toMinor('90071992547409.93', 'USD')).toThrow(
      'Amount is too large: 90071992547409.93',
    );
  });

  it('throws on an unknown currency', () => {
    expect(() => toMinor(100, 'JPY')).toThrow('Unknown currency: JPY');
  });
});

describe('formatMoney', () => {
  it('formats INR with Indian digit grouping', () => {
    expect(formatMoney(324_000_000, 'INR')).toBe('INR 32,40,000');
  });

  it('formats a crore-sized INR amount with Indian digit grouping', () => {
    expect(formatMoney(1_234_567_890, 'INR')).toBe('INR 1,23,45,678.90');
  });

  it.each([
    { currency: 'INR', expected: 'INR 1,234.56' },
    { currency: 'USD', expected: 'USD 1,234.56' },
    { currency: 'GBP', expected: 'GBP 1,234.56' },
    { currency: 'EUR', expected: 'EUR 1,234.56' },
    { currency: 'SGD', expected: 'SGD 1,234.56' },
  ])('shows the ISO code, never a symbol: $expected', ({ currency, expected }) => {
    expect(formatMoney(123_456, currency)).toBe(expected);
  });

  it.each([
    { amountMinor: 9_500_000, expected: 'USD 95,000' },
    { amountMinor: 500, expected: 'USD 5' },
    { amountMinor: 0, expected: 'USD 0' },
  ])('hides the decimals when the amount is whole: $expected', ({ amountMinor, expected }) => {
    expect(formatMoney(amountMinor, 'USD')).toBe(expected);
  });

  it.each([
    { amountMinor: 1_250, expected: 'USD 12.50' },
    { amountMinor: 5, expected: 'USD 0.05' },
    { amountMinor: 9_500_001, expected: 'USD 95,000.01' },
  ])('shows two decimals when the amount is not whole: $expected', ({ amountMinor, expected }) => {
    expect(formatMoney(amountMinor, 'USD')).toBe(expected);
  });

  it.each(['INR', 'USD', 'GBP', 'EUR', 'SGD'])(
    'separates the code and the %s amount with a regular space, not a non-breaking one',
    (currency) => {
      expect(formatMoney(123_456, currency)).not.toMatch(/[\u00a0\u202f]/);
    },
  );

  it('formats the largest safe amount exactly, without float division', () => {
    // 9007199254740991 / 100 as a float prints ...409.90
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'USD')).toBe('USD 90,071,992,547,409.91');
  });

  it('throws on a non-integer amountMinor', () => {
    expect(() => formatMoney(10.5, 'USD')).toThrow(
      'amountMinor must be an integer number of minor units: 10.5',
    );
  });

  it('throws on a negative amountMinor', () => {
    expect(() => formatMoney(-100, 'USD')).toThrow('amountMinor must not be negative: -100');
  });

  it('throws on an unknown currency', () => {
    expect(() => formatMoney(100, 'JPY')).toThrow('Unknown currency: JPY');
  });
});
