import type { InputIssue } from './input-issue.js';

export interface SalaryHolder {
  hireDate: string;
  salaryMinor: number;
}

export interface ProposedSalaryChange {
  effectiveDate: string;
  newSalaryMinor: number;
}

/**
 * The first rule a salary change breaks, or undefined when it breaks none.
 * "Not in the future" is not checked here: the shared schema does that against today.
 */
export function salaryChangeIssue(
  employee: SalaryHolder,
  change: ProposedSalaryChange,
): InputIssue | undefined {
  // ISO dates (YYYY-MM-DD) sort the same as text and as dates.
  if (change.effectiveDate < employee.hireDate) {
    return { path: 'effectiveDate', message: 'Effective date cannot be before the hire date' };
  }
  if (change.newSalaryMinor === employee.salaryMinor) {
    return {
      path: 'newSalaryMajor',
      message: 'New salary must be different from the current salary',
    };
  }
  return undefined;
}
