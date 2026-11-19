import { describe, expect, it } from 'vitest';
import { historyEntryView, roleMedianLine } from './employee-view';

const inIndia = { countryCode: 'IN', currency: 'INR' };

describe('roleMedianLine', () => {
  it('says how far above the median the employee is', () => {
    expect(roleMedianLine({ ...inIndia, roleMedianMinor: 305_000_000, pctVsRoleMedian: 6.2 })).toBe(
      'Median for this role in India: INR 30,50,000 · 6.2% above',
    );
  });

  it('says how far below the median the employee is, without a minus sign', () => {
    expect(
      roleMedianLine({ ...inIndia, roleMedianMinor: 340_000_000, pctVsRoleMedian: -4.7 }),
    ).toBe('Median for this role in India: INR 34,00,000 · 4.7% below');
  });

  it('says when the employee is exactly at the median', () => {
    expect(roleMedianLine({ ...inIndia, roleMedianMinor: 324_000_000, pctVsRoleMedian: 0 })).toBe(
      'Median for this role in India: INR 32,40,000 · at the median',
    );
  });

  it('says when there is nobody else in the role to compare with', () => {
    expect(roleMedianLine({ ...inIndia, roleMedianMinor: null, pctVsRoleMedian: null })).toBe(
      'Only person in this role in India',
    );
  });

  it('names the employee’s own country and uses its currency', () => {
    expect(
      roleMedianLine({
        countryCode: 'DE',
        currency: 'EUR',
        roleMedianMinor: 7_000_000,
        pctVsRoleMedian: 14.3,
      }),
    ).toBe('Median for this role in Germany: EUR 70,000 · 14.3% above');
  });
});

describe('historyEntryView', () => {
  it('shows a starting salary as a single amount with no percentage', () => {
    const view = historyEntryView({
      oldSalaryMinor: null,
      oldCurrency: null,
      newSalaryMinor: 2_800_000,
      currency: 'GBP',
    });

    expect(view).toEqual({ kind: 'starting', amounts: 'GBP 28,000', percent: null });
  });

  it('shows a raise as old → new with a positive percentage', () => {
    const view = historyEntryView({
      oldSalaryMinor: 300_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 324_000_000,
      currency: 'INR',
    });

    expect(view).toEqual({
      kind: 'increase',
      amounts: 'INR 30,00,000 → INR 32,40,000',
      percent: '+8.0%',
    });
  });

  it('shows a cut as old → new with a negative percentage', () => {
    const view = historyEntryView({
      oldSalaryMinor: 310_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 300_000_000,
      currency: 'INR',
    });

    expect(view).toEqual({
      kind: 'decrease',
      amounts: 'INR 31,00,000 → INR 30,00,000',
      percent: '-3.2%',
    });
  });

  it('shows a country change in both currencies, with no percentage across them', () => {
    const view = historyEntryView({
      oldSalaryMinor: 2_800_000,
      oldCurrency: 'GBP',
      newSalaryMinor: 310_000_000,
      currency: 'INR',
    });

    expect(view).toEqual({
      kind: 'countryChange',
      amounts: 'GBP 28,000 → INR 31,00,000',
      percent: null,
    });
  });
});
