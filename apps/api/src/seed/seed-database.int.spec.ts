import { createEmployeeInputSchema, currencyFor } from '@salary-manager/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import type { AppDatabase } from '../db/database.js';
import { type EmployeeRow, type SalaryChangeRow, employees, salaryChanges } from '../db/schema.js';
import { EmployeesRepository } from '../employees/employees.repository.js';
import { EmployeesService } from '../employees/employees.service.js';
import { DatabaseNotEmptyError, runSeed } from './run-seed.js';
import { seedDatabase } from './seed-database.js';

const REFERENCE_DATE = '2026-11-01';
const TWELVE_YEARS_EARLIER = '2014-11-01';
const SMALL = { count: 200, seed: 20261119, referenceDate: REFERENCE_DATE };
// Large enough for the proportions to be stable.
const LARGE = { count: 5_000, seed: 20261119, referenceDate: REFERENCE_DATE };

function seeded(options: { count: number; seed: number; referenceDate: string }) {
  const db = createTestDb();
  const report = seedDatabase(db, options);
  return { db, report, ...rowsOf(db) };
}

function rowsOf(db: AppDatabase): { people: EmployeeRow[]; history: SalaryChangeRow[] } {
  return {
    people: db.select().from(employees).all(),
    history: db.select().from(salaryChanges).all(),
  };
}

/** Each employee's history, oldest first: by effective date, then by the order it was recorded. */
function historyByEmployee(history: SalaryChangeRow[]): Map<number, SalaryChangeRow[]> {
  const grouped = new Map<number, SalaryChangeRow[]>();
  const oldestFirst = [...history].sort(
    (a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id,
  );
  for (const entry of oldestFirst) {
    grouped.set(entry.employeeId, [...(grouped.get(entry.employeeId) ?? []), entry]);
  }
  return grouped;
}

function shareOf<T>(items: T[], matches: (item: T) => boolean): number {
  return items.filter(matches).length / items.length;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
}

describe('seedDatabase determinism', () => {
  it('gives identical employees and salary history when run twice with the same seed', () => {
    const first = seeded(SMALL);
    const second = seeded(SMALL);

    expect(second.people).toEqual(first.people);
    expect(second.history).toEqual(first.history);
  });

  it('gives different data for a different seed', () => {
    const first = seeded(SMALL);
    const other = seeded({ ...SMALL, seed: 7 });

    expect(other.people.map((person) => person.fullName)).not.toEqual(
      first.people.map((person) => person.fullName),
    );
  });

  it('takes every timestamp from the reference date, never from the system clock', () => {
    const { people, history } = seeded(SMALL);
    const stamps = [
      ...people.flatMap((person) => [person.createdAt, person.updatedAt]),
      ...history.map((entry) => entry.createdAt),
    ];

    expect(new Set(stamps)).toEqual(new Set([`${REFERENCE_DATE}T00:00:00.000Z`]));
  });
});

describe('seedDatabase row counts', () => {
  it('inserts exactly the requested number of employees and reports what it inserted', () => {
    const { report, people, history } = seeded(SMALL);

    expect(people).toHaveLength(200);
    expect(report).toEqual({ employees: 200, salaryChanges: history.length });
  });

  it('inserts nothing for a count of zero', () => {
    const { report, people, history } = seeded({ ...SMALL, count: 0 });

    expect(report).toEqual({ employees: 0, salaryChanges: 0 });
    expect([people, history]).toEqual([[], []]);
  });
});

describe('seedDatabase rules the service enforces', () => {
  let people: EmployeeRow[];
  let history: SalaryChangeRow[];
  let db: AppDatabase;

  beforeAll(() => {
    ({ db, people, history } = seeded(LARGE));
  });

  it('seeds employees that all pass the shared create schema, already in normalised form', () => {
    const schema = createEmployeeInputSchema(REFERENCE_DATE);

    const problems = people.flatMap((person) => {
      const input = {
        fullName: person.fullName,
        email: person.email,
        jobTitle: person.jobTitle,
        department: person.department,
        countryCode: person.countryCode,
        // Seeded salaries are whole numbers, so this division is exact.
        salaryMajor: person.salaryMinor / 100,
        employmentType: person.employmentType,
        hireDate: person.hireDate,
      };
      const result = schema.safeParse(input);
      if (!result.success) {
        return [`#${person.id}: ${result.error.issues.map((issue) => issue.message).join('; ')}`];
      }
      // Parsing trims and lowercases; stored values must already be in that form.
      return JSON.stringify(result.data) === JSON.stringify(input)
        ? []
        : [`#${person.id}: not normalised`];
    });

    expect(problems).toEqual([]);
  });

  it('seeds whole-number salaries', () => {
    expect(people.filter((person) => person.salaryMinor % 100 !== 0)).toEqual([]);
  });

  it('derives every currency from the country', () => {
    const wrong = people.filter((person) => person.currency !== currencyFor(person.countryCode));

    expect(wrong).toEqual([]);
  });

  it('seeds unique, lowercase emails, including for people who share a name', () => {
    const emails = people.map((person) => person.email);
    const names = people.map((person) => person.fullName);

    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.filter((email) => email !== email.toLowerCase())).toEqual([]);
    // The uniqueness above only means something if some names really are shared.
    expect(new Set(names).size).toBeLessThan(names.length);
  });

  it('gives every employee a "Starting salary" row first: no old salary, dated on the hire date', () => {
    const byEmployee = historyByEmployee(history);

    const wrong = people.filter((person) => {
      const first = byEmployee.get(person.id)?.[0];
      return !(
        first !== undefined &&
        first.reason === 'Starting salary' &&
        first.oldSalaryMinor === null &&
        first.oldCurrency === null &&
        first.effectiveDate === person.hireDate &&
        first.currency === person.currency
      );
    });

    expect(wrong).toEqual([]);
    expect(history.filter((entry) => entry.reason === 'Starting salary')).toHaveLength(
      people.length,
    );
  });

  it('makes every employee’s current salary equal their latest history row', () => {
    const byEmployee = historyByEmployee(history);

    const wrong = people.filter((person) => {
      const latest = byEmployee.get(person.id)?.at(-1);
      return latest?.newSalaryMinor !== person.salaryMinor || latest.currency !== person.currency;
    });

    expect(wrong).toEqual([]);
  });

  it('chains each raise from the previous salary, in the same currency, with a real change', () => {
    const broken = [...historyByEmployee(history).values()].flatMap((entries) =>
      entries.slice(1).filter((entry, index) => {
        const previous = entries[index];
        return !(
          previous !== undefined &&
          entry.oldSalaryMinor === previous.newSalaryMinor &&
          entry.oldCurrency === previous.currency &&
          entry.currency === previous.currency &&
          entry.newSalaryMinor !== entry.oldSalaryMinor &&
          entry.newSalaryMinor % 100 === 0 &&
          entry.id > previous.id
        );
      }),
    );

    expect(broken).toEqual([]);
  });

  it('gives every later change a reason of 3 to 500 characters that is not "Starting salary"', () => {
    const raises = history.filter((entry) => entry.oldSalaryMinor !== null);

    const wrong = raises.filter(
      (entry) =>
        entry.reason === 'Starting salary' ||
        entry.reason.trim() !== entry.reason ||
        entry.reason.length < 3 ||
        entry.reason.length > 500,
    );

    expect(raises.length).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  it('dates no salary change before the hire date or after the reference date', () => {
    const hireDates = new Map(people.map((person) => [person.id, person.hireDate]));

    const wrong = history.filter(
      (entry) =>
        entry.effectiveDate < (hireDates.get(entry.employeeId) ?? '') ||
        entry.effectiveDate > REFERENCE_DATE,
    );

    expect(wrong).toEqual([]);
  });

  it('spreads hire dates over the 12 years before the reference date, and no further', () => {
    const hireYears = new Set(people.map((person) => person.hireDate.slice(0, 4)));

    expect(people.filter((person) => person.hireDate < TWELVE_YEARS_EARLIER)).toEqual([]);
    expect(people.filter((person) => person.hireDate > REFERENCE_DATE)).toEqual([]);
    expect([...hireYears].sort()).toEqual([
      '2014',
      '2015',
      '2016',
      '2017',
      '2018',
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ]);
  });

  it('is readable through the service: list totals and the first employee’s detail', () => {
    const service = new EmployeesService(
      new EmployeesRepository(db),
      new FixedClock(`${REFERENCE_DATE}T00:00:00.000Z`),
    );

    expect(service.list({}).total).toBe(5_000);
    expect(service.getById(1).salaryHistory.at(-1)).toMatchObject({ reason: 'Starting salary' });
  });
});

describe('seedDatabase shape of the data', () => {
  let people: EmployeeRow[];
  let history: SalaryChangeRow[];

  beforeAll(() => {
    ({ people, history } = seeded(LARGE));
  });

  it.each([
    { countryCode: 'IN', share: 0.42 },
    { countryCode: 'US', share: 0.265 },
    { countryCode: 'GB', share: 0.135 },
    { countryCode: 'DE', share: 0.11 },
    { countryCode: 'SG', share: 0.07 },
  ])(
    'puts about $share of employees in $countryCode (within 1 percentage point)',
    ({ countryCode, share }) => {
      const actual = shareOf(people, (person) => person.countryCode === countryCode);

      expect(Math.abs(actual - share)).toBeLessThanOrEqual(0.01);
    },
  );

  it('uses 8 departments and about 60 job titles, each title belonging to one department', () => {
    const departments = new Set(people.map((person) => person.department));
    const departmentsOfTitle = new Map<string, Set<string>>();
    for (const person of people) {
      const seen = departmentsOfTitle.get(person.jobTitle) ?? new Set<string>();
      departmentsOfTitle.set(person.jobTitle, seen.add(person.department));
    }

    expect(departments.size).toBe(8);
    expect(departmentsOfTitle.size).toBeGreaterThanOrEqual(50);
    expect(departmentsOfTitle.size).toBeLessThanOrEqual(70);
    expect([...departmentsOfTitle.values()].filter((seen) => seen.size !== 1)).toEqual([]);
  });

  it('makes most employees FULL_TIME, with some PART_TIME and some CONTRACTOR', () => {
    const fullTime = shareOf(people, (person) => person.employmentType === 'FULL_TIME');
    const partTime = shareOf(people, (person) => person.employmentType === 'PART_TIME');
    const contractor = shareOf(people, (person) => person.employmentType === 'CONTRACTOR');

    expect(fullTime).toBeGreaterThanOrEqual(0.75);
    expect(partTime).toBeGreaterThanOrEqual(0.02);
    expect(contractor).toBeGreaterThanOrEqual(0.02);
    expect(fullTime + partTime + contractor).toBeCloseTo(1, 10);
  });

  it('gives about 30% of employees between 1 and 3 later raises', () => {
    const changesPerEmployee = [...historyByEmployee(history).values()].map(
      (entries) => entries.length - 1,
    );
    const withRaises = shareOf(changesPerEmployee, (raises) => raises > 0);

    expect(withRaises).toBeGreaterThanOrEqual(0.27);
    expect(withRaises).toBeLessThanOrEqual(0.33);
    expect(Math.max(...changesPerEmployee)).toBe(3);
    expect(new Set(changesPerEmployee)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('leaves about 3% of employees more than 25% above or below the median for their role and country', () => {
    const salariesByRole = new Map<string, number[]>();
    for (const person of people) {
      const role = `${person.countryCode}|${person.jobTitle}`;
      salariesByRole.set(role, [...(salariesByRole.get(role) ?? []), person.salaryMinor]);
    }
    const medianByRole = new Map(
      [...salariesByRole].map(([role, salaries]) => [role, medianOf(salaries)]),
    );

    const outliers = shareOf(people, (person) => {
      const median = medianByRole.get(`${person.countryCode}|${person.jobTitle}`) ?? 0;
      return Math.abs(person.salaryMinor - median) > median * 0.25;
    });

    expect(outliers).toBeGreaterThanOrEqual(0.015);
    expect(outliers).toBeLessThanOrEqual(0.05);
  });

  it('pays within sensible bounds for each currency', () => {
    // Loose floor and ceiling in major units, wide enough to include the deliberate outliers.
    const bounds: Record<string, [number, number]> = {
      INR: [200_000, 20_000_000],
      USD: [25_000, 600_000],
      GBP: [18_000, 400_000],
      EUR: [20_000, 400_000],
      SGD: [25_000, 600_000],
    };

    const outOfBounds = people.filter((person) => {
      const [floor, ceiling] = bounds[person.currency] ?? [0, 0];
      const major = person.salaryMinor / 100;
      return major < floor || major > ceiling;
    });

    expect(outOfBounds).toEqual([]);
  });
});

describe('runSeed', () => {
  it('seeds an empty database', () => {
    const db = createTestDb();

    const report = runSeed(db, { ...SMALL, reset: false });

    expect(report.employees).toBe(200);
    expect(rowsOf(db).people).toHaveLength(200);
  });

  it('refuses to seed a database that already has employees, and leaves it untouched', () => {
    const db = createTestDb();
    seedDatabase(db, { ...SMALL, count: 3 });
    const before = rowsOf(db);

    let thrown: unknown;
    try {
      runSeed(db, { ...SMALL, reset: false });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DatabaseNotEmptyError);
    expect(thrown).toMatchObject({
      message: 'The database already has 3 employees. Pass --reset to delete them and seed again.',
    });
    expect(rowsOf(db)).toEqual(before);
  });

  it('with reset, deletes the existing employees and their history, then seeds', () => {
    const db = createTestDb();
    seedDatabase(db, { ...SMALL, count: 3, seed: 7 });

    const report = runSeed(db, { ...SMALL, reset: true });
    const { people, history } = rowsOf(db);

    expect(report.employees).toBe(200);
    expect(people).toHaveLength(200);
    expect(history).toHaveLength(report.salaryChanges);
    expect(new Set(history.map((entry) => entry.employeeId)).size).toBe(200);
  });

  it('with reset, leaves the database identical to a freshly seeded one, ids included', () => {
    const fresh = seeded(SMALL);
    const reseeded = createTestDb();
    seedDatabase(reseeded, SMALL);

    runSeed(reseeded, { ...SMALL, reset: true });

    expect(rowsOf(reseeded).people).toEqual(fresh.people);
    expect(rowsOf(reseeded).history).toEqual(fresh.history);
    expect(rowsOf(reseeded).people[0]?.id).toBe(1);
  });
});
