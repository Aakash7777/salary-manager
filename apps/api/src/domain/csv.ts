import { getCountry, minorUnitsFor } from '@salary-manager/shared';

const NEEDS_QUOTES = /[",\r\n]/;
// A spreadsheet treats a cell that starts with one of these as a formula and may run it.
const STARTS_LIKE_A_FORMULA = /^[=+\-@]/;

export function csvCell(value: string): string {
  const safe = STARTS_LIKE_A_FORMULA.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvLine(cells: string[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

/** An amount in major units as plain digits: no grouping, no currency, no float arithmetic. */
export function majorUnitsText(amountMinor: number, minorUnits: number): string {
  const digits = String(amountMinor).padStart(minorUnits + 1, '0');
  const whole = digits.slice(0, digits.length - minorUnits);
  const fraction = digits.slice(digits.length - minorUnits);
  return /^0*$/.test(fraction) ? whole : `${whole}.${fraction}`;
}

export interface CsvEmployee {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  currency: string;
  salaryMinor: number;
  employmentType: string;
  hireDate: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACTOR: 'Contractor',
};

export const EMPLOYEE_CSV_HEADER_LINE = csvLine([
  'Name',
  'Email',
  'Job title',
  'Department',
  'Country',
  'Currency',
  'Annual salary',
  'Employment type',
  'Hire date',
]);

export function employeeCsvLine(employee: CsvEmployee): string {
  return csvLine([
    employee.fullName,
    employee.email,
    employee.jobTitle,
    employee.department,
    getCountry(employee.countryCode).name,
    employee.currency,
    majorUnitsText(employee.salaryMinor, minorUnitsFor(employee.currency)),
    EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType,
    employee.hireDate,
  ]);
}
