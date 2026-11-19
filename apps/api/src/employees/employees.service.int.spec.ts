import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { employees, salaryChanges } from '../db/schema.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';
import { EmailAlreadyInUseError, EmployeeNotFoundError, InvalidInputError } from './errors.js';

// At 10:30 UTC on the 19th it is already the 20th at UTC+14, so clock.today() is 2026-11-20.
const NOW = '2026-11-19T10:30:00.000Z';
const TODAY = '2026-11-20';
const DAY_AFTER_TODAY = '2026-11-21';

const priyaInput = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  salaryMajor: 3_240_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
};

const priyaStored = {
  id: 1,
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  currency: 'INR',
  salaryMinor: 324_000_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
  createdAt: NOW,
  updatedAt: NOW,
};

const priyaStartingSalary = {
  id: 1,
  employeeId: 1,
  oldSalaryMinor: null,
  oldCurrency: null,
  newSalaryMinor: 324_000_000,
  currency: 'INR',
  effectiveDate: '2024-03-01',
  reason: 'Starting salary',
  createdAt: NOW,
};

function setup() {
  const db = createTestDb();
  const service = new EmployeesService(new EmployeesRepository(db), new FixedClock(NOW));
  return { db, service };
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw, but it returned');
}

describe('EmployeesService.create', () => {
  it('returns the created employee with timestamps from the clock', () => {
    const { service } = setup();

    expect(service.create(priyaInput)).toEqual(priyaStored);
  });

  it('stores exactly what it returns', () => {
    const { db, service } = setup();

    const created = service.create(priyaInput);

    expect(db.select().from(employees).all()).toEqual([created]);
  });

  it.each([
    { countryCode: 'IN', currency: 'INR' },
    { countryCode: 'US', currency: 'USD' },
    { countryCode: 'GB', currency: 'GBP' },
    { countryCode: 'DE', currency: 'EUR' },
    { countryCode: 'SG', currency: 'SGD' },
  ])(
    'derives the currency $currency from the country $countryCode',
    ({ countryCode, currency }) => {
      const { service } = setup();

      expect(service.create({ ...priyaInput, countryCode })).toMatchObject({
        countryCode,
        currency,
      });
    },
  );

  it('does not accept currency as an input', () => {
    const { db, service } = setup();

    const error = thrownBy(() => service.create({ ...priyaInput, currency: 'USD' }));

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(db.select().from(employees).all()).toEqual([]);
  });

  it('stores the salary as integer minor units, exact even where floats are not', () => {
    const { service } = setup();

    // 75000.35 * 100 is 7500035.000000001 in floating point.
    const created = service.create({ ...priyaInput, countryCode: 'US', salaryMajor: 75_000.35 });

    expect(created.salaryMinor).toBe(7_500_035);
  });

  it('stores the input as normalised by the shared schema', () => {
    const { service } = setup();

    const created = service.create({
      ...priyaInput,
      fullName: '  Priya Sharma ',
      email: ' Priya.Sharma@ACME.test ',
    });

    expect(created).toMatchObject({ fullName: 'Priya Sharma', email: 'priya.sharma@acme.test' });
  });

  it('creating an employee writes a Starting salary history row', () => {
    const { db, service } = setup();

    service.create(priyaInput);

    expect(db.select().from(salaryChanges).all()).toEqual([priyaStartingSalary]);
  });

  it('keeps no employee when the Starting salary row cannot be written, because both are one transaction', () => {
    const { db, service } = setup();
    db.$client.exec(`
      CREATE TRIGGER fail_history_insert BEFORE INSERT ON salary_changes
      BEGIN SELECT RAISE(ABORT, 'history insert failed'); END;
    `);

    expect(() => service.create(priyaInput)).toThrow('history insert failed');

    expect(db.select().from(employees).all()).toEqual([]);
    expect(db.select().from(salaryChanges).all()).toEqual([]);
  });

  it('rejects a duplicate email with EmailAlreadyInUseError', () => {
    const { service } = setup();
    service.create(priyaInput);

    const error = thrownBy(() => service.create({ ...priyaInput, fullName: 'Another Priya' }));

    expect(error).toBeInstanceOf(EmailAlreadyInUseError);
    expect(error).toMatchObject({
      message: 'An employee with the email priya.sharma@acme.test already exists',
    });
  });

  it('treats emails that differ only by case as duplicates', () => {
    const { service } = setup();
    service.create(priyaInput);

    const error = thrownBy(() =>
      service.create({ ...priyaInput, email: 'PRIYA.SHARMA@ACME.TEST' }),
    );

    expect(error).toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('writes nothing for the rejected duplicate', () => {
    const { db, service } = setup();
    service.create(priyaInput);

    thrownBy(() => service.create(priyaInput));

    expect(db.select().from(employees).all()).toHaveLength(1);
    expect(db.select().from(salaryChanges).all()).toHaveLength(1);
  });

  it('rejects invalid input with the shared schema messages and writes nothing', () => {
    const { db, service } = setup();

    const error = thrownBy(() =>
      service.create({ ...priyaInput, email: 'not-an-email', salaryMajor: 0 }),
    );

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({
      issues: [
        { path: 'email', message: 'Enter a valid email address' },
        { path: 'salaryMajor', message: 'Salary must be greater than 0' },
      ],
    });
    expect(db.select().from(employees).all()).toEqual([]);
    expect(db.select().from(salaryChanges).all()).toEqual([]);
  });

  it('accepts a hire date equal to the clock’s today', () => {
    const { service } = setup();

    expect(service.create({ ...priyaInput, hireDate: TODAY })).toMatchObject({ hireDate: TODAY });
  });

  it('rejects a hire date after the clock’s today', () => {
    const { service } = setup();

    const error = thrownBy(() => service.create({ ...priyaInput, hireDate: DAY_AFTER_TODAY }));

    expect(error).toMatchObject({
      issues: [{ path: 'hireDate', message: 'Hire date cannot be in the future' }],
    });
  });
});

describe('EmployeesService.getById', () => {
  it('returns the employee together with its salary history', () => {
    const { service } = setup();
    const created = service.create(priyaInput);

    expect(service.getById(created.id)).toEqual({
      ...priyaStored,
      salaryHistory: [priyaStartingSalary],
      // Priya is the only Senior Engineer in India, so there is no role median to compare with.
      roleMedianMinor: null,
      pctVsRoleMedian: null,
    });
  });

  it('returns the salary history newest first, by effective date and then by most recently recorded', () => {
    const { db, service } = setup();
    const { id: employeeId } = service.create(priyaInput);
    const change = (effectiveDate: string, newSalaryMinor: number) => ({
      employeeId,
      oldSalaryMinor: 324_000_000,
      oldCurrency: 'INR',
      newSalaryMinor,
      currency: 'INR',
      effectiveDate,
      reason: 'Annual raise',
      createdAt: NOW,
    });
    db.insert(salaryChanges)
      .values([
        change('2026-04-01', 360_000_000),
        change('2025-04-01', 340_000_000),
        change('2026-04-01', 365_000_000),
      ])
      .run();

    const history = service.getById(employeeId).salaryHistory;

    expect(history.map((entry) => [entry.effectiveDate, entry.newSalaryMinor])).toEqual([
      ['2026-04-01', 365_000_000],
      ['2026-04-01', 360_000_000],
      ['2025-04-01', 340_000_000],
      ['2024-03-01', 324_000_000],
    ]);
  });

  it('returns only the requested employee’s history', () => {
    const { service } = setup();
    const priya = service.create(priyaInput);
    const hans = service.create({
      ...priyaInput,
      fullName: 'Hans Becker',
      email: 'hans.becker@acme.test',
      countryCode: 'DE',
      salaryMajor: 85_000,
    });

    expect(service.getById(priya.id).salaryHistory).toEqual([priyaStartingSalary]);
    expect(service.getById(hans.id).salaryHistory).toEqual([
      {
        ...priyaStartingSalary,
        id: 2,
        employeeId: hans.id,
        newSalaryMinor: 8_500_000,
        currency: 'EUR',
      },
    ]);
  });

  it('throws EmployeeNotFoundError for an unknown id', () => {
    const { service } = setup();

    const error = thrownBy(() => service.getById(999));

    expect(error).toBeInstanceOf(EmployeeNotFoundError);
    expect(error).toMatchObject({ message: 'Employee 999 was not found' });
  });
});
