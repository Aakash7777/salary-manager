import { describe, expect, it } from 'vitest';
import { compactUsd, gapFromMedianLabel, pluralise } from './insights-format';

describe('compactUsd', () => {
  it.each([
    { usdMinor: 81_234_567_800, text: 'USD 812M', why: 'USD 812,345,678 in millions' },
    { usdMinor: 66_279_758_500, text: 'USD 663M', why: 'USD 662,797,585 rounds up' },
    { usdMinor: 123_456_789_000, text: 'USD 1.23B', why: 'billions keep three figures' },
    { usdMinor: 73_880_000, text: 'USD 739K', why: 'USD 738,800 in thousands' },
    { usdMinor: 95_000, text: 'USD 950', why: 'below a thousand is shown whole' },
    { usdMinor: 0, text: 'USD 0', why: 'an empty payroll' },
  ])('shortens $usdMinor cents to "$text" ($why)', ({ usdMinor, text }) => {
    expect(compactUsd(usdMinor)).toBe(text);
  });

  it('rounds cents to the nearest dollar before shortening', () => {
    expect(compactUsd(150)).toBe('USD 2');
    expect(compactUsd(149)).toBe('USD 1');
  });
});

describe('gapFromMedianLabel', () => {
  it.each([
    { differencePct: 58.7, label: '58.7% above' },
    { differencePct: -31, label: '31.0% below' },
    { differencePct: 25.04, label: '25.0% above' },
    { differencePct: -100, label: '100.0% below' },
  ])('describes $differencePct as "$label"', ({ differencePct, label }) => {
    expect(gapFromMedianLabel(differencePct)).toBe(label);
  });
});

describe('pluralise', () => {
  it.each([
    { count: 0, text: '0 currencies' },
    { count: 1, text: '1 currency' },
    { count: 5, text: '5 currencies' },
  ])('writes $count as "$text"', ({ count, text }) => {
    expect(pluralise(count, 'currency', 'currencies')).toBe(text);
  });

  it('groups thousands in the count', () => {
    expect(pluralise(4_200, 'employee', 'employees')).toBe('4,200 employees');
  });
});
