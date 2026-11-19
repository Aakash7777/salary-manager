import { describe, expect, it } from 'vitest';
import { describeSalaryChange, percentChangeText } from './salary-preview';

describe('percentChangeText', () => {
  it.each([
    { from: 300_000_000, to: 324_000_000, text: '+8.0%', why: 'a raise of exactly 8%' },
    { from: 324_000_000, to: 360_000_000, text: '+11.1%', why: '11.111…% rounds to one decimal' },
    { from: 310_000_000, to: 300_000_000, text: '-3.2%', why: 'a cut of 3.2258…%' },
    { from: 324_000_000, to: 300_000_000, text: '-7.4%', why: 'a cut of 7.407…%' },
    { from: 100_000, to: 200_000, text: '+100.0%', why: 'a doubling' },
    { from: 100_000, to: 100_000, text: '0.0%', why: 'no change has no sign' },
    { from: 324_000_000, to: 324_000_100, text: '+0.0%', why: 'a rise too small to show' },
  ])('gives $text from $from to $to ($why)', ({ from, to, text }) => {
    expect(percentChangeText(from, to)).toBe(text);
  });
});

describe('describeSalaryChange', () => {
  it('describes an increase with the percentage and the yearly difference', () => {
    expect(describeSalaryChange(324_000_000, 360_000_000, 'INR')).toBe(
      '+11.1% · Increase of INR 3,60,000 per year',
    );
  });

  it('describes a decrease with a positive amount', () => {
    expect(describeSalaryChange(324_000_000, 300_000_000, 'INR')).toBe(
      '-7.4% · Decrease of INR 2,40,000 per year',
    );
  });

  it('says when the new salary is the same as the current one', () => {
    expect(describeSalaryChange(324_000_000, 324_000_000, 'INR')).toBe(
      'No change from the current salary',
    );
  });

  it('formats the difference in the employee’s currency, with cents when needed', () => {
    expect(describeSalaryChange(9_800_000, 10_050_050, 'EUR')).toBe(
      '+2.6% · Increase of EUR 2,500.50 per year',
    );
  });

  it('describes a change of a single minor unit without losing it', () => {
    expect(describeSalaryChange(324_000_000, 324_000_001, 'INR')).toBe(
      '+0.0% · Increase of INR 0.01 per year',
    );
  });
});
