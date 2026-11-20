import { describe, expect, it } from 'vitest';
import {
  FX_TABLE_VERSION,
  currencyFor,
  getCountry,
  listCountries,
  minorUnitsFor,
  toUsdMinor,
} from './countries.js';

describe('FX_TABLE_VERSION', () => {
  it('identifies the fixed FX table the rates below belong to', () => {
    expect(FX_TABLE_VERSION).toBe('2026-11');
  });
});

describe('getCountry', () => {
  it.each([
    { code: 'IN', name: 'India', currency: 'INR', fxToUsd: 0.012 },
    { code: 'US', name: 'United States', currency: 'USD', fxToUsd: 1 },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', fxToUsd: 1.27 },
    { code: 'DE', name: 'Germany', currency: 'EUR', fxToUsd: 1.08 },
    { code: 'SG', name: 'Singapore', currency: 'SGD', fxToUsd: 0.74 },
  ])('returns the full config entry for $code', ({ code, name, currency, fxToUsd }) => {
    expect(getCountry(code)).toEqual({ code, name, currency, minorUnits: 2, fxToUsd });
  });

  it('throws on an unknown country code', () => {
    expect(() => getCountry('ZZ')).toThrow('Unknown country code: ZZ');
  });
});

describe('listCountries', () => {
  it('returns every supported country, sorted by name', () => {
    expect(listCountries().map((country) => `${country.code} ${country.name}`)).toEqual([
      'DE Germany',
      'IN India',
      'SG Singapore',
      'GB United Kingdom',
      'US United States',
    ]);
  });

  it('returns the same entries as getCountry', () => {
    for (const country of listCountries()) {
      expect(country).toEqual(getCountry(country.code));
    }
  });

  it('hands out a fresh list, so a caller cannot reorder or empty the config', () => {
    listCountries().length = 0;

    expect(listCountries()).toHaveLength(5);
  });
});

describe('currencyFor', () => {
  it.each([
    ['IN', 'INR'],
    ['US', 'USD'],
    ['GB', 'GBP'],
    ['DE', 'EUR'],
    ['SG', 'SGD'],
  ])('derives the currency of %s as %s', (code, currency) => {
    expect(currencyFor(code)).toBe(currency);
  });

  it('throws on an unknown country code', () => {
    expect(() => currencyFor('ZZ')).toThrow('Unknown country code: ZZ');
  });
});

describe('minorUnitsFor', () => {
  it.each(['INR', 'USD', 'GBP', 'EUR', 'SGD'])('returns 2 minor units for %s', (currency) => {
    expect(minorUnitsFor(currency)).toBe(2);
  });

  it('throws on an unknown currency', () => {
    expect(() => minorUnitsFor('JPY')).toThrow('Unknown currency: JPY');
  });
});

describe('toUsdMinor', () => {
  it.each(['INR', 'USD', 'GBP', 'EUR', 'SGD'])('converts 0 %s to 0 USD cents', (currency) => {
    expect(toUsdMinor(0, currency)).toBe(0);
  });

  it('returns a USD amount unchanged', () => {
    expect(toUsdMinor(123_456, 'USD')).toBe(123_456);
  });

  it('converts a whole amount exactly', () => {
    // INR 100,000.00 at 0.012 = USD 1,200.00
    expect(toUsdMinor(10_000_000, 'INR')).toBe(120_000);
  });

  it('rounds down when the fraction is below half a cent', () => {
    // 49 pence at 1.27 = 62.23 cents
    expect(toUsdMinor(49, 'GBP')).toBe(62);
  });

  it('rounds up when the fraction is above half a cent', () => {
    // 7 euro cents at 1.08 = 7.56 cents
    expect(toUsdMinor(7, 'EUR')).toBe(8);
  });

  it.each([
    { amountMinor: 50, currency: 'GBP', exact: '63.5', expected: 64 },
    { amountMinor: 125, currency: 'INR', exact: '1.5', expected: 2 },
    { amountMinor: 25, currency: 'SGD', exact: '18.5', expected: 19 },
  ])(
    'rounds exactly half a cent up ($amountMinor $currency minor = $exact cents)',
    ({ amountMinor, currency, expected }) => {
      expect(toUsdMinor(amountMinor, currency)).toBe(expected);
    },
  );

  it('stays exact for payroll-sized totals', () => {
    // GBP 50,000,000,000.50 at 1.27 = 6,350,000,000,063.5 cents, half rounds up
    expect(toUsdMinor(5_000_000_000_050, 'GBP')).toBe(6_350_000_000_064);
  });

  it('converts a total past 2^53, given as a bigint, without losing a minor unit', () => {
    // SGD 100,000,000,000,000.01 at 0.74 = 7,400,000,000,000,000.74 cents -> ...001.
    // As a number this total cannot be held: it becomes 10,000,000,000,000,000 and converts to ...000.
    expect(toUsdMinor(10_000_000_000_000_001n, 'SGD')).toBe(7_400_000_000_000_001);
  });

  it('throws on a negative bigint amountMinor', () => {
    expect(() => toUsdMinor(-100n, 'GBP')).toThrow('amountMinor must not be negative: -100');
  });

  it('throws on an unknown currency', () => {
    expect(() => toUsdMinor(100, 'JPY')).toThrow('Unknown currency: JPY');
  });

  it('throws on a non-integer amountMinor', () => {
    expect(() => toUsdMinor(10.5, 'GBP')).toThrow(
      'amountMinor must be an integer number of minor units: 10.5',
    );
  });

  it('throws on a negative amountMinor', () => {
    expect(() => toUsdMinor(-100, 'GBP')).toThrow('amountMinor must not be negative: -100');
  });
});
