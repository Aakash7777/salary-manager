import { describe, expect, it } from 'vitest';
import { findOutliers } from './outliers.js';

/**
 * Three people on exactly 100,000 plus one more. With three equal values in a group of four,
 * the median is 100,000 whatever the fourth person earns, so the fourth is the one under test.
 */
function groupAround100k(testedSalary: number, groupKey = 'IN|Engineer') {
  return [
    { id: 1, groupKey, salaryMinor: 100_000 },
    { id: 2, groupKey, salaryMinor: 100_000 },
    { id: 3, groupKey, salaryMinor: 100_000 },
    { id: 4, groupKey, salaryMinor: testedSalary },
  ];
}

describe('findOutliers', () => {
  it('finds nothing in an empty list', () => {
    expect(findOutliers([])).toEqual([]);
  });

  it('finds nothing in a group of one, however large the salary', () => {
    expect(findOutliers([{ id: 1, groupKey: 'IN|Engineer', salaryMinor: 9_999_999 }])).toEqual([]);
  });

  it('finds nothing when everyone in the group earns the same', () => {
    expect(findOutliers(groupAround100k(100_000))).toEqual([]);
  });

  it('reports a salary far above the median with the median, the signed difference and the direction', () => {
    expect(findOutliers(groupAround100k(150_000))).toEqual([
      {
        id: 4,
        groupKey: 'IN|Engineer',
        salaryMinor: 150_000,
        groupMedianMinor: 100_000,
        differencePct: 50,
        direction: 'above',
      },
    ]);
  });

  it('reports a salary far below the median with a negative difference', () => {
    expect(findOutliers(groupAround100k(60_000))).toEqual([
      {
        id: 4,
        groupKey: 'IN|Engineer',
        salaryMinor: 60_000,
        groupMedianMinor: 100_000,
        differencePct: -40,
        direction: 'below',
      },
    ]);
  });

  it.each([
    { salaryMinor: 125_000, flagged: false, why: 'exactly 25% above is not an outlier' },
    { salaryMinor: 125_001, flagged: true, why: 'one minor unit past 25% above is' },
    { salaryMinor: 75_000, flagged: false, why: 'exactly 25% below is not an outlier' },
    { salaryMinor: 74_999, flagged: true, why: 'one minor unit past 25% below is' },
    { salaryMinor: 124_999, flagged: false, why: 'just inside 25% above is not' },
    { salaryMinor: 75_001, flagged: false, why: 'just inside 25% below is not' },
  ])('at the default threshold, $salaryMinor against a median of 100000: $why', (testCase) => {
    const flaggedIds = findOutliers(groupAround100k(testCase.salaryMinor)).map((row) => row.id);

    expect(flaggedIds).toEqual(testCase.flagged ? [4] : []);
  });

  it.each([
    { salaryMinor: 133_333, differencePct: 33.3 },
    { salaryMinor: 166_667, differencePct: 66.7 },
    { salaryMinor: 66_666, differencePct: -33.3 },
    { salaryMinor: 125_001, differencePct: 25 },
    { salaryMinor: 74_999, differencePct: -25 },
  ])(
    'gives the difference for $salaryMinor to one decimal place: $differencePct',
    ({ salaryMinor, differencePct }) => {
      expect(findOutliers(groupAround100k(salaryMinor))).toMatchObject([{ differencePct }]);
    },
  );

  it('flags both people in a group of two who are far apart, against the median between them', () => {
    const rows = [
      { id: 1, groupKey: 'IN|Engineer', salaryMinor: 100_000 },
      { id: 2, groupKey: 'IN|Engineer', salaryMinor: 300_000 },
    ];

    expect(findOutliers(rows)).toMatchObject([
      { id: 1, groupMedianMinor: 200_000, differencePct: -50, direction: 'below' },
      { id: 2, groupMedianMinor: 200_000, differencePct: 50, direction: 'above' },
    ]);
  });

  it('judges each row against its own group, so the same salary can be an outlier in one group only', () => {
    const rows = [
      ...groupAround100k(120_000, 'IN|Engineer'),
      { id: 5, groupKey: 'US|Engineer', salaryMinor: 200_000 },
      { id: 6, groupKey: 'US|Engineer', salaryMinor: 200_000 },
      { id: 7, groupKey: 'US|Engineer', salaryMinor: 200_000 },
      { id: 8, groupKey: 'US|Engineer', salaryMinor: 120_000 },
    ];

    // 120,000 is 20% above the Indian median but 40% below the US one.
    expect(findOutliers(rows)).toMatchObject([
      { id: 8, groupKey: 'US|Engineer', groupMedianMinor: 200_000, differencePct: -40 },
    ]);
  });

  it('works out the median from unsorted rows whose groups are interleaved', () => {
    const rows = [
      { id: 1, groupKey: 'B', salaryMinor: 900 },
      { id: 2, groupKey: 'A', salaryMinor: 500 },
      { id: 3, groupKey: 'B', salaryMinor: 100 },
      { id: 4, groupKey: 'A', salaryMinor: 100 },
      { id: 5, groupKey: 'B', salaryMinor: 200 },
      { id: 6, groupKey: 'A', salaryMinor: 110 },
    ];

    // A sorted is 100, 110, 500 (median 110). B sorted is 100, 200, 900 (median 200).
    expect(findOutliers(rows)).toMatchObject([
      { id: 1, groupMedianMinor: 200, differencePct: 350, direction: 'above' },
      { id: 2, groupMedianMinor: 110, differencePct: 354.5, direction: 'above' },
      { id: 3, groupMedianMinor: 200, differencePct: -50, direction: 'below' },
    ]);
  });

  it('returns the outliers in the order their rows were given', () => {
    const rows = [
      { id: 30, groupKey: 'A', salaryMinor: 200_000 },
      { id: 10, groupKey: 'A', salaryMinor: 100_000 },
      { id: 20, groupKey: 'A', salaryMinor: 100_000 },
      { id: 40, groupKey: 'A', salaryMinor: 100_000 },
      { id: 5, groupKey: 'A', salaryMinor: 10_000 },
    ];

    expect(findOutliers(rows).map((row) => row.id)).toEqual([30, 5]);
  });

  it.each([
    { thresholdPct: 10, flagged: true, why: '15% is more than 10%' },
    { thresholdPct: 15, flagged: false, why: 'exactly at a custom threshold is not an outlier' },
    { thresholdPct: 50, flagged: false, why: '15% is within 50%' },
  ])('uses a custom threshold of $thresholdPct%: $why', ({ thresholdPct, flagged }) => {
    const flaggedIds = findOutliers(groupAround100k(115_000), thresholdPct).map((row) => row.id);

    expect(flaggedIds).toEqual(flagged ? [4] : []);
  });

  it('does not change the rows it is given', () => {
    const rows = groupAround100k(150_000);
    const before = structuredClone(rows);

    findOutliers(rows);

    expect(rows).toEqual(before);
  });
});
