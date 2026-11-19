import { percentDifference } from './role-comparison.js';
import { summarize } from './stats.js';

export interface SalaryRow {
  id: number;
  /** Rows are compared only with others that share this key, e.g. one role in one country. */
  groupKey: string;
  salaryMinor: number;
}

export interface Outlier extends SalaryRow {
  groupMedianMinor: number;
  /** Signed difference from the group median, to one decimal place. */
  differencePct: number;
  direction: 'above' | 'below';
}

/** Rows whose salary is more than `thresholdPct` percent above or below their group's median. */
export function findOutliers(rows: SalaryRow[], thresholdPct = 25): Outlier[] {
  const salariesByGroup = new Map<string, number[]>();
  for (const row of rows) {
    salariesByGroup.set(row.groupKey, [
      ...(salariesByGroup.get(row.groupKey) ?? []),
      row.salaryMinor,
    ]);
  }
  const medianByGroup = new Map(
    [...salariesByGroup].map(([groupKey, salaries]) => [groupKey, summarize(salaries).median]),
  );

  return rows.flatMap((row): Outlier[] => {
    const groupMedianMinor = medianByGroup.get(row.groupKey);
    if (groupMedianMinor === undefined || groupMedianMinor === null) {
      return [];
    }
    const difference = row.salaryMinor - groupMedianMinor;
    // Compared as whole numbers, so a salary exactly at the threshold is never tipped over
    // by a rounding error in a percentage.
    if (Math.abs(difference) * 100 <= thresholdPct * groupMedianMinor) {
      return [];
    }
    return [
      {
        ...row,
        groupMedianMinor,
        differencePct: percentDifference(row.salaryMinor, groupMedianMinor),
        direction: difference > 0 ? 'above' : 'below',
      },
    ];
  });
}
