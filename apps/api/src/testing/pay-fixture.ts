import type { EmployeesService } from '../employees/employees.service.js';

/**
 * 13 employees in 3 countries, with salaries chosen so every statistic can be checked by hand.
 * They are created in this order, so ids run 1 to 13 from top to bottom.
 * [fullName, email local part, jobTitle, department, countryCode, salaryMajor]
 */
export const PAY_FIXTURE: readonly (readonly [string, string, string, string, string, number])[] = [
  // India: 4 Engineers (median 1,300,000) and 2 Analysts (median 850,000).
  ['Aarav Mehta', 'aarav.mehta', 'Engineer', 'Engineering', 'IN', 1_000_000],
  ['Priya Sharma', 'priya.sharma', 'Engineer', 'Engineering', 'IN', 1_200_000],
  ['Rohan Iyer', 'rohan.iyer', 'Engineer', 'Engineering', 'IN', 1_400_000],
  ['Neha Kapoor', 'neha.kapoor', 'Engineer', 'Engineering', 'IN', 2_000_000],
  ['Ananya Rao', 'ananya.rao', 'Analyst', 'Finance', 'IN', 800_000],
  ['Karan Patel', 'karan.patel', 'Analyst', 'Finance', 'IN', 900_000],
  // United States: 4 Engineers (median 100,000) and 1 Account Executive.
  ['Alice Johnson', 'alice.johnson', 'Engineer', 'Engineering', 'US', 95_000],
  ["Brian O'Neil", 'brian.oneil', 'Engineer', 'Engineering', 'US', 105_000],
  ['Carla Gomez', 'carla.gomez', 'Engineer', 'Engineering', 'US', 70_000],
  ['Evan Wright', 'evan.wright', 'Engineer', 'Engineering', 'US', 140_000],
  ['David Miller', 'david.miller', 'Account Executive', 'Sales', 'US', 90_000],
  // Germany: 2 Engineers (median 70,000).
  ['Hans Becker', 'hans.becker', 'Engineer', 'Engineering', 'DE', 80_000],
  ['Lena Fischer', 'lena.fischer', 'Engineer', 'Engineering', 'DE', 60_000],
];

export function createPayFixture(service: EmployeesService): void {
  for (const [fullName, emailName, jobTitle, department, countryCode, salaryMajor] of PAY_FIXTURE) {
    service.create({
      fullName,
      email: `${emailName}@acme.test`,
      jobTitle,
      department,
      countryCode,
      salaryMajor,
      employmentType: 'FULL_TIME',
      hireDate: '2022-01-10',
    });
  }
}
