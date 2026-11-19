import { summarize } from './stats.js';

export interface RoleComparison {
  roleMedianMinor: number | null;
  /** Signed difference from the role median, to one decimal place. */
  pctVsRoleMedian: number | null;
}

/** How far `amount` is from `reference`, as a signed percentage to one decimal place. */
export function percentDifference(amount: number, reference: number): number {
  const rounded = Math.round(((amount - reference) * 1000) / reference) / 10;
  // A tiny negative difference rounds to -0, which would print and serialize oddly.
  return rounded === 0 ? 0 : rounded;
}

/**
 * Compares one salary with everyone in the same role, the employee included.
 * A role of one has nobody to compare with, so both results are null.
 */
export function compareWithRole(salaryMinor: number, roleSalariesMinor: number[]): RoleComparison {
  const roleMedianMinor = roleSalariesMinor.length > 1 ? summarize(roleSalariesMinor).median : null;
  if (roleMedianMinor === null) {
    return { roleMedianMinor: null, pctVsRoleMedian: null };
  }
  return { roleMedianMinor, pctVsRoleMedian: percentDifference(salaryMinor, roleMedianMinor) };
}
