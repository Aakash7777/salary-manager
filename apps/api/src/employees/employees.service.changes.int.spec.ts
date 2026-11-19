import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { employees, salaryChanges } from '../db/schema.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';
import { EmailAlreadyInUseError, EmployeeNotFoundError, InvalidInputError } from './errors.js';

// Employees are created at one instant and changed at a later one, so the tests can tell
// createdAt from updatedAt.
const CREATED_AT = '2026-11-01T08:00:00.000Z';
const CHANGED_AT = '2026-11-19T10:30:00.000Z';
// At 10:30 UTC on the 19th it is already the 20th at UTC+14, so clock.today() is 2026-11-20.
const TODAY = '2026-11-20';
const DAY_AFTER_TODAY = '2026-11-21';

const NOT_EDITABLE_HERE =
  'Salary can only be changed here when the country changes. Use "Change salary" instead';

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

const hansInput = {
  fullName: 'Hans Becker',
  email: 'hans.becker@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'DE',
  salaryMajor: 98_000,
  employmentType: 'FULL_TIME',
  hireDate: '2016-10-03',
};

const priyaBefore = {
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
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
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
  createdAt: CREATED_AT,
};

const promotion = {
  newSalaryMajor: 3_600_000,
  effectiveDate: '2026-11-01',
  reason: 'Promotion to Staff Engineer',
};

const relocation = {
  countryCode: 'DE',
  newSalaryMajor: 85_000,
  reason: 'Relocated to Berlin',
};

/** A database holding Priya (id 1), and a service whose clock reads CHANGED_AT. */
function setup() {
  const db = createTestDb();
  const repository = new EmployeesRepository(db);
  new EmployeesService(repository, new FixedClock(CREATED_AT)).create(priyaInput);
  const service = new EmployeesService(repository, new FixedClock(CHANGED_AT));

  const storedPriya = () => db.select().from(employees).all()[0];
  const storedHistory = () => db.select().from(salaryChanges).all();
  const failHistoryInserts = () =>
    db.$client.exec(`
      CREATE TRIGGER fail_history_insert BEFORE INSERT ON salary_changes
      BEGIN SELECT RAISE(ABORT, 'history insert failed'); END;
    `);

  return { db, service, storedPriya, storedHistory, failHistoryInserts };
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw, but it returned');
}

describe('EmployeesService.changeSalary', () => {
  it('returns the employee with the new salary, and updatedAt from the clock', () => {
    const { service } = setup();

    expect(service.changeSalary(1, promotion)).toEqual({
      ...priyaBefore,
      salaryMinor: 360_000_000,
      updatedAt: CHANGED_AT,
    });
  });

  it('stores exactly what it returns', () => {
    const { service, storedPriya } = setup();

    const changed = service.changeSalary(1, promotion);

    expect(storedPriya()).toEqual(changed);
  });

  it('writes a history row with the old and new amount, and old currency equal to the currency', () => {
    const { service, storedHistory } = setup();

    service.changeSalary(1, promotion);

    expect(storedHistory()).toEqual([
      priyaStartingSalary,
      {
        id: 2,
        employeeId: 1,
        oldSalaryMinor: 324_000_000,
        oldCurrency: 'INR',
        newSalaryMinor: 360_000_000,
        currency: 'INR',
        effectiveDate: '2026-11-01',
        reason: 'Promotion to Staff Engineer',
        createdAt: CHANGED_AT,
      },
    ]);
  });

  it('chains a second change from the salary the first one set', () => {
    const { service, storedHistory } = setup();
    service.changeSalary(1, promotion);

    service.changeSalary(1, {
      ...promotion,
      newSalaryMajor: 3_900_000,
      reason: 'Market adjustment',
    });

    expect(storedHistory()[2]).toMatchObject({
      oldSalaryMinor: 360_000_000,
      newSalaryMinor: 390_000_000,
      reason: 'Market adjustment',
    });
  });

  it('converts the new salary to minor units exactly, even where floats are not', () => {
    const { service } = setup();
    const hans = service.create(hansInput);

    // 75000.35 * 100 is 7500035.000000001 in floating point.
    const changed = service.changeSalary(hans.id, { ...promotion, newSalaryMajor: 75_000.35 });

    expect(changed.salaryMinor).toBe(7_500_035);
  });

  it('allows a pay cut', () => {
    const { service } = setup();

    expect(service.changeSalary(1, { ...promotion, newSalaryMajor: 3_000_000 }).salaryMinor).toBe(
      300_000_000,
    );
  });

  it('accepts an effective date equal to the clock’s today', () => {
    const { service, storedHistory } = setup();

    service.changeSalary(1, { ...promotion, effectiveDate: TODAY });

    expect(storedHistory()[1]).toMatchObject({ effectiveDate: TODAY });
  });

  it('accepts an effective date equal to the hire date', () => {
    const { service, storedHistory } = setup();

    service.changeSalary(1, { ...promotion, effectiveDate: '2024-03-01' });

    expect(storedHistory()[1]).toMatchObject({ effectiveDate: '2024-03-01' });
  });

  it('rejects an effective date earlier than the hire date', () => {
    const { service, storedPriya, storedHistory } = setup();

    // Priya was hired on 2024-03-01; the day before is 2024-02-29.
    const error = thrownBy(() =>
      service.changeSalary(1, { ...promotion, effectiveDate: '2024-02-29' }),
    );

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({
      issues: [{ path: 'effectiveDate', message: 'Effective date cannot be before the hire date' }],
    });
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('rejects a salary change dated in the future', () => {
    const { service, storedPriya, storedHistory } = setup();

    const error = thrownBy(() =>
      service.changeSalary(1, { ...promotion, effectiveDate: DAY_AFTER_TODAY }),
    );

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({
      issues: [{ path: 'effectiveDate', message: 'Effective date cannot be in the future' }],
    });
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('requires a reason for every salary change', () => {
    const { service, storedPriya, storedHistory } = setup();

    const error = thrownBy(() =>
      service.changeSalary(1, { newSalaryMajor: 3_600_000, effectiveDate: '2026-11-01' }),
    );

    expect(error).toMatchObject({ issues: [{ path: 'reason', message: 'Reason is required' }] });
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('rejects a new salary equal to the current one', () => {
    const { service, storedPriya, storedHistory } = setup();

    const error = thrownBy(() =>
      service.changeSalary(1, { ...promotion, newSalaryMajor: 3_240_000 }),
    );

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({
      issues: [
        {
          path: 'newSalaryMajor',
          message: 'New salary must be different from the current salary',
        },
      ],
    });
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('keeps the old salary when the history row cannot be written, because both are one transaction', () => {
    const { service, storedPriya, storedHistory, failHistoryInserts } = setup();
    failHistoryInserts();

    expect(() => service.changeSalary(1, promotion)).toThrow('history insert failed');

    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('throws EmployeeNotFoundError for an unknown id', () => {
    const { service } = setup();

    const error = thrownBy(() => service.changeSalary(999, promotion));

    expect(error).toBeInstanceOf(EmployeeNotFoundError);
    expect(error).toMatchObject({ message: 'Employee 999 was not found' });
  });
});

describe('EmployeesService.updateDetails', () => {
  it('changes only the fields provided, and sets updatedAt from the clock', () => {
    const { service } = setup();

    const updated = service.updateDetails(1, {
      jobTitle: 'Staff Engineer',
      department: 'Platform',
    });

    expect(updated).toEqual({
      ...priyaBefore,
      jobTitle: 'Staff Engineer',
      department: 'Platform',
      updatedAt: CHANGED_AT,
    });
  });

  it('stores exactly what it returns', () => {
    const { service, storedPriya } = setup();

    const updated = service.updateDetails(1, { jobTitle: 'Staff Engineer' });

    expect(storedPriya()).toEqual(updated);
  });

  it('can change every detail field at once', () => {
    const { service } = setup();

    const updated = service.updateDetails(1, {
      fullName: 'Priya Sharma-Rao',
      email: 'priya.rao@acme.test',
      jobTitle: 'Staff Engineer',
      department: 'Platform',
      employmentType: 'PART_TIME',
      hireDate: '2024-02-15',
    });

    expect(updated).toEqual({
      ...priyaBefore,
      fullName: 'Priya Sharma-Rao',
      email: 'priya.rao@acme.test',
      jobTitle: 'Staff Engineer',
      department: 'Platform',
      employmentType: 'PART_TIME',
      hireDate: '2024-02-15',
      updatedAt: CHANGED_AT,
    });
  });

  it('stores the input as normalised by the shared schema', () => {
    const { service } = setup();

    const updated = service.updateDetails(1, {
      fullName: '  Priya Rao ',
      email: ' Priya.Rao@ACME.test ',
    });

    expect(updated).toMatchObject({ fullName: 'Priya Rao', email: 'priya.rao@acme.test' });
  });

  it('writes nothing for an empty update, so updatedAt stays as it was', () => {
    const { service, storedPriya } = setup();

    expect(service.updateDetails(1, {})).toEqual(priyaBefore);
    expect(storedPriya()).toEqual(priyaBefore);
  });

  it('writes nothing when every provided field equals the current value, so updatedAt stays as it was', () => {
    const { service, storedPriya, storedHistory } = setup();

    const unchanged = service.updateDetails(1, {
      fullName: ' Priya Sharma ',
      email: 'Priya.Sharma@ACME.test',
      jobTitle: 'Senior Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      employmentType: 'FULL_TIME',
      hireDate: '2024-03-01',
    });

    expect(unchanged).toEqual(priyaBefore);
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('salary only changes through changeSalary or a country change', () => {
    const { service, storedPriya, storedHistory } = setup();

    // An ordinary details update leaves salary, currency and history alone.
    service.updateDetails(1, { jobTitle: 'Staff Engineer', countryCode: 'IN' });
    // Sending a salary through "Edit details" is refused, under either field name.
    const viaSalaryMajor = thrownBy(() => service.updateDetails(1, { salaryMajor: 9_999_999 }));
    const viaNewSalaryMajor = thrownBy(() =>
      service.updateDetails(1, { newSalaryMajor: 9_999_999 }),
    );

    expect(viaSalaryMajor).toMatchObject({
      issues: [{ path: '', message: 'Unrecognized key: "salaryMajor"' }],
    });
    expect(viaNewSalaryMajor).toMatchObject({
      issues: [{ path: 'newSalaryMajor', message: NOT_EDITABLE_HERE }],
    });
    expect(storedPriya()).toMatchObject({ salaryMinor: 324_000_000, currency: 'INR' });
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('a country change requires a new salary and is recorded in history', () => {
    const { service, storedPriya, storedHistory } = setup();

    const withoutSalary = thrownBy(() => service.updateDetails(1, { countryCode: 'DE' }));

    expect(withoutSalary).toBeInstanceOf(InvalidInputError);
    expect(withoutSalary).toMatchObject({
      issues: [
        { path: 'newSalaryMajor', message: 'A new salary is required when the country changes' },
        { path: 'reason', message: 'A reason is required when the country changes' },
      ],
    });
    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);

    const relocated = service.updateDetails(1, relocation);

    expect(relocated).toEqual({
      ...priyaBefore,
      countryCode: 'DE',
      currency: 'EUR',
      salaryMinor: 8_500_000,
      updatedAt: CHANGED_AT,
    });
    expect(storedHistory()).toEqual([
      priyaStartingSalary,
      {
        id: 2,
        employeeId: 1,
        oldSalaryMinor: 324_000_000,
        oldCurrency: 'INR',
        newSalaryMinor: 8_500_000,
        currency: 'EUR',
        effectiveDate: TODAY,
        reason: 'Relocated to Berlin',
        createdAt: CHANGED_AT,
      },
    ]);
  });

  it('applies other detail changes together with a country change', () => {
    const { service } = setup();

    const relocated = service.updateDetails(1, { ...relocation, jobTitle: 'Staff Engineer' });

    expect(relocated).toMatchObject({
      countryCode: 'DE',
      currency: 'EUR',
      salaryMinor: 8_500_000,
      jobTitle: 'Staff Engineer',
    });
  });

  it('keeps the old country, currency and salary when the history row cannot be written', () => {
    const { service, storedPriya, storedHistory, failHistoryInserts } = setup();
    failHistoryInserts();

    expect(() => service.updateDetails(1, relocation)).toThrow('history insert failed');

    expect(storedPriya()).toEqual(priyaBefore);
    expect(storedHistory()).toEqual([priyaStartingSalary]);
  });

  it('rejects an email that another employee already uses, and changes nothing', () => {
    const { service, storedPriya } = setup();
    service.create(hansInput);

    const error = thrownBy(() =>
      service.updateDetails(1, { email: 'Hans.Becker@acme.test', jobTitle: 'Staff Engineer' }),
    );

    expect(error).toBeInstanceOf(EmailAlreadyInUseError);
    expect(error).toMatchObject({
      message: 'An employee with the email hans.becker@acme.test already exists',
    });
    expect(storedPriya()).toEqual(priyaBefore);
  });

  it('accepts the employee’s own current email', () => {
    const { service } = setup();

    const updated = service.updateDetails(1, {
      email: 'priya.sharma@acme.test',
      jobTitle: 'Staff Engineer',
    });

    expect(updated).toMatchObject({ email: 'priya.sharma@acme.test', jobTitle: 'Staff Engineer' });
  });

  it('rejects a hire date after the clock’s today, and changes nothing', () => {
    const { service, storedPriya } = setup();

    const error = thrownBy(() => service.updateDetails(1, { hireDate: DAY_AFTER_TODAY }));

    expect(error).toMatchObject({
      issues: [{ path: 'hireDate', message: 'Hire date cannot be in the future' }],
    });
    expect(storedPriya()).toEqual(priyaBefore);
  });

  it('throws EmployeeNotFoundError for an unknown id', () => {
    const { service } = setup();

    const error = thrownBy(() => service.updateDetails(999, { jobTitle: 'Staff Engineer' }));

    expect(error).toBeInstanceOf(EmployeeNotFoundError);
    expect(error).toMatchObject({ message: 'Employee 999 was not found' });
  });
});

describe('EmployeesService.remove', () => {
  it('deletes the employee and their salary history', () => {
    const { service, db } = setup();
    service.changeSalary(1, promotion);

    service.remove(1);

    expect(db.select().from(employees).all()).toEqual([]);
    expect(db.select().from(salaryChanges).all()).toEqual([]);
  });

  it('leaves other employees and their history in place', () => {
    const { service, db } = setup();
    const hans = service.create(hansInput);

    service.remove(1);

    expect(db.select().from(employees).all()).toEqual([hans]);
    expect(db.select().from(salaryChanges).all()).toMatchObject([
      { employeeId: hans.id, reason: 'Starting salary' },
    ]);
  });

  it('makes the employee unreadable afterwards', () => {
    const { service } = setup();

    service.remove(1);

    expect(thrownBy(() => service.getById(1))).toBeInstanceOf(EmployeeNotFoundError);
  });

  it('throws EmployeeNotFoundError for an unknown id', () => {
    const { service } = setup();

    const error = thrownBy(() => service.remove(999));

    expect(error).toBeInstanceOf(EmployeeNotFoundError);
    expect(error).toMatchObject({ message: 'Employee 999 was not found' });
  });

  it('throws EmployeeNotFoundError when the employee was already removed', () => {
    const { service } = setup();
    service.remove(1);

    expect(thrownBy(() => service.remove(1))).toBeInstanceOf(EmployeeNotFoundError);
  });
});
