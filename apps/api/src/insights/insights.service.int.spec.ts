import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { employees as employeesTable } from '../db/schema.js';
import { EmployeesRepository } from '../employees/employees.repository.js';
import { EmployeesService } from '../employees/employees.service.js';
import { InvalidInputError } from '../employees/errors.js';
import { createPayFixture } from '../testing/pay-fixture.js';
import { InsightsRepository } from './insights.repository.js';
import { InsightsService } from './insights.service.js';

const NOW = '2026-11-19T10:30:00.000Z';

/** Both services on one fresh database. `withPayFixture` adds the 13 fixture employees. */
function setup({ withPayFixture }: { withPayFixture: boolean }) {
  const db = createTestDb();
  const employees = new EmployeesService(new EmployeesRepository(db), new FixedClock(NOW));
  if (withPayFixture) {
    createPayFixture(employees);
  }
  return { db, employees, insights: new InsightsService(new InsightsRepository(db)) };
}

function addEmployee(employees: EmployeesService, countryCode: string, salaryMajor: number): void {
  employees.create({
    fullName: `Employee ${countryCode} ${salaryMajor}`,
    email: `employee.${countryCode.toLowerCase()}.${Math.trunc(salaryMajor)}@acme.test`,
    jobTitle: 'Engineer',
    department: 'Engineering',
    countryCode,
    salaryMajor,
    employmentType: 'FULL_TIME',
    hireDate: '2022-01-10',
  });
}

describe('InsightsService.getSummary', () => {
  it('counts employees, countries, departments and job titles, and totals payroll in USD', () => {
    const { insights } = setup({ withPayFixture: true });

    // Payroll by country, each converted on its own and then added:
    //   INR 7,300,000 x 0.012 = USD  87,600.00
    //   USD   500,000 x 1     = USD 500,000.00
    //   EUR   140,000 x 1.08  = USD 151,200.00
    //                           USD 738,800.00
    expect(insights.getSummary()).toEqual({
      headcount: 13,
      countryCount: 3,
      departmentCount: 3,
      jobTitleCount: 3,
      payrollUsdMinor: 73_880_000,
      fxTableVersion: '2026-11',
    });
  });

  it('converts each country’s total to USD, not each salary, so rounding happens once per country', () => {
    const { employees, insights } = setup({ withPayFixture: false });
    addEmployee(employees, 'IN', 1_000_000.42);
    addEmployee(employees, 'IN', 2_000_000.42);

    // Total INR 3,000,000.84 = 300,000,084 paise x 0.012 = 3,600,001.008 cents -> 3,600,001.
    // Converting each salary first would round 1,200,000.504 and 2,400,000.504 up: 3,600,002.
    expect(insights.getSummary().payrollUsdMinor).toBe(3_600_001);
  });

  it('adds a country’s salaries exactly when their total is past 2^53 minor units', () => {
    const { db, insights } = setup({ withPayFixture: false });
    // Written straight to the table: a salary with cents this large cannot be sent as a JSON
    // number, but the column can hold it, and the summary must not be the place that loses it.
    const hugeSalariesMinor = [9_000_000_000_000_001, 1_000_000_000_000_000];
    for (const [index, salaryMinor] of hugeSalariesMinor.entries()) {
      db.insert(employeesTable)
        .values({
          fullName: `Employee SG ${index}`,
          email: `employee.sg.${index}@acme.test`,
          jobTitle: 'Engineer',
          department: 'Engineering',
          countryCode: 'SG',
          currency: 'SGD',
          salaryMinor,
          employmentType: 'FULL_TIME',
          hireDate: '2022-01-10',
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run();
    }

    // Total SGD 100,000,000,000,000.01 = 10,000,000,000,000,001 cents, which is past 2^53 and odd,
    // so number addition gives 10,000,000,000,000,000.
    //   exact: 10,000,000,000,000,001 x 0.74 = 7,400,000,000,000,000.74 -> 7,400,000,000,000,001
    //   lossy: 10,000,000,000,000,000 x 0.74 = 7,400,000,000,000,000
    expect(insights.getSummary().payrollUsdMinor).toBe(7_400_000_000_000_001);
  });

  it('reports zeros for an empty database', () => {
    const { insights } = setup({ withPayFixture: false });

    expect(insights.getSummary()).toEqual({
      headcount: 0,
      countryCount: 0,
      departmentCount: 0,
      jobTitleCount: 0,
      payrollUsdMinor: 0,
      fxTableVersion: '2026-11',
    });
  });
});

describe('InsightsService.getCountries', () => {
  it('returns one row per country with employees, in local currency, largest headcount first', () => {
    const { insights } = setup({ withPayFixture: true });

    expect(insights.getCountries()).toEqual([
      {
        code: 'IN',
        name: 'India',
        currency: 'INR',
        headcount: 6,
        minMinor: 80_000_000,
        // Middle two of 800k, 900k, 1.0M, 1.2M, 1.4M, 2.0M are 1.0M and 1.2M.
        medianMinor: 110_000_000,
        // 7,300,000 / 6 = 1,216,666.666..., which is 121,666,666.67 paise, rounded half up.
        avgMinor: 121_666_667,
        maxMinor: 200_000_000,
      },
      {
        code: 'US',
        name: 'United States',
        currency: 'USD',
        headcount: 5,
        minMinor: 7_000_000,
        // Middle of 70k, 90k, 95k, 105k, 140k.
        medianMinor: 9_500_000,
        // 500,000 / 5.
        avgMinor: 10_000_000,
        maxMinor: 14_000_000,
      },
      {
        code: 'DE',
        name: 'Germany',
        currency: 'EUR',
        headcount: 2,
        minMinor: 6_000_000,
        medianMinor: 7_000_000,
        avgMinor: 7_000_000,
        maxMinor: 8_000_000,
      },
    ]);
  });

  it('leaves out supported countries that have no employees', () => {
    const { insights } = setup({ withPayFixture: true });

    expect(insights.getCountries().map((country) => country.code)).not.toContain('SG');
  });

  it('returns an empty list for an empty database', () => {
    const { insights } = setup({ withPayFixture: false });

    expect(insights.getCountries()).toEqual([]);
  });
});

describe('InsightsService.getCountryJobTitles', () => {
  it('returns India’s job titles by median, highest first, and its one outlier', () => {
    const { insights } = setup({ withPayFixture: true });

    expect(insights.getCountryJobTitles('IN')).toEqual({
      country: { code: 'IN', name: 'India', currency: 'INR' },
      jobTitles: [
        {
          jobTitle: 'Engineer',
          headcount: 4,
          minMinor: 100_000_000,
          // Middle two of 1.0M, 1.2M, 1.4M, 2.0M are 1.2M and 1.4M.
          medianMinor: 130_000_000,
          // 5,600,000 / 4.
          avgMinor: 140_000_000,
          maxMinor: 200_000_000,
        },
        {
          jobTitle: 'Analyst',
          headcount: 2,
          minMinor: 80_000_000,
          medianMinor: 85_000_000,
          avgMinor: 85_000_000,
          maxMinor: 90_000_000,
        },
      ],
      outliers: [
        {
          employeeId: 4,
          fullName: 'Neha Kapoor',
          jobTitle: 'Engineer',
          salaryMinor: 200_000_000,
          roleMedianMinor: 130_000_000,
          // (2.0M - 1.3M) / 1.3M = 53.846...%
          differencePct: 53.8,
          direction: 'above',
        },
      ],
    });
  });

  it('returns the United States’ outliers with the largest gap first, whichever direction', () => {
    const { insights } = setup({ withPayFixture: true });

    const result = insights.getCountryJobTitles('US');

    expect(result.jobTitles).toEqual([
      {
        jobTitle: 'Engineer',
        headcount: 4,
        minMinor: 7_000_000,
        // Middle two of 70k, 95k, 105k, 140k are 95k and 105k.
        medianMinor: 10_000_000,
        // 410,000 / 4.
        avgMinor: 10_250_000,
        maxMinor: 14_000_000,
      },
      {
        jobTitle: 'Account Executive',
        headcount: 1,
        minMinor: 9_000_000,
        medianMinor: 9_000_000,
        avgMinor: 9_000_000,
        maxMinor: 9_000_000,
      },
    ]);
    expect(result.outliers).toEqual([
      {
        employeeId: 10,
        fullName: 'Evan Wright',
        jobTitle: 'Engineer',
        salaryMinor: 14_000_000,
        roleMedianMinor: 10_000_000,
        differencePct: 40,
        direction: 'above',
      },
      {
        employeeId: 9,
        fullName: 'Carla Gomez',
        jobTitle: 'Engineer',
        salaryMinor: 7_000_000,
        roleMedianMinor: 10_000_000,
        differencePct: -30,
        direction: 'below',
      },
    ]);
  });

  it('returns no outliers for Germany, where both Engineers are within 25% of their median', () => {
    const { insights } = setup({ withPayFixture: true });

    // 80,000 and 60,000 against a median of 70,000 are +14.3% and -14.3%.
    expect(insights.getCountryJobTitles('DE')).toMatchObject({
      jobTitles: [{ jobTitle: 'Engineer', headcount: 2, medianMinor: 7_000_000 }],
      outliers: [],
    });
  });

  it('compares people only within their own country, so Indian salaries do not skew the US median', () => {
    const { insights } = setup({ withPayFixture: true });

    const engineers = insights
      .getCountryJobTitles('US')
      .jobTitles.find((row) => row.jobTitle === 'Engineer');

    expect(engineers).toMatchObject({ headcount: 4, medianMinor: 10_000_000 });
  });

  it('returns empty lists for a supported country that has no employees', () => {
    const { insights } = setup({ withPayFixture: true });

    expect(insights.getCountryJobTitles('SG')).toEqual({
      country: { code: 'SG', name: 'Singapore', currency: 'SGD' },
      jobTitles: [],
      outliers: [],
    });
  });

  it.each(['ZZ', 'in', '', 'India'])('rejects the unsupported country code "%s"', (code) => {
    const { insights } = setup({ withPayFixture: true });

    let thrown: unknown;
    try {
      insights.getCountryJobTitles(code);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(thrown).toMatchObject({
      issues: [{ path: 'code', message: 'Select a supported country' }],
    });
  });
});

describe('EmployeesService.getById role median', () => {
  it.each([
    { id: 4, name: 'Neha Kapoor', roleMedianMinor: 130_000_000, pct: 53.8, why: '2.0M vs 1.3M' },
    { id: 1, name: 'Aarav Mehta', roleMedianMinor: 130_000_000, pct: -23.1, why: '1.0M vs 1.3M' },
    { id: 6, name: 'Karan Patel', roleMedianMinor: 85_000_000, pct: 5.9, why: '900k vs 850k' },
    { id: 9, name: 'Carla Gomez', roleMedianMinor: 10_000_000, pct: -30, why: '70k vs 100k' },
    { id: 12, name: 'Hans Becker', roleMedianMinor: 7_000_000, pct: 14.3, why: '80k vs 70k' },
  ])(
    'gives $name the median for their job title and country, and $pct% against it ($why)',
    ({ id, name, roleMedianMinor, pct }) => {
      const { employees } = setup({ withPayFixture: true });

      expect(employees.getById(id)).toMatchObject({
        fullName: name,
        roleMedianMinor,
        pctVsRoleMedian: pct,
      });
    },
  );

  it('gives nulls to David Miller, the only Account Executive in the United States', () => {
    const { employees } = setup({ withPayFixture: true });

    expect(employees.getById(11)).toMatchObject({
      fullName: 'David Miller',
      roleMedianMinor: null,
      pctVsRoleMedian: null,
    });
  });

  it('gives 0% to two people in the same role on the same salary', () => {
    const { employees } = setup({ withPayFixture: false });
    addEmployee(employees, 'DE', 70_000);
    employees.create({
      fullName: 'Second Engineer',
      email: 'second.engineer@acme.test',
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'DE',
      salaryMajor: 70_000,
      employmentType: 'FULL_TIME',
      hireDate: '2022-01-10',
    });

    expect(employees.getById(1)).toMatchObject({ roleMedianMinor: 7_000_000, pctVsRoleMedian: 0 });
  });
});
