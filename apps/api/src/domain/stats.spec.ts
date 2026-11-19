import { describe, expect, it } from 'vitest';
import { summarize } from './stats.js';

const MAX = Number.MAX_SAFE_INTEGER;

describe('summarize', () => {
  it.each([
    {
      name: 'empty input',
      amounts: [],
      expected: { count: 0, min: null, median: null, avg: null, max: null },
    },
    {
      name: 'a single amount',
      amounts: [500],
      expected: { count: 1, min: 500, median: 500, avg: 500, max: 500 },
    },
    {
      name: 'an odd count: the median is the middle value',
      amounts: [100, 200, 300],
      expected: { count: 3, min: 100, median: 200, avg: 200, max: 300 },
    },
    {
      name: 'an even count: the median is the mean of the two middle values',
      amounts: [100, 200, 300, 400],
      expected: { count: 4, min: 100, median: 250, avg: 250, max: 400 },
    },
    {
      name: 'all amounts equal',
      amounts: [700, 700, 700, 700],
      expected: { count: 4, min: 700, median: 700, avg: 700, max: 700 },
    },
    {
      name: 'unsorted input',
      amounts: [500, 100, 400, 200, 300],
      expected: { count: 5, min: 100, median: 300, avg: 300, max: 500 },
    },
    {
      name: 'amounts that sort differently as text than as numbers',
      amounts: [100, 9, 10],
      expected: { count: 3, min: 9, median: 10, avg: 40, max: 100 },
    },
    {
      name: 'a median far from the average',
      amounts: [100, 100, 100, 100, 9_600],
      expected: { count: 5, min: 100, median: 100, avg: 2_000, max: 9_600 },
    },
    {
      name: 'zero amounts',
      amounts: [0, 0, 0],
      expected: { count: 3, min: 0, median: 0, avg: 0, max: 0 },
    },
  ])('summarizes $name', ({ amounts, expected }) => {
    expect(summarize(amounts)).toEqual(expected);
  });

  it.each([
    { amounts: [1, 2], median: 2, why: '1.5 rounds half up to 2' },
    { amounts: [100, 201], median: 151, why: '150.5 rounds half up to 151' },
    { amounts: [2, 4], median: 3, why: '3 is already whole' },
    { amounts: [5, 1, 2, 8], median: 4, why: 'the middle values of the sorted list are 2 and 5' },
  ])(
    'rounds an even-count median half up: $amounts gives $median ($why)',
    ({ amounts, median }) => {
      expect(summarize(amounts).median).toBe(median);
    },
  );

  it.each([
    { amounts: [1, 2], avg: 2, why: '1.5 rounds half up' },
    { amounts: [1, 1, 2], avg: 1, why: '1.33 rounds down' },
    { amounts: [1, 2, 2], avg: 2, why: '1.67 rounds up' },
    { amounts: [0, 0, 1], avg: 0, why: '0.33 rounds down' },
    { amounts: [1, 2, 3, 4], avg: 3, why: '2.5 rounds half up' },
  ])('rounds the average half up: $amounts gives $avg ($why)', ({ amounts, avg }) => {
    expect(summarize(amounts).avg).toBe(avg);
  });

  it('does not change the order of the array it is given', () => {
    const amounts = [300, 100, 200];

    summarize(amounts);

    expect(amounts).toEqual([300, 100, 200]);
  });

  it('summarizes a 10,000-person payroll exactly', () => {
    const amounts = Array<number>(10_000).fill(324_000_000);

    expect(summarize(amounts)).toEqual({
      count: 10_000,
      min: 324_000_000,
      median: 324_000_000,
      avg: 324_000_000,
      max: 324_000_000,
    });
  });

  it('keeps the average exact when the sum is larger than a float can hold', () => {
    // The sum is 3 * MAX - 3, which no double can represent. Adding as floats gives MAX - 2.
    expect(summarize([MAX, MAX, MAX - 3]).avg).toBe(MAX - 1);
  });

  it('keeps an even-count median exact when the two middle values sum past a float', () => {
    // (MAX + MAX - 1) / 2 is MAX - 0.5, which rounds half up to MAX. As floats it gives MAX - 1.
    expect(summarize([MAX, MAX - 1]).median).toBe(MAX);
  });
});
