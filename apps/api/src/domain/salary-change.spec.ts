import { describe, expect, it } from 'vitest';
import { salaryChangeIssue } from './salary-change.js';

const employee = { hireDate: '2024-03-01', salaryMinor: 324_000_000 };

describe('salaryChangeIssue', () => {
  it('finds nothing wrong with a different salary dated after the hire date', () => {
    const change = { effectiveDate: '2026-11-01', newSalaryMinor: 360_000_000 };

    expect(salaryChangeIssue(employee, change)).toBeUndefined();
  });

  it('accepts an effective date equal to the hire date', () => {
    const change = { effectiveDate: '2024-03-01', newSalaryMinor: 360_000_000 };

    expect(salaryChangeIssue(employee, change)).toBeUndefined();
  });

  it('rejects an effective date one day before the hire date', () => {
    const change = { effectiveDate: '2024-02-29', newSalaryMinor: 360_000_000 };

    expect(salaryChangeIssue(employee, change)).toEqual({
      path: 'effectiveDate',
      message: 'Effective date cannot be before the hire date',
    });
  });

  it('rejects an effective date in an earlier year, even with a later month and day', () => {
    const change = { effectiveDate: '2023-12-31', newSalaryMinor: 360_000_000 };

    expect(salaryChangeIssue(employee, change)).toMatchObject({ path: 'effectiveDate' });
  });

  it('rejects a new salary equal to the current one', () => {
    const change = { effectiveDate: '2026-11-01', newSalaryMinor: 324_000_000 };

    expect(salaryChangeIssue(employee, change)).toEqual({
      path: 'newSalaryMajor',
      message: 'New salary must be different from the current salary',
    });
  });

  it.each([
    { newSalaryMinor: 324_000_001, description: 'one minor unit higher' },
    { newSalaryMinor: 323_999_999, description: 'one minor unit lower' },
  ])('accepts a new salary $description than the current one', ({ newSalaryMinor }) => {
    const change = { effectiveDate: '2026-11-01', newSalaryMinor };

    expect(salaryChangeIssue(employee, change)).toBeUndefined();
  });

  it('reports the effective date first when both rules are broken', () => {
    const change = { effectiveDate: '2024-02-29', newSalaryMinor: 324_000_000 };

    expect(salaryChangeIssue(employee, change)).toMatchObject({ path: 'effectiveDate' });
  });
});
